import { prisma } from "./db"
import { decryptSecret, encryptSecret, maskApiKey } from "./crypto"

export interface ResolvedTelegramConfig {
  botToken: string
  chatId: string
  source: "db" | "env" | "none"
  maskedToken: string
  webhookUrl: string | null
}

let tableReady = false

async function ensureTelegramConfigTable(): Promise<void> {
  if (tableReady) return
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TelegramConfig" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "botTokenEncrypted" TEXT NOT NULL,
        "chatId" TEXT NOT NULL,
        "webhookUrl" TEXT,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    tableReady = true
  } catch (err) {
    console.error("[TelegramConfig ensureTable Error]:", err)
  }
}

export async function getTelegramConfig(): Promise<ResolvedTelegramConfig> {
  await ensureTelegramConfigTable()

  let dbToken = ""
  let dbChatId = ""
  let dbWebhookUrl: string | null = null

  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ botTokenEncrypted: string; chatId: string; webhookUrl: string | null }>
    >(`SELECT "botTokenEncrypted", "chatId", "webhookUrl" FROM "TelegramConfig" WHERE "id" = 'default' LIMIT 1;`)

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0]
      if (row.botTokenEncrypted) {
        try {
          dbToken = decryptSecret(row.botTokenEncrypted).trim()
        } catch {
          dbToken = ""
        }
      }
      dbChatId = (row.chatId || "").trim()
      dbWebhookUrl = row.webhookUrl || null
    }
  } catch (err) {
    console.error("[TelegramConfig Read Error]:", err)
  }

  const envToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
  const envChatId = (process.env.TELEGRAM_CHAT_ID || "").trim()

  const botToken = dbToken || envToken
  const chatId = dbChatId || envChatId

  const source: "db" | "env" | "none" =
    dbToken && dbChatId ? "db" : envToken && envChatId ? "env" : botToken || chatId ? (dbToken ? "db" : "env") : "none"

  return {
    botToken,
    chatId,
    source,
    maskedToken: botToken ? maskApiKey(botToken) : "",
    webhookUrl: dbWebhookUrl,
  }
}

export async function saveTelegramConfig(params: {
  botToken?: string
  chatId: string
  webhookUrl?: string | null
}): Promise<ResolvedTelegramConfig> {
  await ensureTelegramConfigTable()

  const current = await getTelegramConfig()
  const finalToken = (params.botToken || "").trim() || current.botToken
  const finalChatId = params.chatId.trim()

  if (!finalToken) {
    throw new Error("Vui lòng nhập Telegram Bot Token")
  }
  if (!finalChatId) {
    throw new Error("Vui lòng nhập Telegram Chat ID")
  }

  const encryptedToken = encryptSecret(finalToken)
  const webhookVal = params.webhookUrl ?? current.webhookUrl

  await prisma.$executeRawUnsafe(
    `INSERT INTO "TelegramConfig" ("id", "botTokenEncrypted", "chatId", "webhookUrl", "updatedAt")
     VALUES ('default', ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT("id") DO UPDATE SET
       "botTokenEncrypted" = excluded."botTokenEncrypted",
       "chatId" = excluded."chatId",
       "webhookUrl" = excluded."webhookUrl",
       "updatedAt" = CURRENT_TIMESTAMP;`,
    encryptedToken,
    finalChatId,
    webhookVal
  )

  return getTelegramConfig()
}

export async function registerTelegramCommandsAndWebhook(params: {
  botToken: string
  originUrl?: string | null
}): Promise<{ webhookConfigured: boolean; webhookUrl: string | null; error?: string }> {
  const { botToken, originUrl } = params

  // Always register "/" commands menu
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "today", description: "Tổng đơn, tổng Token B & tiền thu về hôm nay" },
          { command: "pending", description: "Xem các đơn Buff đang chờ nạp" },
          { command: "done", description: "Xác nhận xong đơn: /done MÃ_ĐƠN [ghi chú]" },
          { command: "note", description: "Lưu ghi chú đơn: /note MÃ_ĐƠN nội dung" },
          { command: "help", description: "Xem menu hướng dẫn lệnh Bot" },
        ],
      }),
    })
  } catch {}

  const cleanOrigin = (originUrl || "").trim().replace(/\/+$/, "")
  if (cleanOrigin.startsWith("https://")) {
    const targetWebhook = `${cleanOrigin}/api/telegram/webhook`
    const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim()
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetWebhook,
          allowed_updates: ["message", "callback_query"],
          ...(secret ? { secret_token: secret } : {}),
        }),
      })
      const json = (await res.json()) as { ok?: boolean; description?: string }
      if (!res.ok || !json.ok) {
        return {
          webhookConfigured: false,
          webhookUrl: null,
          error: json.description || `HTTP ${res.status}`,
        }
      }
      return { webhookConfigured: true, webhookUrl: targetWebhook }
    } catch (err) {
      return {
        webhookConfigured: false,
        webhookUrl: null,
        error: err instanceof Error ? err.message : "setWebhook error",
      }
    }
  }

  return { webhookConfigured: false, webhookUrl: null }
}
