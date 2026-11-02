/**
 * Dino Store API v2 Client
 * Official integration for https://api.abcxy.store
 * 
 * Endpoints:
 * - GET  /api/v2/me                      - Kiểm tra API key, quyền hạn và số dư ví chung
 * - GET  /api/v2/catalog                 - Lấy danh mục sản phẩm từ Dino
 * - GET  /api/v2/orders                  - Lấy lịch sử đơn hàng API
 * - POST /api/v2/orders                  - Tạo đơn mua hàng tự động
 * - GET  /api/v2/orders/{order_code}     - Tra cứu đơn theo mã đơn Dino
 * - GET  /api/v2/orders/by-ref/{ref}     - Tra cứu đơn theo mã đối tác (partner_ref)
 */

import { prisma } from "./db"
import { decryptSecret } from "./crypto"

export interface DinoConfig {
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

export interface DinoMeData {
  version: string
  partner_name: string
  is_admin: boolean
  balance: number
  maintenance_mode: boolean
  rank_name: string
  rank_discount_percent: number
}

export interface DinoCatalogItem {
  product_id: string
  product_code?: string
  name: string
  price: number
  currency?: string
  description?: string
  duration?: string
  warranty?: string
  delivery_mode?: string
  stock_status?: string
  stock_count?: number | null
  stock?: number | null
  available?: boolean
  requires_gmail?: boolean
  image_url?: string
  has_image?: boolean
}

export interface DinoOrderItem {
  id?: string | number
  order_code?: string
  partner_ref?: string
  product_id?: string
  product_name?: string
  quantity?: number
  price?: number
  total_amount?: number
  status?: string
  delivery_mode?: string
  items?: Array<string | Record<string, any>>
  credentials?: Array<string | Record<string, any>>
  serials?: Array<string | Record<string, any>>
  created_at?: string | number
  updated_at?: string | number
  [key: string]: any
}

export interface DinoOrdersResponse {
  orders: DinoOrderItem[]
  pagination: {
    limit: number
    offset: number
    returned: number
    total: number
    has_more: boolean
  }
  filters?: {
    status?: string
    search?: string
  }
  partner_name?: string
  remaining_balance?: number
}

export interface DinoBuyParams {
  partner_ref: string
  product_id: string
  quantity: number
  email?: string
  customer_email?: string
  gmail?: string
}

export interface DinoBuyResult {
  success: boolean
  order?: DinoOrderItem
  credentials?: string[]
  error?: string
  statusCode?: number
  isInsufficientBalance?: boolean
  isOutOfStock?: boolean
}

/**
 * Lấy cấu hình kết nối Dino đang kích hoạt trong Database
 */
export async function getDinoActiveConnection(): Promise<{ config: DinoConfig | null; connectionId?: string; error?: string }> {
  try {
    const conn = await prisma.providerConnection.findFirst({
      where: {
        provider: "dino",
        isEnabled: true,
      },
      orderBy: { createdAt: "asc" },
    })

    if (!conn) {
      return { config: null, error: "Chưa cấu hình hoặc chưa kích hoạt kết nối đại lý Dino Store trong hệ thống." }
    }

    let apiKey = ""
    try {
      apiKey = decryptSecret(conn.apiKeyEncrypted)
    } catch {
      return { config: null, error: "Không thể giải mã API Key của Dino Store. Vui lòng cập nhật lại API Key." }
    }

    return {
      config: {
        baseUrl: conn.baseUrl.trim().replace(/\/+$/, ""),
        apiKey,
      },
      connectionId: conn.id,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Database error"
    return { config: null, error: msg }
  }
}

/**
 * GET /api/v2/me - Kiểm tra API Key và số dư ví chung Dino
 */
export async function getDinoMe(config: DinoConfig): Promise<{ success: boolean; data?: DinoMeData; error?: string }> {
  const timeoutMs = config.timeoutMs || 8000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${config.baseUrl}/api/v2/me`, {
      method: "GET",
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Dino API HTTP ${res.status}: ${errText}` }
    }

    const json = await res.json()
    if (!json.ok && json.success === false) {
      return { success: false, error: json.detail || json.message || json.error || "Lỗi phản hồi từ Dino" }
    }

    return { success: true, data: json.data || json }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi kết nối Dino API"
    return { success: false, error: msg }
  }
}

/**
 * GET /api/v2/catalog - Lấy danh mục sản phẩm từ Dino
 */
export async function getDinoCatalog(config: DinoConfig): Promise<{ success: boolean; catalog?: DinoCatalogItem[]; error?: string }> {
  const timeoutMs = config.timeoutMs || 10000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${config.baseUrl}/api/v2/catalog`, {
      method: "GET",
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Dino API HTTP ${res.status}: ${errText}` }
    }

    const json = await res.json()
    const d = json.data || json
    const rawItems = Array.isArray(d?.catalog)
      ? d.catalog
      : Array.isArray(d?.products)
      ? d.products
      : Array.isArray(d)
      ? d
      : []

    return { success: true, catalog: rawItems }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi kết nối Dino API"
    return { success: false, error: msg }
  }
}

/**
 * GET /api/v2/orders - Lấy danh sách lịch sử đơn hàng API Dino
 */
