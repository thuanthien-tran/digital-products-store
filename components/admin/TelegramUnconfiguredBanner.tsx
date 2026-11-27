import Link from "next/link"
import { BellRing, ArrowRight } from "lucide-react"

/**
 * Displays a clear warning inside Admin views when Telegram Bot credentials
 * are not configured on the current server (.env or Database TelegramConfig).
 */
export function TelegramUnconfiguredBanner() {
  return (
    <div className="mb-5 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-2.5 text-xs text-rose-200">
        <BellRing className="size-4 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-rose-100">
            Telegram Bot chưa được kết nối trên server này!
          </p>
          <p className="text-rose-200/85">
            Đơn Buff Token đã thanh toán (và các lệnh như <code className="font-mono">/pending</code>) sẽ chưa thể gửi về Telegram cho tới khi bạn lưu Bot Token &amp; Chat ID trên server này.
          </p>
        </div>
      </div>
      <Link
        href="/admin/buff-muse#telegram-config"
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-btn shrink-0 self-start sm:self-center"
      >
        <span>Kết nối Telegram ngay</span>
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}
