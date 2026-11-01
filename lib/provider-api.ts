/**
 * Module xử lý Ping API tới Nhà cung cấp / Đối tác dịch vụ bên ngoài
 * (Ví dụ: Buff token, tạo link tự động, mua từ tổng kho API)
 */

interface ProviderApiConfig {
  endpoint: string
  apiKey?: string
  serviceId?: string
  customParams?: Record<string, unknown>
}

interface OrderContext {
  orderCode: string
  email: string
  productName: string
  variantName: string
  quantity: number
  customInput?: string // Ví dụ ID tài khoản cần buff token, email khách cần nâng cấp
}

export async function pingProviderApi(
  config: ProviderApiConfig,
  context: OrderContext
): Promise<{ success: boolean; data?: unknown; serialResult?: string; error?: string }> {
  try {
    console.log(`[Provider API] Đang ping API đối tác cho đơn ${context.orderCode}...`)

    const payload = {
      api_key: config.apiKey,
      service: config.serviceId,
      order_code: context.orderCode,
      email: context.email,
      quantity: context.quantity,
      input: context.customInput || context.email,
      ...config.customParams,
    }

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
    })

    const result = (await response.json()) as Record<string, unknown>

    if (!response.ok) {
      const errDetail =
        (typeof result.message === "string" && result.message) ||
        (typeof result.error === "string" && result.error) ||
        `HTTP ${response.status}`
      throw new Error(errDetail)
    }

    // Tự động nhận diện dữ liệu trả về từ API đối tác (Key, link, hoặc tài khoản)
    const dataObj = typeof result.data === "object" && result.data !== null ? (result.data as Record<string, unknown>) : {}
    const serialCandidate =
      result.key ||
      result.account ||
      result.serial ||
      result.link ||
      dataObj.key ||
      dataObj.link ||
      (result.order_id ? `ID Đơn Tổng Kho: ${result.order_id}` : null)

    const serialResult = typeof serialCandidate === "string" ? serialCandidate : undefined

    return {
      success: true,
      data: result,
      serialResult,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Provider request failed"
    console.error(`[Provider API Error] Lỗi ping API đối tác:`, errorMsg)
    return {
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Gửi Webhook Ping (Outgoing) báo cáo về server riêng hoặc Discord/Telegram
 */
export async function pingOutgoingWebhook(
  webhookUrl: string,
  event: "order.paid" | "order.created",
  orderData: Record<string, unknown>
) {
  try {
    if (!webhookUrl) return
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: orderData,
      }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook dispatch failed"
    console.error("[Outgoing Webhook] Lỗi ping webhook:", msg)
  }
}
