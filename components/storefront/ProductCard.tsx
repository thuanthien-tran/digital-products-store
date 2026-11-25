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
  const popoverId = useId()

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
      className={`group relative flex flex-col justify-between h-full rounded-2xl border bg-card transition-card hover:-translate-y-0.5 ${
        pricing.isOutOfStock && !isContactOnly
          ? "border-border/80 opacity-90 hover:border-border"
          : featured
          ? "border-primary/45 hover:border-primary/80 shadow-[0_8px_28px_-12px_rgba(230,166,111,0.22)]"
          : "border-border hover:border-primary/45"
      } ${className}`}
    >
      {/* Top Section */}
      <div className="flex flex-col flex-1">
        {/* 1. Unified Dark-Framed Media Container (normalizes white & dark logos consistently) */}
        <div className="p-3 pb-0">
          <div
            className={`relative h-32 sm:h-36 w-full overflow-hidden rounded-xl border flex items-center justify-center ${
              featured && !pricing.isOutOfStock
                ? "bg-gradient-to-b from-primary/[0.06] to-background border-primary/25"
                : "bg-background border-border/70"
            }`}
          >
            <Link
              href={`/product/${slug}`}
              className="w-full h-full flex items-center justify-center p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={-1}
              aria-hidden="true"
            >
              {primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={primaryImage}
                  alt=""
                  className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-[180ms] ease-out group-hover:scale-[1.02]"
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
              ) : (
                <div
                  className={`size-12 rounded-xl flex items-center justify-center border ${categoryAccent.iconBg}`}
                >
                  <BrandIcon name={name} className="size-6" />
                </div>
              )}
            </Link>

            {/* Subtle Category Label (top-left) */}
            <span
              className={`absolute top-2 left-2 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border bg-card/90 backdrop-blur-xs ${categoryAccent.badge} pointer-events-none`}
            >
              <span className={`size-1.5 rounded-full ${categoryAccent.dot}`} aria-hidden="true" />
              <span className="max-w-[130px] truncate">{groupName}</span>
            </span>
          </div>
        </div>

        {/* 2. Content Body — Consistent Reading Order */}
        <div className="flex flex-col flex-1 px-4 pt-3.5 pb-3 gap-1.5">
          {/* Product Name (max 2 lines, consistent min-height so cards align) */}
          <Link
            href={`/product/${slug}`}
            title={name}
            className="block group/title focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            <h3 className="font-sans font-semibold text-[15px] sm:text-base text-foreground group-hover/title:text-primary transition-colors duration-150 leading-snug line-clamp-2 min-h-[2.5rem] break-words">
              {name}
            </h3>
          </Link>

          {/* Short Benefit (1 clean line) */}
          {shortBenefit && (
            <p className="text-xs text-muted-foreground/90 leading-snug line-clamp-1">
              {shortBenefit}
            </p>
          )}

          {/* Duration · Delivery / Usage Mode */}
          <p className="text-xs text-muted-foreground leading-snug pt-0.5">
            {metaLine}
          </p>

          {/* Warranty & Stock Status Row */}
          <div className="relative flex items-center justify-between gap-2 pt-1 mt-auto">
            <div className="flex items-center gap-1 min-w-0">
              <div
                className={`inline-flex items-center gap-1 text-[11px] sm:text-xs leading-snug min-w-0 ${
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
                  className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-3.5" />
                </button>
              )}
            </div>

            {/* Clean Inline Stock Indicator */}
            {isContactOnly ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground shrink-0">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                Liên hệ
              </span>
            ) : pricing.isOutOfStock ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-300/90 shrink-0">
                <span className="size-1.5 rounded-full bg-rose-400" aria-hidden="true" />
                Hết hàng
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 shrink-0">
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

      {/* 3. Footer: Aligned Price & Compact Action Button */}
      <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <PriceDisplay
            priceCents={pricing.lowestPrice}
            compareAtPriceCents={pricing.comparePrice}
            prefix={hasDistinctPrices ? "Từ" : undefined}
          />
        </div>

        {/* Action Button */}
        {isContactOnly ? (
          <Button
            asChild
            variant="outline"
            className="h-9 px-3.5 rounded-xl text-xs font-semibold border-border hover:border-primary/50 hover:bg-secondary text-foreground transition-btn shrink-0"
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
            className="h-9 px-3 rounded-xl text-xs font-medium border-border/80 text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn shrink-0"
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
                ? "h-9 px-3.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-caramel-light transition-btn shrink-0"
                : "h-9 px-3.5 rounded-xl text-xs font-semibold bg-secondary text-foreground border border-border hover:border-primary/50 hover:bg-primary hover:text-primary-foreground transition-btn shrink-0"
            }
          >
            <Link href={`/product/${slug}`}>
              <span>Chọn gói</span>
              <ArrowRight className="size-3.5" strokeWidth={2.2} />
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}
