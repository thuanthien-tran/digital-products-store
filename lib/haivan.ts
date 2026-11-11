/**
 * Hải Vân Kho Sỉ (Shop Bot API) Client
 * Official integration for https://webshop.haivankhosi.site
 *
 * Endpoints:
 * - GET  /api/balance               - Lấy số dư ví VND / USDT
 * - GET  /api/products?format=flat  - Lấy danh sách sản phẩm phẳng
 * - POST /api/buy                   - Mua sản phẩm tự động (tối đa 100/request)
 * - GET  /api/rate                  - Tỷ giá USDT/VND
 * - GET  /api/orders                - Lịch sử đơn hàng API
 */

import { prisma } from './db'
import { decryptSecret } from './crypto'

export interface HaiVanConfig {
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

export interface HaiVanBalanceData {
  success: boolean
  user_id?: number
  username?: string
  balance_vnd: number
  balance_usdt: number
}

export interface HaiVanProductItem {
  id: string
  name: string
  emoji_id?: string
  parent_id?: string
  menu_name?: string
  menu_path?: string[]
  price_vnd: number
  price_usdt?: number
  original_price_vnd?: number
  discount_vnd?: number
  discount_type?: string | null
  discount_value?: number
  promo_code?: string | null
  stock: number
  description?: string
}

export interface HaiVanOrderSummary {
  order_group?: string
  product?: string
  quantity?: number
  bonus?: number
  total_items?: number
  original_total_price?: number
  discount?: number
  discount_type?: string | null
  discount_value?: number
  promo_code?: string | null
  total_price?: number
  currency?: string
}

export interface HaiVanBuyResult {
  success: boolean
  order?: HaiVanOrderSummary
  items?: string[]
  new_balance?: number
  error?: string
  statusCode?: number
  isInsufficientBalance?: boolean
  isOutOfStock?: boolean
}

export function normalizeHaiVanUrl(url: string): string {
  return (url || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/docs$/i, '')
    .replace(/\/docs$/i, '')
    .replace(/\/+$/, '')
}

/**
 * Lấy cấu hình kết nối Hải Vân Kho Sỉ đang kích hoạt trong Database
 */
export async function getHaiVanActiveConnection(): Promise<{
  config: HaiVanConfig | null
  connectionId?: string
  error?: string
}> {
  try {
    const conn = await prisma.providerConnection.findFirst({
      where: {
        isEnabled: true,
        OR: [
          { provider: { in: ['haivan', 'shopbot'] } },
          { baseUrl: { contains: 'haivankhosi' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!conn) {
      return {
        config: null,
        error: 'Chưa cấu hình hoặc chưa kích hoạt kết nối đại lý Hải Vân Kho Sỉ trong hệ thống.',
      }
    }

    let apiKey = ''
    try {
      apiKey = decryptSecret(conn.apiKeyEncrypted)
    } catch {
      return {
        config: null,
        error: 'Không thể giải mã API Key của Hải Vân Kho Sỉ. Vui lòng cập nhật lại API Key.',
      }
    }

    return {
      config: {
        baseUrl: normalizeHaiVanUrl(conn.baseUrl),
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
 * GET /api/balance - Kiểm tra số dư ví Hải Vân Kho Sỉ
 */
export async function getHaiVanBalance(
  config: HaiVanConfig
): Promise<{ success: boolean; data?: HaiVanBalanceData; error?: string }> {
  const timeoutMs = config.timeoutMs || 8000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const base = normalizeHaiVanUrl(config.baseUrl)
    const res = await fetch(`${base}/api/balance`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timer)

    const body = await res.json().catch(() => null)
    if (!res.ok || !body || body.success === false) {
      return {
        success: false,
        error: body?.error || body?.message || `HaiVan API HTTP ${res.status}`,
      }
    }

    return {
      success: true,
      data: {
        success: true,
        user_id: body.user_id,
        username: body.username,
        balance_vnd: typeof body.balance_vnd === 'number' ? body.balance_vnd : 0,
        balance_usdt: typeof body.balance_usdt === 'number' ? body.balance_usdt : 0,
      },
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối Hải Vân Kho Sỉ'
    return { success: false, error: msg }
  }
}

/**
 * GET /api/products?format=flat - Lấy danh mục sản phẩm phẳng từ Hải Vân Kho Sỉ
 */
export async function getHaiVanProducts(
  config: HaiVanConfig
): Promise<{ success: boolean; products?: HaiVanProductItem[]; error?: string }> {
  const timeoutMs = config.timeoutMs || 10000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const base = normalizeHaiVanUrl(config.baseUrl)
    const res = await fetch(`${base}/api/products?format=flat`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timer)

    const body = await res.json().catch(() => null)
    if (!res.ok || !body || body.success === false) {
      return {
        success: false,
        error: body?.error || body?.message || `HaiVan API HTTP ${res.status}`,
      }
    }

    let items: HaiVanProductItem[] = []
    if (Array.isArray(body.products)) {
      items = body.products
    } else if (Array.isArray(body.menus)) {
      for (const menu of body.menus) {
        if (Array.isArray(menu?.products)) {
          for (const p of menu.products) {
            items.push({
              ...p,
              menu_name: p.menu_name || menu.name,
              menu_path: p.menu_path || menu.menu_path,
            })
          }
        }
      }
    }

    return { success: true, products: items }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối Hải Vân Kho Sỉ'
    return { success: false, error: msg }
  }
}

/**
 * POST /api/buy - Gửi lệnh mua sản phẩm tự động từ Hải Vân Kho Sỉ
 * Lưu ý tài liệu API: quantity tối đa mỗi request là 100.
 */
export async function buyHaiVanProduct(
  config: HaiVanConfig,
  params: {
    product_id: string
    quantity: number
    currency?: 'vnd' | 'usdt'
  }
): Promise<HaiVanBuyResult> {
  const timeoutMs = config.timeoutMs || 15000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    if (!params.product_id) {
      return { success: false, error: 'Thiếu product_id sản phẩm Hải Vân Kho Sỉ' }
    }
    const qty = Math.max(1, Math.min(100, Math.floor(params.quantity || 1)))

    const base = normalizeHaiVanUrl(config.baseUrl)
    const res = await fetch(`${base}/api/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        product_id: String(params.product_id),
        quantity: qty,
        currency: params.currency || 'vnd',
      }),
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timer)

    const body = await res.json().catch(() => null)
    if (!res.ok || !body || body.success === false) {
      const errorMsg =
        (typeof body?.error === 'string' && body.error) ||
        (typeof body?.message === 'string' && body.message) ||
        `HaiVan API HTTP ${res.status}`

      const isInsufficientBalance = /insufficient|balance|số dư|không đủ tiền|thiếu tiền/i.test(errorMsg)
      const isOutOfStock = /out of stock|hết hàng|không đủ hàng|stock|hết kho/i.test(errorMsg)

      return {
        success: false,
        error: errorMsg,
        statusCode: res.status,
        isInsufficientBalance,
        isOutOfStock,
      }
    }

    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : []
    const items = rawItems
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') return JSON.stringify(item)
        return String(item)
      })
      .filter(Boolean)

    if (items.length === 0) {
      return {
        success: false,
        error: 'API Hải Vân trả về thành công nhưng danh sách tài khoản/code (items) bị rỗng.',
      }
    }

    return {
      success: true,
      order: body.order,
      items,
      new_balance: typeof body.new_balance === 'number' ? body.new_balance : undefined,
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối khi mua hàng Hải Vân Kho Sỉ'
    return { success: false, error: msg }
  }
}

/**
 * GET /api/orders - Lấy lịch sử đơn hàng đã mua từ Hải Vân Kho Sỉ
 */
export async function getHaiVanOrders(
  config: HaiVanConfig
): Promise<{ success: boolean; orders?: any[]; error?: string }> {
  const timeoutMs = config.timeoutMs || 10000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const base = normalizeHaiVanUrl(config.baseUrl)
    const res = await fetch(`${base}/api/orders`, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timer)

    const body = await res.json().catch(() => null)
    if (!res.ok || !body || body.success === false) {
      return {
        success: false,
        error: body?.error || body?.message || `HaiVan API HTTP ${res.status}`,
      }
    }

    return {
      success: true,
      orders: Array.isArray(body.orders) ? body.orders : [],
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Lỗi lấy lịch sử đơn Hải Vân Kho Sỉ'
    return { success: false, error: msg }
  }
}
