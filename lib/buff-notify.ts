import { prisma } from "./db"
import type { BuffSummaryStats } from "./buff-stats"
import { formatVnDateLabel } from "./buff-stats"

export interface BuffOrderAlertPayload {
  orderId: string
  orderCode: string
  email: string
  totalCents: number
  inviteCode: string
  tokenAmountB: number
}

function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)}đ`
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Dispatches multi-channel instant notifications when a Buff Token Muse order is paid:
 * 1. CAPYGO In-App AdminNotification (always active, zero config, idempotent per orderId)
 * 2. Email alert via Resend REST API (if RESEND_API_KEY + ADMIN_NOTIFY_EMAIL are set)
 * 3. Telegram Bot alert with inline "Đã Buff xong" action button (if TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are set)
 * 4. Optional custom Webhook / Discord / Apps Script relay (if ADMIN_BUFF_WEBHOOK_URL is set)
 */
export async function notifyAdminNewBuffOrder(payload: BuffOrderAlertPayload): Promise<void> {
  const { orderId, orderCode, email, totalCents, inviteCode, tokenAmountB } = payload
  const title = `🚀 Đơn Buff ${tokenAmountB}B mới · Mã mời: ${inviteCode}`
  const summaryText = `Đơn #${orderCode} đã thanh toán ${formatVnd(totalCents)} · Mã mời: ${inviteCode} · Số lượng: ${tokenAmountB}B Token · KH: ${email}`

  // 1. In-app AdminNotification (idempotent check by metadata marker)
  try {
    const marker = `"orderId":"${orderId}"`
    const existing = await prisma.adminNotification.findFirst({
      where: {
        type: "buff_order_paid",
        metadata: { contains: marker },
      },
    })

    if (!existing) {
      await prisma.adminNotification.create({
        data: {
          type: "buff_order_paid",
          title,
          message: summaryText,
          metadata: JSON.stringify({
            orderId,
            orderCode,
            inviteCode,
            tokenAmountB,
            totalCents,
            email,
          }),
          link: "/admin/orders",
        },
      })
    } else {
      return
    }
  } catch (err) {
    console.error("[BuffNotify AdminNotification Error]:", err)
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "")
  const adminOrdersUrl = appUrl ? `${appUrl}/admin/orders` : "/admin/orders"

  // 2. Resend Email Alert
  const resendApiKey = (process.env.RESEND_API_KEY || "").trim()
  const adminEmail = (process.env.ADMIN_NOTIFY_EMAIL || "").trim()
  const fromEmail = (process.env.RESEND_FROM_EMAIL || "CAPYGO <onboarding@resend.dev>").trim()

  if (resendApiKey && adminEmail) {
    try {
      const html = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:20px;background:#141416;color:#f4f4f5;border-radius:12px;border:1px solid #27272a">
          <h2 style="margin:0 0 12px;color:#e6a66f;font-size:18px;">Đơn Buff Token Muse AI đã thanh toán</h2>
          <p style="margin:0 0 16px;color:#a1a1aa;font-size:14px;">Khách hàng vừa thanh toán thành công. Bạn có thể bắt đầu buff ngay với thông tin dưới đây:</p>
          <div style="background:#1c1c20;border:1px solid #2e2e34;border-radius:10px;padding:14px;margin-bottom:16px;">
            <p style="margin:6px 0;font-size:14px;"><strong>Mã mời (Invite Code):</strong> <code style="background:#27272a;padding:3px 8px;border-radius:6px;color:#e6a66f;font-size:16px;letter-spacing:1px;">${escapeHtml(inviteCode)}</code></p>
            <p style="margin:6px 0;font-size:14px;"><strong>Số lượng cần buff:</strong> <strong style="color:#4ade80;font-size:16px;">${tokenAmountB}B Token</strong></p>
            <p style="margin:6px 0;font-size:13px;color:#d4d4d8;"><strong>Mã đơn:</strong> #${escapeHtml(orderCode)}</p>
            <p style="margin:6px 0;font-size:13px;color:#d4d4d8;"><strong>Số tiền đã nhận:</strong> ${escapeHtml(formatVnd(totalCents))}</p>
            <p style="margin:6px 0;font-size:13px;color:#d4d4d8;"><strong>Email khách:</strong> ${escapeHtml(email)}</p>
          </div>
          <a href="${escapeHtml(adminOrdersUrl)}" style="display:inline-block;background:#e6a66f;color:#141416;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;">Mở trang Quản lý Đơn hàng</a>
        </div>
      `
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [adminEmail],
          subject: `[CAPYGO] Buff ${tokenAmountB}B · Mã mời ${inviteCode} (#${orderCode})`,
          html,
        }),
      })
      if (!emailRes.ok) {
        console.error("[BuffNotify Resend HTTP Error]:", emailRes.status, await emailRes.text())
      }
    } catch (err) {
      console.error("[BuffNotify Resend Email Error]:", err)
    }
  }

  // 3. Telegram Instant Alert with Inline Button
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim()
  if (botToken && chatId) {
    try {
      const isPlaceholderEmail = !email || email.endsWith("@capygo.local")
      const emailLine = isPlaceholderEmail ? "" : `📧 Email KH: ${escapeHtml(email)}\n`
      const tgMsg =
        `🚀 <b>ĐƠN BUFF TOKEN MUSE ĐÃ THANH TOÁN</b>\n\n` +
        `🔑 Mã mời: <code>${escapeHtml(inviteCode)}</code>\n` +
        `⚡ Số lượng: <b>${tokenAmountB}B Token</b>\n` +
        `📦 Mã đơn: <code>${escapeHtml(orderCode)}</code>\n` +
        `💰 Đã nhận: <b>${escapeHtml(formatVnd(totalCents))}</b>\n` +
        `${emailLine}\n` +
        `💡 Xong bấm nút dưới hoặc gõ:\n<code>/done ${escapeHtml(orderCode)} Đã buff đủ ${tokenAmountB}B</code>`

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: tgMsg,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `📋 Copy Mã mời (${inviteCode})`,
                  copy_text: { text: inviteCode },
                },
                {
                  text: `📋 Copy Mã đơn`,
                  copy_text: { text: orderCode },
                },
              ],
              [
                {
                  text: `✅ Đã Buff xong (${tokenAmountB}B)`,
                  callback_data: `buff_done:${orderCode}`,
                },
                {
                  text: `📝 Xong + Ghi chú`,
                  callback_data: `buff_ask_note:${orderCode}`,
                },
              ],
            ],
          },
        }),
      })
      if (!tgRes.ok) {
        console.error("[BuffNotify Telegram HTTP Error]:", tgRes.status, await tgRes.text())
      }
    } catch (err) {
      console.error("[BuffNotify Telegram Error]:", err)
    }
  }

  // 4. Optional Custom Webhook
  const webhookUrl = (process.env.ADMIN_BUFF_WEBHOOK_URL || "").trim()
  if (webhookUrl && webhookUrl.startsWith("https://")) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "buff_order_paid",
          title,
          content: summaryText,
          orderId,
          orderCode,
          inviteCode,
          tokenAmountB,
          totalCents,
          email,
          adminOrdersUrl,
        }),
      })
    } catch (err) {
      console.error("[BuffNotify Webhook Error]:", err)
    }
  }
}

