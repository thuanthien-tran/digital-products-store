import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/auth'
import { getProviderAdapter } from '@/lib/providers/registry'

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ ok: false, success: false, error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const body = await req.json()
    const { provider, baseUrl, apiKey } = body

    if (!provider || !baseUrl || !apiKey) {
      return NextResponse.json(
        { ok: false, success: false, error: 'Vui lòng nhập đầy đủ loại nhà cung cấp, URL API và API key' },
        { status: 400 }
      )
    }

    const adapter = getProviderAdapter(provider)
    const hostCheck = adapter.validateHost(baseUrl)
    if (!hostCheck.valid) {
      return NextResponse.json({ ok: false, success: false, error: hostCheck.error || 'Địa chỉ URL API không hợp lệ' }, { status: 400 })
    }

    // 1. Test connection & balance
    const testRes = await adapter.testConnection({
      provider,
      baseUrl: String(baseUrl).trim().replace(/\/+$/, ''),
      apiKey: String(apiKey).trim(),
      timeoutMs: 8000,
    })

    if (!testRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: testRes.error || 'Kiểm tra kết nối thất bại',
        },
        { status: 400 }
      )
    }

    // 2. Quick test catalog detection
    let productCount = 0
    try {
      const catRes = await adapter.fetchCatalog({
        provider,
        baseUrl: String(baseUrl).trim().replace(/\/+$/, ''),
        apiKey: String(apiKey).trim(),
        timeoutMs: 10000,
      })
      if (catRes.ok && catRes.products) {
        productCount = catRes.products.length
      }
    } catch {
      // Catalog probe error is non-fatal for basic connection check
    }

    return NextResponse.json({
      ok: true,
      success: true,
      balanceVnd: testRes.balanceVnd ?? 0,
      balanceUsdt: testRes.balanceUsdt ?? 0,
      balanceStatus: testRes.balanceStatus || 'supported',
      productCount,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kiểm tra kết nối'
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 })
  }
}
