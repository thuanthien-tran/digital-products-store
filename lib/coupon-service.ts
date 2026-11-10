import { prisma } from "./db"
import { Prisma } from "@prisma/client"
import { validateEmail } from "./validations"

export const MIN_PAYABLE_AMOUNT_VND = 1000 // Ngân hàng NAPAS247 & SePay yêu cầu tối thiểu 1.000đ

export interface OrderItemEvalInput {
  productId: string
  variantId: string
  quantity: number
  priceCents: number
  productName?: string
  variantName?: string
}

export interface CouponItemAllocation {
  variantId: string
  discountCents: number
  lineSubtotal: number
  lineFinalTotal: number
}

export interface CouponSnapshotData {
  couponId: string
  code: string
  name: string
  discountType: "fixed" | "percent"
  discountValue: number
  maxDiscountAmount: number | null
  minOrderAmount: number | null
  scope: string
  appliedAt: string
  subtotalCents: number
  eligibleSubtotalCents: number
  discountCents: number
  totalCents: number
  allocations: CouponItemAllocation[]
}

export interface CouponEvaluationResult {
  valid: boolean
  code: string
  couponId?: string
  name?: string
  discountType?: "fixed" | "percent"
  discountValue?: number
  subtotalCents: number
  eligibleSubtotalCents: number
  discountCents: number
  totalCents: number
  allocations: CouponItemAllocation[]
  couponSnapshot?: CouponSnapshotData
  error?: string
  errorCode?:
    | "INVALID_CODE"
    | "NOT_FOUND"
    | "INACTIVE"
    | "NOT_STARTED"
    | "EXPIRED"
    | "USAGE_LIMIT_EXCEEDED"
    | "EMAIL_LIMIT_EXCEEDED"
    | "NO_ELIGIBLE_ITEMS"
    | "MIN_ORDER_NOT_MET"
    | "BELOW_MIN_PAYABLE"
    | "INVALID_CONFIG"
}

/**
 * Standardize coupon code format:
 * Trim, uppercase, remove multiple internal spaces, only A-Z0-9_-
 */
export function normalizeCouponCode(code: string | null | undefined): string {
  if (!code) return ""
  return code
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "")
}

export function validateCouponCodeFormat(code: string): { valid: boolean; error?: string } {
  const normalized = normalizeCouponCode(code)
  if (normalized.length < 3) {
    return { valid: false, error: "Mã giảm giá phải có tối thiểu 3 ký tự." }
  }
  if (normalized.length > 30) {
    return { valid: false, error: "Mã giảm giá không được vượt quá 30 ký tự." }
  }
  return { valid: true }
}

/**
 * Pure evaluation function for coupon calculation:
 * - Checks status, schedule, scope, exclusions, min order amount.
 * - Calculates discount (fixed or percent with cap).
 * - Allocates discount proportionally across eligible lines with stable integer rounding.
 * - Enforces minimum payable order amount.
 */
