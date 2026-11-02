import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { generateOrderCode } from "@/lib/utils"
import { validateEmail, validateQuantity, generateAccessToken } from "@/lib/validations"
import { verifyVariantLiveStock } from "@/lib/provider-stock-verifier"

/**
 * Constant-time comparison for API keys
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verifies and maps incoming request to a specific Reseller Tenant Identity.
 * Supports multi-reseller JSON mapping or single RESELLER_API_KEY / API_KEY.
 */
function getResellerContext(req: Request): { authorized: boolean; resellerId?: string } {
  const apiKey = req.headers.get("x-api-key")
  if (!apiKey || !apiKey.trim()) return { authorized: false }

  const trimmedKey = apiKey.trim()

  // 1. Check multi-reseller mapping if configured: RESELLER_ACCOUNTS='{"partner_a":"key_a","partner_b":"key_b"}'
  const accountsJson = process.env.RESELLER_ACCOUNTS
  if (accountsJson && accountsJson.trim()) {
    try {
      const accounts: Record<string, string> = JSON.parse(accountsJson)
      const keysSeen = new Set<string>()
      for (const [id, key] of Object.entries(accounts)) {
        if (!key || typeof key !== "string" || !/^[a-zA-Z0-9_-]{2,64}$/.test(id)) {
          continue
        }
        if (keysSeen.has(key)) {
          console.error(`[Reseller Auth] Configuration error: Duplicate API key configured across multiple reseller IDs`)
          return { authorized: false }
        }
        keysSeen.add(key)

        if (timingSafeCompare(trimmedKey, key)) {
          return { authorized: true, resellerId: id }
        }
      }
    } catch (parseErr) {
      console.error("[Reseller Auth] Invalid JSON format in RESELLER_ACCOUNTS environment variable. Refusing fallback.", parseErr)
      return { authorized: false }
    }
  }

  // 2. Fall back to standard RESELLER_API_KEY
  const defaultKey = process.env.RESELLER_API_KEY || process.env.API_KEY
  if (defaultKey && timingSafeCompare(trimmedKey, defaultKey.trim())) {
    return { authorized: true, resellerId: "reseller_default" }
  }

  return { authorized: false }
}

