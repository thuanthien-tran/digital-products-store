import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/auth'
import { runFatcatCatalogSync } from '@/lib/fatcat-sync-service'

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const result = await runFatcatCatalogSync({ actorUsername: auth.username })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi đồng bộ'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