export function evaluateCouponDiscount(params: {
  coupon: {
    id: string
    code: string
    name: string
    discountType: string
    discountValue: number
    maxDiscountAmount: number | null
    minOrderAmount: number | null
    scope: string
    startDate: Date | null
    endDate: Date | null
    status: string
    products?: Array<{ productId: string }>
    variants?: Array<{ variantId: string }>
    excludedProducts?: Array<{ productId: string }>
    excludedVariants?: Array<{ variantId: string }>
  }
  items: OrderItemEvalInput[]
  email?: string
  now?: Date
  activeTotalRedemptions?: number
  activeEmailRedemptions?: number
  usageLimit?: number | null
  perEmailLimit?: number | null
}): CouponEvaluationResult {
  const { coupon, items } = params
  const now = params.now || new Date()
  const code = normalizeCouponCode(coupon.code)

  // 1. Calculate overall subtotal and consolidate duplicate items
  const consolidatedMap = new Map<string, OrderItemEvalInput>()
  for (const item of items) {
    const qty = Math.max(0, Math.floor(item.quantity))
    const price = Math.max(0, Math.floor(item.priceCents))
    if (qty <= 0) continue

    const existing = consolidatedMap.get(item.variantId)
    if (existing) {
      existing.quantity += qty
    } else {
      consolidatedMap.set(item.variantId, {
        productId: item.productId,
        variantId: item.variantId,
        quantity: qty,
        priceCents: price,
        productName: item.productName,
        variantName: item.variantName,
      })
    }
  }

  const consolidatedItems = Array.from(consolidatedMap.values())
  const subtotalCents = consolidatedItems.reduce((sum, it) => sum + it.priceCents * it.quantity, 0)

  const emptyFail = (errorCode: CouponEvaluationResult["errorCode"], error: string): CouponEvaluationResult => ({
    valid: false,
    code,
    couponId: coupon.id,
    subtotalCents,
    eligibleSubtotalCents: 0,
    discountCents: 0,
    totalCents: subtotalCents,
    allocations: [],
    errorCode,
    error,
  })

  // 2. Status check
  if (coupon.status !== "active") {
    if (coupon.status === "draft") {
      return emptyFail("INACTIVE", "Mã giảm giá này hiện chưa được kích hoạt.")
    }
    if (coupon.status === "paused") {
      return emptyFail("INACTIVE", "Mã giảm giá này đang tạm ngừng sử dụng.")
    }
    return emptyFail("INACTIVE", "Mã giảm giá này không còn khả dụng.")
  }

  // 3. Date schedule check
  if (coupon.startDate && now < coupon.startDate) {
    return emptyFail("NOT_STARTED", "Mã giảm giá này chưa đến thời gian áp dụng.")
  }
  if (coupon.endDate && now > coupon.endDate) {
    return emptyFail("EXPIRED", "Mã giảm giá này đã hết hạn sử dụng.")
  }

  // 4. Usage quota checks
  if (params.usageLimit !== undefined && params.usageLimit !== null) {
    const totalCount = params.activeTotalRedemptions ?? 0
    if (totalCount >= params.usageLimit) {
      return emptyFail("USAGE_LIMIT_EXCEEDED", "Mã giảm giá này đã hết lượt sử dụng.")
    }
  }

  if (params.perEmailLimit !== undefined && params.perEmailLimit !== null && params.email) {
    const emailCount = params.activeEmailRedemptions ?? 0
    if (emailCount >= params.perEmailLimit) {
      return emptyFail("EMAIL_LIMIT_EXCEEDED", "Email này đã sử dụng hết số lượt cho phép của mã ưu đãi.")
    }
  }

  // 5. Scope & Exclusion filtering (Exclusions take absolute precedence!)
  const excludedProductSet = new Set((coupon.excludedProducts || []).map((p) => p.productId))
  const excludedVariantSet = new Set((coupon.excludedVariants || []).map((v) => v.variantId))
  const targetProductSet = new Set((coupon.products || []).map((p) => p.productId))
  const targetVariantSet = new Set((coupon.variants || []).map((v) => v.variantId))

  const eligibleItems: Array<OrderItemEvalInput & { lineTotal: number }> = []
  let eligibleSubtotalCents = 0

  for (const item of consolidatedItems) {
    const lineTotal = item.priceCents * item.quantity

    // Check exclusion first
    if (excludedVariantSet.has(item.variantId) || excludedProductSet.has(item.productId)) {
      continue
    }

    // Check scope
    let isEligible = false
    if (coupon.scope === "all") {
      isEligible = true
    } else if (coupon.scope === "products") {
      isEligible = targetProductSet.has(item.productId)
    } else if (coupon.scope === "variants") {
      isEligible = targetVariantSet.has(item.variantId)
    }

    if (isEligible) {
      eligibleItems.push({ ...item, lineTotal })
      eligibleSubtotalCents += lineTotal
    }
  }

  if (eligibleItems.length === 0 || eligibleSubtotalCents <= 0) {
    return emptyFail("NO_ELIGIBLE_ITEMS", "Mã giảm giá này không áp dụng cho sản phẩm hoặc gói bạn đã chọn.")
  }

  // 6. Minimum Order Amount on eligible subtotal
  if (coupon.minOrderAmount && coupon.minOrderAmount > 0) {
    if (eligibleSubtotalCents < coupon.minOrderAmount) {
      const minFormatted = new Intl.NumberFormat("vi-VN").format(coupon.minOrderAmount) + "đ"
      return emptyFail(
        "MIN_ORDER_NOT_MET",
        `Đơn hàng cần đạt tối thiểu ${minFormatted} cho các sản phẩm hợp lệ để áp dụng mã này.`
      )
    }
  }

  // 7. Calculate discount
  let rawDiscount = 0
  if (coupon.discountType === "fixed") {
    rawDiscount = Math.max(0, Math.floor(coupon.discountValue))
  } else if (coupon.discountType === "percent" || coupon.discountType === "percentage") {
    const pct = Math.max(1, Math.min(100, Math.floor(coupon.discountValue)))
    // Exact integer math: floor((eligibleSubtotal * pct) / 100)
    rawDiscount = Math.floor((eligibleSubtotalCents * pct) / 100)
    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
      rawDiscount = Math.min(rawDiscount, coupon.maxDiscountAmount)
    }
  } else {
    return emptyFail("INVALID_CONFIG", "Cấu hình loại ưu đãi của mã không hợp lệ.")
  }

  // Never discount more than eligible subtotal
  const discountCents = Math.min(rawDiscount, eligibleSubtotalCents)
  const totalCents = subtotalCents - discountCents

  // 8. Enforce minimum payable amount (no free 0đ or negative orders)
  if (totalCents < MIN_PAYABLE_AMOUNT_VND) {
    const minPayFormatted = new Intl.NumberFormat("vi-VN").format(MIN_PAYABLE_AMOUNT_VND) + "đ"
    return emptyFail(
      "BELOW_MIN_PAYABLE",
      `Số tiền thanh toán sau giảm giá phải đạt tối thiểu ${minPayFormatted} để thực hiện giao dịch ngân hàng.`
    )
  }

  // 9. Deterministic discount allocation across eligible items with stable integer remainder distribution
  const allocations: CouponItemAllocation[] = []
  let allocatedSum = 0

  // Sort eligible items by lineTotal descending so the largest item deterministically receives any rounding residue
  const sortedEligible = [...eligibleItems].sort((a, b) => b.lineTotal - a.lineTotal)

  for (let i = 0; i < sortedEligible.length; i++) {
    const it = sortedEligible[i]
    // Proportional formula: floor((it.lineTotal * discountCents) / eligibleSubtotalCents)
    const lineDiscount = Math.floor((it.lineTotal * discountCents) / eligibleSubtotalCents)
    allocatedSum += lineDiscount
    allocations.push({
      variantId: it.variantId,
      discountCents: lineDiscount,
      lineSubtotal: it.lineTotal,
      lineFinalTotal: it.lineTotal - lineDiscount,
    })
  }

  // Distribute rounding residue (if any) to the largest eligible line
  const residue = discountCents - allocatedSum
  if (residue > 0 && allocations.length > 0) {
    allocations[0].discountCents += residue
    allocations[0].lineFinalTotal -= residue
  }

  const snapshot: CouponSnapshotData = {
    couponId: coupon.id,
    code,
    name: coupon.name,
    discountType: coupon.discountType as "fixed" | "percent",
    discountValue: coupon.discountValue,
    maxDiscountAmount: coupon.maxDiscountAmount,
    minOrderAmount: coupon.minOrderAmount,
    scope: coupon.scope,
    appliedAt: now.toISOString(),
    subtotalCents,
    eligibleSubtotalCents,
    discountCents,
    totalCents,
    allocations,
  }

  return {
    valid: true,
    code,
    couponId: coupon.id,
    name: coupon.name,
    discountType: coupon.discountType as "fixed" | "percent",
    discountValue: coupon.discountValue,
    subtotalCents,
    eligibleSubtotalCents,
    discountCents,
    totalCents,
    allocations,
    couponSnapshot: snapshot,
  }
}

