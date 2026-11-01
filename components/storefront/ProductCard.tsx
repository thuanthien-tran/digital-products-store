"use client"

import { useState, useId, useRef, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { calculateProductPricing, type PricingVariant } from "@/lib/pricing"
import { BrandIcon } from "@/components/storefront/BrandIcons"
import { Check, ArrowRight, AlertCircle, Clock, Zap, Info, X, MessageCircle } from "lucide-react"

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
}

// Category aesthetic theme
function getCategoryTheme(groupName: string = "") {
  const norm = groupName.toLowerCase().trim()
  if (norm.includes("ai") || norm.includes("trí tuệ")) {
    return {
      cardBorder: "hover:border-purple-500/50 hover:shadow-purple-950/30",
      badge: "bg-purple-950/40 text-purple-300 border-purple-500/30",
      accent: "text-purple-400",
      iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    }
  }
  if (norm.includes("đồ họa") || norm.includes("thiết kế")) {
    return {
      cardBorder: "hover:border-cyan-500/50 hover:shadow-cyan-950/30",
      badge: "bg-cyan-950/40 text-cyan-300 border-cyan-500/30",
      accent: "text-cyan-400",
      iconBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    }
  }
  if (norm.includes("giải trí") || norm.includes("stream")) {
    return {
      cardBorder: "hover:border-rose-500/50 hover:shadow-rose-950/30",
      badge: "bg-rose-950/40 text-rose-300 border-rose-500/30",
      accent: "text-rose-400",
      iconBg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    }
  }
  if (norm.includes("học tập") || norm.includes("ngôn ngữ")) {
    return {
      cardBorder: "hover:border-emerald-500/50 hover:shadow-emerald-950/30",
      badge: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
      accent: "text-emerald-400",
      iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    }
  }
  return {
    cardBorder: "hover:border-emerald-500/40 hover:shadow-emerald-950/20",
    badge: "bg-emerald-950/30 text-emerald-300 border-emerald-500/20",
    accent: "text-emerald-400",
    iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  }
}

// Extract duration tags from text
function detectDuration(name: string, variants: ProductCardVariant[] = []): string | null {
  const combined = `${name} ${variants.map(v => v.name).join(" ")}`.toLowerCase()
  const match = combined.match(/(\d+\s*(?:tháng|thang|năm|nam|ngày|ngay|tuần|tuan|h|giờ|gio|m|y))/i)
  if (match) return match[1].trim()
  if (combined.includes("vĩnh viễn") || combined.includes("lifetime")) return "Vĩnh viễn"
  return null
}

interface ConditionItem {
  label: string
  detail: string
  isWarning?: boolean
}

// Extract critical condition keywords
function detectConditions(
  name: string,
  desc: string = "",
  warranty: string = "",
  notes: string = ""
): ConditionItem[] {
  const allText = `${name} ${desc} ${warranty} ${notes}`.toLowerCase()
  const results: Array<{ label: string; detail: string; isWarning?: boolean }> = []

  if (allText.includes("kbh") || allText.includes("không bảo hành") || allText.includes("ko bảo hành")) {
    results.push({
      label: "Không bảo hành (KBH)",
      detail: "Sản phẩm được bán dạng KBH, quý khách vui lòng kiểm tra và kích hoạt ngay sau khi nhận.",
      isWarning: true,
    })
  } else if (warranty && warranty.trim()) {
    const firstLine = warranty.trim().split("\n")[0].replace(/^[-*•\s]+/, "")
    results.push({
      label: firstLine.length > 25 ? firstLine.slice(0, 25) + "..." : firstLine,
      detail: warranty.trim(),
    })
  }

  if (allText.includes("vpn") || allText.includes("ấn độ") || allText.includes("india")) {
    results.push({
      label: "Yêu cầu bật VPN",
      detail: "Cần bật VPN khu vực theo hướng dẫn để kích hoạt lần đầu.",
      isWarning: true,
    })
  }

  if (allText.includes("chính chủ")) {
    results.push({
      label: "Nâng chính chủ",
      detail: "Nâng cấp trực tiếp trên email/tài khoản cá nhân của bạn.",
    })
  } else if (allText.includes("cấp sẵn")) {
    results.push({
      label: "Tài khoản cấp sẵn",
      detail: "Hệ thống cấp sẵn tài khoản đăng nhập bảo mật riêng biệt.",
    })
  }

  return results
}

