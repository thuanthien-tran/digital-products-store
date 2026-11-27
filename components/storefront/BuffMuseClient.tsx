"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Zap,
  Check,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  AlertCircle,
  Loader2,
  ArrowRight,
  Tag,
  X,
  CheckCircle2,
  MessageCircle,
  SlidersHorizontal,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { computeCustomBuffPrice } from "@/lib/buff-pricing"
import { useToast } from "@/hooks/use-toast"

const ZALO_PHONE = (process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964").replace(/\D/g, "")

export interface BuffMuseVariant {
  id: string
  name: string
  priceCents: number
  compareAtPriceCents: number | null
  tokenAmountB: number
}

interface BuffMuseClientProps {
  productId: string | null
  productName: string
  isProductOutOfStock: boolean
  variants: BuffMuseVariant[]
}

const QUICK_PRESETS = [5, 10, 30] as const

function makeClientOrderKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "buff_muse_order_key"
}

export function BuffMuseClient({
  productId,
  productName,
  isProductOutOfStock,
  variants,
}: BuffMuseClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const defaultPreset = useMemo(() => {
    const has10 = variants.find((v) => v.tokenAmountB === 10)
    if (has10) return 10
    const has5 = variants.find((v) => v.tokenAmountB === 5)
    if (has5) return 5
    return variants[0]?.tokenAmountB || 10
  }, [variants])

  const [selectionMode, setSelectionMode] = useState<"preset" | "custom">("preset")
  const [selectedB, setSelectedB] = useState<number>(defaultPreset)
  const [customInput, setCustomInput] = useState<string>(String(defaultPreset))

  const [inviteCode, setInviteCode] = useState("")
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [consentAccepted, setConsentAccepted] = useState(true)
  const [guideOpen, setGuideOpen] = useState(false)

  // Coupon state
  const [couponOpen, setCouponOpen] = useState(false)
  const [couponInput, setCouponInput] = useState("")
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    name: string
    discountCents: number
  } | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [idempotencyKey] = useState<string>(makeClientOrderKey)
  const submittingRef = useRef(false)

  const isSystemBlocked = isProductOutOfStock || !productId || variants.length === 0

  const effectiveB = useMemo(() => {
    const raw = selectionMode === "custom" ? parseInt(customInput, 10) : selectedB
    if (!Number.isFinite(raw) || raw < 1) return 1
    return Math.min(30, raw)
  }, [selectionMode, customInput, selectedB])

  const pricing = useMemo(
    () => computeCustomBuffPrice(effectiveB, variants),
    [effectiveB, variants]
  )

  const targetVariant = pricing.matchedVariant || variants[0] || null
  const subtotalPrice = pricing.priceCents
  const discountCents = appliedCoupon
    ? Math.min(appliedCoupon.discountCents, Math.max(0, subtotalPrice - 1000))
    : 0
  const finalPrice = Math.max(subtotalPrice > 0 ? 1000 : 0, subtotalPrice - discountCents)

  const handleSelectPreset = (amountB: number) => {
    setSelectionMode("preset")
    setSelectedB(amountB)
    setCustomInput(String(amountB))
    setSubmitError(null)
    if (appliedCoupon) {
      setAppliedCoupon(null)
      setCouponError(null)
    }
  }

  const handleEnableCustom = () => {
    setSelectionMode("custom")
    setCustomInput(String(effectiveB))
    setSubmitError(null)
    if (appliedCoupon) {
      setAppliedCoupon(null)
      setCouponError(null)
    }
  }

  const handleCustomChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, "")
    if (!digitsOnly) {
      setCustomInput("")
      return
    }
    const num = Math.min(30, Math.max(1, parseInt(digitsOnly, 10)))
    setCustomInput(String(num))
    setSelectedB(num)
    if (appliedCoupon) {
      setAppliedCoupon(null)
      setCouponError(null)
    }
  }

  const adjustCustomB = (delta: number) => {
    const next = Math.min(30, Math.max(1, effectiveB + delta))
    setSelectionMode("custom")
    setSelectedB(next)
    setCustomInput(String(next))
    if (appliedCoupon) {
      setAppliedCoupon(null)
      setCouponError(null)
    }
  }

  const handleInviteChange = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20)
    setInviteCode(clean)
    if (inviteError) setInviteError(null)
    if (submitError) setSubmitError(null)
  }

  const validateInvite = (val: string): string | null => {
    const clean = val.trim().toUpperCase()
    if (!clean) return "Vui lòng nhập Mã mời (Invite Code) Muse AI của bạn"
    if (!/^[A-Z0-9]{4,20}$/.test(clean)) {
      return "Mã mời phải gồm 4–20 ký tự chữ hoặc số (VD: 5MQGL2)"
    }
    return null
  }

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code || !targetVariant || !productId || couponLoading) return
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch("/api/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          items: [{ productId, variantId: targetVariant.id, quantity: 1 }],
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setAppliedCoupon(null)
        setCouponError(data.error || "Mã giảm giá không hợp lệ")
        return
      }
      if (subtotalPrice - Number(data.discountCents || 0) < 1000) {
        setAppliedCoupon(null)
        setCouponError("Mã giảm giá không áp dụng giảm toàn bộ đơn Buff Token (tối thiểu 1.000đ).")
        return
      }
      setAppliedCoupon({
        code: data.code,
        name: data.name || data.code,
        discountCents: Number(data.discountCents || 0),
      })
      setCouponInput(data.code)
    } catch {
      setCouponError("Không thể kiểm tra mã giảm giá lúc này")
    } finally {
      setCouponLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current || isSystemBlocked || !targetVariant || !productId) return

    const invErr = validateInvite(inviteCode)
    setInviteError(invErr)

    if (invErr) return
    if (!consentAccepted) {
      setSubmitError("Vui lòng đồng ý với Điều khoản dịch vụ trước khi thanh toán")
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: inviteCode.trim().toUpperCase(),
          buffMode: "manual",
          customTokenAmountB: effectiveB,
          idempotencyKey,
          consentAccepted: true,
          couponCode: appliedCoupon?.code || undefined,
          items: [
            {
              productId,
              variantId: targetVariant.id,
              quantity: 1,
            },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || "Không thể tạo đơn hàng lúc này")
        return
      }

      toast({
        title: "Đã tạo bảng thanh toán",
        description: "Quét mã VietQR để shop nhận thông báo và bắt đầu buff ngay.",
      })
      router.push(`/order/${data.id}`)
    } catch {
      setSubmitError("Lỗi kết nối máy chủ. Vui lòng thử lại.")
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  const couponAccordionOpen = couponOpen || Boolean(appliedCoupon) || Boolean(couponError)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
      {/* Main Form Card */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-7 rounded-2xl border border-border bg-card p-3.5 sm:p-6 space-y-4 sm:space-y-5"
      >
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary">
              <Zap className="size-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">
                {productName}
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Hỗ trợ mọi mức từ 1B – 30B Token · Thanh toán VietQR
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              isSystemBlocked
                ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isSystemBlocked ? "bg-rose-400" : "bg-emerald-400 animate-pulse"
              }`}
            />
            {isSystemBlocked ? "Tạm ngưng nhận đơn" : "Sẵn sàng nhận đơn"}
          </span>
        </div>

        {/* 1. Invite Code */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="buff-invite-code"
              className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-foreground"
            >
              1. Nhập Mã mời Muse AI <span className="text-primary">*</span>
            </label>
            <button
              type="button"
              onClick={() => setGuideOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-caramel-light cursor-pointer"
            >
              <HelpCircle className="size-3.5" />
              <span>Cách lấy mã?</span>
            </button>
          </div>

          {guideOpen && (
            <div className="rounded-xl border border-border bg-background/80 p-3 text-xs text-muted-foreground leading-relaxed space-y-1 animate-grid-switch">
              <p>
                Mở <strong className="text-foreground">Muse AI</strong> → mục{" "}
                <strong className="text-foreground">Invite Friends / Mời bạn bè</strong> → sao chép
                mã mời của bạn (thường 6 ký tự chữ và số, ví dụ:{" "}
                <code className="font-mono text-primary bg-secondary px-1.5 py-0.5 rounded">
                  5MQGL2
                </code>
                ).
              </p>
              <p className="text-[11px] text-amber-300/90">
                Kiểm tra kỹ ký tự chữ O và số 0 trước khi thanh toán.
              </p>
            </div>
          )}

          <div className="relative">
            <input
              id="buff-invite-code"
              type="text"
              value={inviteCode}
              onChange={(e) => handleInviteChange(e.target.value)}
              placeholder="NHẬP MÃ MỜI (VD: 5MQGL2)"
              maxLength={20}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full h-11 px-3.5 rounded-xl bg-background border font-mono text-sm sm:text-base tracking-widest text-foreground placeholder:font-sans placeholder:tracking-normal placeholder:text-xs sm:placeholder:text-sm placeholder:text-muted-foreground/60 focus:outline-none transition-colors ${
                inviteError
                  ? "border-rose-500/60 focus:border-rose-400"
                  : inviteCode.length >= 4
                  ? "border-emerald-500/45 focus:border-primary"
                  : "border-border focus:border-primary"
              }`}
            />
            {inviteCode && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-muted-foreground">
                {inviteCode.length}/20
              </span>
            )}
          </div>
          {inviteError && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{inviteError}</span>
            </p>
          )}
        </div>

        {/* 2. Amount Selector: 5B - 10B - 30B - Tùy chọn (1..30B) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-foreground">
              2. Chọn số lượng Token muốn Buff <span className="text-primary">*</span>
            </span>
            <span className="text-[11px] text-muted-foreground">Tối đa 30B / đơn</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_PRESETS.map((amountB) => {
              const presetInfo = computeCustomBuffPrice(amountB, variants)
              const isSelected = selectionMode === "preset" && selectedB === amountB

              return (
                <button
                  key={amountB}
                  type="button"
                  disabled={isSystemBlocked}
                  onClick={() => handleSelectPreset(amountB)}
                  className={`relative text-left p-2.5 sm:p-3 rounded-xl border transition-ui active:scale-[0.97] ${
                    isSystemBlocked
                      ? "border-border/50 bg-background/40 opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "border-primary bg-primary/12 shadow-[0_0_0_1px_rgba(230,166,111,0.35)] cursor-pointer"
                      : "border-border bg-background/70 hover:border-primary/45 hover:bg-secondary/50 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-heading font-bold text-sm sm:text-base text-foreground">
                      {amountB}B
                    </span>
                    <span
                      className={`size-4 rounded-full flex items-center justify-center border shrink-0 ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground animate-chip-in"
                          : "border-border bg-card"
                      }`}
                    >
                      {isSelected && <Check className="size-2.5 stroke-[3]" />}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-primary tabular-nums block">
                    {formatPrice(presetInfo.priceCents)}
                  </span>
                </button>
              )
            })}

            {/* Custom Option Button */}
            <button
              type="button"
              disabled={isSystemBlocked}
              onClick={handleEnableCustom}
              className={`relative text-left p-2.5 sm:p-3 rounded-xl border transition-ui active:scale-[0.97] ${
                isSystemBlocked
                  ? "border-border/50 bg-background/40 opacity-50 cursor-not-allowed"
                  : selectionMode === "custom"
                  ? "border-primary bg-primary/12 shadow-[0_0_0_1px_rgba(230,166,111,0.35)] cursor-pointer"
                  : "border-border bg-background/70 hover:border-primary/45 hover:bg-secondary/50 cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="font-heading font-bold text-sm sm:text-base text-foreground inline-flex items-center gap-1">
                  <SlidersHorizontal className="size-3.5 text-primary" />
                  <span>Tùy chọn</span>
                </span>
                <span
                  className={`size-4 rounded-full flex items-center justify-center border shrink-0 ${
                    selectionMode === "custom"
                      ? "bg-primary border-primary text-primary-foreground animate-chip-in"
                      : "border-border bg-card"
                  }`}
                >
                  {selectionMode === "custom" && <Check className="size-2.5 stroke-[3]" />}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground block">
                {selectionMode === "custom" ? `${effectiveB}B · Tự nhập` : "1B – 30B"}
              </span>
            </button>
          </div>

          {/* Expandable Custom Input Panel */}
          <div
            aria-hidden={selectionMode !== "custom"}
            className="accordion-grid"
            data-open={selectionMode === "custom" ? "true" : "false"}
          >
            <div className="accordion-grid-inner">
              <div className="p-3 rounded-xl border border-primary/35 bg-background/85 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <label
                    htmlFor="buff-custom-b"
                    className="text-xs font-semibold text-foreground block"
                  >
                    Nhập số lượng Token (B):
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Chọn từ 1B đến 30B Token (1B = 1 tỷ Token)
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={effectiveB <= 1}
                    onClick={() => adjustCustomB(-1)}
                    className="size-9 rounded-lg border border-border bg-card hover:bg-secondary text-foreground font-bold disabled:opacity-40 cursor-pointer"
                  >
                    −
                  </button>
                  <div className="relative">
                    <input
                      id="buff-custom-b"
                      type="text"
                      inputMode="numeric"
                      value={customInput}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      onBlur={() => {
                        if (!customInput) setCustomInput("1")
                      }}
                      className="w-16 h-9 pl-2 pr-5 rounded-lg border border-border bg-card text-center font-mono font-bold text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-primary pointer-events-none">
                      B
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={effectiveB >= 30}
                    onClick={() => adjustCustomB(1)}
                    className="size-9 rounded-lg border border-border bg-card hover:bg-secondary text-foreground font-bold disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Coupon */}
        <div className="rounded-xl border border-border/80 bg-background/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setCouponOpen((prev) => !prev)}
            aria-expanded={couponAccordionOpen}
            className="w-full min-h-[40px] px-3 py-2 flex items-center justify-between text-xs font-medium text-foreground hover:bg-secondary/50 transition-btn cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Tag className="size-3.5 text-primary shrink-0" />
              <span>
                {appliedCoupon
                  ? `Mã giảm giá: ${appliedCoupon.code} (-${formatPrice(discountCents)})`
                  : "Bạn có mã giảm giá?"}
              </span>
            </span>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform duration-150 ${
                couponAccordionOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <div
            aria-hidden={!couponAccordionOpen}
            className="accordion-grid"
            data-open={couponAccordionOpen ? "true" : "false"}
          >
            <div className="accordion-grid-inner">
              <div className="px-3 pb-3 pt-2 border-t border-border/60 space-y-2">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span className="font-mono">{appliedCoupon.code}</span>
                      <span>(-{formatPrice(discountCents)})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null)
                        setCouponInput("")
                        setCouponError(null)
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer"
                    >
                      <X className="size-3" />
                      <span>Bỏ</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase())
                        if (couponError) setCouponError(null)
                      }}
                      placeholder="Nhập mã giảm giá..."
                      className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-card border border-border text-xs font-mono uppercase text-foreground placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      disabled={couponLoading || !couponInput.trim()}
                      onClick={handleApplyCoupon}
                      className="h-9 px-3 rounded-lg bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground border border-border disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {couponLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Áp dụng"}
                    </button>
                  </div>
                )}
                {couponError && <p className="text-[11px] text-rose-400">{couponError}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Summary & CTA */}
        <div className="pt-2 border-t border-border/70 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Gói đã chọn: <strong className="text-primary">{effectiveB}B Token</strong>
            </span>
            <div className="text-right">
              <span className="text-muted-foreground mr-1.5">Tổng thanh toán:</span>
              <span className="text-lg sm:text-xl font-bold text-foreground tabular-nums">
                {formatPrice(finalPrice)}
              </span>
            </div>
          </div>

          <label className="flex items-start gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              className="mt-0.5 rounded border-border accent-primary"
            />
            <span>
              Tôi xác nhận đã nhập đúng mã mời Muse AI và đồng ý{" "}
              <Link href="/dieu-khoan-dich-vu" className="text-primary hover:underline">
                Điều khoản dịch vụ
              </Link>
              .
            </span>
          </label>

          {submitError && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {isSystemBlocked ? (
            <a
              href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
                "Chào shop CapyGo, mình muốn đặt Buff Token Muse AI."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 rounded-xl bg-secondary border border-border hover:border-primary/40 text-foreground font-semibold text-sm flex items-center justify-center gap-2 transition-btn"
            >
              <MessageCircle className="size-4 text-primary" />
              <span>Nhắn Zalo đặt buff trực tiếp</span>
            </a>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-primary hover:bg-caramel-light text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-btn disabled:opacity-60 cursor-pointer shadow-[0_6px_20px_-8px_rgba(230,166,111,0.55)]"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Đang mở bảng thanh toán...</span>
                </>
              ) : (
                <>
                  <span>Buff {effectiveB}B · Thanh toán {formatPrice(finalPrice)}</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          )}
        </div>
      </form>

      {/* Side Summary Card */}
      <aside className="lg:col-span-5 rounded-2xl border border-border bg-card/85 p-4 sm:p-5 space-y-3.5 text-xs">
        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>Quy trình xử lý đơn Buff</span>
        </div>

        <ol className="space-y-2.5 text-muted-foreground leading-relaxed">
          <li className="flex gap-2.5">
            <span className="size-5 rounded-full bg-secondary border border-border text-[11px] font-bold text-primary flex items-center justify-center shrink-0">
              1
            </span>
            <span>
              Nhập chính xác <strong className="text-foreground">Mã mời Muse AI</strong> &amp; chọn
              số lượng (5B, 10B, 30B hoặc số B tùy chọn từ 1–30B).
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="size-5 rounded-full bg-secondary border border-border text-[11px] font-bold text-primary flex items-center justify-center shrink-0">
              2
            </span>
            <span>
              Bấm nút Buff để hiện bảng thanh toán <strong className="text-foreground">VietQR</strong>.
              Hệ thống tự động đối soát khi tiền về ngân hàng.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="size-5 rounded-full bg-secondary border border-border text-[11px] font-bold text-primary flex items-center justify-center shrink-0">
              3
            </span>
            <span>
              Ngay sau khi thanh toán xong, Admin nhận thông báo kèm{" "}
              <strong className="text-foreground">Mã mời + Số lượng Token</strong> để tiến hành buff
              và cập nhật hoàn tất trực tiếp trên trang đơn hàng của bạn.
            </span>
          </li>
        </ol>

        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Cần hỗ trợ gấp?</span>
          <a
            href={`https://zalo.me/${ZALO_PHONE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            Nhắn Zalo →
          </a>
        </div>
      </aside>
    </div>
  )
}