export async function GET(req: Request) {
  const context = getResellerContext(req)
  if (!context.authorized || !context.resellerId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: API Key không hợp lệ hoặc chưa được kích hoạt" },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.json({ success: false, error: "Thiếu tham số code" }, { status: 400 })
  }

  const cleanCode = code.trim().toUpperCase()
  // INVARIANT: Reseller tenant isolation via dedicated resellerId column
  // Retail customer orders (resellerId is null) or orders from other resellers return 404 (Fail-closed)
  const order = await prisma.order.findFirst({
    where: {
      code: cleanCode,
      resellerId: context.resellerId,
    },
    include: {
      items: {
        include: {
          product: { select: { name: true } },
          variant: { select: { name: true } },
          serials: { select: { content: true } },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json(
      { success: false, error: "Không tìm thấy đơn hàng trong phạm vi đối tác của bạn" },
      {
        status: 404,
        headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
      }
    )
  }

  const isPaid = order.status === "paid"

  return NextResponse.json(
    {
      success: true,
      data: {
        orderCode: order.code,
        status: order.status,
        email: order.email,
        totalAmount: order.totalCents,
        createdAt: order.createdAt,
        items: order.items.map((i) => ({
          product: i.product.name,
          variant: i.variant.name,
          quantity: i.quantity,
          price: i.priceCents,
          serials: isPaid ? i.serials.map((s) => s.content) : [],
          serial: isPaid ? i.serials.map((s) => s.content).join("\n") || null : null,
        })),
      },
    },
    {
      headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
    }
  )
}

export async function POST(req: Request) {
  const context = getResellerContext(req)
  if (!context.authorized || !context.resellerId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: API Key không hợp lệ hoặc chưa được kích hoạt" },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    const { email, variantId, quantity = 1 } = body

    if (!email || !variantId) {
      return NextResponse.json(
        { success: false, error: "Email và variantId là bắt buộc" },
        { status: 400 }
      )
    }

    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      return NextResponse.json(
        { success: false, error: emailValidation.error || "Định dạng email không hợp lệ" },
        { status: 400 }
      )
    }

    const qtyValidation = validateQuantity(quantity)
    if (!qtyValidation.valid) {
      return NextResponse.json(
        { success: false, error: qtyValidation.error || "Số lượng không hợp lệ" },
        { status: 400 }
      )
    }

    const parsedQty = qtyValidation.value

    const variant = await prisma.variant.findUnique({
      where: { id: variantId },
      include: {
        product: true,
        connection: true,
        sourceProduct: true,
        _count: { select: { serials: { where: { status: "available" } } } },
      },
    })

    if (!variant) {
      return NextResponse.json({ success: false, error: "Gói sản phẩm không tồn tại" }, { status: 404 })
    }

    // INVARIANT: Public and published products only (Reject draft or hidden)
    if (variant.product.visibility !== "public" || variant.product.editorialStatus !== "published") {
      return NextResponse.json(
        { success: false, error: `Sản phẩm "${variant.product.name}" hiện không khả dụng` },
        { status: 400 }
      )
    }

    // INVARIANT: Reject products suspended by administrator
    if (variant.product.statusOverride === "out_of_stock") {
      return NextResponse.json(
        { success: false, error: `Sản phẩm "${variant.product.name}" hiện đang tạm khóa bán bởi quản trị viên` },
        { status: 400 }
      )
    }

    // Check purchase limits
    if (variant.minQuantity && parsedQty < variant.minQuantity) {
      return NextResponse.json(
        { success: false, error: `Số lượng đặt mua tối thiểu là ${variant.minQuantity}` },
        { status: 400 }
      )
    }
    if (variant.maxQuantity && parsedQty > variant.maxQuantity) {
      return NextResponse.json(
        { success: false, error: `Số lượng đặt mua tối đa là ${variant.maxQuantity}` },
        { status: 400 }
      )
    }

    // Check stock / live provider source
    const isProviderBacked = Boolean(
      variant.connectionId ||
      variant.provider ||
      variant.product.deliveryType === "fatcat" ||
      variant.product.deliveryType === "dino"
    )

    if (isProviderBacked) {
      const verifyRes = await verifyVariantLiveStock(variant.id)
      if (!verifyRes.ok) {
        const cachedStock = (variant.providerStock ?? 0) + variant._count.serials
        if (cachedStock < parsedQty) {
          return NextResponse.json(
            { success: false, error: verifyRes.error || "Không thể xác minh nguồn hàng từ đại lý" },
            { status: 400 }
          )
        }
      } else if (verifyRes.stock < parsedQty) {
        return NextResponse.json(
          { success: false, error: `Kho đại lý không đủ số lượng yêu cầu (Hiện còn ${verifyRes.stock})` },
          { status: 400 }
        )
      }
    } else if (variant.product.deliveryType === "serials" && variant._count.serials < parsedQty) {
      return NextResponse.json(
        { success: false, error: `Kho không đủ hàng (Hiện còn ${variant._count.serials})` },
        { status: 400 }
      )
    }

    // Server-determined price
    const totalCents = variant.priceCents * parsedQty

    // Unique order code
    let code = generateOrderCode()
    let existing = await prisma.order.findUnique({ where: { code } })
    while (existing) {
      code = generateOrderCode()
      existing = await prisma.order.findUnique({ where: { code } })
    }

    const accessToken = generateAccessToken()

    const order = await prisma.order.create({
      data: {
        code,
        email: emailValidation.normalized!,
        totalCents,
        status: "pending",
        accessToken,
        resellerId: context.resellerId,
        note: `[RESELLER:${context.resellerId}]`,
        items: {
          create: [
            {
              productId: variant.productId,
              variantId: variant.id,
              quantity: parsedQty,
              priceCents: variant.priceCents,
              productName: variant.product.name,
              variantName: variant.name,
              connectionId: variant.connectionId || null,
              connectionName: variant.connection?.name || null,
              providerCost: variant.providerPrice || null,
            },
          ],
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderCode: order.code,
        status: order.status,
        totalAmount: order.totalCents,
        email: order.email,
        resellerId: context.resellerId,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
