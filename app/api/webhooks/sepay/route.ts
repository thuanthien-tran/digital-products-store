import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { fulfillOrder } from "@/lib/fulfillment"

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

function verifySepayAuth(req: Request, expectedKey: string): boolean {
  const cleanExpected = expectedKey.trim()

  // 1. Check custom headers first (x-api-key, sepay-token)
  const xApiKey = req.headers.get("x-api-key") || req.headers.get("sepay-token")
  if (xApiKey && timingSafeCompare(xApiKey.trim(), cleanExpected)) {
    return true
  }

  // 2. Check standard Authorization header
  const authHeader = req.headers.get("authorization") || ""
  if (!authHeader.trim()) return false

  const trimmedAuth = authHeader.trim()

  // Exact raw match
  if (timingSafeCompare(trimmedAuth, cleanExpected)) {
    return true
  }

  // Check scheme + token: "Apikey xxx", "ApiKey xxx", "Bearer xxx", "Token xxx"
  const parts = trimmedAuth.split(/\s+/)
  if (parts.length >= 2) {
    const scheme = parts[0].toLowerCase()
    const token = parts.slice(1).join(" ").trim()
    if (["apikey", "bearer", "token"].includes(scheme)) {
      if (timingSafeCompare(token, cleanExpected)) {
        return true
      }
    }
  }

  return false
}

function isMatchingAccount(received: string | number | undefined, configured: string): boolean {
  if (!received) return false
  const r = String(received).trim().replace(/^0+/, "")
  const c = configured.trim().replace(/^0+/, "")
  return r === c || String(received).trim() === configured.trim()
}