/**
 * Public preview function used by storefront checkout:
 * Checks code and quota WITHOUT reserving.
 * Safe for public callers (no secret data disclosed).
 */
export async function previewCouponCode(params: {
  code: string
  email?: string
  items: OrderItemEvalInput[]
}): Promise<CouponEvaluationResult> {
  const code = normalizeCouponCode(params.code)
  if (!code) {
    return {
      valid: false,
      code: "",
      subtotalCents: 0,
      eligibleSubtotalCents: 0,
      discountCents: 0,
      totalCents: 0,
      allocations: [],
      error: "Vui lòng nhập mã giảm giá.",
      errorCode: "INVALID_CODE",
    }
  }

  const formatCheck = validateCouponCodeFormat(code)
  if (!formatCheck.valid) {
    return {
      valid: false,
      code,
      subtotalCents: 0,
      eligibleSubtotalCents: 0,
      discountCents: 0,
      totalCents: 0,
      allocations: [],
      error: formatCheck.error,
      errorCode: "INVALID_CODE",
    }
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code },
    include: {
      products: { select: { productId: true } },
      variants: { select: { variantId: true } },
      excludedProducts: { select: { productId: true } },
      excludedVariants: { select: { variantId: true } },
    },
  })

  if (!coupon) {
    return {
      valid: false,
      code,
      subtotalCents: 0,
      eligibleSubtotalCents: 0,
      discountCents: 0,
      totalCents: 0,
      allocations: [],
      error: "Mã giảm giá không tồn tại hoặc đã bị xóa.",
      errorCode: "NOT_FOUND",
    }
  }

  // Count active reservations + redemptions
  const [activeTotal, activeEmail] = await Promise.all([
    coupon.usageLimit
      ? prisma.couponRedemption.count({
          where: { couponId: coupon.id, status: { in: ["reserved", "redeemed"] } },
        })
      : 0,
    coupon.perEmailLimit && params.email
      ? prisma.couponRedemption.count({
          where: {
            couponId: coupon.id,
            email: params.email.trim().toLowerCase(),
            status: { in: ["reserved", "redeemed"] },
          },
        })
      : 0,
  ])

  return evaluateCouponDiscount({
    coupon,
    items: params.items,
    email: params.email,
    activeTotalRedemptions: activeTotal,
    activeEmailRedemptions: activeEmail,
    usageLimit: coupon.usageLimit,
    perEmailLimit: coupon.perEmailLimit,
  })
}

