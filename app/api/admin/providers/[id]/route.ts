import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'
import { encryptSecret, maskApiKey } from '@/lib/crypto'
import { getProviderAdapter } from '@/lib/providers/registry'

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
    const connection = await prisma.providerConnection.findUnique({
      where: { id },
      include: {
        _count: {
          select: { sourceProducts: true, variants: true },
        },
      },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Không tìm thấy kết nối' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        provider: connection.provider,
        baseUrl: connection.baseUrl,
        apiKeyMasked: connection.apiKeyMasked,
        isEnabled: connection.isEnabled,
        balanceVnd: connection.balanceVnd ?? 0,
        balanceUsdt: connection.balanceUsdt ?? 0,
        lastSyncedAt: connection.lastSyncedAt,
        lastSyncStatus: connection.lastSyncStatus,
        lastSyncError: connection.lastSyncError,
        sourceCount: connection._count.sourceProducts,
        variantCount: connection._count.variants,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy thông tin kết nối'
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
    const { name, baseUrl, apiKey, isEnabled } = body

    const existing = await prisma.providerConnection.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy kết nối' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name.trim()
    if (isEnabled !== undefined) updateData.isEnabled = Boolean(isEnabled)

    if (baseUrl !== undefined) {
      const adapter = getProviderAdapter(existing.provider)
      const hostCheck = adapter.validateHost(baseUrl)
      if (!hostCheck.valid) {
        return NextResponse.json({ error: hostCheck.error || 'URL API không hợp lệ' }, { status: 400 })
      }
      updateData.baseUrl = baseUrl.trim().replace(/\/+$/, '')
    }

    // Only update key if user actually typed a new key (not empty or masked placeholder)
    if (apiKey && !apiKey.includes('••••')) {
      const trimmedKey = String(apiKey).trim()
      updateData.apiKeyEncrypted = encryptSecret(trimmedKey)
      updateData.apiKeyMasked = maskApiKey(trimmedKey)
    }

    const updated = await prisma.providerConnection.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      connection: {
        id: updated.id,
        name: updated.name,
        provider: updated.provider,
        baseUrl: updated.baseUrl,
        apiKeyMasked: updated.apiKeyMasked,
        isEnabled: updated.isEnabled,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi cập nhật kết nối'
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
    await prisma.providerConnection.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Đã xóa kết nối thành công' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi xóa kết nối'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
