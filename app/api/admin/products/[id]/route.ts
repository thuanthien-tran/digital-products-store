import { NextResponse } from 'next/server'
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
      return NextResponse.json({ success: true, product: published })
    } else if (action === 'hide') {
      const hidden = await hideProductFromStore(id, auth.username || 'admin')
      return NextResponse.json({ success: true, product: hidden })
    } else {
      return NextResponse.json({ error: `Hành động "${action}" không hợp lệ` }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi thao tác sản phẩm'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