/**
 * Transactional coupon reservation:
 * Must run inside Prisma transaction when creating an order.
 * Ensures atomicity, optimistic locking (version) and quota guarantees.
 */
export async function reserveCouponForOrder(
  tx: Prisma.TransactionClient,
  params: {
    code: string
    email: string
    items: OrderItemEvalInput[]
    orderId: string
  }
): Promise<{ success: boolean; evaluation: CouponEvaluationResult; redemptionId?: string }> {
  const code = normalizeCouponCode(params.code)
  const normalizedEmail = params.email.trim().toLowerCase()

  const coupon = await tx.coupon.findUnique({
    where: { code },
    include: {
      products: { select: { productId: true } },
      variants: { select: { variantId: true } },
      excludedProducts: { select: { productId: true } },
      excludedVariants: { select: { variantId: true } },
    },
  })

  if (!coupon) {
    return {
      success: false,
      evaluation: {
        valid: false,
        code,
        subtotalCents: 0,
        eligibleSubtotalCents: 0,
        discountCents: 0,
        totalCents: 0,
        allocations: [],
        error: "Mã giảm giá không tồn tại.",
        errorCode: "NOT_FOUND",
      },
    }
  }

  // Count active reservations and redemptions within the interactive transaction
  const [activeTotal, activeEmail] = await Promise.all([
    coupon.usageLimit
      ? tx.couponRedemption.count({
          where: { couponId: coupon.id, status: { in: ["reserved", "redeemed"] } },
        })
      : 0,
    coupon.perEmailLimit
      ? tx.couponRedemption.count({
          where: {
            couponId: coupon.id,
            email: normalizedEmail,
            status: { in: ["reserved", "redeemed"] },
          },
        })
      : 0,
  ])

  const evaluation = evaluateCouponDiscount({
    coupon,
    items: params.items,
    email: normalizedEmail,
    activeTotalRedemptions: activeTotal,
    activeEmailRedemptions: activeEmail,
    usageLimit: coupon.usageLimit,
    perEmailLimit: coupon.perEmailLimit,
  })

  if (!evaluation.valid) {
    return { success: false, evaluation }
  }

  // Optimistic concurrency check: update version atomically
  const updatedCoupon = await tx.coupon.updateMany({
    where: {
      id: coupon.id,
      version: coupon.version,
      status: "active",
    },
    data: {
      version: { increment: 1 },
    },
  })

  if (updatedCoupon.count === 0) {
    return {
      success: false,
      evaluation: {
        ...evaluation,
        valid: false,
        error: "Mã ưu đãi đang được nhiều người cùng sử dụng. Vui lòng thử lại sau giây lát.",
        errorCode: "USAGE_LIMIT_EXCEEDED",
      },
    }
  }

  // Check existing redemption for idempotency
  const existingRedemption = await tx.couponRedemption.findUnique({
    where: { orderId: params.orderId },
  })
  if (existingRedemption) {
    if (existingRedemption.status === "reserved" || existingRedemption.status === "redeemed") {
      return { success: true, evaluation, redemptionId: existingRedemption.id }
    }
    const updatedRedemption = await tx.couponRedemption.update({
      where: { id: existingRedemption.id },
      data: {
        status: "reserved",
        discountAmount: evaluation.discountCents,
        reservedAt: new Date(),
        releasedAt: null,
        releaseReason: null,
      },
    })
    return { success: true, evaluation, redemptionId: updatedRedemption.id }
  }

  // Create redemption in 'reserved' state linked to order
  const redemption = await tx.couponRedemption.create({
    data: {
      couponId: coupon.id,
      orderId: params.orderId,
      email: normalizedEmail,
      discountAmount: evaluation.discountCents,
      status: "reserved",
    },
  })

  return {
    success: true,
    evaluation,
    redemptionId: redemption.id,
  }
}

