/**
 * ShopTool Giá Rẻ API Client
 * Official integration for https://shoptoolgiare.com
 * 
 * Endpoints:
 * - GET  /api/v1/account         - Kiểm tra tài khoản, số dư ví và số Credit Buff
 * - GET  /api/v1/products        - Lấy danh mục sản phẩm & dịch vụ Buff
 * - POST /api/v1/buff/check      - Kiểm tra tính hợp lệ trước khi buff
 * - POST /api/v1/buff/credit     - Đặt đơn buff bằng Credit (0đ)
 * - POST /api/v1/buff/wallet     - Đặt đơn buff bằng tiền ví VND
 * - POST /api/v1/buy             - Mua tài khoản có sẵn bằng tiền ví
 * - GET  /api/v1/buff/status     - Tra cứu tiến độ đơn buff
 */

import { prisma } from "./db"
import { decryptSecret } from "./crypto"

export interface ShopToolConfig {
  baseUrl: string
  apiKey: string
  telegramId?: string | number
  timeoutMs?: number
}

export interface ShopToolUserData {
  telegram_id: number | string
  username: string
  balance: number
  balance_formatted?: string
  buff_credits: number
  buff_credits_formatted?: string
  status?: string
  can_use_api?: boolean
  can_buff_by_credit?: boolean
  max_buff_by_credit_b?: number
  can_buff_by_wallet?: boolean
  max_buff_by_wallet_b?: number
  buff_unit_price?: number
  unit_price?: number
}

export interface ShopToolProductItem {
  code: string
  name: string
  price: number
  price_formatted?: string
  price_vnd?: number
  unit_price?: number
  is_buff?: boolean
  stock_available?: number | string
  is_selling_paused?: boolean
  description?: string
  has_discount?: boolean
  tiered_pricing?: {
    regular_price?: number
    discount_price?: number
    min_qty?: number
    tier_desc?: string
  }
}

export interface ShopToolBuffResult {
  success: boolean
  order_code?: string
  orderCode?: string
  used_method?: "credit" | "wallet"
  message?: string
  error?: string
  isInsufficientBalance?: boolean
  isInsufficientCredits?: boolean
}

export interface ShopToolBuyResult {
  success: boolean
  order_code?: string
  credentials?: string[]
  message?: string
  error?: string
  isInsufficientBalance?: boolean
}

/**
 * Lấy cấu hình kết nối ShopTool đang kích hoạt trong Database
 */
export async function getShopToolActiveConnection(): Promise<{ config: ShopToolConfig | null; connectionId?: string; error?: string }> {
  try {
    const conn = await prisma.providerConnection.findFirst({
      where: {
        provider: { in: ["shoptool", "shoptoolgiare"] },
        isEnabled: true,
      },
      orderBy: { createdAt: "asc" },
    })

    if (!conn) {
      return { config: null, error: "Chưa cấu hình hoặc chưa kích hoạt kết nối đại lý ShopTool Giá Rẻ trong hệ thống." }
    }

    let apiKey = ""
    try {
      apiKey = decryptSecret(conn.apiKeyEncrypted)
    } catch {
      return { config: null, error: "Không thể giải mã API Key của ShopTool Giá Rẻ. Vui lòng cập nhật lại API Key." }
    }

    const cleanBase = conn.baseUrl.trim().replace(/\/+$/, "")
    const baseUrl = cleanBase.endsWith("/api/v1") ? cleanBase : `${cleanBase}/api/v1`

    return {
      config: {
        baseUrl,
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
 * GET /api/v1/account - Kiểm tra tài khoản, số dư tiền và số Credit Buff
 */
export async function getShopToolAccount(config: ShopToolConfig): Promise<{ success: boolean; user?: ShopToolUserData; error?: string }> {
  const timeoutMs = config.timeoutMs || 8000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const cleanBase = config.baseUrl.trim().replace(/\/+$/, "")
    const ep = cleanBase.endsWith("/api/v1") ? `${cleanBase}/account` : `${cleanBase}/api/v1/account`

    const res = await fetch(ep, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `ShopTool HTTP ${res.status}: ${errText}` }
    }

    const json = await res.json()
    if (!json.success && json.ok === false) {
      return { success: false, error: json.message || json.error || "Lỗi phản hồi từ ShopTool" }
    }

    return { success: true, user: json.user || json.data || json }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi kết nối ShopTool API"
    return { success: false, error: msg }
  }
}

/**
 * GET /api/v1/products - Lấy danh mục sản phẩm từ ShopTool
 */
export async function getShopToolProducts(config: ShopToolConfig): Promise<{ success: boolean; products?: ShopToolProductItem[]; error?: string }> {
  const timeoutMs = config.timeoutMs || 10000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const cleanBase = config.baseUrl.trim().replace(/\/+$/, "")
    const ep = cleanBase.endsWith("/api/v1") ? `${cleanBase}/products` : `${cleanBase}/api/v1/products`

    const res = await fetch(ep, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `ShopTool HTTP ${res.status}: ${errText}` }
    }

    const json = await res.json()
    if (!json.success && json.ok === false) {
      return { success: false, error: json.message || json.error || "Lỗi lấy sản phẩm ShopTool" }
    }

    return { success: true, products: json.products || json.items || [] }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi kết nối ShopTool API"
    return { success: false, error: msg }
  }
}

