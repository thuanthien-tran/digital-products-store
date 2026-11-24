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
 */
function detectSingleDuration(
  name: string,
  variants: ProductCardVariant[],
  hasMultipleVariants: boolean
): string | null {
  if (hasMultipleVariants) return null
  const combined = `${name} ${variants[0]?.name || ""}`.toLowerCase()
  const viMatch = combined.match(/(\d+\s*(?:tháng|thang|năm|nam|ngày|ngay|tuần|tuan|giờ|gio))/i)
  if (viMatch) return viMatch[1].trim()
  const enMatch = combined.match(/\b(\d+)\s*(days?|months?|years?|m|d)\b/i)
  if (enMatch) {
    const num = enMatch[1]
    const unit = enMatch[2].toLowerCase()
    if (unit === "m" || unit.startsWith("month")) return `${num} tháng`
    if (unit === "d" || unit.startsWith("day")) return `${num} ngày`
    if (unit.startsWith("year")) return `${num} năm`
  }
  if (combined.includes("vĩnh viễn") || combined.includes("lifetime")) return "Vĩnh viễn"
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
  images = [],
  groupName = "Chưa phân loại",
  deliveryType = "serials",
  statusOverride = "auto",
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

  const primaryImage =
    !imgError && images && images.length > 0 && images[0]?.trim()
      ? images[0].trim()
      : null

  const isContactOnly = deliveryType === "contact"
  const usageMode = detectUsageMode(name, deliveryType)
  const duration = detectSingleDuration(name, variants, pricing.hasMultipleVariants)
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
    usageMode,
    pricing.hasMultipleVariants ? `${variants.length} gói` : duration,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <article
      className={`group relative flex flex-col justify-between h-full rounded-2xl border bg-card transition-card ${
        featured
          ? "border-primary/40 hover:border-primary/70"
          : "border-border hover:border-primary/40"
      } ${className}`}
    >
      {/* Top Section */}
      <div className="flex flex-col flex-1">
        {/* 1. 16:9 Image Frame (overflow-hidden stays ONLY on image wrapper, never clipping popovers) */}
        <div className="relative aspect-video w-full overflow-hidden rounded-t-[15px] bg-background border-b border-border">
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
                alt={name}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-background select-none p-4">
                <div
                  className={`size-12 rounded-xl flex items-center justify-center border ${categoryAccent.iconBg}`}
                >
                  <BrandIcon name={name} className="size-6" />
                </div>
              </div>
            )}
          </Link>

          {/* Subtle Category Label (top-left) */}
          <span
            className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-lg border bg-background/90 ${categoryAccent.badge} pointer-events-none`}
          >
            <span className={`size-1.5 rounded-full ${categoryAccent.dot}`} aria-hidden="true" />
            <span className="max-w-[140px] truncate">{groupName}</span>
          </span>

          {/* Out-of-stock pill only when actually out of stock (avoids redundant "Còn hàng" noise on every card) */}
          {pricing.isOutOfStock && !isContactOnly && (
            <span className="absolute top-2.5 right-2.5 inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-background/95 text-rose-300 border border-rose-500/40 pointer-events-none">
              Hết hàng
            </span>
          )}
        </div>

        {/* 2. Content Body */}
        <div className="flex flex-col flex-1 p-4 sm:p-5 gap-2.5">
          {/* Product Name (16–18px) */}
          <Link
            href={`/product/${slug}`}
            className="block group/title focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            <h3 className="font-sans font-semibold text-base sm:text-[17px] text-foreground group-hover/title:text-primary transition-colors duration-150 leading-snug line-clamp-2 break-words">
              {name}
            </h3>
          </Link>

          {/* Usage Mode · Duration / Package Count (13px, clearly readable on mobile & desktop) */}
          <p className="text-[13px] text-muted-foreground leading-snug">
            {metaLine}
          </p>

          {/* Warranty / Critical Condition (12–13px, always visible on mobile, never hidden in tooltip only) */}
          <div className="relative flex items-start justify-between gap-2 pt-0.5">
            <div
              className={`inline-flex items-start gap-1.5 text-xs sm:text-[13px] leading-snug ${
                warrantySummary.isWarning
                  ? "text-amber-300 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {warrantySummary.isWarning ? (
                <AlertCircle className="size-3.5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <ShieldCheck className="size-3.5 text-muted-foreground/80 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span>{warrantySummary.text}</span>
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
                className="inline-flex items-center justify-center size-7 -mr-1 -mt-0.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="size-3.5" />
              </button>
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

      {/* 3. Footer: Price & Primary Action */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-border/70 flex flex-col gap-3 mt-auto">
        <PriceDisplay
          priceCents={pricing.lowestPrice}
          compareAtPriceCents={pricing.comparePrice}
          prefix={pricing.hasMultipleVariants ? "Từ" : undefined}
        />

        {/* Action Button (min-h 44px for mobile tap ergonomics) */}
        {isContactOnly ? (
          <Button
            asChild
            variant="outline"
            className="w-full h-11 rounded-xl text-sm font-semibold border-border hover:border-primary/50 hover:bg-secondary text-foreground transition-btn"
          >
            <a
              href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
                `Chào shop CapyGo, mình cần tư vấn đặt mua gói: ${name}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Liên hệ Zalo tư vấn mua ${name}`}
            >
              <MessageCircle className="size-4 text-primary" />
              <span>Liên hệ Zalo</span>
            </a>
          </Button>
        ) : pricing.isOutOfStock ? (
          <Button
            asChild
            variant="outline"
            className="w-full h-11 rounded-xl text-sm font-medium border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn"
          >
            <a
              href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
                `Chào shop CapyGo, mình muốn hỏi khi nào có hàng gói: ${name}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Liên hệ Zalo hỏi hàng ${name}`}
            >
              <MessageCircle className="size-4" />
              <span>Hết hàng · Liên hệ</span>
            </a>
          </Button>
        ) : (
          <Button
            asChild
            variant={featured ? "default" : "secondary"}
            className={
              featured
                ? "w-full h-11 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-caramel-light transition-btn"
                : "w-full h-11 rounded-xl text-sm font-semibold bg-secondary text-foreground border border-border hover:border-primary/50 hover:bg-primary hover:text-primary-foreground transition-btn"
            }
          >
            <Link href={`/product/${slug}`}>
              <span>{pricing.hasMultipleVariants ? "Chọn gói" : "Xem chi tiết"}</span>
              <ArrowRight className="size-4" strokeWidth={2.2} />
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}