// Fallback extractor for bullet points from markdown description
function parseDescriptionBullets(description: string = ""): string[] {
  if (!description) return []

  const descClean = description.replace(/\r\n/g, "\n")
  const bMatch = descClean.match(
    /\*\*(?:Thông tin & Quyền lợi|Quyền lợi|Đặc quyền)[^*]*\*\*([\s\S]*?)(?=\*\*(?:Hướng dẫn|Chính sách|Lưu ý|Bảo hành)|$)/i
  )
  const targetText = bMatch && bMatch[1] ? bMatch[1] : descClean

  const lines = targetText.split("\n")
  const results: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) continue

    const bulletClean = trimmed
      .replace(/^[-*•\d.)\s]+/, "")
      .replace(/[*_#`]/g, "")
      .trim()

    // Skip section headers or instruction lines
    if (bulletClean.endsWith(":")) continue
    if (/^(thông tin|quyền lợi|hướng dẫn|chính sách|lưu ý|bảo hành|nhận hàng|kích hoạt|\d+\s*bước)/i.test(bulletClean)) continue
    if (/^(vpn|cài extension|bật vpn|tải app)/i.test(bulletClean)) continue

    if (bulletClean.length >= 3 && !results.includes(bulletClean)) {
      results.push(bulletClean)
      if (results.length >= 3) break
    }
  }

  return results
}