export async function getDinoOrders(
  config: DinoConfig,
  params?: { limit?: number; offset?: number; status?: string; search?: string }
): Promise<{ success: boolean; data?: DinoOrdersResponse; error?: string }> {
  const timeoutMs = config.timeoutMs || 10000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = new URL(`${config.baseUrl}/api/v2/orders`)
    if (params?.limit) url.searchParams.set("limit", String(params.limit))
    if (params?.offset !== undefined) url.searchParams.set("offset", String(params.offset))
    if (params?.status) url.searchParams.set("status", params.status)
    if (params?.search) url.searchParams.set("search", params.search)

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Dino API HTTP ${res.status}: ${errText}` }
    }

    const json = await res.json()
    return { success: true, data: json.data || json }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi kết nối Dino API"
    return { success: false, error: msg }
  }
}

/**
 * GET /api/v2/orders/{order_code} - Tra cứu đơn hàng theo mã đơn của Dino
 */
export async function getDinoOrderByCode(
  config: DinoConfig,
  orderCode: string
): Promise<{ success: boolean; order?: DinoOrderItem; error?: string }> {
  const timeoutMs = config.timeoutMs || 8000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const cleanCode = encodeURIComponent(orderCode.trim())
    const res = await fetch(`${config.baseUrl}/api/v2/orders/${cleanCode}`, {
      method: "GET",
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Dino API HTTP ${res.status}: ${errText}` }
    }

    const json = await res.json()
    return { success: true, order: json.data || json }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi tra cứu đơn Dino"
    return { success: false, error: msg }
  }
}

/**
 * GET /api/v2/orders/by-ref/{partner_ref} - Tra cứu đơn theo mã đối tác của shop mình
 */
export async function getDinoOrderByRef(
  config: DinoConfig,
  partnerRef: string
): Promise<{ success: boolean; order?: DinoOrderItem; error?: string }> {
  const timeoutMs = config.timeoutMs || 8000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const cleanRef = encodeURIComponent(partnerRef.trim())
    const res = await fetch(`${config.baseUrl}/api/v2/orders/by-ref/${cleanRef}`, {
      method: "GET",
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Dino API HTTP ${res.status}: ${errText}` }
    }

    const json = await res.json()
    return { success: true, order: json.data || json }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi tra cứu đơn Dino theo mã tham chiếu"
    return { success: false, error: msg }
  }
}

/**
 * Trích xuất danh sách serial / tài khoản bàn giao từ phản hồi đơn hàng của Dino
 */
export function extractDinoCredentials(orderData: any): string[] {
  if (!orderData || typeof orderData !== "object") return []

  // Case 1: items array
  const rawList = Array.isArray(orderData.items)
    ? orderData.items
    : Array.isArray(orderData.credentials)
    ? orderData.credentials
    : Array.isArray(orderData.serials)
    ? orderData.serials
    : Array.isArray(orderData.accounts)
    ? orderData.accounts
    : []

  if (rawList.length > 0) {
    return rawList.map((item: any) => {
      if (typeof item === "string") return item
      if (item && typeof item === "object") {
        return (
          item.content ||
          item.serial ||
          item.code ||
          item.account ||
          item.key ||
          item.data ||
          JSON.stringify(item)
        )
      }
      return String(item)
    }).filter(Boolean)
  }

  // Case 2: single credential field
  if (typeof orderData.content === "string" && orderData.content.trim()) return [orderData.content.trim()]
  if (typeof orderData.serial === "string" && orderData.serial.trim()) return [orderData.serial.trim()]
  if (typeof orderData.code === "string" && orderData.code.trim()) return [orderData.code.trim()]
  if (typeof orderData.account === "string" && orderData.account.trim()) return [orderData.account.trim()]

  return []
}

/**
 * POST /api/v2/orders - Đặt mua sản phẩm tự động qua Dino API
 */
export async function buyDinoProduct(
  config: DinoConfig,
  params: DinoBuyParams
): Promise<DinoBuyResult> {
  const timeoutMs = config.timeoutMs || 15000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const payload: Record<string, any> = {
      partner_ref: params.partner_ref,
      product_id: params.product_id,
      quantity: params.quantity,
    }

    if (params.email || params.customer_email || params.gmail) {
      const email = params.email || params.customer_email || params.gmail
      payload.email = email
      payload.customer_email = email
      payload.gmail = email
    }

    const res = await fetch(`${config.baseUrl}/api/v2/orders`, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    })

    clearTimeout(timer)

    const rawText = await res.text()
    let data: any
    try {
      data = JSON.parse(rawText)
    } catch {
      return {
        success: false,
        statusCode: res.status,
        error: `Phản hồi từ Dino không phải JSON (HTTP ${res.status}): ${rawText.slice(0, 150)}`,
      }
    }

    if (!res.ok) {
      const detail = data?.detail || data?.message || data?.error || rawText
      const isInsufficientBalance = res.status === 402 || /insufficient balance/i.test(detail)
      const isOutOfStock = res.status === 404 || /out_of_stock|hết hàng/i.test(detail)

      return {
        success: false,
        statusCode: res.status,
        error: detail,
        isInsufficientBalance,
        isOutOfStock,
      }
    }

    const orderData = data?.data || data
    const credentials = extractDinoCredentials(orderData)

    return {
      success: true,
      statusCode: res.status,
      order: orderData,
      credentials,
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Network error"
    return {
      success: false,
      error: `Lỗi kết nối Dino API: ${msg}`,
    }
  }
}
