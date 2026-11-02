import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/auth'
import {
  getDinoActiveConnection,
  getDinoMe,
  getDinoCatalog,
  getDinoOrders,
  getDinoOrderByCode,
  getDinoOrderByRef,
  buyDinoProduct,
} from '@/lib/dino'

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') || 'me'

    const { config, error: connError } = await getDinoActiveConnection()
    if (!config) {
      return NextResponse.json({ error: connError || 'Chưa cấu hình Dino Store' }, { status: 400 })
    }

    if (action === 'me') {
      const res = await getDinoMe(config)
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 502 })
      }
      return NextResponse.json({ success: true, data: res.data })
    }

    if (action === 'catalog') {
      const res = await getDinoCatalog(config)
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 502 })
      }
      return NextResponse.json({ success: true, catalog: res.catalog })
    }

    if (action === 'orders') {
      const limit = parseInt(searchParams.get('limit') || '20', 10)
      const offset = parseInt(searchParams.get('offset') || '0', 10)
      const status = searchParams.get('status') || undefined
      const search = searchParams.get('search') || undefined

      const res = await getDinoOrders(config, { limit, offset, status, search })
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 502 })
      }
      return NextResponse.json({ success: true, data: res.data })
    }

    if (action === 'order-by-code') {
      const code = searchParams.get('code')
      if (!code) {
        return NextResponse.json({ error: 'Thiếu mã đơn hàng Dino (code)' }, { status: 400 })
      }
      const res = await getDinoOrderByCode(config, code)
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 502 })
      }
      return NextResponse.json({ success: true, order: res.order })
    }

    if (action === 'order-by-ref') {
      const ref = searchParams.get('ref')
      if (!ref) {
        return NextResponse.json({ error: 'Thiếu mã tham chiếu đối tác (ref)' }, { status: 400 })
      }
      const res = await getDinoOrderByRef(config, ref)
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 502 })
      }
      return NextResponse.json({ success: true, order: res.order })
    }

    return NextResponse.json({ error: `Hành động không hợp lệ: ${action}` }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Dino API Handler Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const body = await req.json()
    const { action, partner_ref, product_id, quantity, email } = body

    const { config, error: connError } = await getDinoActiveConnection()
    if (!config) {
      return NextResponse.json({ error: connError || 'Chưa cấu hình Dino Store' }, { status: 400 })
    }

    if (action === 'buy') {
      if (!partner_ref || !product_id || !quantity) {
        return NextResponse.json(
          { error: 'Bắt buộc điền partner_ref, product_id và quantity' },
          { status: 400 }
        )
      }

      const res = await buyDinoProduct(config, {
        partner_ref,
        product_id,
        quantity: Number(quantity),
        email,
      })

      if (!res.success) {
        return NextResponse.json(
          {
            error: res.error,
            isInsufficientBalance: res.isInsufficientBalance,
            isOutOfStock: res.isOutOfStock,
          },
          { status: res.statusCode || 400 }
        )
      }

      return NextResponse.json({ success: true, order: res.order, credentials: res.credentials })
    }

    return NextResponse.json({ error: `Hành động POST không hợp lệ: ${action}` }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Dino API Handler Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
