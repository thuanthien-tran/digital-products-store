import { prisma } from "./db"
import { Prisma } from "@prisma/client"

export interface InventoryUpdateRequest {
  connectionId: string
  externalId: string
  sourceStock: number
  sourceStatus?: "available" | "out_of_stock" | "unavailable" | "unknown"
  wholesalePrice?: number
  reason:
    | "sync"
    | "manual_sync"
    | "pre_checkout_check"
    | "fulfillment_out_of_stock"
    | "webhook"
  verifiedAt?: Date
  allowNotification?: boolean
}

export interface InventoryUpdateResult {
  updated: boolean
  sourceProductId?: string
  productId?: string
  variantId?: string
  previousStock: number
  newStock: number
  previousStatus: string
  newStatus: string
  productStatusChanged: boolean
  adminNotificationCreated: boolean
}

// In-memory cache timestamp for storefront fast-polling invalidation
let lastInventoryChangeTimestamp = Date.now()

export function getGlobalInventoryTimestamp(): number {
  return lastInventoryChangeTimestamp
}

export function touchGlobalInventoryTimestamp(): void {
  lastInventoryChangeTimestamp = Date.now()
}

/**
 * Standardized unified pipeline for recording stock updates across all entry points.
 * 
 * INVARIANTS:
 * 1. NEVER overwrite selling retail price (Variant.priceCents) or approved descriptions/images.
 * 2. Only updates provider wholesale price (Variant.providerPrice / SourceProduct.sourcePrice).
 * 3. Does not let an older response overwrite newer verified data (monotonic time check).
 * 4. Deduplicates notifications to prevent spamming admin notifications on every cycle.
 * 5. Re-evaluates product-level statusOverride strictly considering local physical serials.
 */