/**
 * Transition redemption from 'reserved' to 'redeemed' upon successful payment:
 * Strictly idempotent: if already redeemed, no-op.
 */
export async function redeemCouponReservation(
  orderId: string,
  txClient?: Prisma.TransactionClient
): Promise<boolean> {
  const db = txClient || prisma

  const redemption = await db.couponRedemption.findUnique({
    where: { orderId },
  })

  if (!redemption) return false
  if (redemption.status === "redeemed") return true // Idempotent

  if (redemption.status === "reserved") {
    await db.couponRedemption.update({
      where: { id: redemption.id },
      data: {
        status: "redeemed",
        redeemedAt: new Date(),
      },
    })

    // Increment fast counter on Coupon
    await db.coupon.update({
      where: { id: redemption.couponId },
      data: {
        usedCount: { increment: 1 },
      },
    })
    return true
  }

  return false
}

/**
 * Release a reserved coupon when an order is cancelled or expires without payment:
 * Strictly safe: never releases if already redeemed!
 */
export async function releaseCouponReservation(
  orderId: string,
  txClient?: Prisma.TransactionClient,
  reason = "order_cancelled"
): Promise<boolean> {
  const db = txClient || prisma

  const redemption = await db.couponRedemption.findUnique({
    where: { orderId },
  })

  if (!redemption) return false
  // Terminal protection: NEVER release an already redeemed coupon
  if (redemption.status === "redeemed") return false
  if (redemption.status === "released") return true // Idempotent

  if (redemption.status === "reserved") {
    await db.couponRedemption.update({
      where: { id: redemption.id },
      data: {
        status: "released",
        releasedAt: new Date(),
        releaseReason: reason,
      },
    })
    return true
  }

  return false
}
