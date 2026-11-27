import { NextResponse } from "next/server"
import { verifyAdminRequest } from "@/lib/auth"
import { syncTelegramBotUpdates } from "@/lib/telegram-bot"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const res = await syncTelegramBotUpdates()
    if (!res.ok) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      processed: res.processed,
      actions: res.actions,
      message:
        res.processed > 0
          ? `Đã xử lý ${res.processed} lệnh từ Telegram Bot (${res.actions.join(", ")}).`
          : "Không có lệnh Telegram mới.",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed"
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
