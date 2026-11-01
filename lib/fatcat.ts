/**
 * FatCat Store API Client
 * Official integration for https://api.fatcatstore.click
 */

export interface FatcatProduct {
  id: number
  name: string
  price_vnd: number
  regular_price_vnd: number
  sale_qty: number
  stock: number
  max_quantity: number
  description: string
}

export interface FatcatBalance {
  balance_vnd: number
  balance_usdt: number
  usdt_rate: number
}

export interface FatcatBuyResult {
  success: boolean
  order?: {
    id: string
    request_id?: string
    product_id: number
    product?: string
    quantity: number
    price?: number
    status?: string
    items: string[]
    created_at?: number
  }
  duplicate?: boolean
  error?: string
}

export function getFatcatConfig() {
  const apiUrl = (process.env.FATCAT_API_URL || "https://api.fatcatstore.click").replace(/\/+$/, "")
  const apiKey = process.env.FATCAT_API_KEY || ""
  const isEnabled = process.env.ENABLE_FATCAT_INTEGRATION === "true" && Boolean(apiKey)

  return { apiUrl, apiKey, isEnabled }
}

/**
 * Lấy số dư ví hiện tại trên FatCat Store
 */
export async function getFatcatBalance(): Promise<{ success: boolean; data?: FatcatBalance; error?: string }> {
  const { apiUrl, apiKey } = getFatcatConfig()
  if (!apiKey) {
    return { success: false, error: "Chưa cấu hình FATCAT_API_KEY" }
  }

  try {
    const res = await fetch(`${apiUrl}/api/balance`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Lỗi kết nối FatCat (${res.status}): ${errText}` }
    }

    const data = (await res.json()) as FatcatBalance
    return { success: true, data }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error"
    return { success: false, error: msg }
  }
}

/**
 * Lấy danh sách sản phẩm, bảng giá và tồn kho thời gian thực từ FatCat Store
 */
export async function getFatcatProducts(): Promise<{ success: boolean; products?: FatcatProduct[]; error?: string }> {
  const { apiUrl, apiKey } = getFatcatConfig()
  if (!apiKey) {
    return { success: false, error: "Chưa cấu hình FATCAT_API_KEY" }
  }

  try {
    const res = await fetch(`${apiUrl}/api/products`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Lỗi kết nối FatCat (${res.status}): ${errText}` }
    }

    const data = (await res.json()) as { products?: FatcatProduct[] }
    return { success: true, products: Array.isArray(data.products) ? data.products : [] }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error"
    return { success: false, error: msg }
  }
}

/**
 * Gọi lệnh mua hàng tự động từ FatCat Store (Nhận tài khoản ngay trong phản hồi)
 * @param productId ID sản phẩm bên FatCat (lấy từ /api/products)
 * @param quantity Số lượng cần mua
 * @param requestId Mã định danh đơn hàng bên ta (Chống mua trùng khi mạng chập chờn)
 */
export async function buyFatcatProduct(
  productId: number,
  quantity: number,
  requestId: string
): Promise<FatcatBuyResult> {
  const { apiUrl, apiKey, isEnabled } = getFatcatConfig()

  if (!isEnabled) {
    return {
      success: false,
      error: "Tích hợp FatCat hiện đang tắt trên hệ thống (ENABLE_FATCAT_INTEGRATION=false hoặc thiếu API Key).",
    }
  }

  try {
    console.log(`[FatCat API] Đang gửi lệnh mua: product_id=${productId}, qty=${quantity}, request_id=${requestId}`)

    const cleanRequestId = requestId.slice(0, 64)

    const res = await fetch(`${apiUrl}/api/buy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        quantity,
        request_id: cleanRequestId,
      }),
    })

    const body = await res.json()

    if (!res.ok) {
      const errorMsg =
        (typeof body.message === "string" && body.message) ||
        (typeof body.error === "string" && body.error) ||
        `HTTP ${res.status}`
      console.error(`[FatCat API Error] ${errorMsg}`)
      return { success: false, error: errorMsg }
    }

    if (!body.order || !Array.isArray(body.order.items) || body.order.items.length === 0) {
      return {
        success: false,
        error: "API FatCat trả về thành công nhưng danh sách items rỗng.",
      }
    }

    return {
      success: true,
      order: body.order,
      duplicate: Boolean(body.duplicate),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network request failed"
    console.error(`[FatCat API Exception]`, msg)
    return { success: false, error: msg }
  }
}
