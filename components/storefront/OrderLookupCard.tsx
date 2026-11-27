"use client"

import { useState } from "react"
import Link from "next/link"
import { Link2, ShieldCheck, MessageCircle, ShoppingBag, ArrowUpRight } from "lucide-react"

interface OrderLookupCardProps {
  zaloPhone: string
}

export function OrderLookupCard({ zaloPhone }: OrderLookupCardProps) {
  const [orderInput, setOrderInput] = useState("")

  const trimmed = orderInput.trim()

  // Extract order ID if user pastes a full /order/<id> URL
  const extractedOrderId = (() => {
    if (!trimmed) return ""
    const match = trimmed.match(/\/order\/([a-zA-Z0-9_-]+)/)
    if (match?.[1]) return match[1]
    return ""
  })()

  const zaloMessage = trimmed
    ? `Chào shop CapyGo, mình cần hỗ trợ tra cứu đơn hàng: ${extractedOrderId || trimmed}`
    : "Chào shop CapyGo, mình cần hỗ trợ tra cứu đơn hàng."

  const zaloHref = `https://zalo.me/${zaloPhone}?text=${encodeURIComponent(zaloMessage)}`

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-6 space-y-3.5 sm:space-y-5">
      {/* Method 1 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <div className="size-7 sm:size-9 rounded-lg sm:rounded-xl bg-secondary border border-border flex items-center justify-center text-primary shrink-0">
            <Link2 className="size-3.5 sm:size-4" />
          </div>
          <h2 className="text-[13.5px] sm:text-base font-semibold text-foreground leading-snug">
            Cách 1: Mở lại đường dẫn đơn đã lưu
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Mỗi đơn hàng có đường dẫn riêng (
          <code className="font-mono text-[11px] sm:text-xs bg-secondary px-1.5 py-0.5 rounded text-foreground/90">
            /order/...
          </code>
          ) kèm phiên an toàn. Mở lại tab hoặc lịch sử trình duyệt để xem thông tin bàn giao.
        </p>
      </div>

      {/* Method 2 */}
      <div className="border-t border-border/70 pt-3.5 sm:pt-5 space-y-1.5">
        <div className="flex items-center gap-2.5">
          <div className="size-7 sm:size-9 rounded-lg sm:rounded-xl bg-secondary border border-border flex items-center justify-center text-primary shrink-0">
            <ShieldCheck className="size-3.5 sm:size-4" />
          </div>
          <h2 className="text-[13.5px] sm:text-base font-semibold text-foreground leading-snug">
            Cách 2: Nhờ Zalo cấp lại thông tin
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Nếu đã đóng trình duyệt hoặc đổi thiết bị, nhắn Zalo kèm{" "}
          <strong className="text-foreground font-medium">mã đơn hàng</strong> và{" "}
          <strong className="text-foreground font-medium">ảnh biên lai chuyển khoản</strong>.
        </p>
      </div>

      {/* Quick Order Code / Link Input */}
      <div className="border-t border-border/70 pt-3.5 sm:pt-5 space-y-2.5">
        <div className="space-y-1.5">
          <label
            htmlFor="lookup-order-code"
            className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Mã đơn hoặc link đơn (tùy chọn)
          </label>
          <div className="flex gap-2">
            <input
              id="lookup-order-code"
              type="text"
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              placeholder="VD: CAPY-123456 hoặc dán link /order/..."
              className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-border bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 transition-colors"
            />
            {extractedOrderId && (
              <Link
                href={`/order/${extractedOrderId}`}
                className="inline-flex items-center gap-1 h-10 px-3 rounded-xl border border-primary/40 bg-primary/10 text-primary font-semibold text-xs hover:bg-primary/15 active:scale-[0.97] transition-btn shrink-0"
              >
                <span>Mở đơn</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Action Row: Compact side-by-side on mobile */}
        <div className="grid grid-cols-[1.35fr_1fr] sm:flex sm:flex-row gap-2 sm:gap-3 pt-0.5">
          <a
            href={zaloHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 h-10 sm:h-11 px-3 sm:px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:bg-caramel-light active:scale-[0.98] transition-btn whitespace-nowrap"
          >
            <MessageCircle className="size-3.5 sm:size-4 shrink-0" />
            <span>Nhắn Zalo hỗ trợ</span>
          </a>

          <Link
            href="/san-pham"
            className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-11 px-3 sm:px-5 rounded-xl border border-border bg-background hover:bg-secondary text-foreground font-medium text-xs sm:text-sm active:scale-[0.98] transition-btn whitespace-nowrap"
          >
            <ShoppingBag className="size-3.5 sm:size-4 text-muted-foreground shrink-0 hidden sm:inline" />
            <span>Xem sản phẩm</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
