import { prisma } from "./db"
import {
  addBuffNoteToOrder,
  completeBuffOrder,
  getBuffStatsForDate,
  getVietnamDateKey,
} from "./buff-stats"
import {
  buildDailyBuffSummaryHtml,
  escapeHtml,
  sendTelegramBuffCompleted,
} from "./buff-notify"

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat?: { id: number | string }
    text?: string
    reply_to_message?: {
      message_id: number
      text?: string
    }
  }
  callback_query?: {
    id: string
    message?: {
      message_id: number
      chat?: { id: number | string }
      text?: string
    }
    data?: string
  }
}

async function callTgApi(method: string, payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
  if (!botToken) return null
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    })
    return (await res.json()) as Record<string, unknown>
  } catch (err) {
    console.error(`[TelegramBot ${method} Error]:`, err)
    return null
  }
}

async function replyTelegram(
  chatId: string,
  htmlText: string,
  options?: {
    replyToMessageId?: number
    replyMarkup?: Record<string, unknown>
  }
): Promise<void> {
  await callTgApi("sendMessage", {
    chat_id: chatId,
    text: htmlText,
    parse_mode: "HTML",
    ...(options?.replyToMessageId ? { reply_to_message_id: options.replyToMessageId } : {}),
    ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  })
}

async function sendMenuCard(chatId: string, replyToMessageId?: number): Promise<void> {
  await replyTelegram(
    chatId,
    `🤖 <b>BOT QUẢN LÝ BUFF TOKEN CAPYGO</b>\n\n` +
      `<b>Lệnh nhanh:</b>\n` +
      `• <code>/done MÃ_ĐƠN [ghi chú]</code> — Đánh dấu đã buff xong + lưu note + xem tổng kết\n` +
      `• <code>/note MÃ_ĐƠN nội dung</code> — Thêm/sửa ghi chú cho đơn\n` +
      `• <code>/today</code> (hoặc <code>/thongke</code>) — Tổng đơn, tổng Token B &amp; tổng tiền hôm nay\n` +
      `• <code>/today DD/MM</code> — Xem thống kê theo ngày cụ thể\n` +
      `• <code>/pending</code> (hoặc <code>/cho</code>) — Danh sách đơn đã thanh toán đang chờ buff`,
    {
      replyToMessageId,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "📊 Tổng kết hôm nay", callback_data: "buff_today" },
            { text: "⏳ Đơn đang chờ", callback_data: "buff_pending" },
          ],
        ],
      },
    }
  )
}

