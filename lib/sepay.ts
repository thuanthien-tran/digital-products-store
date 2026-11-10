import { prisma } from "./db"
import { fulfillOrder } from "./fulfillment"
import { redeemCouponReservation } from "./coupon-service"

export interface SepayNormalizedTransaction {
  id: string
  bankBrandName?: string
  accountNumber?: string
  transactionDate?: string
  amountIn: number
  amountOut: number
  content: string
  referenceNumber?: string
}

interface SepayCache {
  timestamp: number
  transactions: SepayNormalizedTransaction[]
}

let inMemoryCache: SepayCache | null = null
const CACHE_TTL_MS = 3500 // Cache for 3.5s to prevent hammering SePay API on rapid polling

/**
 * Fetches recent incoming transactions from SePay API (supporting both v2 and v1).
 */
export async function fetchRecentSepayTransactions(): Promise<SepayNormalizedTransaction[]> {
  const token = (process.env.SEPAY_API_TOKEN || process.env.SEPAY_WEBHOOK_KEY || "").trim()
  if (!token) {
    return []
  }

  const now = Date.now()
  if (inMemoryCache && now - inMemoryCache.timestamp < CACHE_TTL_MS) {
    return inMemoryCache.transactions
  }

  const normalized: SepayNormalizedTransaction[] = []

  // 1. Try SePay API v2 first (preferred modern API)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch("https://userapi.sepay.vn/v2/transactions?per_page=30", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data?.transactions) ? data.transactions : []

      for (const item of rawList) {
        const amountIn = Number(item.amount_in || item.amountIn || 0)
        const amountOut = Number(item.amount_out || item.amountOut || 0)
        const content = String(item.transaction_content || item.content || item.description || "")
        const id = String(item.id || item.transaction_id || item.reference_number || "")

        if (id && amountIn > 0) {
          normalized.push({
            id,
            bankBrandName: item.bank_brand_name || item.gateway || undefined,
            accountNumber: item.account_number ? String(item.account_number) : undefined,
            transactionDate: item.transaction_date || item.createdAt || undefined,
            amountIn,
            amountOut,
            content,
            referenceNumber: item.reference_number ? String(item.reference_number) : undefined,
          })
        }
      }

      if (normalized.length > 0) {
        inMemoryCache = { timestamp: now, transactions: normalized }
        return normalized
      }
    }
  } catch (err) {
    // Fall through to v1
  }

  // 2. Fallback to SePay API v1
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch("https://my.sepay.vn/userapi/transactions/list?limit=30", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      const rawList = Array.isArray(data?.transactions) ? data.transactions : Array.isArray(data?.data) ? data.data : []

      for (const item of rawList) {
        const amountIn = Number(item.amount_in || 0)
        const amountOut = Number(item.amount_out || 0)
        const content = String(item.transaction_content || item.content || "")
        const id = String(item.id || item.reference_number || "")

        if (id && amountIn > 0) {
          normalized.push({
            id,
            bankBrandName: item.bank_brand_name || undefined,
            accountNumber: item.account_number ? String(item.account_number) : undefined,
            transactionDate: item.transaction_date || undefined,
            amountIn,
            amountOut,
            content,
            referenceNumber: item.reference_number ? String(item.reference_number) : undefined,
          })
        }
      }
    }
  } catch (err) {
    console.warn("[SePay Auto-Polling] Không thể kết nối tới SePay API:", err instanceof Error ? err.message : err)
  }

  inMemoryCache = { timestamp: now, transactions: normalized }
  return normalized
}

/**
 * Active Proactive Reconciliation:
 * Queries SePay transactions to check if an order has been paid.
 * If a matching incoming payment is found:
 * - Records payment in database.
 * - Transitions order status to paid.
 * - Triggers live fulfillment automatically.
 */
export async function reconcileOrderWithSepay(orderId: string): Promise<{
  matched: boolean
  orderStatus: string
  amountReceived?: number
  message?: string
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  })

  if (!order) {
    return { matched: false, orderStatus: "not_found" }
  }

  // Already settled
  if (order.status === "paid") {
    return { matched: true, orderStatus: "paid" }
  }

  // If order is refunded, do not auto-reconcile
  if (order.status === "refunded") {
    return { matched: false, orderStatus: order.status }
  }

  const transactions = await fetchRecentSepayTransactions()
  if (transactions.length === 0) {
    return { matched: false, orderStatus: order.status }
  }

  const cleanOrderCode = order.code.trim().toUpperCase()
  const rawCodeNoAg = cleanOrderCode.replace(/^AG/, "")

  // Find transaction matching this order's code
  const matchedTx = transactions.find((tx) => {
    const cleanContent = tx.content.toUpperCase().replace(/[^A-Z0-9]/g, "")
    // Match "AGxxxxxx" or exact code
    return cleanContent.includes(cleanOrderCode) || (rawCodeNoAg.length >= 5 && cleanContent.includes(rawCodeNoAg))
  })

  if (!matchedTx) {
    return { matched: false, orderStatus: order.status }
  }

  const txIdStr = String(matchedTx.id).trim()

  // Deduplication check: Has this transaction already been recorded?
  const existingPayment = await prisma.payment.findUnique({
    where: { transactionId: txIdStr },
  })

  let newlyRecordedAmount = 0
  if (!existingPayment) {
    // Record payment atomically and update status
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: order.id,
          transactionId: txIdStr,
          gateway: matchedTx.bankBrandName ? `SePay (${matchedTx.bankBrandName})` : "SePay (Tự động quét)",
          amount: Math.round(matchedTx.amountIn),
          content: matchedTx.content,
          transactionDate: matchedTx.transactionDate || null,
        },
      })

      const freshOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payments: true },
      })

      const totalPaid = freshOrder.payments.reduce((sum, p) => sum + p.amount, 0)
      const fullyPaid = totalPaid >= freshOrder.totalCents
      newlyRecordedAmount = totalPaid

      await tx.order.update({
        where: { id: order.id },
        data: { status: fullyPaid ? "processing" : "partially_paid" },
      })

      if (fullyPaid) {
        await redeemCouponReservation(order.id, tx)
      }
    })
  } else {
    newlyRecordedAmount = order.payments.reduce((sum, p) => sum + p.amount, 0)
  }

  // Check if fully paid after recording
  const updatedOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { payments: true },
  })

  const totalCurrentPaid = updatedOrder?.payments.reduce((sum, p) => sum + p.amount, 0) || newlyRecordedAmount
  const isFullyPaid = totalCurrentPaid >= order.totalCents

  if (isFullyPaid) {
    try {
      console.log(`[SePay Auto-Polling] Đã phát hiện giao dịch ${txIdStr} cho đơn #${order.code}. Bắt đầu xuất kho...`)
      const fRes = await fulfillOrder(order.id)
      console.log(`[SePay Auto-Polling] Kết quả xuất kho đơn #${order.code}:`, fRes.status)
      return {
        matched: true,
        orderStatus: fRes.status || "paid",
        amountReceived: totalCurrentPaid,
        message: "Thanh toán thành công! Đã tự động kích hoạt giao hàng.",
      }
    } catch (fulfillErr) {
      console.error(`[SePay Auto-Polling] Lỗi khi xuất kho đơn #${order.code}:`, fulfillErr)
      return {
        matched: true,
        orderStatus: "paid",
        amountReceived: totalCurrentPaid,
      }
    }
  }

  return {
    matched: true,
    orderStatus: "partially_paid",
    amountReceived: totalCurrentPaid,
    message: "Đã nhận một phần thanh toán.",
  }
}
