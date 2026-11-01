import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'
import { decryptSecret } from '@/lib/crypto'
import { getProviderAdapter } from '@/lib/providers/registry'

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
    const connection = await prisma.providerConnection.findUnique({ where: { id } })
    if (!connection) {
      return NextResponse.json({ ok: false, success: false, error: 'Không tìm thấy kết nối' }, { status: 404 })
    }

    let apiKey = ''
    try {
      apiKey = decryptSecret(connection.apiKeyEncrypted)
    } catch {
      return NextResponse.json({ ok: false, success: false, error: 'Không thể giải mã khóa bí mật' }, { status: 500 })
    }

    const adapter = getProviderAdapter(connection.provider)
    const testRes = await adapter.testConnection({
      baseUrl: connection.baseUrl,
      apiKey,
      provider: connection.provider,
    })

    if (!testRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          connectionId: id,
          connectionName: connection.name,
          error: testRes.error || 'Kiểm tra kết nối thất bại',
        },
        { status: 400 }
      )
    }

    if (testRes.balanceVnd !== undefined && testRes.balanceVnd !== null) {
      await prisma.providerConnection.update({
        where: { id },
        data: {
          balanceVnd: testRes.balanceVnd,
          balanceUsdt: testRes.balanceUsdt ?? 0,
        },
      })
    }

    return NextResponse.json({
      ok: true,
      success: true,
      connectionId: id,
      connectionName: connection.name,
      balanceVnd: testRes.balanceVnd ?? 0,
      balanceUsdt: testRes.balanceUsdt ?? 0,
      balanceStatus: testRes.balanceStatus || (testRes.balanceVnd !== undefined && testRes.balanceVnd !== null ? 'supported' : 'unsupported'),
      message: 'Kết nối thành công! Khóa API và máy chủ đại lý hợp lệ.',
      checkedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kiểm tra kết nối'
    return NextResponse.json({ ok: false, success: false, error: msg }, { status: 500 })
  }
}