async function sendPendingList(chatId: string, replyToMessageId?: number): Promise<void> {
  const pendingList = await prisma.buffFulfillment.findMany({
    where: { status: { in: ["pending", "submitting", "processing", "needs_review"] } },
    include: {
      orderItem: {
        include: {
          order: { select: { code: true, status: true, totalCents: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  })

  const paidPending = pendingList.filter(
    (b) => b.orderItem?.order && (b.orderItem.order.status === "paid" || b.orderItem.order.status === "processing")
  )

  if (paidPending.length === 0) {
    await replyTelegram(chatId, "✅ Hiện không có đơn Buff nào đang chờ nạp!", { replyToMessageId })
    return
  }

  const lines = paidPending.map((b, idx) => {
    const o = b.orderItem!.order!
    const vnd = new Intl.NumberFormat("vi-VN").format(o.totalCents)
    return `${idx + 1}. <code>#${escapeHtml(o.code)}</code> · Mã mời: <code>${escapeHtml(b.inviteCode)}</code> · <b>${b.tokenAmountB}B</b> · ${vnd}đ`
  })

  const buttons = paidPending.slice(0, 5).flatMap((b) => {
    const o = b.orderItem!.order!
    return [
      [
        { text: `📋 Copy Mã: ${b.inviteCode}`, copy_text: { text: b.inviteCode } },
        { text: `📋 Copy #${o.code}`, copy_text: { text: o.code } },
      ],
      [
        { text: `✅ Xong #${o.code} (${b.tokenAmountB}B)`, callback_data: `buff_done:${o.code}` },
        { text: `📝 Note #${o.code}`, callback_data: `buff_ask_note:${o.code}` },
      ],
    ]
  })

  await replyTelegram(
    chatId,
    `⏳ <b>ĐƠN BUFF ĐANG CHỜ (${paidPending.length})</b>\n\n${lines.join("\n")}\n\nBấm nút dưới hoặc gõ <code>/done MÃ_ĐƠN ghi chú</code>.`,
    {
      replyToMessageId,
      replyMarkup: { inline_keyboard: buttons },
    }
  )
}

function parseDateArgToKey(rawArg?: string): { valid: boolean; dateKey: string } {
  if (!rawArg) return { valid: true, dateKey: getVietnamDateKey() }
  const clean = rawArg.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const d = new Date(`${clean}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) return { valid: true, dateKey: clean }
    return { valid: false, dateKey: getVietnamDateKey() }
  }
  const dm = clean.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/)
  if (dm) {
    const todayKey = getVietnamDateKey()
    const currentYear = todayKey.slice(0, 4)
    const dayNum = parseInt(dm[1], 10)
    const monthNum = parseInt(dm[2], 10)
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      return { valid: false, dateKey: todayKey }
    }
    const day = String(dayNum).padStart(2, "0")
    const month = String(monthNum).padStart(2, "0")
    const year = dm[3] ? (dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : currentYear
    return { valid: true, dateKey: `${year}-${month}-${day}` }
  }
  return { valid: false, dateKey: getVietnamDateKey() }
}

/**
 * Processes a single Telegram update strictly authorized against TELEGRAM_CHAT_ID.
 */
export async function processTelegramUpdate(update: TelegramUpdate): Promise<{ handled: boolean; action?: string }> {
  const expectedChatId = (process.env.TELEGRAM_CHAT_ID || "").trim()
  if (!expectedChatId) return { handled: false }

  // 1. Inline Button Callbacks
  if (update.callback_query) {
    const cb = update.callback_query
    const chatId = cb.message?.chat?.id ? String(cb.message.chat.id) : ""
    if (chatId !== expectedChatId) return { handled: false }

    const data = (cb.data || "").trim()

    if (data === "buff_today") {
      await callTgApi("answerCallbackQuery", { callback_query_id: cb.id })
      const stats = await getBuffStatsForDate(getVietnamDateKey())
      await replyTelegram(chatId, buildDailyBuffSummaryHtml(stats), {
        replyMarkup: {
          inline_keyboard: [[{ text: "🔄 Làm mới", callback_data: "buff_today" }, { text: "⏳ Đơn chờ", callback_data: "buff_pending" }]],
        },
      })
      return { handled: true, action: "today_callback" }
    }

    if (data === "buff_pending") {
      await callTgApi("answerCallbackQuery", { callback_query_id: cb.id })
      await sendPendingList(chatId)
      return { handled: true, action: "pending_callback" }
    }

    if (data.startsWith("buff_ask_note:")) {
      const orderCode = data.slice("buff_ask_note:".length).trim().toUpperCase()
      await callTgApi("answerCallbackQuery", { callback_query_id: cb.id })
      await replyTelegram(
        chatId,
        `📝 <b>Nhập ghi chú hoàn tất cho đơn #${escapeHtml(orderCode)}</b>\n<i>Hãy trả lời (Reply) trực tiếp tin nhắn này với nội dung note (VD: Đã buff đủ 10/10B):</i>`,
        {
          replyToMessageId: cb.message?.message_id,
          replyMarkup: { force_reply: true, selective: true },
        }
      )
      return { handled: true, action: "ask_note" }
    }

    if (data.startsWith("buff_done:")) {
      const orderCode = data.slice("buff_done:".length).trim().toUpperCase()
      const res = await completeBuffOrder({
        orderIdOrCode: orderCode,
        note: "Đã hoàn tất Buff (xác nhận qua Bot Telegram)",
        actor: "Telegram Bot",
      })
      if (!res.ok) {
        await callTgApi("answerCallbackQuery", {
          callback_query_id: cb.id,
          text: res.error || "Không thể xác nhận đơn",
          show_alert: true,
        })
        return { handled: true, action: "callback_error" }
      }

      await callTgApi("answerCallbackQuery", {
        callback_query_id: cb.id,
        text: `✅ Đã xác nhận xong đơn #${res.orderCode}`,
      })

      if (cb.message?.message_id) {
        await callTgApi("editMessageReplyMarkup", {
          chat_id: chatId,
          message_id: cb.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: `✅ ĐÃ BUFF XONG #${res.orderCode}`, callback_data: "buff_today" }],
            ],
          },
        })
      }

      const stats = await getBuffStatsForDate(getVietnamDateKey())
      await sendTelegramBuffCompleted({
        orderCode: res.orderCode!,
        inviteCode: res.inviteCode || "N/A",
        completedB: res.completedB || res.tokenAmountB || 1,
        tokenAmountB: res.tokenAmountB || 1,
        totalCents: res.totalCents || 0,
        note: res.note,
        stats,
      })
      return { handled: true, action: "buff_done_callback" }
    }

    return { handled: false }
  }

  // 2. Text Commands & ForceReply Notes
  const msg = update.message
  if (!msg || !msg.text) return { handled: false }
  const chatId = msg.chat?.id ? String(msg.chat.id) : ""
  if (chatId !== expectedChatId) return { handled: false }

  const text = msg.text.trim()
  const lower = text.toLowerCase()

  // Handle ForceReply to "Nhập ghi chú hoàn tất cho đơn #AG..."
  const replyText = msg.reply_to_message?.text || ""
  const forceReplyOrderMatch = replyText.match(/Nhập ghi chú hoàn tất cho đơn #([A-Z0-9_-]+)/i)
  if (forceReplyOrderMatch && !text.startsWith("/")) {
    const orderCode = forceReplyOrderMatch[1].toUpperCase()
    const res = await completeBuffOrder({
      orderIdOrCode: orderCode,
      note: text,
      actor: "Telegram Bot",
    })
    if (!res.ok) {
      await replyTelegram(chatId, `⚠️ ${escapeHtml(res.error || "Không thể lưu ghi chú")}`, {
        replyToMessageId: msg.message_id,
      })
      return { handled: true, action: "reply_note_error" }
    }
    const stats = await getBuffStatsForDate(getVietnamDateKey())
    await sendTelegramBuffCompleted({
      orderCode: res.orderCode!,
      inviteCode: res.inviteCode || "N/A",
      completedB: res.completedB || res.tokenAmountB || 1,
      tokenAmountB: res.tokenAmountB || 1,
      totalCents: res.totalCents || 0,
      note: res.note,
      stats,
    })
    return { handled: true, action: "reply_note_done" }
  }

  if (lower === "/start" || lower === "/menu" || lower === "/help" || lower === "/lenh") {
    await sendMenuCard(chatId, msg.message_id)
    return { handled: true, action: "menu" }
  }

  const todayMatch = text.match(/^\/(?:today|thongke|report|ngay)(?:@\S+)?(?:\s+([\s\S]+))?$/i)
  if (todayMatch) {
    const parsedDate = parseDateArgToKey(todayMatch[1])
    if (!parsedDate.valid) {
      await replyTelegram(
        chatId,
        `⚠️ Ngày không hợp lệ. Ví dụ đúng:\n<code>/today</code> hoặc <code>/today 27/11</code>`,
        { replyToMessageId: msg.message_id }
      )
      return { handled: true, action: "today_invalid_arg" }
    }
    const stats = await getBuffStatsForDate(parsedDate.dateKey)
    await replyTelegram(chatId, buildDailyBuffSummaryHtml(stats), {
      replyToMessageId: msg.message_id,
      replyMarkup: {
        inline_keyboard: [[{ text: "🔄 Cập nhật", callback_data: "buff_today" }, { text: "⏳ Đơn chờ", callback_data: "buff_pending" }]],
      },
    })
    return { handled: true, action: "today" }
  }

  if (lower === "/pending" || lower === "/cho") {
    await sendPendingList(chatId, msg.message_id)
    return { handled: true, action: "pending" }
  }

  if (/^\/(?:done|xong)(?:@\S+)?$/i.test(text)) {
    await replyTelegram(
      chatId,
      `⚠️ Bạn chưa nhập <b>MÃ ĐƠN</b>. Ví dụ đúng:\n<code>/done AG2P433L</code> hoặc <code>/done AG2P433L Đã buff đủ 10B</code>`,
      { replyToMessageId: msg.message_id }
    )
    return { handled: true, action: "done_missing_code" }
  }

  const doneMatch = text.match(/^\/(?:done|xong)(?:@\S+)?\s+#?([a-zA-Z0-9_-]+)(?:\s+([\s\S]+))?$/i)
  if (doneMatch) {
    const orderCode = doneMatch[1].trim()
    const customNote = doneMatch[2]?.trim() || "Đã hoàn tất Buff"
    const res = await completeBuffOrder({
      orderIdOrCode: orderCode,
      note: customNote,
      actor: "Telegram Bot",
    })
    if (!res.ok) {
      await replyTelegram(chatId, `⚠️ ${escapeHtml(res.error || "Không thể hoàn tất đơn")}`, {
        replyToMessageId: msg.message_id,
      })
      return { handled: true, action: "done_error" }
    }
    const stats = await getBuffStatsForDate(getVietnamDateKey())
    await sendTelegramBuffCompleted({
      orderCode: res.orderCode!,
      inviteCode: res.inviteCode || "N/A",
      completedB: res.completedB || res.tokenAmountB || 1,
      tokenAmountB: res.tokenAmountB || 1,
      totalCents: res.totalCents || 0,
      note: res.note,
      stats,
    })
    return { handled: true, action: "done" }
  }

  if (/^\/note(?:@\S+)?(?:\s+#?[a-zA-Z0-9_-]+)?$/i.test(text)) {
    await replyTelegram(
      chatId,
      `⚠️ Thiếu mã đơn hoặc nội dung ghi chú. Ví dụ đúng:\n<code>/note AG2P433L Đã buff bù xong</code>`,
      { replyToMessageId: msg.message_id }
    )
    return { handled: true, action: "note_invalid_syntax" }
  }

  const noteMatch = text.match(/^\/note(?:@\S+)?\s+#?([a-zA-Z0-9_-]+)\s+([\s\S]+)$/i)
  if (noteMatch) {
    const orderCode = noteMatch[1].trim()
    const customNote = noteMatch[2].trim()
    const res = await addBuffNoteToOrder({
      orderIdOrCode: orderCode,
      note: customNote,
      actor: "Telegram Bot",
    })
    if (!res.ok) {
      await replyTelegram(chatId, `⚠️ ${escapeHtml(res.error || "Lỗi lưu ghi chú")}`, {
        replyToMessageId: msg.message_id,
      })
    } else {
      await replyTelegram(
        chatId,
        `📝 Đã lưu ghi chú cho đơn <code>#${escapeHtml(res.orderCode!)}</code>:\n<i>${escapeHtml(customNote)}</i>`,
        { replyToMessageId: msg.message_id }
      )
    }
    return { handled: true, action: "note" }
  }

  // Fallback reply when user sends an unknown command or mistyped text
  await replyTelegram(
    chatId,
    `❓ <b>Lệnh không hợp lệ hoặc sai cú pháp:</b> <code>${escapeHtml(text.slice(0, 60))}</code>\n\n` +
      `Các lệnh hỗ trợ:\n` +
      `• <code>/pending</code> — Xem đơn chờ buff\n` +
      `• <code>/done MÃ_ĐƠN [ghi chú]</code> — Xác nhận xong\n` +
      `• <code>/note MÃ_ĐƠN nội dung</code> — Lưu ghi chú\n` +
      `• <code>/today</code> — Tổng kết hôm nay\n` +
      `• <code>/menu</code> — Hiện nút chọn nhanh`,
    {
      replyToMessageId: msg.message_id,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "📊 Tổng kết hôm nay", callback_data: "buff_today" },
            { text: "⏳ Đơn đang chờ", callback_data: "buff_pending" },
          ],
        ],
      },
    }
  )
  return { handled: true, action: "unknown_command" }
}

