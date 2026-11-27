import { NextResponse } from "next/server"
import { processTelegramUpdate } from "@/lib/telegram-bot"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const expectedSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim()
    if (expectedSecret) {
      const headerSecret = req.headers.get("x-telegram-bot-api-secret-token") || ""
      if (headerSecret !== expectedSecret) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
      }
    }

    const update = await req.json()
    const res = await processTelegramUpdate(update)
    return NextResponse.json({ ok: true, handled: res.handled, action: res.action })
  } catch (err) {
    console.error("[Telegram Webhook Error]:", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