export function buildDailyBuffSummaryHtml(stats: BuffSummaryStats): string {
  const dateLabel = formatVnDateLabel(stats.dateKey)
  const listPreview =
    stats.dayCompletedList.length > 0
      ? `\n\n📋 <b>Chi tiết đơn đã xong (${stats.dayCompletedList.length}):</b>\n` +
        stats.dayCompletedList
          .slice(0, 10)
          .map(
            (it, idx) =>
              `${idx + 1}. <code>#${escapeHtml(it.orderCode)}</code> · <code>${escapeHtml(it.inviteCode)}</code> · <b>${it.tokensB}B</b> · ${escapeHtml(formatVnd(it.totalCents))}${
                it.note ? ` <i>(${escapeHtml(it.note)})</i>` : ""
              }`
          )
          .join("\n") +
        (stats.dayCompletedList.length > 10
          ? `\n<i>...và ${stats.dayCompletedList.length - 10} đơn khác</i>`
          : "")
      : ""

  return (
    `📊 <b>TỔNG KẾT BUFF TOKEN (${escapeHtml(dateLabel)})</b>\n\n` +
    `✅ Tổng đơn đã buff xong: <b>${stats.dayCompletedOrders} đơn</b>\n` +
    `⏳ Đơn chờ buff: <b>${stats.dayPendingOrders} đơn</b>\n` +
    `⚡ Tổng Token đã buff: <b>${stats.dayTokensBuffedB}B Token</b>\n` +
    `💰 Tổng tiền thu về: <b>${escapeHtml(formatVnd(stats.dayRevenueCents))}</b>` +
    `${listPreview}\n\n` +
    `📈 <i>Lũy kế toàn bộ: ${stats.allCompletedOrders} đơn · ${stats.allTokensBuffedB}B · ${escapeHtml(formatVnd(stats.allRevenueCents))}</i>`
  )
}

export async function sendTelegramBuffCompleted(params: {
  orderCode: string
  inviteCode: string
  completedB: number
  tokenAmountB: number
  totalCents: number
  note?: string | null
  stats: BuffSummaryStats
}): Promise<{ ok: boolean; error?: string }> {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim()
  if (!botToken || !chatId) {
    return { ok: false, error: "Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID" }
  }

  const noteLine = params.note ? `\n📝 Ghi chú: <i>${escapeHtml(params.note)}</i>` : ""
  const msg =
    `✅ <b>ĐÃ HOÀN TẤT ĐƠN BUFF #${escapeHtml(params.orderCode)}</b>\n` +
    `🔑 Mã mời: <code>${escapeHtml(params.inviteCode)}</code> · <b>${params.completedB}/${params.tokenAmountB}B</b> · <b>${escapeHtml(formatVnd(params.totalCents))}</b>` +
    `${noteLine}\n\n` +
    buildDailyBuffSummaryHtml(params.stats)

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
    })
    if (!res.ok) {
      return { ok: false, error: await res.text() }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Telegram error" }
  }
}

export async function sendTelegramDailySummary(stats: BuffSummaryStats): Promise<{ ok: boolean; error?: string }> {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim()
  if (!botToken || !chatId) {
    return { ok: false, error: "Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID" }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildDailyBuffSummaryHtml(stats),
        parse_mode: "HTML",
      }),
    })
    if (!res.ok) {
      return { ok: false, error: await res.text() }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Telegram error" }
  }
}
