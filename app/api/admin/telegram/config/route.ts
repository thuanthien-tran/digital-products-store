import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"
import {
  getTelegramConfig,
  registerTelegramCommandsAndWebhook,
  saveTelegramConfig,
} from "@/lib/telegram-config"
import { sendTelegramBuffOrderMessage } from "@/lib/buff-notify"

export const dynamic = "force-dynamic"

async function markBuffNotificationTelegramSent(orderId: string): Promise<void> {
  try {
    const marker = `"orderId":"${orderId}"`
    const existing = await prisma.adminNotification.findFirst({
      where: {
        type: "buff_order_paid",
        metadata: { contains: marker },
      },
    })
    if (!existing) return
    let meta: Record<string, unknown> = {}
    try {
      meta = existing.metadata ? JSON.parse(existing.metadata) : {}
    } catch {
      meta = {}
    }
    delete meta.telegramError
    await prisma.adminNotification.update({
      where: { id: existing.id },
      data: {
        metadata: JSON.stringify({
          ...meta,
          telegramSent: true,
        }),
      },
    })
  } catch {}
}

async function dispatchPendingBuffAlerts(
  botToken: string,
  chatId: string,
  onlyUnsent: boolean
): Promise<{ total: number; sent: number }> {
  const pendingBuffs = await prisma.buffFulfillment.findMany({
    where: { status: { in: ["pending", "processing", "needs_review"] } },
    include: {
      orderItem: {
        include: {
          order: {
            select: {
              id: true,
              code: true,
              email: true,
              status: true,
              totalCents: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  const eligible = pendingBuffs.filter(
    (b) =>
      b.orderItem?.order &&
      (b.orderItem.order.status === "paid" || b.orderItem.order.status === "processing")
  )

  if (eligible.length === 0) {
    return { total: 0, sent: 0 }
  }

  let targets = eligible
  if (onlyUnsent) {
    const unsent: typeof eligible = []
    for (const bf of eligible) {
      const ordId = bf.orderItem!.order!.id
      const notif = await prisma.adminNotification.findFirst({
        where: {
          type: "buff_order_paid",
          metadata: { contains: `"orderId":"${ordId}"` },
        },
        select: { metadata: true },
      })
      let alreadySent = false
      if (notif?.metadata) {
        try {
          alreadySent = JSON.parse(notif.metadata).telegramSent === true
        } catch {
          alreadySent = false
        }
      }
      if (!alreadySent) {
        unsent.push(bf)
      }
    }
    targets = unsent
  }

  let sentCount = 0
  for (const bf of targets) {
    const ord = bf.orderItem!.order!
    const r = await sendTelegramBuffOrderMessage(botToken, chatId, {
      orderId: ord.id,
      orderCode: ord.code,
      email: ord.email,
      totalCents: ord.totalCents,
      inviteCode: bf.inviteCode,
      tokenAmountB: bf.tokenAmountB,
    })
    if (r.ok) {
      sentCount += 1
      await markBuffNotificationTelegramSent(ord.id)
    }
  }

  return { total: targets.length, sent: sentCount }
}

export async function POST(req: Request) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const action = String(body.action || "")
    const inputToken = typeof body.botToken === "string" ? body.botToken.trim() : ""
    const inputChatId = typeof body.chatId === "string" ? body.chatId.trim() : ""
    const origin = typeof body.origin === "string" ? body.origin.trim() : ""

    const current = await getTelegramConfig()

    if (action === "detect_chat_id") {
      const tokenToUse = inputToken || current.botToken
      if (!tokenToUse) {
        return NextResponse.json({ error: "Vui lòng nhập Bot Token trước khi tự lấy Chat ID" }, { status: 400 })
      }
      const res = await fetch(`https://api.telegram.org/bot${tokenToUse}/getUpdates?limit=20`, {
        cache: "no-store",
      })
      const json = (await res.json()) as {
        ok?: boolean
        description?: string
        result?: Array<{ message?: { chat?: { id?: number | string } } }>
      }
      if (!res.ok || !json.ok) {
        return NextResponse.json(
          { error: json.description || "Không thể gọi getUpdates. Nếu webhook đang bật, hãy nhập Chat ID thủ công." },
          { status: 400 }
        )
      }
      const list = Array.isArray(json.result) ? json.result : []
      const lastWithChat = [...list].reverse().find((u) => u.message?.chat?.id !== undefined)
      const detected = lastWithChat?.message?.chat?.id ? String(lastWithChat.message.chat.id) : ""
      if (!detected) {
        return NextResponse.json(
          { error: "Chưa thấy tin nhắn nào gửi tới bot. Hãy bấm /start trong bot Telegram rồi thử lại." },
          { status: 400 }
        )
      }
      return NextResponse.json({
        success: true,
        chatId: detected,
        message: `Đã tìm thấy Chat ID: ${detected}. Bấm "Lưu & Kết nối Telegram" để lưu lại.`,
      })
    }

    if (action === "save") {
      const saved = await saveTelegramConfig({
        botToken: inputToken || undefined,
        chatId: inputChatId || current.chatId,
      })

      const hookRes = await registerTelegramCommandsAndWebhook({
        botToken: saved.botToken,
        originUrl: origin || process.env.NEXT_PUBLIC_APP_URL || null,
      })

      const finalConfig = hookRes.webhookConfigured
        ? await saveTelegramConfig({
            botToken: saved.botToken,
            chatId: saved.chatId,
            webhookUrl: hookRes.webhookUrl,
          })
        : saved

      // Push any missed paid Buff orders (recorded before Telegram was configured on this server)
      const autoFlushed =
        finalConfig.botToken && finalConfig.chatId
          ? await dispatchPendingBuffAlerts(finalConfig.botToken, finalConfig.chatId, true).catch(() => ({
              total: 0,
              sent: 0,
            }))
          : { total: 0, sent: 0 }

      const parts: string[] = []
      if (hookRes.webhookConfigured) {
        parts.push(`Đã lưu & gắn Webhook tự động (${hookRes.webhookUrl})!`)
      } else if (hookRes.error) {
        parts.push(`Đã lưu Bot vào Database nhưng Webhook lỗi (${hookRes.error}).`)
      } else {
        parts.push("Đã lưu cấu hình Telegram Bot vào Database!")
      }
      if (autoFlushed.sent > 0) {
        parts.push(`Đã tự gửi bù ${autoFlushed.sent} đơn Buff đang chờ qua Telegram!`)
      }

      return NextResponse.json({
        success: true,
        config: {
          configured: Boolean(finalConfig.botToken && finalConfig.chatId),
          source: finalConfig.source,
          maskedToken: finalConfig.maskedToken,
          chatId: finalConfig.chatId,
          webhookUrl: finalConfig.webhookUrl,
        },
        autoSent: autoFlushed.sent,
        webhookError: hookRes.error || null,
        message: parts.join(" "),
      })
    }

    if (action === "test") {
      const tokenToUse = inputToken || current.botToken
      const chatToUse = inputChatId || current.chatId
      if (!tokenToUse || !chatToUse) {
        return NextResponse.json({ error: "Thiếu Bot Token hoặc Chat ID" }, { status: 400 })
      }
      const res = await fetch(`https://api.telegram.org/bot${tokenToUse}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatToUse,
          parse_mode: "HTML",
          text: "✅ <b>Test kết nối Telegram từ server web thành công!</b>\nTừ giờ mọi đơn Buff Token mới sẽ báo trực tiếp về đây.",
        }),
      })
      const json = (await res.json()) as { ok?: boolean; description?: string }
      if (!res.ok || !json.ok) {
        return NextResponse.json(
          { error: `Telegram từ chối gửi: ${json.description || `HTTP ${res.status}`}` },
          { status: 400 }
        )
      }
      return NextResponse.json({
        success: true,
        message: "Đã gửi tin nhắn Test thành công tới Telegram của bạn!",
      })
    }

    if (action === "resend_pending") {
      const tokenToUse = current.botToken
      const chatToUse = current.chatId
      if (!tokenToUse || !chatToUse) {
        return NextResponse.json({ error: "Vui lòng lưu Bot Token & Chat ID trước" }, { status: 400 })
      }

      const { total, sent } = await dispatchPendingBuffAlerts(tokenToUse, chatToUse, false)

      if (total === 0) {
        return NextResponse.json({
          success: true,
          sent: 0,
          message: "Không có đơn Buff nào đang chờ nạp để gửi lại.",
        })
      }

      return NextResponse.json({
        success: true,
        sent,
        message: `Đã gửi ${sent}/${total} đơn Buff đang chờ về Telegram!`,
      })
    }

    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi cấu hình Telegram"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
