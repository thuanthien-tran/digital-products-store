import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên" }, { status: 401 })
  }

  try {
    const { id } = await params
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        products: { include: { product: { select: { id: true, name: true } } } },
        variants: { include: { variant: { select: { id: true, name: true, priceCents: true, productId: true } } } },
        excludedProducts: { include: { product: { select: { id: true, name: true } } } },
        excludedVariants: { include: { variant: { select: { id: true, name: true, priceCents: true, productId: true } } } },
        redemptions: {
          include: {
            order: { select: { id: true, code: true, status: true, totalCents: true, createdAt: true } },
          },
          orderBy: { reservedAt: "desc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    })

    if (!coupon) {
      return NextResponse.json({ error: "Không tìm thấy mã giảm giá" }, { status: 404 })
    }

    const formatted = {
      ...coupon,
      discountType: coupon.discountType === "percent" ? "percentage" : "fixed",
      maxDiscountCents: coupon.maxDiscountAmount,
      minOrderCents: coupon.minOrderAmount || 0,
      startsAt: coupon.startDate ? coupon.startDate.toISOString() : null,
      endsAt: coupon.endDate ? coupon.endDate.toISOString() : null,
      redemptions: coupon.redemptions.map((r) => ({
        ...r,
        discountCents: r.discountAmount,
      })),
      auditLogs: coupon.auditLogs.map((l) => ({
        ...l,
        details: l.diff,
      })),
    }

    return NextResponse.json({ success: true, coupon: formatted })
  } catch (error: any) {
    console.error("[GET /api/admin/coupons/[id]] Error:", error)
    return NextResponse.json({ error: "Lỗi tải thông tin mã: " + error.message }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const {
      name,
      discountType,
      discountValue,
      maxDiscountCents,
      minOrderCents = 0,
      scope = "all",
      status,
      usageLimit = null,
      perEmailLimit = null,
      startsAt = null,
      endsAt = null,
      productIds = [],
      variantIds = [],
      excludedProductIds = [],
      excludedVariantIds = [],
      version,
    } = body

    const existing = await prisma.coupon.findUnique({
      where: { id },
      include: {
        products: true,
        variants: true,
        excludedProducts: true,
        excludedVariants: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy mã giảm giá" }, { status: 404 })
    }

    // Optimistic concurrency control check
    if (version !== undefined && existing.version !== version) {
      return NextResponse.json(
        { error: "Dữ liệu mã giảm giá đã được thay đổi bởi phiên làm việc khác (HTTP 409 Conflict). Vui lòng tải lại trang." },
        { status: 409 }
      )
    }

    const cleanName = typeof name === "string" ? name.trim() : existing.name
    if (!cleanName || cleanName.length < 2 || cleanName.length > 120) {
      return NextResponse.json({ error: "Tên mã giảm giá phải từ 2 đến 120 ký tự" }, { status: 400 })
    }

    const isPercent = discountType === "percentage" || discountType === "percent"
    const validDiscountType = isPercent ? "percent" : "fixed"
    const numValue = Number(discountValue !== undefined ? discountValue : existing.discountValue)
    if (!Number.isInteger(numValue) || numValue <= 0) {
      return NextResponse.json({ error: "Giá trị giảm giá phải là số nguyên dương" }, { status: 400 })
    }

    let parsedMaxDiscount: number | null = null
    if (validDiscountType === "percent") {
      if (numValue > 100) {
        return NextResponse.json({ error: "Mức giảm phần trăm không được vượt quá 100%" }, { status: 400 })
      }
      if (!maxDiscountCents || Number(maxDiscountCents) <= 0) {
        return NextResponse.json(
          { error: "Mã giảm phần trăm bắt buộc phải có mức giảm tối đa (VNĐ)" },
          { status: 400 }
        )
      }
      parsedMaxDiscount = Math.round(Number(maxDiscountCents))
    } else {
      parsedMaxDiscount = maxDiscountCents ? Math.round(Number(maxDiscountCents)) : null
    }

    const numMinOrder = Math.max(0, Math.round(Number(minOrderCents) || 0))
    const numUsageLimit = usageLimit !== null && usageLimit !== undefined && usageLimit !== "" ? Math.max(1, Math.round(Number(usageLimit))) : null
    const numPerEmailLimit = perEmailLimit !== null && perEmailLimit !== undefined && perEmailLimit !== "" ? Math.max(1, Math.round(Number(perEmailLimit))) : null

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
      return NextResponse.json({ error: "Thời gian bắt đầu không được sau thời gian kết thúc" }, { status: 400 })
    }

    const validStatus = ["draft", "active", "paused", "archived"].includes(status) ? status : existing.status
    const validScope = ["all", "products", "variants"].includes(scope) ? scope : "all"

    const updatedCoupon = await prisma.$transaction(async (tx) => {
      // Clear old scope relations
      await tx.couponProduct.deleteMany({ where: { couponId: id } })
      await tx.couponVariant.deleteMany({ where: { couponId: id } })
      await tx.couponExcludedProduct.deleteMany({ where: { couponId: id } })
      await tx.couponExcludedVariant.deleteMany({ where: { couponId: id } })

      const updated = await tx.coupon.update({
        where: { id },
        data: {
          name: cleanName,
          discountType: validDiscountType,
          discountValue: numValue,
          maxDiscountAmount: parsedMaxDiscount,
          minOrderAmount: numMinOrder,
          scope: validScope,
          status: validStatus,
          usageLimit: numUsageLimit,
          perEmailLimit: numPerEmailLimit,
          startDate: parsedStartsAt,
          endDate: parsedEndsAt,
          version: { increment: 1 },
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

      // Audit log
      await tx.couponAuditLog.create({
        data: {
          couponId: id,
          action: "update",
          actor: auth.username || "admin",
          diff: JSON.stringify({
            changes: {
              name: cleanName !== existing.name ? { from: existing.name, to: cleanName } : undefined,
              status: validStatus !== existing.status ? { from: existing.status, to: validStatus } : undefined,
              discountValue: numValue !== existing.discountValue ? { from: existing.discountValue, to: numValue } : undefined,
              scope: validScope !== existing.scope ? { from: existing.scope, to: validScope } : undefined,
            },
          }),
        },
      })

      return updated
    })

    return NextResponse.json({ success: true, coupon: updatedCoupon })
  } catch (error: any) {
    console.error("[PUT /api/admin/coupons/[id]] Error:", error)
    return NextResponse.json({ error: "Lỗi cập nhật mã: " + error.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên" }, { status: 401 })
  }

  try {
    const { id } = await params
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true } } },
    })

    if (!coupon) {
      return NextResponse.json({ error: "Không tìm thấy mã giảm giá" }, { status: 404 })
    }

    // Never hard-delete coupons that have redemption history to preserve order audit integrity
    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id },
        data: {
          status: "archived",
          version: { increment: 1 },
        },
      })

      await tx.couponAuditLog.create({
        data: {
          couponId: id,
          action: "archive",
          actor: auth.username || "admin",
          diff: JSON.stringify({ previousStatus: coupon.status }),
        },
      })
    })

    return NextResponse.json({ success: true, message: `Đã lưu trữ mã giảm giá ${coupon.code}` })
  } catch (error: any) {
    console.error("[DELETE /api/admin/coupons/[id]] Error:", error)
    return NextResponse.json({ error: "Lỗi lưu trữ mã: " + error.message }, { status: 500 })
  }
}
