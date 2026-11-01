import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'
import {
  updateSourceProductDraft,
  publishSourceProduct,
  unpublishSourceProduct,
  ignoreSourceProduct,
  restoreIgnoredSourceProduct,
  ConflictError,
  ValidationError,
} from '@/lib/source-product-service'

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
    const [sourceProduct, groups] = await Promise.all([
      prisma.sourceProduct.findUnique({
        where: { id },
        include: {
          product: {
            include: {
              group: true,
              variants: true,
            },
          },
        },
      }),
      prisma.productGroup.findMany({
        where: { visibility: 'public' },
        orderBy: { sortOrder: 'asc' },
      }),
    ])

    if (!sourceProduct) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm nguồn' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      sourceProduct,
      groups: groups.map((g) => ({ id: g.id, name: g.name })),
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

    const updated = await updateSourceProductDraft(id, body)
    return NextResponse.json({ success: true, sourceProduct: updated })
  } catch (err: unknown) {
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: err.message, code: 'CONFLICT' }, { status: 409 })
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
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
    const body = await req.json()
    const action = body.action as 'publish' | 'unpublish' | 'ignore' | 'restore'

    if (!action) {
      return NextResponse.json({ error: 'Thiếu trường action' }, { status: 400 })
    }

    let result
    if (action === 'publish') {
      result = await publishSourceProduct(id, auth.username || 'admin', {
        confirmBelowCost: Boolean(body.confirmBelowCost),
        expectedVersion: body.expectedVersion,
      })
    } else if (action === 'unpublish') {
      result = await unpublishSourceProduct(id, auth.username || 'admin')
    } else if (action === 'ignore') {
      result = await ignoreSourceProduct(id, auth.username || 'admin')
    } else if (action === 'restore') {
      result = await restoreIgnoredSourceProduct(id)
    } else {
      return NextResponse.json({ error: `Hành động "${action}" không hợp lệ` }, { status: 400 })
    }

    return NextResponse.json({ success: true, sourceProduct: result })
  } catch (err: unknown) {
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: err.message, code: 'CONFLICT' }, { status: 409 })
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const msg = err instanceof Error ? err.message : 'Lỗi xử lý hành động'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
