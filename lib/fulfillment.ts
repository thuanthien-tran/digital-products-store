import { prisma } from './db'
import { Prisma } from '@prisma/client'

export const VALID_ORDER_STATUSES = ['pending', 'partially_paid', 'processing', 'paid', 'cancelled', 'refunded'] as const
export type OrderStatus = (typeof VALID_ORDER_STATUSES)[number]

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['partially_paid', 'processing', 'paid', 'cancelled'],
  partially_paid: ['processing', 'paid', 'cancelled'],
  processing: ['paid', 'cancelled'],
  paid: ['cancelled', 'refunded'],
  cancelled: [], // Terminal state
  refunded: [],  // Terminal state
}

/**
 * Validates whether an order status transition is allowed by the lifecycle state machine.
 */
export function validateStatusTransition(currentStatus: string, targetStatus: string): { valid: boolean; error?: string } {
  if (!VALID_ORDER_STATUSES.includes(targetStatus as OrderStatus)) {
    return {
      valid: false,
      error: `Trạng thái "${targetStatus}" không hợp lệ. Cho phép: ${VALID_ORDER_STATUSES.join(', ')}`,
    }
  }

  if (currentStatus === targetStatus) {
    return { valid: true } // No-op transition
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus] || []
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      error: `Không thể chuyển trạng thái đơn hàng từ "${currentStatus}" sang "${targetStatus}"`,
    }
  }

  return { valid: true }
}

/**
 * Shared transactional fulfillment logic for orders.
 * Assigns available serials to order items atomically.
 */
export async function fulfillOrder(
  orderId: string,
  txClient?: Prisma.TransactionClient
): Promise<{ success: boolean; fullyFulfilled: boolean; status: OrderStatus; deliveredSerials: number; neededSerials: number; error?: string }> {
  const db = txClient || prisma

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { select: { deliveryType: true } },
          variant: { select: { provider: true, providerProductId: true, providerStock: true } },
          serials: true,
        },
      },
    },
  })

  if (!order) {
    return { success: false, fullyFulfilled: false, status: 'pending', deliveredSerials: 0, neededSerials: 0, error: 'Order not found' }
  }

  // INVARIANT: Terminal states (cancelled, refunded) must never be fulfilled or resurrected
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return {
      success: false,
      fullyFulfilled: false,
      status: order.status as OrderStatus,
      deliveredSerials: 0,
      neededSerials: 0,
      error: `Cannot fulfill order in terminal state: ${order.status}`,
    }
  }

  let totalDelivered = 0
  let totalNeeded = 0

  for (const item of order.items) {
    const isFatcat = item.variant?.provider === 'fatcat' || item.product.deliveryType === 'fatcat'
    const isSerialDelivery = item.product.deliveryType === 'serials' || isFatcat
    const alreadyDelivered = item.serials.length
    const needed = isSerialDelivery ? Math.max(0, item.quantity - alreadyDelivered) : 0
    totalNeeded += item.quantity

    if (needed > 0) {
      // 1. Try local serial inventory first
      const availableSerials = await db.serial.findMany({
        where: {
          variantId: item.variantId,
          status: 'available',
        },
        take: needed,
      })

      let localDelivered = 0
      if (availableSerials.length > 0) {
        const serialIds = availableSerials.map((s) => s.id)
        const updateResult = await db.serial.updateMany({
          where: { id: { in: serialIds }, status: 'available' },
          data: {
            status: 'sold',
            orderItemId: item.id,
          },
        })
        localDelivered = updateResult.count
      }

      const remainingNeeded = needed - localDelivered

      // 2. If item is configured with FatCat provider and still needs items, purchase from FatCat API only if live buy is enabled
      const isLiveBuyActive = process.env.ENABLE_FATCAT_LIVE_BUY === 'true'
      if (isFatcat && item.variant?.providerProductId && remainingNeeded > 0) {
        if (!isLiveBuyActive) {
          await db.order.update({
            where: { id: orderId },
            data: {
              note: '[Kênh giao hàng FatCat chưa kích hoạt]: Cần xuất kho thủ công hoặc bật ENABLE_FATCAT_LIVE_BUY.',
            },
          })
          continue
        }
        try {
          const { buyFatcatProduct } = await import('./fatcat')
          const requestId = `${order.code}-${item.id}`
          const buyRes = await buyFatcatProduct(item.variant.providerProductId, remainingNeeded, requestId)

          if (buyRes.success && buyRes.order && Array.isArray(buyRes.order.items) && buyRes.order.items.length > 0) {
            for (const credential of buyRes.order.items) {
              await db.serial.create({
                data: {
                  variantId: item.variantId,
                  orderItemId: item.id,
                  content: credential,
                  status: 'sold',
                },
              })
            }
            totalDelivered += alreadyDelivered + localDelivered + buyRes.order.items.length
          } else {
            console.error(`[Fulfillment FatCat Error] Đơn ${order.code}: ${buyRes.error}`)

            // Reverse sync immediately if out of stock is reported by provider API
            const isOutOfStockMsg = /hết hàng|out of stock|stock.*0|không đủ|kho rỗng/i.test(buyRes.error || '')
            if (isOutOfStockMsg && item.variant && item.variant.providerProductId) {
              try {
                const { recordSourceStockUpdate } = await import('./inventory-pipeline')
                if (item.connectionId) {
                  await recordSourceStockUpdate({
                    connectionId: item.connectionId,
                    externalId: String(item.variant.providerProductId),
                    sourceStock: 0,
                    reason: 'fulfillment_out_of_stock',
                  })
                }
              } catch (reverseErr) {
                console.error(`[Fulfillment Reverse Sync Error]`, reverseErr)
              }
            }

            await db.order.update({
              where: { id: orderId },
              data: {
                note: `[NGOẠI LỆ NGUỒN HÀNG]: Đại lý báo "${buyRes.error || 'Mua thất bại'}". Đã nhận thanh toán nhưng chưa giao được. Chờ đối soát hoặc hoàn tiền thủ công.`,
              },
            })
            totalDelivered += alreadyDelivered + localDelivered
          }
        } catch (fatcatErr) {
          const msg = fatcatErr instanceof Error ? fatcatErr.message : 'FatCat API Exception'
          console.error(`[Fulfillment FatCat Exception]`, msg)
          totalDelivered += alreadyDelivered + localDelivered
        }
      } else {
        totalDelivered += alreadyDelivered + localDelivered
      }
    } else {
      // Non-serial service items or already delivered items
      totalDelivered += item.quantity
    }
  }

  const fullyFulfilled = totalDelivered >= totalNeeded
  const newStatus: OrderStatus = fullyFulfilled ? 'paid' : 'processing'

  await db.order.update({
    where: { id: orderId },
    data: { status: newStatus },
  })

  return {
    success: true,
    fullyFulfilled,
    status: newStatus,
    deliveredSerials: totalDelivered,
    neededSerials: totalNeeded,
  }
}

