import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'

interface Params {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/products/[id]/featured
 * Toggles or updates the isFeatured flag for a single product with atomic concurrency protection.
 * Strictly enforces a hard maximum of 6 featured products (including drafts and hidden items).
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized: Quyền quản trị viên là bắt buộc' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await req.json().catch(() => null)

    if (!body || typeof body.isFeatured !== 'boolean') {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ: isFeatured bắt buộc và phải là kiểu boolean (true/false)' },
        { status: 400 }
      )
    }

    const targetIsFeatured: boolean = body.isFeatured

    // Atomic transaction ensures concurrency safety when multiple admin requests hit at the same time
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        select: { id: true, name: true, isFeatured: true, slug: true, visibility: true, editorialStatus: true },
      })

      if (!existing) {
        throw new Error('PRODUCT_NOT_FOUND')
      }

      if (targetIsFeatured) {
        if (existing.editorialStatus !== 'published' || existing.visibility !== 'public') {
          throw new Error('PRODUCT_NOT_PUBLISHED')
        }
      }

      // If turning ON featured, check that total featured count won't exceed 6
      if (targetIsFeatured && !existing.isFeatured) {
        const currentFeaturedCount = await tx.product.count({
          where: {
            isFeatured: true,
            editorialStatus: 'published',
            visibility: 'public',
          },
        })

        if (currentFeaturedCount >= 6) {
          throw new Error('FEATURED_LIMIT_EXCEEDED')
        }
      }

      const updated = await tx.product.update({
        where: { id },
        data: { isFeatured: targetIsFeatured },
        select: { id: true, name: true, isFeatured: true, slug: true },
      })

      const totalFeatured = await tx.product.count({
        where: {
          isFeatured: true,
          editorialStatus: 'published',
          visibility: 'public',
        },
      })

      return { product: updated, featuredCount: totalFeatured }
    })

    // Revalidate storefront cache immediately
    try {
      revalidatePath('/', 'layout')
      revalidatePath('/')
      if (result.product.slug) {
        revalidatePath(`/product/${result.product.slug}`)
      }
    } catch {}

    return NextResponse.json({
      success: true,
      product: result.product,
      featuredCount: result.featuredCount,
    })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'PRODUCT_NOT_FOUND') {
        return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 })
      }
      if (err.message === 'PRODUCT_NOT_PUBLISHED') {
        return NextResponse.json(
          { error: 'Chỉ có thể chọn nổi bật cho sản phẩm đang đăng bán công khai trên website.' },
          { status: 400 }
        )
      }
      if (err.message === 'FEATURED_LIMIT_EXCEEDED') {
        return NextResponse.json(
          {
            error:
              'Đã đạt giới hạn tối đa 6 sản phẩm nổi bật trên trang chủ. Vui lòng bỏ chọn bớt sản phẩm khác trước khi thêm mới.',
          },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Lỗi máy chủ không xác định' }, { status: 500 })
  }
}
