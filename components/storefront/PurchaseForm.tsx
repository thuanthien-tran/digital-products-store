"use client"

import { useState, useRef, useId, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { formatPrice } from "@/lib/utils"
import { 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  AlertTriangle, 
  Plus, 
  Minus,
  ShieldCheck,
  Zap,
  Clock,
  MessageCircle,
  Tag,
  CheckCircle2,
  X,
} from "lucide-react"

export interface PurchaseVariant {
  id: string
  name: string
  priceCents: number
  compareAtPriceCents: number | null
  availableStock: number
  minQuantity?: number
  maxQuantity?: number | null
  tokenAmountB?: number | null
  isActive?: boolean
}

export interface PurchaseFormProps {
  product: {
    id: string
    name: string
    deliveryType: string
    fulfillmentType?: string
    quantityMode?: string
    requiresInviteCode?: boolean
    statusOverride?: string | null
    noticeNotes?: string | null
    warrantyTerms?: string | null
  }
  variants: PurchaseVariant[]
}

// Regex matching RFC 5322 simplified standard
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

// Detect duration tag from variant name
function detectDurationTag(name: string): string | null {
  const match = name.match(/(\d+\s*(?:tháng|thang|năm|nam|ngày|ngay|tuần|tuan|h|giờ|gio|m|y))/i)
  if (match) return match[1].trim()
  if (/vĩnh viễn|lifetime/i.test(name)) return "Vĩnh viễn"
  return null
}

// Detect condition tag (KBH, VPN) from variant name
function detectVariantBadge(name: string): string | null {
  if (/kbh|không bảo hành|ko bảo hành/i.test(name)) return "KBH (Không bảo hành)"
  if (/vpn/i.test(name)) return "Yêu cầu VPN"
  return null
}

export function PurchaseForm({ product, variants }: PurchaseFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const formId = useId()

  // Dynamic live availability state (polled every 20s when active, preserving user form inputs)
  const [liveStockMap, setLiveStockMap] = useState<Record<string, { availableStock: number; isPurchasable: boolean }>>({})
  const isPollingRef = useRef(false)

  const getEffectiveStock = useCallback((v: PurchaseVariant): number => {
    if (liveStockMap[v.id] !== undefined) {
      return liveStockMap[v.id].availableStock
    }
    return v.availableStock
  }, [liveStockMap])

  // Default to first variant that has stock, otherwise first
  const initialVariant = variants.find((v) => v.availableStock > 0) || variants[0]
  const [selectedVariantId, setSelectedVariantId] = useState<string>(initialVariant?.id || "")
  const [quantity, setQuantity] = useState<number>(1)
  const [email, setEmail] = useState("")
  const [emailTouched, setEmailTouched] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [consentAgreed, setConsentAgreed] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [inviteCodeError, setInviteCodeError] = useState<string | null>(null)

  // Coupon state
  const [couponInput, setCouponInput] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    name: string
    discountType: "fixed" | "percentage"
    discountValue: number
    maxDiscountCents: number | null
    subtotalCents: number
    discountCents: number
    finalTotalCents: number
    description: string
  } | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponSuccessMessage, setCouponSuccessMessage] = useState<string | null>(null)
  const couponAbortControllerRef = useRef<AbortController | null>(null)
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  )

  const isSubmittingRef = useRef(false)
  const radioRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Poll live availability without losing any user selections or input data
  const pollAvailability = useCallback(async () => {
    if (isPollingRef.current) return
    if (typeof document !== "undefined" && (document.hidden || document.visibilityState === "hidden")) return

    isPollingRef.current = true
    try {
      const vIds = variants.map((v) => v.id).join(",")
      if (!vIds) return

      const res = await fetch(`/api/store/availability?variantIds=${vIds}`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      if (data && data.variants) {
        setLiveStockMap((prev) => ({
          ...prev,
          ...data.variants,
        }))
      }
    } catch {
      // Non-blocking silent backoff
    } finally {
      isPollingRef.current = false
    }
  }, [variants])

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void pollAvailability()
    }, 0)
    const interval = setInterval(pollAvailability, 20000)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pollAvailability()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [pollAvailability])

  const selectedVariant = variants.find((v) => v.id === selectedVariantId)
  const isBuffProduct =
    product.fulfillmentType === "buff" ||
    product.deliveryType === "buff" ||
    product.deliveryType === "service" ||
    Boolean(selectedVariant?.tokenAmountB) ||
    variants.some((v) => Boolean(v.tokenAmountB)) ||
    /buff/i.test(`${product.name} ${selectedVariant?.name || ""}`)

  const isFixedPackage = product.quantityMode === "fixed_package"
  const rawStock = selectedVariant ? getEffectiveStock(selectedVariant) : 0
  const effectiveStock = selectedVariant
    ? (isBuffProduct ? Math.max(rawStock, 999) : rawStock)
    : 0
  const isOutOfStock = !selectedVariant || (isBuffProduct ? (selectedVariant.isActive === false) : effectiveStock <= 0)

  // Quantity limits
  const maxAllowedQuantity = isFixedPackage
    ? 1
    : Math.min(selectedVariant?.maxQuantity || 50, isBuffProduct ? 50 : Math.max(1, effectiveStock))

  // Price calculations
  const unitPrice = selectedVariant?.priceCents || 0
  const subtotalPrice = unitPrice * quantity
  const discountAmount = appliedCoupon ? appliedCoupon.discountCents : 0
  const finalPrice = appliedCoupon ? appliedCoupon.finalTotalCents : subtotalPrice

  const rawCompare = selectedVariant?.compareAtPriceCents || null
  const hasValidCompare = Boolean(rawCompare && rawCompare > unitPrice)
  const compareTotalPrice = hasValidCompare && rawCompare ? rawCompare * quantity : null
  const savingsAmount = compareTotalPrice ? compareTotalPrice - subtotalPrice : null
  const discountPercent =
    hasValidCompare && rawCompare
      ? Math.floor(((rawCompare - unitPrice) / rawCompare) * 100)
      : null

  const handleApplyCoupon = useCallback(async (codeToApply?: string) => {
    const rawCode = (codeToApply !== undefined ? codeToApply : couponInput).trim().toUpperCase()
    if (!rawCode) {
      setCouponError("Vui lòng nhập mã giảm giá")
      return
    }

    if (couponAbortControllerRef.current) {
      couponAbortControllerRef.current.abort()
    }
    const controller = new AbortController()
    couponAbortControllerRef.current = controller

    setCouponLoading(true)
    setCouponError(null)
    setCouponSuccessMessage(null)

    try {
      const res = await fetch("/api/coupons/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: rawCode,
          email: email.trim().toLowerCase() || undefined,
          items: [
            {
              variantId: selectedVariantId,
              quantity: Math.max(1, Math.min(quantity, maxAllowedQuantity)),
            },
          ],
        }),
        signal: controller.signal,
      })

      const data = await res.json().catch(() => ({}))
      const couponObj = data.coupon || (data.code && data.valid ? {
        id: data.couponId || "",
        code: data.code,
        name: data.name || data.code,
        discountType: data.discountType === "percent" ? "percentage" : "fixed",
        discountValue: data.discountValue || 0,
        maxDiscountCents: data.maxDiscountCents ?? null,
        subtotalCents: data.subtotalCents ?? subtotalPrice,
        discountCents: data.discountCents ?? 0,
        finalTotalCents: data.totalCents ?? data.finalTotalCents ?? (subtotalPrice - (data.discountCents ?? 0)),
        description: data.name || data.code,
      } : null)

      if (!res.ok || !data.valid || !couponObj) {
        setAppliedCoupon(null)
        setCouponError(data.error || "Mã giảm giá không hợp lệ hoặc không đủ điều kiện áp dụng")
      } else {
        setAppliedCoupon(couponObj)
        setCouponInput(couponObj.code)
        setCouponError(null)
        setCouponSuccessMessage(`Áp dụng thành công: ${couponObj.name} (-${formatPrice(couponObj.discountCents)})`)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      console.error("[PurchaseForm] Lỗi kiểm tra coupon:", err)
      setAppliedCoupon(null)
      setCouponError(err instanceof Error && !err.message.includes("fetch") ? err.message : "Lỗi kết nối khi kiểm tra mã giảm giá")
    } finally {
      setCouponLoading(false)
    }
  }, [couponInput, email, selectedVariantId, quantity, maxAllowedQuantity])

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput("")
    setCouponError(null)
    setCouponSuccessMessage(null)
  }

  // Re-verify applied coupon if variant or quantity changes
  useEffect(() => {
    if (!appliedCoupon) return
    const currentCode = appliedCoupon.code
    const timer = setTimeout(() => {
      handleApplyCoupon(currentCode)
    }, 250)
    return () => clearTimeout(timer)
  }, [selectedVariantId, quantity, handleApplyCoupon])

  // Validate email
  const validateEmailValue = (val: string): string | null => {
    const trimmed = val.trim()
    if (!trimmed) {
      return "Vui lòng nhập địa chỉ email của bạn"
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      return "Địa chỉ email không đúng định dạng (ví dụ: ban@gmail.com)"
    }
    return null
  }

  const handleEmailBlur = () => {
    setEmailTouched(true)
    setEmailError(validateEmailValue(email))
  }

  const handleEmailChange = (val: string) => {
    setEmail(val)
    if (emailTouched) {
      setEmailError(validateEmailValue(val))
    }
    if (submitError) {
      setSubmitError(null)
    }
  }

  // Handle keyboard navigation for radio group
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const availableVariants = variants.filter((v) => getEffectiveStock(v) > 0)
    if (availableVariants.length === 0) return

    let nextIndex = -1
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % variants.length
      while (getEffectiveStock(variants[nextIndex]) === 0 && nextIndex !== currentIndex) {
        nextIndex = (nextIndex + 1) % variants.length
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + variants.length) % variants.length
      while (getEffectiveStock(variants[nextIndex]) === 0 && nextIndex !== currentIndex) {
        nextIndex = (nextIndex - 1 + variants.length) % variants.length
      }
    }

    if (nextIndex >= 0 && variants[nextIndex] && getEffectiveStock(variants[nextIndex]) > 0) {
      const nextVariant = variants[nextIndex]
      setSelectedVariantId(nextVariant.id)
      setQuantity(1)
      radioRefs.current.get(nextVariant.id)?.focus()
    }
  }

  const handleSelectVariant = (id: string) => {
    const v = variants.find((item) => item.id === id)
    if (!v || getEffectiveStock(v) <= 0) return
    setSelectedVariantId(id)
    setQuantity(1)
    setSubmitError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    // Validate email
    const err = validateEmailValue(email)
    setEmailTouched(true)
    if (err) {
      setEmailError(err)
      return
    }

    if (!selectedVariant || isOutOfStock) {
      setSubmitError("Gói bạn chọn hiện đã hết hàng trong kho. Vui lòng chọn gói khác.")
      return
    }

    if (!consentAgreed) {
      setConsentError(true)
      setSubmitError("Vui lòng tích chọn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật trước khi tiếp tục.")
      return
    }

    if (isBuffProduct || product.requiresInviteCode) {
      const cleanCode = inviteCode.trim().toUpperCase()
      if (!cleanCode || cleanCode.length < 4 || cleanCode.length > 20) {
        setInviteCodeError("Mã mời phải từ 4 đến 20 ký tự chữ hoặc số.")
        setSubmitError("Vui lòng nhập chính xác mã mời nhận token Muse AI để tiếp tục.")
        return
      }
    }

    // Guard against double submission
    if (isSubmittingRef.current || loading) return
    isSubmittingRef.current = true
    setLoading(true)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          consentAccepted: true,
          consentTimestamp: new Date().toISOString(),
          note: isBuffProduct && inviteCode ? `Mã mời: ${inviteCode.trim().toUpperCase()}` : undefined,
          inviteCode: isBuffProduct && inviteCode ? inviteCode.trim().toUpperCase() : undefined,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
          idempotencyKey: idempotencyKeyRef.current,
          items: [
            {
              productId: product.id,
              variantId: selectedVariant.id,
              quantity: Math.max(1, Math.min(quantity, maxAllowedQuantity)),
            },
          ],
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        // If stock changed or unverified, update local state immediately without wiping inputs
        if (errorData.code === "OUT_OF_STOCK" || errorData.code === "INSUFFICIENT_STOCK") {
          setLiveStockMap((prev) => ({
            ...prev,
            [selectedVariant.id]: {
              availableStock: errorData.availableStock ?? 0,
              isPurchasable: (errorData.availableStock ?? 0) > 0,
              displayStatus: (errorData.availableStock ?? 0) > 0 ? "available" : "out_of_stock",
            },
          }))
        }
        throw new Error(errorData.error || "Không thể khởi tạo đơn hàng. Vui lòng thử lại.")
      }

      const data = await res.json()
      router.push(`/order/${data.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Đã có lỗi xảy ra khi tạo đơn hàng."
      setSubmitError(msg)
      toast({
        title: "Không thể tạo đơn hàng",
        description: msg,
        variant: "destructive",
      })
      isSubmittingRef.current = false
      setLoading(false)
    }
  }

  // Detect critical condition notes
  const isKBH = /kbh|không bảo hành/i.test(`${selectedVariant?.name || ""} ${product.name}`)
  const isVPN = /vpn|ấn độ|india/i.test(`${selectedVariant?.name || ""} ${product.noticeNotes || ""}`)

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-xl shadow-black/40 text-foreground space-y-6">
      {/* A. Header: Title & Stock Status */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            Hoàn tất đơn hàng
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chọn gói và nhập email để tiến hành thanh toán
          </p>
        </div>

        {/* Live Stock Status Indicator */}
        <div className="shrink-0">
          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
              <span className="size-1.5 rounded-full bg-slate-500" />
              Tạm hết hàng
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Còn hàng
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* B. Chọn gói (Radio Card List) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              id={`${formId}-variant-label`}
              className="text-xs font-bold text-foreground uppercase tracking-wider block"
            >
              {isBuffProduct ? "1. Chọn gói dung lượng Token Muse AI *" : "1. Chọn gói / thời hạn *"}
            </label>
            <span className="text-[11px] text-muted-foreground font-medium">
              {variants.length} gói
            </span>
          </div>

          <div
            role="radiogroup"
            aria-labelledby={`${formId}-variant-label`}
            className="space-y-2"
          >
            {variants.map((v, idx) => {
              const isSelected = selectedVariantId === v.id
              const vStock = getEffectiveStock(v)
              const isBuffVariant = isBuffProduct || Boolean(v.tokenAmountB) || /buff|\d+b/i.test(v.name)
              const outOfStock = isBuffVariant ? (v.isActive === false) : vStock <= 0
              const durationTag = detectDurationTag(v.name)
              const conditionBadge = detectVariantBadge(v.name)
              const hasDiscount = Boolean(v.compareAtPriceCents && v.compareAtPriceCents > v.priceCents)
              const vDiscountPct = hasDiscount && v.compareAtPriceCents
                ? Math.floor(((v.compareAtPriceCents - v.priceCents) / v.compareAtPriceCents) * 100)
                : null

              return (
                <div
                  key={v.id}
                  ref={(el) => {
                    if (el) radioRefs.current.set(v.id, el)
                    else radioRefs.current.delete(v.id)
                  }}
                  role="radio"
                  tabIndex={isSelected ? 0 : outOfStock ? -1 : 0}
                  aria-checked={isSelected}
                  aria-disabled={outOfStock}
                  onClick={() => !outOfStock && handleSelectVariant(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault()
                      if (!outOfStock) handleSelectVariant(v.id)
                    } else {
                      handleKeyDown(e, idx)
                    }
                  }}
                  className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border text-left transition-all select-none outline-none ${
                    outOfStock
                      ? "opacity-40 cursor-not-allowed bg-secondary/10 border-border/40"
                      : isSelected
                      ? "border-caramel bg-caramel/10 ring-1 ring-caramel/80 cursor-pointer shadow-sm"
                      : "border-border/80 bg-secondary/30 hover:border-border hover:bg-secondary/60 cursor-pointer focus-visible:ring-2 focus-visible:ring-caramel-light focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  }`}
                >
                  {/* Left: Radio Dot & Package Title & Badges */}
                  <div className="flex items-start gap-3 min-w-0 pr-2">
                    {/* Visual Radio Indicator */}
                    <div
                      className={`size-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        outOfStock
                          ? "border-border bg-secondary/20"
                          : isSelected
                          ? "border-caramel bg-secondary/60 ring-2 ring-caramel/30"
                          : "border-border bg-secondary/40 group-hover:border-muted-foreground/60"
                      }`}
                    >
                      {isSelected && <div className="size-2 rounded-full bg-caramel" />}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-semibold leading-snug break-words ${isSelected ? "text-foreground font-bold" : "text-foreground/90"}`}>
                          {v.name}
                        </span>

                        {(() => {
                          let displayB = v.tokenAmountB
                          const match = v.name.match(/(\d+)\s*b\b/i)
                          if (match) {
                            displayB = parseInt(match[1], 10)
                          }
                          return displayB ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-caramel/20 text-caramel border border-caramel/40">
                              ⚡ Nạp {displayB}B Token (~{displayB} tỷ Tokens)
                            </span>
                          ) : null
                        })()}

                        {conditionBadge && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            {conditionBadge}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {durationTag && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <Clock className="size-3 text-muted-foreground/70" />
                            {durationTag}
                          </span>
                        )}
                        <span className="text-[11px]">
                          {isBuffProduct
                            ? "Sẵn sàng nạp tự động 24/7"
                            : product.deliveryType === "contact"
                            ? "Sẵn sàng cấp qua Zalo"
                            : outOfStock
                            ? "Hết hàng"
                            : `Kho còn: ${vStock}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Pricing & Discount Tag */}
                  <div className="mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-foreground tabular-nums">
                        {formatPrice(v.priceCents)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {v.compareAtPriceCents && v.compareAtPriceCents > v.priceCents && (
                        <span className="text-xs text-muted-foreground/60 line-through tabular-nums">
                          {formatPrice(v.compareAtPriceCents)}
                        </span>
                      )}
                      {vDiscountPct && vDiscountPct >= 1 && (
                        <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded-full tabular-nums">
                          -{vDiscountPct}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* C. Email nhận thông tin đơn hàng */}
        <div className="space-y-1.5">
          <label
            htmlFor="customer-email"
            className="text-xs font-bold text-foreground uppercase tracking-wider block"
          >
            2. Email nhận thông tin đơn hàng *
          </label>
          <div className="relative">
            <input
              id="customer-email"
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              required
              aria-required="true"
              aria-invalid={Boolean(emailTouched && emailError)}
              aria-describedby={emailTouched && emailError ? `${formId}-email-error ${formId}-email-hint` : `${formId}-email-hint`}
              className={`w-full h-11 px-3.5 rounded-xl border bg-secondary/40 text-foreground text-sm placeholder:text-muted-foreground/50 transition-all focus:outline-none ${
                emailTouched && emailError
                  ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  : "border-border hover:border-border/90 focus:border-caramel focus:ring-2 focus:ring-caramel/20"
              }`}
            />
          </div>

          {emailTouched && emailError ? (
            <p
              id={`${formId}-email-error`}
              className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1 animate-in fade-in duration-150"
            >
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{emailError}</span>
            </p>
          ) : (
            <p id={`${formId}-email-hint`} className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Dùng để nhận thông tin tài khoản và xác nhận đơn hàng.
            </p>
          )}
        </div>

        {/* Trường nhập Mã Mời (Invite Code) dành riêng cho các gói Buff Token */}
        {(isBuffProduct || product.requiresInviteCode) && (
          <div className="space-y-1.5 p-3.5 rounded-xl border border-caramel/30 bg-caramel/5">
            <div className="flex items-center justify-between">
              <label htmlFor="customer-invite-code" className="text-xs font-bold text-caramel uppercase tracking-wider block">
                Mã mời Muse AI của bạn (Invite Code) *
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {inviteCode.length}/20
              </span>
            </div>
            <input
              id="customer-invite-code"
              type="text"
              maxLength={20}
              placeholder="VD: 0FBALX (Mã mời từ Muse AI)"
              value={inviteCode}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                setInviteCode(val)
                if (inviteCodeError && val.length >= 4) setInviteCodeError(null)
              }}
              className={`w-full h-11 px-3.5 rounded-xl border bg-secondary/40 text-foreground font-mono text-sm tracking-widest uppercase placeholder:text-muted-foreground/50 transition-all focus:outline-none ${
                inviteCodeError
                  ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  : "border-caramel/50 hover:border-caramel focus:border-caramel focus:ring-2 focus:ring-caramel/20"
              }`}
            />
            {inviteCodeError ? (
              <p className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{inviteCodeError}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Nhập mã mời nhận token trong tài khoản Muse AI của bạn để hệ thống nạp tự động ngay sau khi thanh toán.
              </p>
            )}
          </div>
        )}

        {/* D. Số lượng mua */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-secondary/30">
          <div>
            <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
              Số lượng mua
            </span>
            <span className="text-[11px] text-muted-foreground">
              {isFixedPackage
                ? "Gói cố định 1 lượt nạp / đơn"
                : `Tối đa ${maxAllowedQuantity} ${isBuffProduct ? "gói" : "tài khoản"} / đơn`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isFixedPackage ? (
              <>
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  disabled={quantity <= 1}
                  aria-label="Giảm số lượng"
                  className="size-8 rounded-lg border border-border bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Minus className="size-3.5" />
                </button>

                <span className="w-9 text-center font-bold text-sm text-foreground tabular-nums">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.min(maxAllowedQuantity, prev + 1))}
                  disabled={quantity >= maxAllowedQuantity}
                  aria-label="Tăng số lượng"
                  className="size-8 rounded-lg border border-border bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Plus className="size-3.5" />
                </button>
              </>
            ) : (
              <span className="px-3 py-1 rounded-lg border border-border bg-secondary/60 font-bold text-sm text-foreground tabular-nums">
                1
              </span>
            )}
          </div>
        </div>

        {/* Condition notice if KBH or VPN is required */}
        {(isKBH || isVPN) && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              {isKBH && (
                <p>
                  <strong>Lưu ý bảo hành:</strong> Gói mua ở chế độ Không bảo hành (KBH). Vui lòng kiểm tra và kích hoạt ngay sau khi nhận mã.
                </p>
              )}
              {isVPN && (
                <p className={isKBH ? "mt-1" : ""}>
                  <strong>Lưu ý kích hoạt:</strong> Gói yêu cầu kết nối VPN khu vực chỉ định trong lần kích hoạt đầu tiên.
                </p>
              )}
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {submitError && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{submitError}</span>
          </div>
        )}

        {/* Coupon Code Input & Application */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-semibold text-foreground/90 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Tag className="size-3.5 text-caramel" />
              Mã giảm giá (Coupon)
            </span>
            {appliedCoupon && (
              <span className="text-[11px] text-emerald-400 font-medium">Đã áp dụng mã thành công</span>
            )}
          </label>

          {appliedCoupon ? (
            <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-300 tracking-wider">
                      {appliedCoupon.code}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      -{formatPrice(appliedCoupon.discountCents)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {appliedCoupon.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/80 bg-secondary/60 hover:bg-secondary text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Bỏ mã giảm giá"
              >
                <X className="size-3" />
                <span>Bỏ mã</span>
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase())
                    if (couponError) setCouponError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleApplyCoupon()
                    }
                  }}
                  placeholder="Nhập mã ưu đãi..."
                  className="w-full h-10 px-3.5 rounded-xl border border-border bg-secondary/40 font-mono text-xs uppercase placeholder:normal-case placeholder:font-sans placeholder:text-muted-foreground focus:border-caramel focus:ring-1 focus:ring-caramel outline-none transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => handleApplyCoupon()}
                disabled={couponLoading || !couponInput.trim()}
                className="px-4 h-10 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {couponLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <span>Áp dụng</span>
                )}
              </button>
            </div>
          )}

          {couponError && (
            <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1 animate-in fade-in duration-150">
              <AlertCircle className="size-3 shrink-0" />
              <span>{couponError}</span>
            </p>
          )}

          {couponSuccessMessage && !couponError && (
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in duration-150">
              <CheckCircle2 className="size-3 shrink-0" />
              <span>{couponSuccessMessage}</span>
            </p>
          )}
        </div>

        {/* E. Tóm tắt thanh toán */}
        <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 space-y-2 text-xs text-muted-foreground">
          {/* Tạm tính */}
          <div className="flex items-center justify-between">
            <span>Tạm tính:</span>
            <span className="text-foreground/90 tabular-nums font-medium">
              {formatPrice(subtotalPrice)}
            </span>
          </div>

          {/* Chiết khấu niêm yết nếu có compareAtPrice */}
          {hasValidCompare && compareTotalPrice && savingsAmount && savingsAmount > 0 && (
            <div className="flex items-center justify-between text-muted-foreground/80">
              <span className="flex items-center gap-1.5">
                <span>Tiết kiệm giá gốc:</span>
                {discountPercent && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
                    −{discountPercent}%
                  </span>
                )}
              </span>
              <span className="tabular-nums">
                −{formatPrice(savingsAmount)}
              </span>
            </div>
          )}

          {/* Mã giảm giá Coupon */}
          {appliedCoupon && discountAmount > 0 && (
            <div className="flex items-center justify-between text-emerald-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <span>Mã giảm giá ({appliedCoupon.code}):</span>
              </span>
              <span className="tabular-nums font-bold">
                −{formatPrice(discountAmount)}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-border/60 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground/90">Tổng thanh toán:</span>
            <span className="text-2xl font-extrabold text-oat-cream tracking-tight tabular-nums">
              {formatPrice(finalPrice)}
            </span>
          </div>
        </div>

        {/* Consent Checkbox theo Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 & NĐ 356/2025/NĐ-CP */}
        <div className="pt-0.5">
          <label className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
            consentError && !consentAgreed
              ? "border-red-500/60 bg-red-500/10 text-red-200 shadow-xs"
              : "border-border/70 bg-secondary/20 hover:border-caramel/40 hover:bg-secondary/35 text-muted-foreground hover:text-foreground"
          }`}>
            <input
              type="checkbox"
              checked={consentAgreed}
              onChange={(e) => {
                setConsentAgreed(e.target.checked)
                if (e.target.checked) {
                  setConsentError(false)
                  if (submitError?.includes("đồng ý")) setSubmitError(null)
                }
              }}
              className="mt-0.5 size-4 rounded border-border text-caramel focus:ring-caramel-light shrink-0 cursor-pointer accent-caramel"
            />
            <span className="text-xs leading-relaxed">
              Tôi đã đọc và đồng ý với{" "}
              <Link
                href="/dieu-khoan-dich-vu"
                target="_blank"
                className="text-caramel font-semibold underline underline-offset-2 hover:text-caramel-light transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Điều khoản dịch vụ
              </Link>{" "}
              và{" "}
              <Link
                href="/chinh-sach-bao-mat"
                target="_blank"
                className="text-caramel font-semibold underline underline-offset-2 hover:text-caramel-light transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Chính sách bảo mật
              </Link>{" "}
              của CapyGo.
            </span>
          </label>
        </div>

        {/* F. Nút chính / Nút Liên Hệ Đặt Hàng */}
        {product.deliveryType === "contact" ? (
          <div className="space-y-3 pt-1">
            <a
              href={`https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964"}?text=${encodeURIComponent(
                `Chào shop CapyGo, mình cần đặt mua gói: ${product.name}${
                  selectedVariant ? ` (${selectedVariant.name})` : ""
                }`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white shadow-md shadow-sky-500/20 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="size-5" />
              <span>Liên hệ Zalo để đặt hàng ngay</span>
            </a>
            <p className="text-xs text-center text-sky-400/90 font-medium leading-relaxed bg-sky-500/10 border border-sky-500/20 p-2.5 rounded-xl">
              Sản phẩm này được cấp theo yêu cầu riêng. Quý khách vui lòng nhắn Zalo để nhân viên kiểm tra tình trạng kho và bàn giao trực tiếp.
            </p>
          </div>
        ) : (
          <>
            <button
              type="submit"
              disabled={loading || isOutOfStock}
              className="w-full h-12 rounded-xl text-sm font-bold bg-caramel hover:bg-caramel-light active:bg-[#D9955C] text-espresso shadow-sm transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel-light focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin text-espresso" />
                  <span>Đang kiểm tra nguồn hàng & tạo đơn…</span>
                </>
              ) : isOutOfStock ? (
                <span>Gói hiện đã hết hàng</span>
              ) : (
                <>
                  <span>Tiếp tục đến VietQR</span>
                  <ArrowRight className="size-4" strokeWidth={2.2} />
                </>
              )}
            </button>

            {/* Out of Stock Contact Action */}
            {isOutOfStock && (
              <a
                href={`https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-11 rounded-xl text-xs font-semibold border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 flex items-center justify-center gap-2 transition-colors active-bounce"
              >
                <MessageCircle className="size-4 text-amber-400" />
                <span>Liên hệ Zalo để đặt trước hoặc tư vấn gói</span>
              </a>
            )}

            {/* G. Hướng dẫn tiếp theo */}
            <p className="text-xs text-center text-muted-foreground leading-relaxed px-1">
              Mã QR, tài khoản nhận và nội dung chuyển khoản sẽ hiển thị ở bước tiếp theo.
            </p>
          </>
        )}

        {/* Trust Badges */}
        <div className="pt-3 border-t border-border/40 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Zap className="size-3 text-caramel" />
            Giao tự động
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="size-3 text-caramel" />
            Thanh toán an toàn
          </span>
        </div>
      </form>
    </div>
  )
}
