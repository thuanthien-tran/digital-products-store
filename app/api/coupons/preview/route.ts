import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { previewCouponCode, OrderItemEvalInput } from "@/lib/coupon-service"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { validateEmail } from "@/lib/validations"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const rate = checkRateLimit(`coupon_prev:${ip}`, 30, 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: "Bạn thao tác quá nhanh. Vui lòng thử lại sau giây lát.",
          errorCode: "RATE_LIMITED",
        },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, valid: false, error: "Dữ liệu yêu cầu không hợp lệ.", errorCode: "INVALID_BODY" },
        { status: 400 }
      )
    }

    const { code, email, items } = body

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json(
        { success: false, valid: false, error: "Vui lòng nhập mã giảm giá.", errorCode: "INVALID_CODE" },
        { status: 400 }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, valid: false, error: "Đơn hàng chưa có sản phẩm nào.", errorCode: "NO_ITEMS" },
        { status: 400 }
      )
    }

    // Optional email validation if provided
    let normalizedEmail: string | undefined = undefined
    if (email && typeof email === "string" && email.trim()) {
      const emailRes = validateEmail(email)
      if (emailRes.valid) {
        normalizedEmail = emailRes.normalized
      }
    }

    // Server-side authoritative price lookup: NEVER trust priceCents from client
    const variantIds = items.map((i: any) => String(i.variantId || ""))
    const variants = await prisma.variant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: {
          select: { id: true, name: true, visibility: true, editorialStatus: true },
        },
      },
    })

    const evalItems: OrderItemEvalInput[] = []
    for (const rawItem of items) {
      const v = variants.find((variant) => variant.id === rawItem.variantId)
      if (!v) continue

      // Ignore unpublished or hidden products from calculation
      if (v.product.visibility !== "public" || v.product.editorialStatus !== "published") {
        continue
      }

      const qty = Math.max(1, Math.min(999, parseInt(String(rawItem.quantity), 10) || 1))
      evalItems.push({
        productId: v.productId,
        variantId: v.id,
        quantity: qty,
        priceCents: v.priceCents,
        productName: v.product.name,
        variantName: v.name,
      })
    }

    if (evalItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: "Không tìm thấy sản phẩm hợp lệ trong đơn hàng.",
          errorCode: "NO_ELIGIBLE_ITEMS",
        },
        { status: 400 }
      )
    }

    const result = await previewCouponCode({
      code: String(code),
      email: normalizedEmail,
      items: evalItems,
    })

    if (!result.valid) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: result.error || "Mã giảm giá không hợp lệ.",
          errorCode: result.errorCode || "INVALID_COUPON",
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ...result,
      success: true,
      coupon: {
        id: result.couponId,
        code: result.code,
        name: result.name || result.code,
        discountType: result.discountType === "percent" ? "percentage" : "fixed",
        discountValue: result.discountValue,
        maxDiscountCents: result.couponSnapshot?.maxDiscountAmount ?? null,
        subtotalCents: result.subtotalCents,
        discountCents: result.discountCents,
        finalTotalCents: result.totalCents,
        description: result.couponSnapshot?.name || "",
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi kiểm tra mã giảm giá"
    return NextResponse.json(
      { success: false, valid: false, error: msg, errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
