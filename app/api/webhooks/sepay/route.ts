import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { fulfillOrder } from "@/lib/fulfillment"

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export async function POST(req: Request) {
  try {
    // 1. Fail-closed secret verification
    const expectedKey = process.env.SEPAY_WEBHOOK_KEY
    if (!expectedKey) {
      console.error("[SePay Webhook] CRITICAL: SEPAY_WEBHOOK_KEY is not configured on server.")
      return NextResponse.json(
        { success: false, error: "Server misconfiguration: Webhook secret missing" },
        { status: 500 }
      )
    }

    const authHeader = req.headers.get("authorization") || ""
    const expectedApiKey = `Apikey ${expectedKey}`
    const expectedBearer = `Bearer ${expectedKey}`

    const isApiKey = timingSafeCompare(authHeader, expectedApiKey)
    const isBearer = timingSafeCompare(authHeader, expectedBearer)

    if (!authHeader || (!isApiKey && !isBearer)) {
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
    if (transferType !== "in") {
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

    // 4. Validate amount is positive finite integer within reasonable bounds (1,000 to 1,000,000,000 VND)
    const currentTransferAmount = Number(transferAmount)
    if (
      !Number.isFinite(currentTransferAmount) ||
      !Number.isInteger(currentTransferAmount) ||
      currentTransferAmount < 1000 ||
      currentTransferAmount > 1000000000
    ) {
      return NextResponse.json({ success: false, message: "Số tiền chuyển khoản không hợp lệ" }, { status: 400 })
    }

    // 5. Account number verification if configured (Fail-closed)
    const configuredAccount = process.env.BANK_ACCOUNT_NUMBER
    if (configuredAccount) {
      if (!accountNumber || String(accountNumber).trim() !== configuredAccount.trim()) {
        console.warn(`[SePay Webhook] Received payment for unexpected or missing account: ${accountNumber}`)
        return NextResponse.json({ success: false, message: "Tài khoản nhận tiền không khớp với cấu hình hệ thống" }, { status: 400 })
      }
    }

    // 6. Deduplication check (Idempotency)
    const existingPayment = await prisma.payment.findUnique({ where: { transactionId: txIdStr } })
    if (existingPayment) {
      return NextResponse.json({ success: true, message: "Already processed transaction", duplicate: true })
    }

    // 7. Extract order code
    const orderCode = code || extractOrderCode(content || "")
    if (!orderCode) {
      return NextResponse.json({ success: true, message: "No recognizable order code found in content" })
    }

    // 8. Query order
    const order = await prisma.order.findUnique({
      where: { code: String(orderCode).toUpperCase() },
      include: {
        payments: true,
      },
    })

    if (!order) {
      return NextResponse.json({ success: true, message: "Order not found" })
    }

    // Terminal states (cancelled or refunded) must never be resurrected or fulfilled
    if (order.status === "cancelled" || order.status === "refunded") {
      console.warn(`[SePay Webhook] Received payment for ${order.status} order ${order.code}. Needs manual reconciliation.`)
      // Record payment for auditing, but NEVER fulfill or change order status
      await prisma.payment.create({
        data: {
          orderId: order.id,
          transactionId: txIdStr,
          gateway: gateway || "Unknown",
          amount: currentTransferAmount,
          content: `[TIỀN ĐẾN SAU KHI ${order.status.toUpperCase()}]: ${content || ""}`,
          transactionDate: transactionDate ? String(transactionDate) : null,
        },
      })
      return NextResponse.json({
        success: true,
        message: `Recorded payment for ${order.status} order for manual reconciliation`,
        reconciled: false,
      })
    }

    // 9. Atomic transaction for payment recording and fulfillment
    const result = await prisma.$transaction(async (tx) => {
      // Record payment
      await tx.payment.create({
        data: {
          orderId: order.id,
          transactionId: txIdStr,
          gateway: gateway || "Unknown",
          amount: currentTransferAmount,
          content: content || "",
          transactionDate: transactionDate ? String(transactionDate) : null,
        },
      })

      // Query fresh order with all payments inside transaction to avoid race condition
      const freshOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payments: true },
      })

      // Double-check terminal states inside transaction
      if (freshOrder.status === "cancelled" || freshOrder.status === "refunded") {
        return { status: freshOrder.status, fulfilled: false }
      }

      const currentTotalPaid = freshOrder.payments.reduce((sum, p) => sum + p.amount, 0)

      // Check if underpaid
      if (currentTotalPaid < freshOrder.totalCents) {
        console.warn(`[SePay Webhook] Underpayment on order ${freshOrder.code}: received ${currentTotalPaid}/${freshOrder.totalCents} VND.`)
        await tx.order.update({
          where: { id: freshOrder.id },
          data: { status: "partially_paid" },
        })
        return { status: "partially_paid", fulfilled: false }
      }

      // Full payment reached (currentTotalPaid >= freshOrder.totalCents): Fulfill order
      const fulfillment = await fulfillOrder(freshOrder.id, tx)
      return { status: fulfillment.status, fulfilled: fulfillment.fullyFulfilled }
    })

    // Safe non-blocking Telegram notification
    notifyTelegram(order.code, currentTransferAmount, order.email, result.status).catch(() => {})

    return NextResponse.json({ success: true, status: result.status })
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ success: true, message: "Duplicate transaction caught concurrently", duplicate: true })
    }
    const message = err instanceof Error ? err.message : "Internal error"
    console.error("[SePay Webhook Error]:", message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

function extractOrderCode(content: string): string | null {
  const match = content.toUpperCase().match(/\bAG[A-Z0-9]{6}\b/)
  return match ? match[0] : null
}

async function notifyTelegram(orderCode: string, amount: number, email: string, status: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  try {
    const statusText =
      status === "paid"
        ? "✅ Đã giao hàng"
        : status === "partially_paid"
        ? "⚠️ Chuyển thiếu tiền"
        : "⏳ Đang xử lý kho"
    const message = `🔔 *Thông báo thanh toán*\n\n📦 Mã đơn: \`${orderCode}\`\n💰 Số tiền: ${new Intl.NumberFormat("vi-VN").format(amount)}đ\n📧 Email: ${email}\n📊 Trạng thái: *${statusText}*`
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
    })
  } catch {}
}
