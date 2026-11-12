/**
 * ShopXoaiNon (Shop Xoài Non API v1) Client
 * Official integration for https://shopxoainon.online/api/v1
 *
 * Endpoints:
 * - GET  /me                      - Thông tin tài khoản API
 * - GET  /wallet/balance          - Số dư ví Telegram
 * - GET  /products                - Danh sách sản phẩm
 * - GET  /products/{id}           - Chi tiết sản phẩm
 * - POST /products/{id}/quote     - Báo giá & tồn kho realtime
 * - POST /orders                  - Mua sản phẩm tự động qua ví
 * - GET  /orders/{id}             - Trạng thái đơn hàng
 * - GET  /orders/{id}/delivery    - Lấy thông tin tài khoản đã giao
 */

import { prisma } from './db'
import { decryptSecret } from './crypto'

export interface ShopXoaiNonConfig {
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

export interface ShopXoaiNonMeData {
  id: number
  name: string
  customer?: {
    telegram_id?: string
    username?: string
    first_name?: string
  }
}

export interface ShopXoaiNonProductVariant {
  id: string
  title: string
  description?: string
  manual_upgrade?: boolean
  prices?: {
    vnd?: number
    [key: string]: any
  }
  in_stock: boolean
  available_quantity: number
}

export interface ShopXoaiNonProduct {
  id: string
  title: string
  in_stock: boolean
  variants: ShopXoaiNonProductVariant[]
}

export interface ShopXoaiNonBuyResult {
  success: boolean
  order?: any
  items?: string[]
  error?: string
  statusCode?: number
  isInsufficientBalance?: boolean
  isOutOfStock?: boolean
}

/**
 * Lấy cấu hình kết nối ShopXoaiNon đang kích hoạt trong Database
 */
export async function getShopXoaiNonActiveConnection(): Promise<{
  config: ShopXoaiNonConfig | null
  connectionId?: string
  error?: string
}> {
  try {
    const conn = await prisma.providerConnection.findFirst({
      where: {
        provider: { in: ['shopxoainon', 'xoainon'] },
        isEnabled: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!conn) {
      return {
        config: null,
        error: 'Chưa cấu hình hoặc chưa kích hoạt kết nối đại lý Shop Xoài Non trong hệ thống.',
      }
    }

    let apiKey = ''
    try {
      apiKey = decryptSecret(conn.apiKeyEncrypted)
    } catch {
      return {
        config: null,
        error: 'Không thể giải mã API Key của Shop Xoài Non. Vui lòng cập nhật lại API Key.',
      }
    }

    return {
      config: {
        baseUrl: conn.baseUrl.trim().replace(/\/+$/, ''),
        apiKey,
      },
      connectionId: conn.id,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error'
    return { config: null, error: msg }
  }
}

/**
 * GET /wallet/balance - Lấy số dư ví ShopXoaiNon
 */
export async function getShopXoaiNonBalance(
  config: ShopXoaiNonConfig
): Promise<{ success: boolean; balanceVnd?: number; me?: ShopXoaiNonMeData; error?: string }> {
  const timeoutMs = config.timeoutMs || 8000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const [resBal, resMe] = await Promise.all([
      fetch(`${config.baseUrl}/wallet/balance`, {
        method: 'GET',
        headers: {
          'x-api-key': config.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
        cache: 'no-store',
      }),
      fetch(`${config.baseUrl}/me`, {
        method: 'GET',
        headers: {
          'x-api-key': config.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
        cache: 'no-store',
      }),
    ])

    clearTimeout(timer)

    if (!resBal.ok) {
      return {
        success: false,
        error: `ShopXoaiNon API HTTP ${resBal.status} (Kiểm tra lại API Key)`,
      }
    }

    const jsonBal = await resBal.json().catch(() => null)
    const jsonMe = resMe.ok ? await resMe.json().catch(() => null) : null

    const balanceVnd =
      typeof jsonBal?.data?.vnd === 'number'
        ? jsonBal.data.vnd
        : typeof jsonBal?.vnd === 'number'
        ? jsonBal.vnd
        : 0

    return {
      success: true,
      balanceVnd,
      me: jsonMe?.data || jsonMe,
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối ShopXoaiNon'
    return { success: false, error: msg }
  }
}

/**
 * GET /products - Lấy danh mục sản phẩm từ ShopXoaiNon
 */
export async function getShopXoaiNonProducts(
  config: ShopXoaiNonConfig
): Promise<{ success: boolean; products?: ShopXoaiNonProduct[]; error?: string }> {
  const timeoutMs = config.timeoutMs || 10000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${config.baseUrl}/products`, {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timer)

    if (!res.ok) {
      return {
        success: false,
        error: `ShopXoaiNon HTTP ${res.status}`,
      }
    }

    const json = await res.json().catch(() => null)
    const list: ShopXoaiNonProduct[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : []

    return { success: true, products: list }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối ShopXoaiNon'
    return { success: false, error: msg }
  }
}

/**
 * POST /orders - Mua sản phẩm tự động qua API ShopXoaiNon
 */
export async function buyShopXoaiNonProduct(
  config: ShopXoaiNonConfig,
  params: {
    variantId: string
    quantity: number
    idempotencyKey: string
  }
): Promise<ShopXoaiNonBuyResult> {
  const timeoutMs = config.timeoutMs || 15000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const qty = Math.max(1, Math.floor(params.quantity || 1))
    const res = await fetch(`${config.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Idempotency-Key': params.idempotencyKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        items: [{ variant_id: params.variantId, quantity: qty }],
        currency_code: 'vnd',
        payment_method: 'wallet',
      }),
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timer)

    const rawJson = await res.json().catch(() => null)
    if (!res.ok) {
      const errMsg =
        rawJson?.error ||
        rawJson?.message ||
        (Array.isArray(rawJson?.details) ? JSON.stringify(rawJson.details) : '') ||
        `ShopXoaiNon HTTP ${res.status}`

      const isInsufficientBalance = res.status === 400 && /tiền|balance|không đủ|thiếu/i.test(errMsg)
      const isOutOfStock = res.status === 400 && /hết hàng|stock|out of stock/i.test(errMsg)

      return {
        success: false,
        error: errMsg,
        statusCode: res.status,
        isInsufficientBalance,
        isOutOfStock,
      }
    }

    const orderData = rawJson?.data || rawJson
    const orderId = orderData?.id || orderData?.order_id

    // Lấy thông tin tài khoản đã giao qua /orders/{id}/delivery
    let deliveryItems: string[] = []
    if (orderId) {
      try {
        const delRes = await fetch(`${config.baseUrl}/orders/${orderId}/delivery`, {
          method: 'GET',
          headers: {
            'x-api-key': config.apiKey,
            Accept: 'application/json',
          },
          cache: 'no-store',
        })
        if (delRes.ok) {
          const delJson = await delRes.json().catch(() => null)
          const rawAccounts = delJson?.data?.items || delJson?.data || delJson?.items || []
          if (Array.isArray(rawAccounts)) {
            deliveryItems = rawAccounts.map((a: any) => {
              if (typeof a === 'string') return a
              if (a?.content) return a.content
              if (a?.account) return a.account
              if (a?.email && a?.password) return `${a.email}|${a.password}${a.two_factor ? `|${a.two_factor}` : ''}`
              return JSON.stringify(a)
            })
          }
        }
      } catch (delErr) {
        console.error('[ShopXoaiNon delivery fetch error]', delErr)
      }
    }

    return {
      success: true,
      order: orderData,
      items: deliveryItems.length > 0 ? deliveryItems : [orderData?.code || `Order #${orderId}`],
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Lỗi mua hàng ShopXoaiNon'
    return { success: false, error: msg }
  }
}