export async function recordSourceStockUpdate(
  req: InventoryUpdateRequest,
  txClient?: Prisma.TransactionClient
): Promise<InventoryUpdateResult> {
  const db = txClient || prisma
  const now = req.verifiedAt || new Date()

  // 1. Find existing SourceProduct by connectionId and externalId
  const sourceProduct = await db.sourceProduct.findUnique({
    where: {
      connectionId_externalId: {
        connectionId: req.connectionId,
        externalId: req.externalId,
      },
    },
    include: {
      connection: true,
      product: {
        include: {
          variants: {
            include: {
              _count: {
                select: { serials: { where: { status: "available" } } },
              },
            },
          },
        },
      },
    },
  })

  if (!sourceProduct) {
    return {
      updated: false,
      previousStock: 0,
      newStock: req.sourceStock,
      previousStatus: "unknown",
      newStatus: req.sourceStatus || "unknown",
      productStatusChanged: false,
      adminNotificationCreated: false,
    }
  }

  // Stale update protection: if record was verified more recently than this event, skip stock downgrade
  if (sourceProduct.lastSyncedAt && sourceProduct.lastSyncedAt > now) {
    return {
      updated: false,
      sourceProductId: sourceProduct.id,
      previousStock: sourceProduct.sourceStock,
      newStock: sourceProduct.sourceStock,
      previousStatus: sourceProduct.sourceStatus,
      newStatus: sourceProduct.sourceStatus,
      productStatusChanged: false,
      adminNotificationCreated: false,
    }
  }

  const previousStock = sourceProduct.sourceStock
  const previousStatus = sourceProduct.sourceStatus

  const normalizedStock = Math.max(0, req.sourceStock)
  const normalizedStatus =
    req.sourceStatus || (normalizedStock > 0 ? "available" : "out_of_stock")

  // 2. Update SourceProduct record
  const updateData: Prisma.SourceProductUpdateInput = {
    sourceStock: normalizedStock,
    sourceStatus: normalizedStatus,
    lastSeenAt: now,
    lastSyncedAt: now,
  }

  if (typeof req.wholesalePrice === "number" && req.wholesalePrice >= 0) {
    updateData.sourcePrice = req.wholesalePrice
  }

  await db.sourceProduct.update({
    where: { id: sourceProduct.id },
    data: updateData,
  })

  let productStatusChanged = false

  // 3. Update linked Variant (providerStock & providerPrice)
  if (sourceProduct.isAddedToStore && sourceProduct.product) {
    const linkedVariant =
      sourceProduct.product.variants.find((v) => v.id === sourceProduct.variantId) ||
      sourceProduct.product.variants[0]

    if (linkedVariant) {
      await db.variant.update({
        where: { id: linkedVariant.id },
        data: {
          providerStock: normalizedStock,
          ...(typeof req.wholesalePrice === "number" ? { providerPrice: req.wholesalePrice } : {}),
        },
      })
    }

    // 4. Re-evaluate Product level status:
    // If ALL variants now have 0 sellable units (local serials + provider stock == 0),
    // set product.statusOverride to 'out_of_stock'.
    // If stock returned (> 0) and product was auto-locked, return to 'auto'.
    if (sourceProduct.product.editorialStatus === "published") {
      const allVariants = sourceProduct.product.variants.map((v) => {
        const vStock = v.id === linkedVariant?.id ? normalizedStock : (v.providerStock ?? 0)
        const localStock = v._count.serials
        return vStock + localStock
      })

      const totalSellable = allVariants.reduce((sum, s) => sum + s, 0)

      if (totalSellable === 0 && sourceProduct.product.statusOverride !== "out_of_stock") {
        await db.product.update({
          where: { id: sourceProduct.product.id },
          data: { statusOverride: "out_of_stock" },
        })
        productStatusChanged = true
      } else if (totalSellable > 0 && sourceProduct.product.statusOverride === "out_of_stock") {
        // Only return to 'auto' if it wasn't manually suspended by an explicit admin action
        await db.product.update({
          where: { id: sourceProduct.product.id },
          data: { statusOverride: "auto" },
        })
        productStatusChanged = true
      }
    }
  }

  // 5. Admin Notification Management (with smart deduplication)
  let adminNotificationCreated = false
  const isTransitioningToOutOfStock = previousStock > 0 && normalizedStock === 0
  const isTransitioningBackInStock = previousStock === 0 && normalizedStock > 0
  const isDiscontinued = normalizedStatus === "unavailable" && previousStatus !== "unavailable"

  const shouldNotify =
    req.allowNotification !== false &&
    (isTransitioningToOutOfStock || isTransitioningBackInStock || isDiscontinued || req.reason === "fulfillment_out_of_stock")

  if (shouldNotify) {
    const connName = sourceProduct.connection?.name || "Đại lý"
    const prodName = sourceProduct.customName || sourceProduct.sourceName

    let notifType = "stock_status"
    let notifTitle = ""
    let notifMessage = ""

    if (req.reason === "fulfillment_out_of_stock") {
      notifType = "stock_status"
      notifTitle = `Khẩn cấp: Hết hàng sau thanh toán (${connName}): #${req.externalId} ${prodName}`
      notifMessage = `Đại lý xác nhận hết hàng khi hệ thống thực hiện mua sau khi nhận tiền. Vui lòng kiểm tra và hoàn tiền hoặc đổi gói cho khách.`
    } else if (isDiscontinued) {
      notifType = "discontinued"
      notifTitle = `Ngừng cung cấp (${connName}): #${req.externalId} ${prodName}`
      notifMessage = `Sản phẩm #${req.externalId} đã bị gỡ khỏi danh mục đại lý. Đã cập nhật khóa mua.`
    } else if (isTransitioningToOutOfStock) {
      notifType = "stock_status"
      notifTitle = `Hết hàng (${connName}): #${req.externalId} ${prodName}`
      notifMessage = `Nguồn đại lý vừa hết hàng (Tồn: 0). Hệ thống đã tự động khóa mua cho các gói phụ thuộc nguồn này.`
    } else if (isTransitioningBackInStock) {
      notifType = "stock_status"
      notifTitle = `Có hàng trở lại (${connName}): #${req.externalId} ${prodName}`
      notifMessage = `Nguồn đại lý đã có hàng trở lại (Tồn: ${normalizedStock}).`
    }

    if (notifTitle) {
      // Deduplicate: check if a notification with same type, connectionId and externalId was created in last 10 minutes
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      const existingNotif = await db.adminNotification.findFirst({
        where: {
          connectionId: req.connectionId,
          type: notifType,
          title: notifTitle,
          createdAt: { gte: tenMinutesAgo },
        },
      })

      if (!existingNotif) {
        await db.adminNotification.create({
          data: {
            connectionId: req.connectionId,
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            link: `/admin/sources?connectionId=${req.connectionId}`,
          },
        })
        adminNotificationCreated = true
      }
    }
  }

  // 6. Invalidate global memory cache timestamp so clients and server routes detect changes
  touchGlobalInventoryTimestamp()

  return {
    updated: true,
    sourceProductId: sourceProduct.id,
    productId: sourceProduct.productId || undefined,
    variantId: sourceProduct.variantId || undefined,
    previousStock,
    newStock: normalizedStock,
    previousStatus,
    newStatus: normalizedStatus,
    productStatusChanged,
    adminNotificationCreated,
  }
}