export function ProductCard({
  name,
  slug,
  description = "",
  images = [],
  groupName = "Chưa phân loại",
  deliveryType = "serials",
  statusOverride = "auto",
  highlights,
  conditions: customConditions,
  warrantyTerms,
  noticeNotes,
  variants = [],
  className = "",
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false)
  const [activeCondition, setActiveCondition] = useState<{ label: string; detail: string } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  // Calculate pricing strictly
  const pricing = calculateProductPricing(variants, statusOverride)
  const theme = getCategoryTheme(groupName)

  // Determine cover image URL
  const primaryImage = !imgError && images && images.length > 0 && images[0]?.trim() ? images[0].trim() : null

  // Extract highlights (explicit takes precedence, fallback to parsed copy)
  const displayHighlights =
    highlights && highlights.length > 0
      ? highlights.slice(0, 3)
      : parseDescriptionBullets(description).slice(0, 3)

  // Extract key attributes
  const duration = detectDuration(name, variants)
  const deliveryLabel =
    deliveryType === "service"
      ? "Nâng cấp tài khoản"
      : "Giao tự động tức thì"

  // Extract condition warnings / notes
  const conditionList: ConditionItem[] =
    customConditions && customConditions.length > 0
      ? customConditions.map(c => ({ label: c, detail: c, isWarning: false }))
      : detectConditions(name, description, warrantyTerms || "", noticeNotes || "")

  // Close popover on outside click or escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveCondition(null)
    }
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveCondition(null)
      }
    }
    if (activeCondition) {
      document.addEventListener("keydown", handleKeyDown)
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("keydown", handleKeyDown)
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [activeCondition])

  return (
    <div
      className={`group relative flex flex-col justify-between h-full rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl overflow-hidden ${theme.cardBorder} ${className}`}
    >
      {/* Upper Section */}
      <div className="flex flex-col flex-1">
        {/* 16:9 Image Frame (Flush to top, left, right borders) */}
        <div className="relative aspect-video w-full overflow-hidden bg-muted/20 border-b border-border/50">
          <Link
            href={`/product/${slug}`}
            className="block w-full h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            tabIndex={-1}
            aria-hidden="true"
          >
            {primaryImage ? (
              // Native img for robust loading & error handling with external CDN URLs
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryImage}
                alt={name}
                className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                onError={() => setImgError(true)}
                loading="lazy"
              />
            ) : (
              // Minimalist tech placeholder with brand icon
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-card/90 via-muted/25 to-background select-none">
                <div className={`size-12 rounded-xl flex items-center justify-center border shadow-inner transition-transform duration-300 group-hover:scale-110 ${theme.iconBg}`}>
                  <BrandIcon name={name} className="size-6" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground/80 mt-2 tracking-wide uppercase">
                  {groupName}
                </span>
              </div>
            )}
          </Link>

          {/* Product Stock Status Badge (Top-Left over Image) */}
          <div
            className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border backdrop-blur-md shadow-md pointer-events-none transition-colors ${
              pricing.hasStock
                ? "text-emerald-300 bg-emerald-950/80 border-emerald-500/40 shadow-emerald-950/30"
                : "text-rose-300 bg-rose-950/80 border-rose-500/40 shadow-rose-950/30"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                pricing.hasStock ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            />
            <span>{pricing.hasStock ? "Còn hàng" : "Hết hàng"}</span>
          </div>

          {/* Discount Percentage Badge (Top-Right over Image) */}
          {pricing.discountPercent && pricing.discountPercent >= 1 ? (
            <div className="absolute top-2.5 right-2.5 bg-rose-600/90 text-white font-extrabold text-[11px] px-2.5 py-0.5 rounded-full shadow-md backdrop-blur-sm pointer-events-none tracking-tight">
              -{pricing.discountPercent}%
            </div>
          ) : null}
        </div>

        {/* Content Body */}
        <div className="flex flex-col flex-1 p-4 sm:p-5">
          {/* Category Pill */}
          <div className="flex items-center pb-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border backdrop-blur transition-transform duration-200 ${theme.badge}`}
            >
              {groupName}
            </span>
          </div>

          {/* Product Title (2 lines max, accessible link) */}
          <Link href={`/product/${slug}`} className="block group/title mt-0.5">
            <h3 className="font-bold text-base sm:text-[17px] text-foreground group-hover/title:text-accent transition-colors duration-150 leading-snug line-clamp-2">
              {name}
            </h3>
          </Link>

          {/* Key Attributes Row: Duration & Delivery Mode */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {duration && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary/60 text-secondary-foreground border border-border/50">
                <Clock className="size-3 text-muted-foreground" />
                {duration}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary/60 text-secondary-foreground border border-border/50">
              <Zap className="size-3 text-muted-foreground" />
              {deliveryLabel}
            </span>
          </div>

          {/* 2 to 3 Short Highlights */}
          {displayHighlights.length > 0 && (
            <div className="mt-3.5 space-y-1.5 flex-1">
              {displayHighlights.map((hl, hIdx) => (
                <div
                  key={hIdx}
                  className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground group-hover:text-foreground/90 transition-colors"
                >
                  <Check
                    className={`size-3.5 mt-0.5 shrink-0 ${theme.accent}`}
                    strokeWidth={2.5}
                  />
                  <span className="line-clamp-1">{hl}</span>
                </div>
              ))}
            </div>
          )}

          {/* Important Conditions / Info Popover Trigger (Clean HTML: Button is NEVER nested inside Link) */}
          {conditionList.length > 0 && (
            <div className="relative mt-3 pt-2.5 border-t border-border/40">
              <div className="flex flex-wrap items-center gap-1.5">
                {conditionList.map((cond, cIdx) => (
                  <button
                    key={cIdx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveCondition(activeCondition?.label === cond.label ? null : cond)
                    }}
                    aria-expanded={activeCondition?.label === cond.label}
                    aria-controls={popoverId}
                    className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                      cond.isWarning
                        ? "bg-amber-950/20 text-amber-300 border-amber-500/30 hover:bg-amber-950/40 hover:border-amber-500/50"
                        : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {cond.isWarning && <AlertCircle className="size-3 text-amber-400 shrink-0" />}
                    <span>{cond.label}</span>
                    <Info className="size-2.5 opacity-60 ml-0.5" />
                  </button>
                ))}
              </div>

              {/* Accessible Condition Details Popover */}
              {activeCondition && (
                <div
                  id={popoverId}
                  ref={popoverRef}
                  role="dialog"
                  aria-label={activeCondition.label}
                  className="absolute bottom-full left-0 right-0 mb-2 z-30 p-3 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl text-xs text-popover-foreground animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border/50">
                    <span className="font-semibold text-[11px] text-foreground flex items-center gap-1.5">
                      <AlertCircle className="size-3 text-amber-400" />
                      {activeCondition.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveCondition(null)}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                      aria-label="Đóng"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {activeCondition.detail}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: Price Display & Action Button */}
      <div className="p-4 sm:p-5 pt-3 mt-auto border-t border-border/50 flex items-end justify-between gap-3 bg-muted/5">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {pricing.hasMultipleVariants ? "Giá từ" : "Giá bán"}
          </span>

          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight tabular-nums">
              {pricing.priceText}
            </span>

            {/* Strikethrough Compare Price */}
            {pricing.comparePrice ? (
              <span className="line-through text-xs text-muted-foreground tabular-nums">
                {formatPrice(pricing.comparePrice)}
              </span>
            ) : null}
          </div>

          {/* Savings Amount */}
          {pricing.savings ? (
            <span className="text-[11px] font-medium text-emerald-400 tabular-nums">
              Tiết kiệm {formatPrice(pricing.savings)}
            </span>
          ) : null}
        </div>

        {/* Action Button */}
        {pricing.isOutOfStock ? (
          <Button
            size="sm"
            asChild
            variant="outline"
            className="text-xs h-9 px-3.5 font-medium border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-200 transition-all duration-150 shrink-0"
          >
            <a
              href={`https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964"}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Liên hệ mua ${name} qua Zalo khi hết hàng`}
            >
              <MessageCircle className="size-3.5 mr-1 text-amber-400" />
              <span>Liên hệ</span>
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            asChild
            variant="outline"
            className="text-xs h-9 px-3.5 font-medium border-border/80 group/btn active-bounce group-hover:border-accent/50 group-hover:text-accent transition-all duration-150 shrink-0"
          >
            <Link href={`/product/${slug}`}>
              <span>{pricing.hasMultipleVariants ? "Chọn gói" : "Xem chi tiết"}</span>
              <ArrowRight
                className="size-3.5 ml-1 transition-transform duration-200 group-hover:translate-x-1"
                strokeWidth={2}
              />
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
