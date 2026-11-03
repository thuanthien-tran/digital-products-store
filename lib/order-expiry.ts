import { prisma } from "./db"

export const ORDER_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Checks if a pending order has exceeded the 10-minute payment timeout.
 */
export function isOrderExpired(createdAt: Date | string, status: string, totalPaid: number = 0): boolean {
  if (status !== "pending") return false
  if (totalPaid > 0) return false // Do not auto-cancel if user already sent partial payment
  const createdTime = new Date(createdAt).getTime()
  return Date.now() - createdTime > ORDER_EXPIRY_MS
}

/**
 * Automatically cancels a specific order if it has expired.
 */
export async function cancelIfExpired(orderId: string, createdAt: Date | string, status: string, totalPaid: number = 0): Promise<boolean> {
  if (!isOrderExpired(createdAt, status, totalPaid)) return false

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "cancelled",
        note: "[Hệ thống]: Tự động hủy đơn do quá thời hạn thanh toán 10 phút.",
      },
    })
    return true
  } catch (err) {
    console.error(`[Order Expiry] Lỗi khi hủy đơn hết hạn ${orderId}:`, err)
    return false
  }
}

/**
 * Batch clean up: Cancels all pending orders that have been unpaid for more than 10 minutes.
 * Can be invoked by Cron jobs or background tasks.
 */
export async function cancelAllExpiredPendingOrders(): Promise<number> {
  const cutoffTime = new Date(Date.now() - ORDER_EXPIRY_MS)

  try {
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "pending",
        createdAt: { lt: cutoffTime },
        payments: { none: {} }, // Only cancel orders with NO payments recorded
      },
      select: { id: true },
    })

    if (expiredOrders.length === 0) return 0

    const ids = expiredOrders.map((o) => o.id)
    const result = await prisma.order.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "cancelled",
        note: "[Hệ thống]: Tự động hủy đơn hàng do quá thời hạn thanh toán 10 phút.",
      },
    })

    console.log(`[Order Expiry] Đã tự động hủy ${result.count} đơn hàng chờ quá 10 phút.`)
    return result.count
  } catch (err) {
    console.error("[Order Expiry] Lỗi khi tự động hủy các đơn hết hạn:", err)
    return 0
  }
}
