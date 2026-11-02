import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateOrderCode } from "@/lib/utils"
import { validateEmail, validateQuantity, generateAccessToken } from "@/lib/validations"
import { verifyAdminRequest } from "@/lib/auth"
import { verifyVariantLiveStock } from "@/lib/provider-stock-verifier"

interface OrderItemInput {
  productId: string
  variantId: string
  quantity: number
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, items } = body

    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.error || "Địa chỉ email không hợp lệ" },
        { status: 400 }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Danh sách sản phẩm không hợp lệ" },
        { status: 400 }
      )
    }

    // Validate quantities
    for (const item of items as OrderItemInput[]) {
      const qtyValidation = validateQuantity(item.quantity)
      if (!qtyValidation.valid) {
        return NextResponse.json(
          { error: qtyValidation.error || "Số lượng sản phẩm không hợp lệ" },
          { status: 400 }
        )
      }
    }

    // Fetch variants with stock count, product visibility and connection snapshot info
    const variantIds = items.map((i: OrderItemInput) => i.variantId)
    const variants = await prisma.variant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: true,
        connection: true,
        sourceProduct: true,
        _count: { select: { serials: { where: { status: "available" } } } },
      },
    })

    // Consolidate quantities if the same variantId is submitted multiple times
    const variantQtyMap = new Map<string, number>()
    for (const item of items as OrderItemInput[]) {
      const current = variantQtyMap.get(item.variantId) || 0
      variantQtyMap.set(item.variantId, current + item.quantity)
    }

    // Check visibility, purchase limits, and live provider stock on consolidated quantities
    for (const [vId, totalQty] of variantQtyMap.entries()) {
      const variant = variants.find((v) => v.id === vId)
      if (!variant) {
        return NextResponse.json(
          { error: "Gói sản phẩm được chọn không tồn tại" },
          { status: 400 }
        )
      }

      // Check min/max purchase limits
      if (variant.minQuantity && totalQty < variant.minQuantity) {
        return NextResponse.json(
          { error: `Số lượng đặt mua tối thiểu cho "${variant.name}" là ${variant.minQuantity}` },
          { status: 400 }
        )
      }
      if (variant.maxQuantity && totalQty > variant.maxQuantity) {
        return NextResponse.json(
          { error: `Số lượng đặt mua tối đa cho mỗi đơn hàng của "${variant.name}" là ${variant.maxQuantity}` },
          { status: 400 }
        )
      }

      // INVARIANT: Hidden or unpublished products must not be orderable
      if (variant.product.visibility !== "public" || variant.product.editorialStatus !== "published") {
        return NextResponse.json(
          { error: `Sản phẩm "${variant.product.name}" hiện không khả dụng` },
          { status: 400 }
        )
      }

      // INVARIANT: Admin suspended products must not be orderable
      if (variant.product.statusOverride === "out_of_stock") {
        return NextResponse.json(
          { error: `Sản phẩm "${variant.product.name}" hiện đang tạm khóa bán bởi quản trị viên` },
          { status: 400 }
        )
      }

      const isProviderBacked = Boolean(
        variant.connectionId ||
        variant.provider ||
        variant.product.deliveryType === "fatcat" ||
        variant.product.deliveryType === "dino"
      )

      if (isProviderBacked) {
        // Safe fulfillment guard: When FatCat live buy is not activated, reject checkout if no local stock
        const isLiveBuyActive = process.env.ENABLE_FATCAT_LIVE_BUY === "true"
        if (
          (variant.provider === "fatcat" || variant.product.deliveryType === "fatcat") &&
          !isLiveBuyActive &&
          variant._count.serials < totalQty
        ) {
          return NextResponse.json(
            {
              error: `Sản phẩm "${variant.product.name}" chưa bật kênh thanh toán trực tuyến. Vui lòng liên hệ hỗ trợ.`,
            },
            { status: 400 }
          )
        }

        // Live on-demand pre-checkout verification with provider adapter
        const verifyRes = await verifyVariantLiveStock(vId)

        if (!verifyRes.ok) {
          const cachedStock = (variant.providerStock ?? 0) + variant._count.serials
          if (cachedStock < totalQty) {
            if (verifyRes.isNetworkOrTimeout) {
              return NextResponse.json(
                {
                  error: "Chưa thể xác minh nguồn hàng từ đại lý. Vui lòng thử lại sau.",
                  code: "UNVERIFIED_SOURCE",
                },
                { status: 503 }
              )
            }
            return NextResponse.json(
              {
                error: verifyRes.error || "Không thể xác minh nguồn hàng từ đại lý",
                code: "UNVERIFIED_SOURCE",
              },
              { status: 400 }
            )
          }
          console.warn(`[Checkout] Phục vụ đơn từ tồn kho DB (${cachedStock}) do đại lý chưa phản hồi.`)
        } else if (verifyRes.stock < totalQty) {
          if (verifyRes.stock === 0) {
            return NextResponse.json(
              {
                error: "Gói này vừa hết hàng. Vui lòng chọn gói khác hoặc quay lại sau.",
                code: "OUT_OF_STOCK",
              },
              { status: 400 }
            )
          }
          return NextResponse.json(
            {
              error: `Kho đại lý hiện chỉ còn ${verifyRes.stock} suất (bạn đang yêu cầu tổng cộng ${totalQty}). Vui lòng giảm số lượng.`,
              code: "INSUFFICIENT_STOCK",
              availableStock: verifyRes.stock,
            },
            { status: 400 }
          )
        }
      } else if (variant.product.deliveryType === "serials" && variant._count.serials < totalQty) {
        return NextResponse.json(
          {
            error: `Sản phẩm "${variant.product.name} - ${variant.name}" chỉ còn ${variant._count.serials} trong kho (bạn đang yêu cầu tổng cộng ${totalQty})`,
            code: "OUT_OF_STOCK",
          },
          { status: 400 }
        )
      }
    }

    let totalCents = 0
    const itemsToCreate = []

    for (const item of items as OrderItemInput[]) {
      const variant = variants.find((v) => v.id === item.variantId)!

      if (item.productId && variant.productId !== item.productId) {
        return NextResponse.json(
          { error: "Thông tin sản phẩm và biến thể không đồng bộ" },
          { status: 400 }
        )
      }

      const itemTotal = variant.priceCents * item.quantity
      totalCents += itemTotal

      itemsToCreate.push({
        productId: variant.productId,
        variantId: variant.id,
        quantity: item.quantity,
        priceCents: variant.priceCents,
        productName: variant.product.name,
        variantName: variant.name,
        connectionId: variant.connectionId || null,
        connectionName: variant.connection?.name || null,
        providerCost: variant.providerPrice || null,
      })
    }

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
        items: {
          create: itemsToCreate,
        },
      },
    })

    const response = NextResponse.json({
      id: order.id,
      code: order.code,
      accessToken,
    })

    // Set secure HttpOnly cookie for order access
    response.cookies.set(`order_access_${order.id}`, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    return response
  } catch (err) {
    console.error("Create order error:", err)
    return NextResponse.json({ error: "Lỗi hệ thống khi tạo đơn hàng" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get("email")
    const code = searchParams.get("code")

    const adminCheck = await verifyAdminRequest(req)
    const isAdmin = adminCheck.authenticated

    // Parse cookies strictly into a key-value map
    const cookieHeader = req.headers.get("cookie") || ""
    const cookieMap = new Map<string, string>()
    if (cookieHeader) {
      const parts = cookieHeader.split(";").map((p) => p.trim())
      for (const p of parts) {
        const eqIdx = p.indexOf("=")
        if (eqIdx !== -1) {
          const k = p.slice(0, eqIdx).trim()
          const v = decodeURIComponent(p.slice(eqIdx + 1).trim())
          cookieMap.set(k, v)
        }
      }
    }

    // Case 1: Order code is provided (Direct order lookup)
    if (code) {
      const normalizedCode = code.trim().toUpperCase()
      const whereClause: { code: string; email?: string } = { code: normalizedCode }

      if (email) {
        const emailCheck = validateEmail(email)
        if (!emailCheck.valid) {
          return NextResponse.json({ error: emailCheck.error }, { status: 400 })
        }
        whereClause.email = emailCheck.normalized
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          code: true,
          status: true,
          totalCents: true,
          createdAt: true,
        },
      })

      return NextResponse.json(orders)
    }

    // Case 2: Admin lookup by email
    if (isAdmin && email) {
      const emailCheck = validateEmail(email)
      if (!emailCheck.valid) {
        return NextResponse.json({ error: emailCheck.error }, { status: 400 })
      }

      const orders = await prisma.order.findMany({
        where: { email: emailCheck.normalized },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          code: true,
          status: true,
          totalCents: true,
          createdAt: true,
        },
      })
      return NextResponse.json(orders)
    }

    // Case 3: Public email lookup without order code -> MUST verify possession of valid order_access cookie
    if (email) {
      const emailCheck = validateEmail(email)
      if (!emailCheck.valid) {
        return NextResponse.json({ error: emailCheck.error }, { status: 400 })
      }

      // Fetch candidates belonging to this email
      const candidates = await prisma.order.findMany({
        where: { email: emailCheck.normalized },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          code: true,
          status: true,
          totalCents: true,
          createdAt: true,
          accessToken: true,
        },
      })

      // Strictly verify that caller possesses the exact matching accessToken cookie for each order
      const authorizedOrders = candidates.filter((o) => {
        if (!o.accessToken) return false
        const cookieVal = cookieMap.get(`order_access_${o.id}`)
        return cookieVal === o.accessToken
      })

      if (authorizedOrders.length === 0) {
        return NextResponse.json(
          {
            error:
              "Không thể xác thực quyền truy cập lịch sử đơn hàng. Vui lòng nhập mã đơn hàng cụ thể (ví dụ: AGXXXXXX) hoặc tra cứu từ thiết bị bạn đã đặt mua.",
          },
          { status: 401 }
        )
      }

      return NextResponse.json(
        authorizedOrders.map((o) => {
          const { accessToken, ...rest } = o
          void accessToken
          return rest
        })
      )
    }

    return NextResponse.json(
      { error: "Vui lòng cung cấp mã đơn hàng hoặc email để tra cứu" },
      { status: 400 }
    )
  } catch (err) {
    console.error("Lookup orders error:", err)
    return NextResponse.json({ error: "Lỗi hệ thống khi tra cứu đơn hàng" }, { status: 500 })
  }
}