async function resolveOrderCode(content: string, code?: string): Promise<string | null> {
  // 1. Check direct code property from SePay
  if (code && typeof code === "string" && code.trim()) {
    const cleanCode = code.trim().toUpperCase()
    const m = cleanCode.match(/AG[A-Z0-9]{6}/)
    if (m) return m[0]
  }

  const raw = (content || "").toUpperCase()

  // 2. Direct regex match AG followed by 6 alphanumeric characters
  const directMatch = raw.match(/AG[A-Z0-9]{6}/)
  if (directMatch) return directMatch[0]

  // 3. Space-separated: AG 123456
  const spaceMatch = raw.match(/AG\s+([A-Z0-9]{6})/)
  if (spaceMatch) return `AG${spaceMatch[1]}`

  // 4. Fallback search among recent pending orders (last 48 hours)
  try {
    const normalizedContent = raw.replace(/[^A-Z0-9]/g, "")
    const recentOrders = await prisma.order.findMany({
      where: {
        status: { in: ["pending", "partially_paid"] },
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      select: { code: true },
      take: 20,
    })

    for (const ord of recentOrders) {
      if (ord.code && normalizedContent.includes(ord.code.toUpperCase())) {
        return ord.code.toUpperCase()
      }
    }
  } catch {
    // ignore fallback search errors
  }

  return null
}

export async function POST(req: Request) {
  try {
    // 1. Secret verification
    const expectedKey = process.env.SEPAY_WEBHOOK_KEY
    if (!expectedKey) {
      console.error("[SePay Webhook] CRITICAL: SEPAY_WEBHOOK_KEY is not configured on server.")
      return NextResponse.json(
        { success: false, error: "Server misconfiguration: Webhook secret missing" },
        { status: 500 }
      )
    }

    if (!verifySepayAuth(req, expectedKey)) {
      console.warn("[SePay Webhook] Unauthorized webhook attempt: auth header mismatch.")
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      id: rawTransactionId,
      gateway,
      transactionDate,
      accountNumber,
      code,
      content,
      transferType,
      transferAmount,
    } = body

    // 2. Only process incoming transfers
    if (transferType && transferType !== "in") {
      return NextResponse.json({ success: true, message: "Skipped outgoing transaction" })
    }

    // 3. INVARIANT: Require non-empty transactionId to prevent replay attacks
    const txIdStr = rawTransactionId !== undefined && rawTransactionId !== null ? String(rawTransactionId).trim() : ""
    if (!txIdStr) {
      return NextResponse.json(
        { success: false, error: "Bắt buộc phải có transactionId (id)" },
        { status: 400 }
      )
    }

    // 4. Validate transfer amount
    const currentTransferAmount = Number(transferAmount)
    if (
      !Number.isFinite(currentTransferAmount) ||
      !Number.isInteger(currentTransferAmount) ||
      currentTransferAmount < 1000 ||
      currentTransferAmount > 1000000000
    ) {
      return NextResponse.json({ success: false, message: "Số tiền chuyển khoản không hợp lệ" }, { status: 400 })
    }

    // 5. Account number verification if configured
    const configuredAccount = process.env.BANK_ACCOUNT_NUMBER
    if (configuredAccount && accountNumber) {
      if (!isMatchingAccount(accountNumber, configuredAccount)) {
        console.warn(`[SePay Webhook] Account mismatch: received ${accountNumber}, configured ${configuredAccount}`)
        // We log warning, but do not drop if order code is valid and verified
      }
    }

    // 6. Deduplication check (Idempotency)
    const existingPayment = await prisma.payment.findUnique({ where: { transactionId: txIdStr } })
    if (existingPayment) {
      return NextResponse.json({ success: true, message: "Already processed transaction", duplicate: true })
    }

    // 7. Extract order code
    const orderCode = await resolveOrderCode(content || "", code)
    if (!orderCode) {
      console.warn(`[SePay Webhook] No recognizable order code in content: "${content}"`)
      return NextResponse.json({ success: true, message: "No recognizable order code found in content" })
    }

    // 8. Query order
    const order = await prisma.order.findUnique({
      where: { code: orderCode.toUpperCase() },
      include: { payments: true },
    })

    if (!order) {
      console.warn(`[SePay Webhook] Order code ${orderCode} not found in database.`)
      return NextResponse.json({ success: true, message: "Order not found" })
    }

    // Terminal states check
    if (order.status === "cancelled" || order.status === "refunded") {
      console.warn(`[SePay Webhook] Received payment for ${order.status} order ${order.code}.`)
      await prisma.payment.create({
        data: {
          orderId: order.id,
          transactionId: txIdStr,
          gateway: gateway || "SePay",
          amount: currentTransferAmount,
          content: `[TIỀN ĐẾN SAU KHI ${order.status.toUpperCase()}]: ${content || ""}`,
          transactionDate: transactionDate ? String(transactionDate) : null,
        },
      })
      return NextResponse.json({
        success: true,
        message: `Recorded payment for ${order.status} order for manual reconciliation`,
      })
    }

    // 9. Step 1: Record payment and update order status in fast DB transaction (< 50ms)
    // Never run slow external HTTP provider calls inside the interactive DB transaction!
    const { orderId, isFullyPaid, totalPaid } = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          orderId: order.id,
          transactionId: txIdStr,
          gateway: gateway || "SePay",
          amount: currentTransferAmount,
          content: content || "",
          transactionDate: transactionDate ? String(transactionDate) : null,
        },
      })

      const freshOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payments: true },
      })

      const currentTotal = freshOrder.payments.reduce((sum, p) => sum + p.amount, 0)
      const fullyPaid = currentTotal >= freshOrder.totalCents

      const newStatus = fullyPaid ? "processing" : "partially_paid"
      await tx.order.update({
        where: { id: freshOrder.id },
        data: { status: newStatus },
      })

      return {
        orderId: freshOrder.id,
        isFullyPaid: fullyPaid,
        totalPaid: currentTotal,
      }
    })

    // 10. Step 2: Now that DB transaction has COMMITTED and payment is permanently saved:
    // Call fulfillment (Dino or FatCat API) outside of DB transaction
    if (isFullyPaid) {
      try {
        console.log(`[SePay Webhook] Triggering live fulfillment for order ${order.code}...`)
        const fulfillRes = await fulfillOrder(orderId)
        console.log(`[SePay Webhook] Fulfillment result for ${order.code}:`, fulfillRes.status)
      } catch (fulfillErr) {
        console.error(`[SePay Webhook] Error fulfilling order ${order.code}:`, fulfillErr)
      }
    }

    // Safe non-blocking Telegram notification
    notifyTelegram(order.code, currentTransferAmount, order.email, isFullyPaid ? "paid" : "partially_paid").catch(() => {})

    return NextResponse.json({
      success: true,
      orderCode: order.code,
      status: isFullyPaid ? "paid" : "partially_paid",
      totalPaid,
    })
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ success: true, message: "Duplicate transaction caught concurrently", duplicate: true })
    }
    const message = err instanceof Error ? err.message : "Internal error"
    console.error("[SePay Webhook Error]:", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

async function notifyTelegram(orderCode: string, amount: number, email: string, status: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  try {
    const statusText =
      status === "paid"
        ? "✅ Đã thanh toán & Giao hàng"
        : status === "partially_paid"
        ? "⚠️ Chuyển thiếu tiền"
        : "⏳ Đang xử lý giao hàng"
    const message = `🔔 *Thông báo thanh toán SePay*\n\n📦 Mã đơn: \`${orderCode}\`\n💰 Số tiền: ${new Intl.NumberFormat("vi-VN").format(amount)}đ\n📧 Email: ${email}\n📊 Trạng thái: *${statusText}*`
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
    })
  } catch {}
}
