import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'
import { updateProductDetails, publishProductToStore, hideProductFromStore } from '@/lib/product-catalog-service'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const { id } = await params
    const [product, groups, connections] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
        include: {
          group: true,
          variants: {
            include: {
              connection: {
                select: { id: true, name: true, provider: true },
              },
              sourceProduct: true,
              _count: {
                select: { serials: { where: { status: 'available' } } },
              },
            },
          },
          sourceProduct: true,
        },
      }),
      prisma.productGroup.findMany({
        where: { visibility: 'public' },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.providerConnection.findMany({
        where: { isEnabled: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, provider: true },
      }),
    ])

    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      product,
      groups,
      connections,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy thông tin sản phẩm'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()

    const result = await updateProductDetails(id, body, auth.username)
    try {
      revalidatePath('/', 'layout')
      revalidatePath('/')
      if (result.product?.slug) {
        revalidatePath(`/product/${result.product.slug}`)
      }
    } catch {}
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi cập nhật sản phẩm'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'publish'

    if (action === 'publish') {
      const published = await publishProductToStore(id, auth.username || 'admin', {
        confirmBelowCost: Boolean(body.confirmBelowCost),
      })
      try {
        revalidatePath('/', 'layout')
        revalidatePath('/')
        if (published.slug) revalidatePath(`/product/${published.slug}`)
      } catch {}
      return NextResponse.json({ success: true, product: published })
    } else if (action === 'hide') {
      const hidden = await hideProductFromStore(id, auth.username || 'admin')
      try {
        revalidatePath('/', 'layout')
        revalidatePath('/')
        if (hidden.slug) revalidatePath(`/product/${hidden.slug}`)
      } catch {}
      return NextResponse.json({ success: true, product: hidden })
    } else {
      return NextResponse.json({ error: `Hành động "${action}" không hợp lệ` }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi thao tác sản phẩm'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const { id } = await params
    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm cần xóa' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // 1. Reset liên kết sourceProduct nếu có
      await tx.sourceProduct.updateMany({
        where: { productId: id },
        data: { productId: null, variantId: null, isAddedToStore: false, editorialStatus: 'draft' },
      })

      // 2. Xóa các serial thuộc các biến thể của sản phẩm
      await tx.serial.deleteMany({
        where: { variant: { productId: id } },
      })

      // 3. Xóa các mục orderItem liên kết với sản phẩm này
      await tx.orderItem.deleteMany({
        where: { productId: id },
      })

      // 4. Xóa các biến thể của sản phẩm
      await tx.variant.deleteMany({
        where: { productId: id },
      })

      // 5. Xóa sản phẩm
      await tx.product.delete({
        where: { id },
      })
    })

    try {
      revalidatePath('/', 'layout')
      revalidatePath('/')
      if (product.slug) revalidatePath(`/product/${product.slug}`)
    } catch {}

    return NextResponse.json({ success: true, message: 'Đã xóa vĩnh viễn sản phẩm thành công' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi xóa sản phẩm'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
