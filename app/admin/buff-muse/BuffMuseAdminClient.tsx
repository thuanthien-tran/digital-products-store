"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Zap,
  Save,
  Loader2,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Power,
  Send,
  Bell,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { formatPrice } from "@/lib/utils"
import { computeCustomBuffPrice, MUSE_BUFF_STANDARD_PACKAGES } from "@/lib/buff-pricing"
import type { BuffMuseAdminConfig, BuffMuseTierConfig } from "@/lib/buff-config"

const PREVIEW_AMOUNTS = [1, 2, 5, 7, 10, 15, 20, 25, 31] as const

export interface TelegramAdminSummary {
  configured: boolean
  source: "db" | "env" | "none"
  maskedToken: string
  chatId: string
  webhookUrl: string | null
}

export function BuffMuseAdminClient({
  initialConfig,
  initialTelegram,
}: {
  initialConfig: BuffMuseAdminConfig
  initialTelegram: TelegramAdminSummary
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [existsInDb, setExistsInDb] = useState(initialConfig.existsInDb)
  const [productName, setProductName] = useState(initialConfig.productName)
  const [isEnabled, setIsEnabled] = useState(initialConfig.isEnabled)
  const [tiers, setTiers] = useState<BuffMuseTierConfig[]>(initialConfig.tiers)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Telegram Bot Config State
  const [tgConfigured, setTgConfigured] = useState(initialTelegram.configured)
  const [tgSource, setTgSource] = useState(initialTelegram.source)
  const [tgMaskedToken, setTgMaskedToken] = useState(initialTelegram.maskedToken)
  const [tgWebhookUrl, setTgWebhookUrl] = useState<string | null>(initialTelegram.webhookUrl)
  const [tgTokenInput, setTgTokenInput] = useState("")
  const [tgChatIdInput, setTgChatIdInput] = useState(initialTelegram.chatId)
  const [tgBusy, setTgBusy] = useState<string | null>(null)
  const [tgFeedback, setTgFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const handleTelegramAction = async (
    action: "save" | "detect_chat_id" | "test" | "resend_pending"
  ) => {
    if (tgBusy) return
    setTgBusy(action)
    setTgFeedback(null)

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      const res = await fetch("/api/admin/telegram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          botToken: tgTokenInput.trim() || undefined,
          chatId: tgChatIdInput.trim(),
          origin,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setTgFeedback({ type: "err", text: json.error || "Thao tác Telegram thất bại" })
        return
      }

      if (json.chatId) setTgChatIdInput(json.chatId)
      if (json.config) {
        setTgConfigured(json.config.configured)
        setTgSource(json.config.source)
        setTgMaskedToken(json.config.maskedToken)
        setTgWebhookUrl(json.config.webhookUrl)
      }
      if (action === "save") {
        setTgTokenInput("")
      }

      setTgFeedback({ type: "ok", text: json.message || "Thành công!" })
      toast({ title: "Telegram Bot", description: json.message || "Thao tác thành công" })
    } catch {
      setTgFeedback({ type: "err", text: "Lỗi kết nối máy chủ" })
    } finally {
      setTgBusy(null)
    }
  }

  const updateTier = (
    tokenAmountB: number,
    patch: Partial<Pick<BuffMuseTierConfig, "priceCents" | "compareAtPriceCents" | "isActive">>
  ) => {
    setTiers((prev) =>
      prev.map((t) => (t.tokenAmountB === tokenAmountB ? { ...t, ...patch } : t))
    )
    setErrorMsg(null)
  }

  const handleApplySuggested = () => {
    setTiers((prev) =>
      prev.map((t) => {
        const std = MUSE_BUFF_STANDARD_PACKAGES.find((p) => p.tokenAmountB === t.tokenAmountB)
        if (!std) return t
        return {
          ...t,
          priceCents: std.defaultPrice,
          compareAtPriceCents: std.defaultComparePrice ?? null,
          isActive: true,
        }
      })
    )
    toast({
      title: "Đã điền bảng giá gợi ý",
      description: "Bấm Lưu cấu hình để áp dụng ra trang /buff-muse.",
    })
  }

  const previewRates = useMemo(() => {
    const activeVariants = tiers
      .filter((t) => t.isActive)
      .map((t) => ({
        id: t.variantId || `tier-${t.tokenAmountB}`,
        name: t.name,
        priceCents: t.priceCents,
        tokenAmountB: t.tokenAmountB,
      }))

    return PREVIEW_AMOUNTS.map((b) => ({
      b,
      calc: computeCustomBuffPrice(b, activeVariants),
    }))
  }, [tiers])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/admin/buff-muse", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          isEnabled,
          tiers: tiers.map((t) => ({
            tokenAmountB: t.tokenAmountB,
            priceCents: t.priceCents,
            compareAtPriceCents: t.compareAtPriceCents,
            isActive: t.isActive,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || "Lưu cấu hình thất bại")
        return
      }

      if (json.config) {
        setExistsInDb(json.config.existsInDb)
        setProductName(json.config.productName)
        setIsEnabled(json.config.isEnabled)
        setTiers(json.config.tiers)
      }

      toast({
        title: "Đã lưu bảng giá Buff Token",
        description: "Trang /buff-muse đã được cập nhật ngay lập tức.",
      })
      router.refresh()
    } catch {
      setErrorMsg("Lỗi kết nối máy chủ khi lưu cấu hình")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            <span>Quản Lý Giá Buff Token Muse (/buff-muse)</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Điều chỉnh trạng thái nhận đơn, giá các gói 5B – 10B – 31B và mức tính giá Tùy chọn (1B – 31B).
          </p>
        </div>

        <Link
          href="/buff-muse"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-semibold text-foreground transition-btn shrink-0 self-start sm:self-auto"
        >
          <span>Mở trang /buff-muse</span>
          <ExternalLink className="size-3.5 text-primary" />
        </Link>
      </div>

      {!existsInDb && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
          <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Database hiện chưa có sản phẩm Buff Token Muse công khai (vì vậy trang{" "}
            <code className="font-mono text-amber-100">/buff-muse</code> đang hiện &ldquo;Tạm ngưng nhận đơn&rdquo;). Hãy chỉnh giá bên dưới, bật trạng thái <strong>Đang mở nhận đơn</strong> rồi bấm <strong>Lưu cấu hình</strong> — hệ thống sẽ tự khởi tạo đầy đủ!
          </span>
        </div>
      )}

      {/* Status & Display Title Card */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-7 space-y-1.5">
          <label
            htmlFor="buff-admin-title"
            className="text-xs font-semibold text-foreground block"
          >
            Tên gói hiển thị trên trang /buff-muse
          </label>
          <Input
            id="buff-admin-title"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="VD: Buff Token Muse AI Chính Chủ"
            className="text-sm"
          />
        </div>

        <div className="md:col-span-5 flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-border bg-background/60">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Trạng thái nhận đơn
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                isEnabled ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  isEnabled ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                }`}
              />
              {isEnabled ? "Đang mở nhận đơn" : "Tạm ngưng nhận đơn"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsEnabled((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-semibold border transition-btn cursor-pointer ${
              isEnabled
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25"
                : "bg-rose-500/15 text-rose-300 border-rose-500/35 hover:bg-rose-500/25"
            }`}
          >
            <Power className="size-3.5" />
            <span>{isEnabled ? "Đang BẬT" : "Đang TẮT"}</span>
          </button>
        </div>
      </div>

      {/* Pricing Tiers Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-secondary/20">
          <div>
            <h2 className="text-sm font-bold text-foreground">Bảng giá các mức Token (VND)</h2>
            <p className="text-[11px] text-muted-foreground">
              Các nút chọn nhanh trên <code className="font-mono">/buff-muse</code> dùng <strong>5B, 10B, 31B</strong>; chế độ <strong>Tùy chọn (1–31B)</strong> tự nội suy theo mốc gần nhất bên dưới.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleApplySuggested}
            className="text-xs h-8 gap-1.5 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Điền giá gợi ý</span>
          </Button>
        </div>

        <div className="divide-y divide-border/70">
          {tiers.map((tier) => {
            const isQuickPreset = [5, 10, 31].includes(tier.tokenAmountB)
            const unitRate = Math.round(tier.priceCents / tier.tokenAmountB)

            return (
              <div
                key={tier.tokenAmountB}
                className={`p-4 sm:px-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center transition-opacity ${
                  tier.isActive ? "" : "opacity-55 bg-background/40"
                }`}
              >
                <div className="sm:col-span-3 flex items-center justify-between sm:block space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-base text-foreground">
                      {tier.tokenAmountB}B Token
                    </span>
                    {isQuickPreset ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
                        Preset chính
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground border border-border">
                        Mốc tùy chọn
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    Đơn giá: <strong className="text-foreground">{formatPrice(unitRate)}</strong> / 1B
                  </p>
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label
                    htmlFor={`price-${tier.tokenAmountB}`}
                    className="text-[11px] font-medium text-muted-foreground block"
                  >
                    Giá bán (VNĐ)
                  </label>
                  <div className="relative">
                    <Input
                      id={`price-${tier.tokenAmountB}`}
                      type="number"
                      min={1000}
                      step={500}
                      value={tier.priceCents}
                      onChange={(e) =>
                        updateTier(tier.tokenAmountB, {
                          priceCents: Math.max(0, parseInt(e.target.value || "0", 10) || 0),
                        })
                      }
                      className="pr-10 font-mono font-bold text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      đ
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label
                    htmlFor={`compare-${tier.tokenAmountB}`}
                    className="text-[11px] font-medium text-muted-foreground block"
                  >
                    Giá gốc gạch (tuỳ chọn)
                  </label>
                  <Input
                    id={`compare-${tier.tokenAmountB}`}
                    type="number"
                    min={0}
                    step={1000}
                    value={tier.compareAtPriceCents ?? ""}
                    placeholder="Trống nếu không giảm"
                    onChange={(e) => {
                      const val = e.target.value.trim()
                      updateTier(tier.tokenAmountB, {
                        compareAtPriceCents: val ? parseInt(val, 10) || 0 : null,
                      })
                    }}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2 flex sm:justify-end">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={tier.isActive}
                      onChange={(e) =>
                        updateTier(tier.tokenAmountB, { isActive: e.target.checked })
                      }
                      className="size-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <span>{tier.isActive ? "Đang bật" : "Đang ẩn"}</span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Live Custom Price Preview */}
      <div className="rounded-2xl border border-border bg-card/80 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Xem trước giá hiển thị trên /buff-muse (kể cả chế độ Tùy chọn 1–31B)
          </h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 text-xs">
          {previewRates.map(({ b, calc }) => (
            <div
              key={b}
              className={`p-2 rounded-xl border text-center ${
                [5, 10, 31].includes(b)
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-background/60"
              }`}
            >
              <span className="font-bold text-foreground block">{b}B</span>
              <span className="text-[11px] font-semibold text-primary tabular-nums">
                {formatPrice(calc.priceCents)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="submit"
          disabled={saving}
          className="h-10 px-5 rounded-xl bg-primary hover:bg-caramel-light text-primary-foreground font-bold text-sm gap-2 cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              {existsInDb ? <Save className="size-4" /> : <CheckCircle2 className="size-4" />}
              <span>{existsInDb ? "Lưu cấu hình giá Buff" : "Kích hoạt & Lưu bảng giá"}</span>
            </>
          )}
        </Button>
      </div>

      {/* Telegram Bot Configuration Card (Persists in DB so production works even without editing .env) */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary">
              <Bell className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Thông báo &amp; Bot Telegram nhận đơn Buff
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Lưu trực tiếp vào Database (mã hóa AES-256) và tự gắn Webhook cho domain thật.
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              tgConfigured
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                : "bg-rose-500/10 text-rose-300 border-rose-500/30"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                tgConfigured ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            />
            {tgConfigured
              ? `Đã kết nối (${tgSource === "db" ? "Database" : ".env"})`
              : "Chưa cấu hình trên server này!"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label htmlFor="tg-bot-token" className="text-xs font-semibold text-foreground block">
              Bot Token (@BotFather)
            </label>
            <Input
              id="tg-bot-token"
              type="password"
              value={tgTokenInput}
              onChange={(e) => setTgTokenInput(e.target.value)}
              placeholder={
                tgMaskedToken ? `Đang lưu: ${tgMaskedToken} (để trống nếu giữ nguyên)` : "VD: 9102505205:AAFw..."
              }
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tg-chat-id" className="text-xs font-semibold text-foreground block">
              Telegram Chat ID nhận thông báo
            </label>
            <div className="flex gap-2">
              <Input
                id="tg-chat-id"
                type="text"
                value={tgChatIdInput}
                onChange={(e) => setTgChatIdInput(e.target.value)}
                placeholder="VD: 5890711288"
                className="font-mono text-xs flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(tgBusy)}
                onClick={() => handleTelegramAction("detect_chat_id")}
                className="h-9 text-xs gap-1 shrink-0 cursor-pointer"
                title="Tự lấy Chat ID từ tin nhắn /start mới nhất gửi cho bot"
              >
                {tgBusy === "detect_chat_id" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
                <span>Tự lấy ID</span>
              </Button>
            </div>
          </div>
        </div>

        {tgWebhookUrl && (
          <p className="text-[11px] text-muted-foreground font-mono truncate">
            Webhook đang gắn: <span className="text-emerald-400">{tgWebhookUrl}</span>
          </p>
        )}

        {tgFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              tgFeedback.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {tgFeedback.type === "ok" ? (
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
            )}
            <span>{tgFeedback.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            disabled={Boolean(tgBusy)}
            onClick={() => handleTelegramAction("save")}
            className="h-9 px-4 text-xs font-semibold bg-primary hover:bg-caramel-light text-primary-foreground gap-1.5 cursor-pointer"
          >
            {tgBusy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            <span>Lưu &amp; Kết nối Telegram</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={Boolean(tgBusy) || !tgConfigured}
            onClick={() => handleTelegramAction("test")}
            className="h-9 px-3.5 text-xs font-semibold gap-1.5 cursor-pointer"
          >
            {tgBusy === "test" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5 text-primary" />}
            <span>Gửi tin nhắn Test</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={Boolean(tgBusy) || !tgConfigured}
            onClick={() => handleTelegramAction("resend_pending")}
            className="h-9 px-3.5 text-xs font-semibold gap-1.5 cursor-pointer"
          >
            {tgBusy === "resend_pending" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5 text-amber-400" />
            )}
            <span>Gửi lại các đơn Buff đang chờ</span>
          </Button>
        </div>
      </div>
    </form>
  )
}
