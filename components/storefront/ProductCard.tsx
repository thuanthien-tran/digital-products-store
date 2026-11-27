"use client"

import { useState, useId, useRef, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PriceDisplay } from "@/components/ui/price-display"
import { calculateProductPricing, type PricingVariant } from "@/lib/pricing"
import { BrandIcon } from "@/components/storefront/BrandIcons"
import { ArrowRight, AlertCircle, Info, X, MessageCircle, ShieldCheck } from "lucide-react"

export interface ProductCardVariant extends PricingVariant {
  id: string
  name: string
  priceCents: number
  compareAtPriceCents: number | null
  availableStock: number
  providerStock?: number | null
}

export interface ProductCardProps {
  id: string
  name: string
  slug: string
  description?: string
  images?: string[]
  groupId?: string | null
  groupName?: string
  deliveryType?: string
  statusOverride?: string
  highlights?: string[]
  conditions?: string[]
  warrantyTerms?: string | null
  noticeNotes?: string | null
  variants: ProductCardVariant[]
  className?: string
  priority?: boolean
  featured?: boolean
}

const ZALO_PHONE = (process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964").replace(/\D/g, "")

/**
 * Category color accent — applied ONLY to small label badge & icon placeholder.
 * - AI: purple
 * - Đồ họa & Thiết kế: teal
 * - Văn phòng & Tiện ích: blue
 */
function getCategoryAccent(groupName: string = "") {
  const norm = groupName.toLowerCase().trim()
  if (norm.includes("ai") || norm.includes("trí tuệ")) {
    return {
      badge: "text-purple-200 border-purple-400/40",
      dot: "bg-purple-400",
      iconBg: "bg-purple-500/10 text-purple-300 border-purple-500/25",
    }
  }
  if (norm.includes("đồ họa") || norm.includes("thiết kế")) {
    return {
      badge: "text-teal-200 border-teal-400/40",
      dot: "bg-teal-400",
      iconBg: "bg-teal-500/10 text-teal-300 border-teal-500/25",
    }
  }
  if (norm.includes("văn phòng") || norm.includes("tiện ích")) {
    return {
      badge: "text-blue-200 border-blue-400/40",
      dot: "bg-blue-400",
      iconBg: "bg-blue-500/10 text-blue-300 border-blue-500/25",
    }
  }
  return {
    badge: "text-foreground border-border",
    dot: "bg-primary",
    iconBg: "bg-secondary text-muted-foreground border-border",
  }
}

/**
 * Derive clear usage format from real product metadata without fabricating.
 */
function detectUsageMode(name: string, deliveryType: string): string {
  const lower = name.toLowerCase()
  if (deliveryType === "contact") return "Liên hệ đặt hàng"
  if (lower.includes("slot") || lower.includes("team")) return "Slot nhóm"
  if (lower.includes("buff") || lower.includes("bổ sung token")) return "Nạp token chính chủ"
  if (lower.includes("chính chủ")) return "Nâng cấp chính chủ"
  if (lower.includes("cấp sẵn") || lower.includes("acc cấp")) return "Tài khoản cấp sẵn"
  if (lower.includes("api ") || lower.startsWith("api")) return "API Key / Token"
  if (lower.includes("link ")) return "Link kích hoạt"
  if (deliveryType === "service") return "Dịch vụ nâng cấp"
  return "Tài khoản / Mã số"
}

/**
 * Only infer duration for single-variant products so multi-variant products never show misleading duration.
 * Explicitly avoids mistaking token/memory quantities (e.g. "50M Token", "100M") for months.
 */
function detectSingleDuration(
  name: string,
  variants: ProductCardVariant[],
  hasMultipleVariants: boolean
): string | null {
  if (hasMultipleVariants) return null
  const combined = `${name} ${variants[0]?.name || ""}`.toLowerCase()

  // 1. Vietnamese explicit duration words
  const viMatch = combined.match(/(\d+)\s*(tháng|thang|năm|nam|ngày|ngay|tuần|tuan|giờ|gio)\b/i)
  if (viMatch) {
    const num = viMatch[1]
    const unit = viMatch[2].toLowerCase()
    if (unit === "thang" || unit === "tháng") return `${num} tháng`
    if (unit === "nam" || unit === "năm") return `${num} năm`
    if (unit === "ngay" || unit === "ngày") return `${num} ngày`
    if (unit === "tuan" || unit === "tuần") return `${num} tuần`
    if (unit === "gio" || unit === "giờ") return `${num} giờ`
  }

  // 2. English full duration words (checked BEFORE shorthand m/d so "50M Token - 2 days" yields "2 ngày")
  const enFullMatch = combined.match(/\b(\d+)\s*(days?|months?|years?|weeks?|hours?)\b/i)
  if (enFullMatch) {
    const num = enFullMatch[1]
    const unit = enFullMatch[2].toLowerCase()
    if (unit.startsWith("month")) return `${num} tháng`
    if (unit.startsWith("day")) return `${num} ngày`
    if (unit.startsWith("year")) return `${num} năm`
    if (unit.startsWith("week")) return `${num} tuần`
    if (unit.startsWith("hour")) return `${num} giờ`
  }

  // 3. Shorthand like "18M" or "30D" — ONLY when not followed by token/credit/size units and within sane bounds
  const shortMatch = combined.match(/\b(\d{1,3})\s*(m|d)\b(?!\s*(?:token|tokens|credit|credits|b\b|k\b|mb|gb))/i)
  if (shortMatch) {
    const num = parseInt(shortMatch[1], 10)
    const unit = shortMatch[2].toLowerCase()
    if (unit === "m" && num >= 1 && num <= 36) return `${num} tháng`
    if (unit === "d" && num >= 1 && num <= 365) return `${num} ngày`
  }

  if (combined.includes("vĩnh viễn") || combined.includes("lifetime")) return "Vĩnh viễn"
  return null
}

/**
 * Extract a concise, single-line customer benefit from real highlights or description.
 */
function extractShortBenefit(highlights?: string[], description?: string): string | null {
  const isBareHeading = (line: string) =>
    /^(thông tin\s*&\s*quyền lợi|mô tả sản phẩm|lưu ý|hướng dẫn|bảo hành)\s*:?$/i.test(line)

  if (highlights && highlights.length > 0) {
    for (const h of highlights) {
      const clean = h.replace(/^[-*•\s#]+/, "").replace(/\*\*/g, "").trim()
      if (clean.length >= 6 && !isBareHeading(clean)) return clean
    }
  }
  if (description && description.trim()) {
    const lines = description
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•\s#>]+/, "").replace(/\*\*/g, "").trim())
      .filter(
        (l) =>
          l.length >= 8 &&
          !isBareHeading(l) &&
          !/^lưu ý|^hướng dẫn|^bảo hành|^chính sách bảo hành/i.test(l)
      )
    if (lines.length > 0) {
      return lines[0]
    }
  }
  return null
}

interface WarrantySummary {
  text: string
  detail: string | null
  isWarning: boolean
}

/**
 * Extract clear, honest warranty / condition summary from real product fields.
 */
function detectWarrantySummary(
  name: string,
  warrantyTerms?: string | null,
  noticeNotes?: string | null,
  hasMultipleVariants?: boolean
): WarrantySummary {
  const combined = `${name} ${warrantyTerms || ""} ${noticeNotes || ""}`.toLowerCase()

  if (
    combined.includes("kbh") ||
    combined.includes("không bảo hành") ||
    combined.includes("ko bảo hành") ||
    combined.includes("no warranty") ||
    /\(nw\)/i.test(name)
  ) {
    return {
      text: "Không bảo hành (KBH)",
      detail:
        noticeNotes?.trim() ||
        warrantyTerms?.trim() ||
        "Sản phẩm bán dạng không bảo hành (KBH). Vui lòng kiểm tra và sử dụng ngay sau khi nhận.",
      isWarning: true,
    }
  }

  const limitedMatch = name.match(/\bBH(\d+)D\b/i)
  if (limitedMatch) {
    const days = limitedMatch[1]
    return {
      text: `Bảo hành giới hạn ${days} ngày`,
      detail: warrantyTerms?.trim() || noticeNotes?.trim() || `Áp dụng bảo hành giới hạn ${days} ngày theo điều kiện gói.`,
      isWarning: true,
    }
  }

  if (warrantyTerms && warrantyTerms.trim()) {
    const firstLine = warrantyTerms.trim().split("\n")[0].replace(/^[-*•\s]+/, "").trim()
    return {
      text: firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine,
      detail: warrantyTerms.trim(),
      isWarning: false,
    }
  }

  if (hasMultipleVariants) {
    return {
      text: "Điều kiện & thời hạn theo từng gói",
      detail: noticeNotes?.trim() || null,
      isWarning: false,
    }
  }

  if (/\bbhf\b|\(fw\)/i.test(name)) {
    return {
      text: "Bảo hành theo thời hạn gói",
      detail: noticeNotes?.trim() || null,
      isWarning: false,
    }
  }

  return {
    text: "Xem điều kiện gói trong chi tiết",
    detail: noticeNotes?.trim() || null,
    isWarning: false,
  }
}

export function ProductCard({
  name,
  slug,
  description,
  images = [],
  groupName = "Chưa phân loại",
  deliveryType = "serials",
  statusOverride = "auto",
  highlights = [],
  warrantyTerms,
  noticeNotes,
  variants = [],
  className = "",
  featured = false,
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  const borderGlowRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  const handleCardPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || !cardRef.current) return
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }
    const card = cardRef.current
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Subtle 3D perspective micro-tilt (±3deg max) + smooth elevation
    const relX = (x / rect.width - 0.5) * 2
    const relY = (y / rect.height - 0.5) * 2
    const rotateY = (relX * 3.2).toFixed(2)
    const rotateX = (-relY * 2.8).toFixed(2)

    card.style.setProperty("--card-x", `${x}px`)
    card.style.setProperty("--card-y", `${y}px`)
    card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(0, -4px, 0)`

    if (spotlightRef.current) spotlightRef.current.style.opacity = "1"
    if (borderGlowRef.current) borderGlowRef.current.style.opacity = "1"
  }

  const handleCardPointerLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = ""
    }
    if (spotlightRef.current) spotlightRef.current.style.opacity = "0"
    if (borderGlowRef.current) borderGlowRef.current.style.opacity = "0"
  }

  const pricing = calculateProductPricing(variants, statusOverride)
  const categoryAccent = getCategoryAccent(groupName)
  const hasDistinctPrices = new Set(variants.map((v) => v.priceCents)).size > 1

  const primaryImage =
    !imgError && images && images.length > 0 && images[0]?.trim()
      ? images[0].trim()
      : null

  const isContactOnly = deliveryType === "contact"
  const usageMode = detectUsageMode(name, deliveryType)
  const duration = detectSingleDuration(name, variants, pricing.hasMultipleVariants)
  const shortBenefit = extractShortBenefit(highlights, description)
  const warrantySummary = detectWarrantySummary(
    name,
    warrantyTerms,
    noticeNotes,
    pricing.hasMultipleVariants
  )

  const hasDetailPopover = Boolean(
    warrantySummary.detail || (noticeNotes && noticeNotes.trim())
  )

  // Close popover on Escape or outside click/touch
  useEffect(() => {
    if (!popoverOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPopoverOpen(false)
        triggerRef.current?.focus()
      }
    }

    const handlePointerOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setPopoverOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("mousedown", handlePointerOutside)
    document.addEventListener("touchstart", handlePointerOutside)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("mousedown", handlePointerOutside)
      document.removeEventListener("touchstart", handlePointerOutside)
    }
  }, [popoverOpen])

  const metaLine = [
    pricing.hasMultipleVariants ? `${variants.length} gói` : duration,
    usageMode,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <article
      ref={cardRef}
      onPointerMove={handleCardPointerMove}
      onPointerLeave={handleCardPointerLeave}
      className={`group relative flex flex-col justify-between h-full rounded-2xl border bg-card transition-card ${
        pricing.isOutOfStock && !isContactOnly
          ? "border-border/80 opacity-90 hover:border-border"
          : featured
          ? "border-primary/45 hover:border-primary/80 shadow-[0_8px_28px_-12px_rgba(230,166,111,0.22)] hover:shadow-[0_20px_42px_-16px_rgba(230,166,111,0.34)]"
          : "border-border hover:border-primary/40 hover:shadow-[0_18px_40px_-18px_rgba(230,166,111,0.28)]"
      } ${className}`}
    >
      {/* 1px Cursor-Tracking Caramel Border Glow Ring (desktop pointer: fine) */}
      <div
        ref={borderGlowRef}
        aria-hidden="true"
        style={{ opacity: 0 }}
        className="card-border-glow z-20"
      />

      {/* Volumetric Inner Caramel Spotlight (clipped to card radius without clipping popovers) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
      >
        <div
          ref={spotlightRef}
          style={{
            opacity: 0,
            background:
              "radial-gradient(300px circle at var(--card-x, 50%) var(--card-y, 50%), rgba(242, 188, 142, 0.22), rgba(230, 166, 111, 0.06) 45%, transparent 72%)",
          }}
          className="absolute inset-0 transition-opacity duration-200"
        />
      </div>
      {/* Top Section */}
      <div className="flex flex-col flex-1">
        {/* 1. Unified 16:9 Full-Bleed Media Frame */}
        <div className="p-2 pb-0 sm:p-3 sm:pb-0">
          <div
            className={`relative aspect-[16/9] w-full overflow-hidden rounded-xl border ${
              featured && !pricing.isOutOfStock
                ? "bg-background border-primary/25"
                : "bg-background border-border/70"
            }`}
          >
            <Link
              href={`/product/${slug}`}
              className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={-1}
              aria-hidden="true"
            >
              {primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primaryImage}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-[180ms] ease-out group-hover:scale-[1.02]"
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-3 sm:p-4">
                  <div
                    className={`size-10 sm:size-12 rounded-xl flex items-center justify-center border ${categoryAccent.iconBg}`}
                  >
                    <BrandIcon name={name} className="size-5 sm:size-6" />
                  </div>
                </div>
              )}
            </Link>

            {/* Diagonal Glass Sheen Sweep on Hover */}
            <div aria-hidden="true" className="card-media-sheen" />

            {/* Subtle Category Label (top-left) */}
            <span
              className={`absolute top-1.5 left-1.5 sm:top-2 sm:left-2 inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-md border bg-card/90 backdrop-blur-xs ${categoryAccent.badge} pointer-events-none`}
            >
              <span className={`size-1.5 rounded-full shrink-0 ${categoryAccent.dot}`} aria-hidden="true" />
              <span className="max-w-[92px] sm:max-w-[130px] truncate">{groupName}</span>
            </span>
          </div>
        </div>

        {/* 2. Content Body — Consistent Reading Order (compact on 2-col mobile) */}
        <div className="flex flex-col flex-1 px-2.5 pt-2.5 pb-2 sm:px-4 sm:pt-3.5 sm:pb-3 gap-1 sm:gap-1.5">
          {/* Product Name (fixed 2-line box height so adjacent cards align pixel-perfect) */}
          <Link
            href={`/product/${slug}`}
            title={name}
            className="block group/title focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            <h3 className="font-sans font-semibold text-[13px] sm:text-base text-foreground group-hover/title:text-primary transition-colors duration-150 leading-[1.35] line-clamp-2 h-[35px] sm:h-[44px] break-words">
              {name}
            </h3>
          </Link>

          {/* Short Benefit (1 clean line — shown on sm+ so 2-col mobile cards stay crisp) */}
          {shortBenefit && (
            <p className="hidden sm:block text-xs text-muted-foreground/90 leading-snug line-clamp-1">
              {shortBenefit}
            </p>
          )}

          {/* Duration · Delivery / Usage Mode (hidden on narrow 2-col mobile for cleaner cards) */}
          <p className="hidden sm:block text-xs text-muted-foreground leading-snug truncate pt-0.5">
            {metaLine}
          </p>

          {/* Warranty & Stock Status Row */}
          <div className="relative flex items-center justify-between gap-2 pt-0.5 sm:pt-1 mt-auto">
            <div className="hidden sm:flex items-center gap-1 min-w-0 max-w-full">
              <div
                className={`inline-flex items-center gap-1 text-[10.5px] sm:text-xs leading-snug min-w-0 ${
                  warrantySummary.isWarning
                    ? "text-amber-300 font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {warrantySummary.isWarning ? (
                  <AlertCircle className="size-3 text-amber-400 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="size-3 text-muted-foreground/80 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{warrantySummary.text}</span>
              </div>

              {hasDetailPopover && (
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPopoverOpen((prev) => !prev)
                  }}
                  aria-expanded={popoverOpen}
                  aria-controls={popoverId}
                  aria-label={`Xem điều kiện gói ${name}`}
                  className="inline-flex items-center justify-center size-5 sm:size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-3 sm:size-3.5" />
                </button>
              )}
            </div>

            {/* Clean Inline Stock Indicator */}
            {isContactOnly ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-medium text-muted-foreground shrink-0">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                Liên hệ
              </span>
            ) : pricing.isOutOfStock ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-medium text-rose-300/90 shrink-0">
                <span className="size-1.5 rounded-full bg-rose-400" aria-hidden="true" />
                Hết hàng
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-medium text-emerald-400 shrink-0">
                <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                Còn hàng
              </span>
            )}

            {/* Unclipped Accessible Popover */}
            {popoverOpen && hasDetailPopover && (
              <div
                id={popoverId}
                ref={popoverRef}
                role="dialog"
                aria-label={`Điều kiện ${name}`}
                className="absolute bottom-full left-0 right-0 mb-2 z-30 p-3.5 rounded-xl border border-border bg-popover shadow-lg text-xs text-popover-foreground animate-fade-in"
              >
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border">
                  <span className="font-semibold text-foreground">Điều kiện &amp; Bảo hành</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPopoverOpen(false)
                      triggerRef.current?.focus()
                    }}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn"
                    aria-label="Đóng"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {warrantySummary.detail || noticeNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Footer: Single-line price + full-width button on mobile, horizontal on sm+ */}
      <div className="px-2.5 py-2.5 sm:px-4 sm:py-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 h-5 sm:h-auto flex items-center">
          <PriceDisplay
            priceCents={pricing.lowestPrice}
            compareAtPriceCents={pricing.comparePrice}
            prefix={hasDistinctPrices ? "Từ" : undefined}
            size="sm"
          />
        </div>

        {/* Action Button */}
        {isContactOnly ? (
          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-semibold border-border hover:border-primary/50 hover:bg-secondary text-foreground transition-btn shrink-0"
          >
            <a
              href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
                `Chào shop CapyGo, mình cần tư vấn đặt mua gói: ${name}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Liên hệ Zalo tư vấn mua ${name}`}
            >
              <MessageCircle className="size-3.5 text-primary" />
              <span>Liên hệ</span>
            </a>
          </Button>
        ) : pricing.isOutOfStock ? (
          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto h-8 sm:h-9 px-3 rounded-xl text-[11px] sm:text-xs font-medium border-border/80 text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn shrink-0"
          >
            <a
              href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
                `Chào shop CapyGo, mình muốn hỏi khi nào có hàng gói: ${name}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Liên hệ Zalo hỏi hàng ${name}`}
            >
              <span>Hỏi hàng</span>
            </a>
          </Button>
        ) : (
          <Button
            asChild
            variant={featured ? "default" : "secondary"}
            className={
              featured
                ? "w-full sm:w-auto h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-semibold bg-primary text-primary-foreground hover:bg-caramel-light transition-btn shrink-0"
                : "w-full sm:w-auto h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-semibold bg-secondary text-foreground border border-border hover:border-primary/50 hover:bg-primary hover:text-primary-foreground transition-btn shrink-0"
            }
          >
            <Link href={`/product/${slug}`}>
              <span>Chọn gói</span>
              <ArrowRight
                className="size-3.5 transition-transform duration-[150ms] ease-out group-hover:translate-x-[3px]"
                strokeWidth={2.2}
              />
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}