/**
 * Syncs pending Telegram updates via getUpdates (safe single-flight).
 */
export async function syncTelegramBotUpdates(): Promise<{
  ok: boolean
  processed: number
  actions: string[]
  error?: string
}> {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim()
  if (!botToken || !chatId) {
    return { ok: false, processed: 0, actions: [], error: "Chưa cấu hình Telegram Bot" }
  }

  const metricKey = "telegram_last_update_id"
  const metric = await prisma.siteMetric.findUnique({ where: { key: metricKey } })
  const offset = metric ? metric.value + 1 : 0

  try {
    const url = `https://api.telegram.org/bot${botToken}/getUpdates?timeout=0&limit=30${offset > 0 ? `&offset=${offset}` : ""}`
    const res = await fetch(url, { cache: "no-store" })
    const json = await res.json()

    if (!res.ok || !json.ok) {
      return {
        ok: false,
        processed: 0,
        actions: [],
        error: json.description || `HTTP ${res.status}`,
      }
    }

    const updates: TelegramUpdate[] = Array.isArray(json.result) ? json.result : []
    if (updates.length === 0) {
      return { ok: true, processed: 0, actions: [] }
    }

    let maxId = metric?.value || 0
    const actions: string[] = []
    let processed = 0

    for (const upd of updates) {
      if (upd.update_id > maxId) maxId = upd.update_id
      const result = await processTelegramUpdate(upd)
      if (result.handled) {
        processed += 1
        if (result.action) actions.push(result.action)
      }
    }

    await prisma.siteMetric.upsert({
      where: { key: metricKey },
      create: { key: metricKey, value: maxId },
      update: { value: maxId },
    })

    return { ok: true, processed, actions }
  } catch (err) {
    return {
      ok: false,
      processed: 0,
      actions: [],
      error: err instanceof Error ? err.message : "Sync Telegram failed",
    }
  }
}

