import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"
import { normalizeCouponCode } from "@/lib/coupon-service"

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")?.trim().toUpperCase() || ""
    const status = searchParams.get("status") || "all"

    const where: any = {}
    if (status !== "all") {
      where.status = status
    }
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ]
    }

    const [coupons, products] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          products: { include: { product: { select: { id: true, name: true } } } },
          variants: { include: { variant: { select: { id: true, name: true, priceCents: true, productId: true } } } },
          excludedProducts: { include: { product: { select: { id: true, name: true } } } },
          excludedVariants: { include: { variant: { select: { id: true, name: true, priceCents: true, productId: true } } } },
          redemptions: {
            select: {
              id: true,
              status: true,
              discountAmount: true,
              email: true,
              reservedAt: true,
              redeemedAt: true,
              releasedAt: true,
              order: { select: { id: true, code: true, status: true, totalCents: true, createdAt: true } },
            },
            orderBy: { reservedAt: "desc" },
            take: 20,
          },
          _count: {
            select: {
              redemptions: true,
            },
          },
        },
      }),
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          variants: {
            select: {
              id: true,
              name: true,
              priceCents: true,
              providerPrice: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ])

    const formattedCoupons = coupons.map((c) => {
      const redeemedCount = c.redemptions.filter((r) => r.status === "redeemed").length
      const reservedCount = c.redemptions.filter((r) => r.status === "reserved").length
      const activeConsumed = redeemedCount + reservedCount
      const remainingQuota = c.usageLimit !== null ? Math.max(0, c.usageLimit - activeConsumed) : null

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        description: null,
        discountType: c.discountType === "percent" ? "percentage" : "fixed",
        discountValue: c.discountValue,
        maxDiscountCents: c.maxDiscountAmount,
        minOrderCents: c.minOrderAmount || 0,
        scope: c.scope,
        status: c.status,
        usageLimit: c.usageLimit,
        perEmailLimit: c.perEmailLimit,
        startsAt: c.startDate ? c.startDate.toISOString() : null,
        endsAt: c.endDate ? c.endDate.toISOString() : null,
        version: c.version,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        stats: {
          redeemedCount,
          reservedCount,
          totalRedemptions: c._count.redemptions,
          remainingQuota,
        },
        products: c.products.map((p) => ({ id: p.productId, name: p.product.name })),
        variants: c.variants.map((v) => ({ id: v.variantId, name: v.variant.name, productId: v.variant.productId })),
        excludedProducts: c.excludedProducts.map((p) => ({ id: p.productId, name: p.product.name })),
        excludedVariants: c.excludedVariants.map((v) => ({ id: v.variantId, name: v.variant.name, productId: v.variant.productId })),
        recentRedemptions: c.redemptions.map((r) => ({
          id: r.id,
          status: r.status,
          discountCents: r.discountAmount,
          email: r.email,
          reservedAt: r.reservedAt.toISOString(),
          redeemedAt: r.redeemedAt ? r.redeemedAt.toISOString() : null,
          releasedAt: r.releasedAt ? r.releasedAt.toISOString() : null,
          orderCode: r.order.code,
          orderId: r.order.id,
          orderStatus: r.order.status,
        })),
      }
    })

    return NextResponse.json({
      success: true,
      coupons: formattedCoupons,
      catalog: {
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceCents: v.priceCents,
            providerPrice: v.providerPrice,
          })),
        })),
      },
    })
  } catch (error: any) {
    console.error("[GET /api/admin/coupons] Error:", error)
    return NextResponse.json({ error: "Lỗi tải danh sách mã giảm giá: " + error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      code,
      name,
      discountType,
      discountValue,
      maxDiscountCents,
      minOrderCents = 0,
      scope = "all",
      status = "active",
      usageLimit = null,
      perEmailLimit = null,
      startsAt = null,
      endsAt = null,
      productIds = [],
      variantIds = [],
      excludedProductIds = [],
      excludedVariantIds = [],
    } = body

    const cleanCode = normalizeCouponCode(code)
    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 30) {
      return NextResponse.json(
        { error: "Mã giảm giá phải từ 3 đến 30 ký tự chữ và số" },
        { status: 400 }
      )
    }

    if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
      return NextResponse.json(
        { error: "Mã giảm giá chỉ được chứa chữ cái, số, gạch ngang (-) hoặc gạch dưới (_)" },
        { status: 400 }
      )
    }

    const existing = await prisma.coupon.findUnique({
      where: { code: cleanCode },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Mã giảm giá "${cleanCode}" đã tồn tại trong hệ thống (kể cả mã lưu trữ). Vui lòng chọn mã khác.` },
        { status: 400 }
      )
    }

    const cleanName = typeof name === "string" ? name.trim() : ""
    if (!cleanName || cleanName.length < 2 || cleanName.length > 120) {
      return NextResponse.json(
        { error: "Tên mã giảm giá phải từ 2 đến 120 ký tự" },
        { status: 400 }
      )
    }

    if (discountType !== "fixed" && discountType !== "percentage" && discountType !== "percent") {
      return NextResponse.json(
        { error: "Loại giảm giá phải là 'fixed' (số tiền) hoặc 'percentage' (phần trăm)" },
        { status: 400 }
      )
    }

    const numValue = Number(discountValue)
    if (!Number.isInteger(numValue) || numValue <= 0) {
      return NextResponse.json(
        { error: "Giá trị giảm giá phải là số nguyên dương" },
        { status: 400 }
      )
    }

    const isPercent = discountType === "percentage" || discountType === "percent"
    let parsedMaxDiscount: number | null = null
    if (isPercent) {
      if (numValue > 100) {
        return NextResponse.json(
          { error: "Mức giảm phần trăm không được vượt quá 100%" },
          { status: 400 }
        )
      }
      if (!maxDiscountCents || Number(maxDiscountCents) <= 0) {
        return NextResponse.json(
          { error: "Mã giảm phần trăm bắt buộc phải có mức giảm tối đa (VNĐ) để kiểm soát trần rủi ro" },
          { status: 400 }
        )
      }
      parsedMaxDiscount = Math.round(Number(maxDiscountCents))
    } else {
      if (maxDiscountCents) {
        parsedMaxDiscount = Math.round(Number(maxDiscountCents))
      }
    }

    const numMinOrder = Math.max(0, Math.round(Number(minOrderCents) || 0))
    const numUsageLimit = usageLimit ? Math.max(1, Math.round(Number(usageLimit))) : null
    const numPerEmailLimit = perEmailLimit ? Math.max(1, Math.round(Number(perEmailLimit))) : null

    let parsedStartsAt: Date | null = null
    let parsedEndsAt: Date | null = null
    if (startsAt) {
      parsedStartsAt = new Date(startsAt)
      if (isNaN(parsedStartsAt.getTime())) {
        return NextResponse.json({ error: "Thời gian bắt đầu không hợp lệ" }, { status: 400 })
      }
    }
    if (endsAt) {
      parsedEndsAt = new Date(endsAt)
      if (isNaN(parsedEndsAt.getTime())) {
        return NextResponse.json({ error: "Thời gian kết thúc không hợp lệ" }, { status: 400 })
      }
    }
    if (parsedStartsAt && parsedEndsAt && parsedStartsAt > parsedEndsAt) {
      return NextResponse.json(
        { error: "Thời gian bắt đầu không được sau thời gian kết thúc" },
        { status: 400 }
      )
    }

    if (!["draft", "active", "paused"].includes(status)) {
      return NextResponse.json(
        { error: "Trạng thái không hợp lệ (draft, active, paused)" },
        { status: 400 }
      )
    }

    const validScope = ["all", "products", "variants"].includes(scope) ? scope : "all"
    if (validScope === "products" && (!Array.isArray(productIds) || productIds.length === 0)) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất 1 sản phẩm cho phạm vi chỉ định" },
        { status: 400 }
      )
    }
    if (validScope === "variants" && (!Array.isArray(variantIds) || variantIds.length === 0)) {
      return NextResponse.json(
        { error: "Vui lòng chọn ít nhất 1 biến thể cho phạm vi chỉ định" },
        { status: 400 }
      )
    }

    const createdCoupon = await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.create({
        data: {
          code: cleanCode,
          name: cleanName,
          discountType: isPercent ? "percent" : "fixed",
          discountValue: numValue,
          maxDiscountAmount: parsedMaxDiscount,
          minOrderAmount: numMinOrder,
          scope: validScope,
          status,
          usageLimit: numUsageLimit,
          perEmailLimit: numPerEmailLimit,
          startDate: parsedStartsAt,
          endDate: parsedEndsAt,
          products: validScope === "products" && Array.isArray(productIds)
            ? { create: productIds.map((pId: string) => ({ productId: pId })) }
            : undefined,
          variants: validScope === "variants" && Array.isArray(variantIds)
            ? { create: variantIds.map((vId: string) => ({ variantId: vId })) }
            : undefined,
          excludedProducts: Array.isArray(excludedProductIds) && excludedProductIds.length > 0
            ? { create: excludedProductIds.map((pId: string) => ({ productId: pId })) }
            : undefined,
          excludedVariants: Array.isArray(excludedVariantIds) && excludedVariantIds.length > 0
            ? { create: excludedVariantIds.map((vId: string) => ({ variantId: vId })) }
            : undefined,
        },
      })

      await tx.couponAuditLog.create({
        data: {
          couponId: coupon.id,
          action: "create",
          actor: auth.username || "admin",
          diff: JSON.stringify({
            code: cleanCode,
            discountType: isPercent ? "percent" : "fixed",
            discountValue: numValue,
            maxDiscountAmount: parsedMaxDiscount,
            status,
            scope: validScope,
          }),
        },
      })

      return coupon
    })

    return NextResponse.json({ success: true, coupon: createdCoupon })
  } catch (error: any) {
    console.error("[POST /api/admin/coupons] Error:", error)
    return NextResponse.json({ error: "Lỗi tạo mã giảm giá: " + error.message }, { status: 500 })
  }
}
