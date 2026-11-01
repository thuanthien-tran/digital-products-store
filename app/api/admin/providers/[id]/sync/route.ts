import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/auth'
import { syncProviderConnection } from '@/lib/sync-engine'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ ok: false, success: false, error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const { id } = await params
    const result = await syncProviderConnection(id, { actorUsername: auth.username })

    const responsePayload = {
      ok: result.success,
      ...result,
    }

    if (!result.success) {
      return NextResponse.json(responsePayload, { status: 400 })
    }

    return NextResponse.json(responsePayload)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi đồng bộ đại lý'
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 })
  }
}