const globalForTg = globalThis as unknown as {
  __capygoTgPollerStarted?: boolean
  __capygoTgSyncRunning?: boolean
}

/**
 * Starts a lightweight Telegram polling loop inside Node.js runtime when webhooks are not used
 * (allows /today, /done, /note, and inline buttons to work instantly on localhost too).
 */
export function startTelegramBotPoller(): void {
  if (globalForTg.__capygoTgPollerStarted) return
  if (process.env.TELEGRAM_WEBHOOK_ENABLED === "true") return
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim()
  if (!botToken || !chatId) return

  globalForTg.__capygoTgPollerStarted = true

  // Register menu commands on Telegram so "/" autocomplete shows immediately
  void callTgApi("setMyCommands", {
    commands: [
      { command: "today", description: "Tổng đơn, tổng Token B & tiền thu về hôm nay" },
      { command: "pending", description: "Xem các đơn Buff đang chờ nạp" },
      { command: "done", description: "Xác nhận xong đơn: /done MÃ_ĐƠN [ghi chú]" },
      { command: "note", description: "Lưu ghi chú đơn: /note MÃ_ĐƠN nội dung" },
      { command: "help", description: "Xem menu hướng dẫn lệnh Bot" },
    ],
  })

  setInterval(() => {
    if (globalForTg.__capygoTgSyncRunning) return
    globalForTg.__capygoTgSyncRunning = true
    void syncTelegramBotUpdates()
      .catch(() => {})
      .finally(() => {
        globalForTg.__capygoTgSyncRunning = false
      })
  }, 2500)
}