/**
 * Đặt đơn Buff Token (Tự động chọn Credit nếu có số dư Credit, hoặc ví VND)
 */
export async function buyShopToolBuff(
  config: ShopToolConfig,
  params: {
    invite_code: string
    quantity?: number
    mode?: "auto" | "credit" | "wallet"
  }
): Promise<ShopToolBuffResult> {
  const timeoutMs = config.timeoutMs || 12000
  const cleanBase = config.baseUrl.trim().replace(/\/+$/, "")
  const baseV1 = cleanBase.endsWith("/api/v1") ? cleanBase : `${cleanBase}/api/v1`
  const quantity = Math.max(1, params.quantity || 1)
  const inviteCode = params.invite_code.trim().toUpperCase()

  // 1. Determine method: credit or wallet
  let chosenMethod: "credit" | "wallet" = "wallet"

  if (params.mode === "credit") {
    chosenMethod = "credit"
  } else if (params.mode === "wallet") {
    chosenMethod = "wallet"
  } else {
    // Mode "auto": check account to see if user has enough buff_credits
    const acc = await getShopToolAccount(config)
    if (acc.success && acc.user && (acc.user.buff_credits ?? 0) >= quantity) {
      chosenMethod = "credit"
    } else {
      chosenMethod = "wallet"
    }
  }

  const endpoint = `${baseV1}/buff/${chosenMethod}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        invite_code: inviteCode,
        quantity,
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)
    const json = await res.json()

    if (!res.ok || json.success === false) {
      const errMsg = json.message || json.error || `HTTP ${res.status}`
      const isInsuffBal = json.error === "ZERO_BALANCE" || errMsg.includes("Số dư") || errMsg.includes("balance")
      const isInsuffCred = json.error === "INSUFFICIENT_CREDITS" || errMsg.includes("Credit")

      // Fallback: Nếu chọn credit mà hết credit thì thử sang wallet nếu là auto mode
      if (chosenMethod === "credit" && params.mode === "auto") {
        return await buyShopToolBuff(config, { invite_code: inviteCode, quantity, mode: "wallet" })
      }

      return {
        success: false,
        used_method: chosenMethod,
        error: errMsg,
        isInsufficientBalance: isInsuffBal,
        isInsufficientCredits: isInsuffCred,
      }
    }

    const orderCode = json.order_code || json.order?.code || json.order?.order_code || json.id || "N/A"

    return {
      success: true,
      order_code: String(orderCode),
      orderCode: String(orderCode),
      used_method: chosenMethod,
      message: json.message || `Đã lên đơn Buff ${quantity}B token thành công vào mã ${inviteCode}`,
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi kết nối ShopTool"
    return { success: false, error: msg }
  }
}

/**
 * POST /api/v1/buy - Mua tài khoản có sẵn từ ShopTool
 */
export async function buyShopToolAccount(
  config: ShopToolConfig,
  params: {
    product_code: string
    quantity: number
  }
): Promise<ShopToolBuyResult> {
  const timeoutMs = config.timeoutMs || 12000
  const cleanBase = config.baseUrl.trim().replace(/\/+$/, "")
  const ep = cleanBase.endsWith("/api/v1") ? `${cleanBase}/buy` : `${cleanBase}/api/v1/buy`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(ep, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        product_code: params.product_code,
        quantity: params.quantity,
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)
    const json = await res.json()

    if (!res.ok || json.success === false) {
      const errMsg = json.message || json.error || `HTTP ${res.status}`
      return {
        success: false,
        error: errMsg,
        isInsufficientBalance: json.error === "ZERO_BALANCE" || errMsg.includes("Số dư"),
      }
    }

    const orderCode = json.order_code || json.order?.code || "N/A"
    const credentials: string[] = []

    if (Array.isArray(json.credentials)) {
      for (const c of json.credentials) {
        credentials.push(typeof c === "string" ? c : JSON.stringify(c))
      }
    } else if (Array.isArray(json.items)) {
      for (const it of json.items) {
        credentials.push(typeof it === "string" ? it : JSON.stringify(it))
      }
    } else if (json.data && typeof json.data === "string") {
      credentials.push(json.data)
    }

    return {
      success: true,
      order_code: String(orderCode),
      credentials,
      message: json.message,
    }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi kết nối ShopTool"
    return { success: false, error: msg }
  }
}

/**
 * GET /api/v1/buff/status - Kiểm tra tiến độ đơn Buff Token
 */
export async function getShopToolBuffStatus(
  config: ShopToolConfig,
  orderCode: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const timeoutMs = config.timeoutMs || 8000
  const cleanBase = config.baseUrl.trim().replace(/\/+$/, "")
  const baseV1 = cleanBase.endsWith("/api/v1") ? cleanBase : `${cleanBase}/api/v1`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const ep = `${baseV1}/buff/status?order_code=${encodeURIComponent(orderCode)}`
    const res = await fetch(ep, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    clearTimeout(timer)
    const json = await res.json()
    return { success: json.success !== false, data: json }
  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : "Lỗi tra cứu tiến độ ShopTool"
    return { success: false, error: msg }
  }
}
