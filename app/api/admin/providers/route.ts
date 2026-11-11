import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'
import { encryptSecret, maskApiKey } from '@/lib/crypto'
import { getProviderAdapter, normalizeProviderBaseUrl, resolveEffectiveProvider } from '@/lib/providers/registry'

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const connections = await prisma.providerConnection.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            sourceProducts: true,
            variants: true,
          },
        },
      },
    })

    // Mask sensitive fields - NEVER return encrypted or raw key to client
    const safeConnections = connections.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      baseUrl: c.baseUrl,
      apiKeyMasked: c.apiKeyMasked || maskApiKey('example_key'),
      isEnabled: c.isEnabled,
      balanceVnd: c.balanceVnd ?? 0,
      balanceUsdt: c.balanceUsdt ?? 0,
      lastSyncedAt: c.lastSyncedAt,
      lastSyncStatus: c.lastSyncStatus,
      lastSyncError: c.lastSyncError,
      sourceCount: c._count.sourceProducts,
      variantCount: c._count.variants,
      createdAt: c.createdAt,
    }))

    return NextResponse.json({ success: true, connections: safeConnections })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy danh sách kết nối'
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
    const { name, provider, baseUrl, apiKey, isEnabled } = body

    if (!name || !provider || !baseUrl || !apiKey) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ tên, loại nhà cung cấp, URL API và API key' }, { status: 400 })
    }

    const cleanBaseUrl = normalizeProviderBaseUrl(String(baseUrl))
    const effectiveProvider = resolveEffectiveProvider(String(provider), cleanBaseUrl)
    const adapter = getProviderAdapter(effectiveProvider, cleanBaseUrl)
    const hostCheck = adapter.validateHost(cleanBaseUrl)
    if (!hostCheck.valid) {
      return NextResponse.json({ error: hostCheck.error || 'Địa chỉ URL API không hợp lệ hoặc không thuộc danh sách cho phép' }, { status: 400 })
    }

    const rawApiKey = String(apiKey).trim()
    const apiKeyEncrypted = encryptSecret(rawApiKey)
    const apiKeyMasked = maskApiKey(rawApiKey)

    const newConnection = await prisma.providerConnection.create({
      data: {
        name: name.trim(),
        provider: effectiveProvider,
        baseUrl: cleanBaseUrl,
        apiKeyEncrypted,
        apiKeyMasked,
        isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
      },
    })

    return NextResponse.json({
      success: true,
      connection: {
        id: newConnection.id,
        name: newConnection.name,
        provider: newConnection.provider,
        baseUrl: newConnection.baseUrl,
        apiKeyMasked: newConnection.apiKeyMasked,
        isEnabled: newConnection.isEnabled,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi tạo kết nối'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
