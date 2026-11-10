import { prisma } from "./db"
import { releaseCouponReservation } from "./coupon-service"

export const ORDER_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Checks if a pending order has exceeded the 10-minute payment timeout.
 */
export function isOrderExpired(createdAt: Date | string, status: string, totalPaid: number = 0): boolean {
  if (status !== "pending") return false
  if (totalPaid > 0) return false // Do not auto-cancel if user already sent payment
  const createdTime = new Date(createdAt).getTime()
  return Date.now() - createdTime > ORDER_EXPIRY_MS
}

/**
 * Automatically cancels a specific order if it has expired.
 * Transactional and conditional: guarantees no race condition with incoming payments.
 */
export async function cancelIfExpired(
  orderId: string,
  createdAt: Date | string,
  status: string,
  totalPaid: number = 0
): Promise<boolean> {
  const createdTime = new Date(createdAt).getTime()
  if (Date.now() - createdTime <= ORDER_EXPIRY_MS) return false

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Fresh read inside transaction with all recorded payments
      const freshOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      })

      if (!freshOrder || freshOrder.status !== "pending") return false

      const freshPaid = freshOrder.payments.reduce((sum, p) => sum + p.amount, 0)
      if (freshPaid > 0) {
        // Customer paid money concurrently, ABORT cancellation!
        return false
      }

      // 2. Atomic conditional cancellation
      const updateRes = await tx.order.updateMany({
        where: {
          id: orderId,
          status: "pending",
        },
        data: {
          status: "cancelled",
          note: "[Hệ thống]: Tự động hủy đơn do quá thời hạn thanh toán 10 phút.",
        },
      })

      if (updateRes.count > 0) {
        // 3. Safely release coupon reservation
        await releaseCouponReservation(orderId, tx, "order_expired")

        // 4. Safely return serials to pool if applicable
        try {
          const { releaseOrderSerials } = await import("./fulfillment")
          await releaseOrderSerials(orderId, false, tx)
        } catch {}

        return true
      }

      return false
    })
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
    const expiredCandidates = await prisma.order.findMany({
      where: {
        status: "pending",
        createdAt: { lt: cutoffTime },
        payments: { none: {} }, // Only orders with NO payments recorded
      },
      select: { id: true, createdAt: true, status: true },
      take: 50,
    })

    if (expiredCandidates.length === 0) return 0

    let cancelledCount = 0
    for (const candidate of expiredCandidates) {
      const cancelled = await cancelIfExpired(candidate.id, candidate.createdAt, candidate.status, 0)
      if (cancelled) cancelledCount++
    }

    if (cancelledCount > 0) {
      console.log(`[Order Expiry] Đã tự động hủy và hoàn lượt coupon cho ${cancelledCount} đơn hàng chờ quá 10 phút.`)
    }
    return cancelledCount
  } catch (err) {
    console.error("[Order Expiry] Lỗi khi tự động hủy các đơn hết hạn:", err)
    return 0
  }
}