/**
 * Handles serial lifecycle when an order is cancelled or refunded.
 * INVARIANT: Disclosed serials (from paid, refunded, or processing orders) must NEVER return to sellable inventory!
 */
export async function releaseOrderSerials(
  orderId: string,
  forceRevoke = false,
  txClient?: Prisma.TransactionClient
): Promise<{ releasedCount: number; revokedCount: number }> {
  const db = txClient || prisma

  const currentOrder = await db.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  })

  const serials = await db.serial.findMany({
    where: {
      orderItem: { orderId },
    },
  })

  if (serials.length === 0) {
    return { releasedCount: 0, revokedCount: 0 }
  }

  const serialIds = serials.map((s) => s.id)

  // INVARIANT: An order that is or was paid, refunded, or processing (partially delivered),
  // or where any serial was marked delivered, must NEVER return serials to available pool!
  const shouldRevoke =
    forceRevoke ||
    currentOrder?.status === 'paid' ||
    currentOrder?.status === 'refunded' ||
    currentOrder?.status === 'processing' ||
    serials.some((s) => s.status === 'delivered')

  if (shouldRevoke) {
    // Quarantine/revoke already assigned/disclosed credentials so they are never resold
    await db.serial.updateMany({
      where: { id: { in: serialIds } },
      data: {
        status: 'revoked',
        // Preserve orderItemId for audit history
      },
    })
    return { releasedCount: 0, revokedCount: serials.length }
  } else {
    // Order was strictly pending/unpaid and serials were never revealed to customer
    await db.serial.updateMany({
      where: { id: { in: serialIds } },
      data: {
        status: 'available',
        orderItemId: null,
      },
    })
    return { releasedCount: serials.length, revokedCount: 0 }
  }
}
