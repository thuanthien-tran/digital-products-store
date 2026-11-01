import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/auth'
import { addSourceProductsToStore } from '@/lib/product-catalog-service'

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const body = await req.json()
    const { sourceProductIds } = body

    if (!Array.isArray(sourceProductIds) || sourceProductIds.length === 0) {
      return NextResponse.json({ error: 'Vui lòng chọn ít nhất một sản phẩm nguồn' }, { status: 400 })
    }

    const result = await addSourceProductsToStore(sourceProductIds, auth.username)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi thêm sản phẩm vào kho bán'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
