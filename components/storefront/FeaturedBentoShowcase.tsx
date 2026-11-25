"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { BrandIcon } from "@/components/storefront/BrandIcons"
import { calculateProductPricing } from "@/lib/pricing"
import { formatPrice } from "@/lib/utils"
import type { StorefrontProduct } from "@/components/storefront/StorefrontCatalog"

const ZALO_PHONE = (process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964").replace(/\D/g, "")

/**
 * Produce a clean, scannable display title for featured cards by stripping
 * duration/format suffixes that are already shown on the subtitle line.
 * Full product name is always preserved in `title` attribute and detail page.
 */
function getCompactFeaturedTitle(rawName: string): string {
  const clean = rawName
    .replace(/\s*\([^)]*(?:1b|5b|10b|20b|30b|kbh|bhf|fw|nw)[^)]*\)/gi, "")
    .replace(/\s*[-–·]\s*\d+\s*(?:ngày|ngay|tháng|thang|năm|nam|days?|months?|years?)\b/gi, "")
    .replace(/\s+\b(?:chính chủ|chinh chu)\b/gi, "")
    .replace(/\s+\b\d+\s*(?:ngày|ngay|tháng|thang|năm|nam|days?|months?|years?)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[-–·:\s]+$/, "")
    .trim()

  return clean.length >= 4 ? clean : rawName
}

function extractCompactBenefitSummary(product: StorefrontProduct): string | null {
  const isIgnored = (line: string) =>
    /^(thông tin\s*&\s*quyền lợi|mô tả sản phẩm|hướng dẫn|chính sách bảo hành|bảo hành|lưu ý|thời hạn)\b/i.test(
      line
    )

  const snippets: string[] = []

  if (product.highlights && product.highlights.length > 0) {
    for (const h of product.highlights) {
      const clean = h.replace(/^[-*•\s#]+/, "").replace(/\*\*/g, "").trim()
      if (clean.length >= 4 && !isIgnored(clean)) {
        snippets.push(clean.length > 36 ? `${clean.slice(0, 36).trim()}…` : clean)
      }
      if (snippets.length >= 3) break
    }
  }

  if (snippets.length === 0 && product.description && product.description.trim()) {
    const lines = product.description
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•\s#>]+/, "").replace(/\*\*/g, "").trim())
      .filter((l) => l.length >= 6 && !isIgnored(l))

    for (const line of lines) {
      if (/\bchỉ\s*\d+k\b/i.test(line)) continue
      snippets.push(line.length > 64 ? `${line.slice(0, 64).trim()}…` : line)
      if (snippets.length >= 2) break
    }
  }

  return snippets.length > 0 ? snippets.join(" · ") : null
}

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

function detectDuration(product: StorefrontProduct, hasMultipleVariants: boolean): string | null {
  if (hasMultipleVariants) return `${product.variants.length} gói`
  const combined = `${product.name} ${product.variants[0]?.name || ""}`.toLowerCase()

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

  const shortMatch = combined.match(
    /\b(\d{1,3})\s*(m|d)\b(?!\s*(?:token|tokens|credit|credits|b\b|k\b|mb|gb))/i
  )
  if (shortMatch) {
    const num = parseInt(shortMatch[1], 10)
    const unit = shortMatch[2].toLowerCase()
    if (unit === "m" && num >= 1 && num <= 36) return `${num} tháng`
    if (unit === "d" && num >= 1 && num <= 365) return `${num} ngày`
  }

  if (combined.includes("vĩnh viễn") || combined.includes("lifetime")) return "Vĩnh viễn"
  return null
}

function getShortWarranty(product: StorefrontProduct): { text: string; isWarning: boolean } {
  const combined = `${product.name} ${product.warrantyTerms || ""} ${product.noticeNotes || ""}`.toLowerCase()
  if (/kbh|không bảo hành|ko bảo hành|no warranty|\(nw\)/i.test(combined)) {
    return { text: "Không bảo hành (KBH)", isWarning: true }
  }
  if (product.warrantyTerms && product.warrantyTerms.trim()) {
    const first = product.warrantyTerms
      .trim()
      .split("\n")[0]
      .replace(/^[-*•\s]+/, "")
      .replace(/^bảo hành\s*:\s*/i, "Bảo hành ")
      .trim()
    return {
      text: first.length > 40 ? `${first.slice(0, 40)}…` : first,
      isWarning: false,
    }
  }
  return { text: "Bảo hành theo gói", isWarning: false }
}

function CompactThumb({
  imageUrl,
  name,
  sizeClass,
  surfaceClass = "bg-[#121315] border-white/10",
}: {
  imageUrl: string | null
  name: string
  sizeClass: string
  surfaceClass?: string
}) {
  const [failed, setFailed] = useState(false)

  return (
    <div
      className={`${sizeClass} shrink-0 rounded-xl border overflow-hidden flex items-center justify-center ${surfaceClass}`}
    >
      {imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          onError={() => setFailed(true)}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <BrandIcon name={name} className="size-6 text-muted-foreground" />
      )}
    </div>
  )
}

function FlagshipCard({ product }: { product: StorefrontProduct }) {
  const cardRef = useRef<HTMLElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  const [hasEntered, setHasEntered] = useState(false)

  // One-time sheen trigger when card enters viewport (never repeats on scroll)
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setHasEntered(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasEntered(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Desktop-only (pointer: fine) soft cursor spotlight using direct DOM CSS variables (zero React state updates)
  useEffect(() => {
    const card = cardRef.current
    const spot = spotlightRef.current
    if (!card || !spot) return

    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!supportsFinePointer || prefersReducedMotion) return

    let rafId: number | null = null
    let lastX = 0
    let lastY = 0

    const updateSpot = () => {
      rafId = null
      spot.style.setProperty("--spot-x", `${lastX}px`)
      spot.style.setProperty("--spot-y", `${lastY}px`)
      spot.style.opacity = "1"
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      const rect = card.getBoundingClientRect()
      lastX = e.clientX - rect.left
      lastY = e.clientY - rect.top
      if (rafId === null) {
        rafId = requestAnimationFrame(updateSpot)
      }
    }

    const onPointerLeave = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      spot.style.opacity = "0"
    }

    card.addEventListener("pointermove", onPointerMove, { passive: true })
    card.addEventListener("pointerleave", onPointerLeave, { passive: true })

    return () => {
      card.removeEventListener("pointermove", onPointerMove)
      card.removeEventListener("pointerleave", onPointerLeave)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  const pricing = calculateProductPricing(product.variants, product.statusOverride)
  const hasDistinctPrices = new Set(product.variants.map((v) => v.priceCents)).size > 1
  const isContactOnly = product.deliveryType === "contact"
  const compactTitle = getCompactFeaturedTitle(product.name)
  const duration = detectDuration(product, pricing.hasMultipleVariants)
  const usageMode = detectUsageMode(product.name, product.deliveryType)
  const benefitLine = extractCompactBenefitSummary(product)
  const warranty = getShortWarranty(product)
  const primaryImage = product.images?.[0]?.trim() || null

  return (
    <article
      ref={cardRef}
      className="relative h-full flex flex-col justify-between rounded-2xl border border-[#E6A66F]/35 bg-gradient-to-br from-[#2E2219] via-[#201B18] to-[#16171A] p-5 sm:p-6 transition-card hover:-translate-y-[3px] hover:border-[#E6A66F]/75 shadow-[0_12px_30px_-18px_rgba(230,166,111,0.2)] hover:shadow-[0_16px_38px_-16px_rgba(230,166,111,0.34)] overflow-hidden"
    >
      {/* One-time soft ivory sheen sweep on viewport entry */}
      {hasEntered && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-[#FFF5EA]/14 to-transparent featured-sheen-once"
        />
      )}

      {/* Desktop-only subtle cursor-following light spot (zero React re-renders) */}
      <div
        ref={spotlightRef}
        aria-hidden="true"
        style={{
          opacity: 0,
          background:
            "radial-gradient(280px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(240, 184, 130, 0.22), rgba(230, 166, 111, 0.06) 45%, transparent 72%)",
        }}
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
      />

      <div className="relative z-10 space-y-4">
        {/* Top Row: Single CAPYGO đề xuất label + Stock Status */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-[0.07em] bg-[#E6A66F]/18 text-[#F2BC8E] border border-[#E6A66F]/30">
            CAPYGO đề xuất
          </span>

          {isContactOnly ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#FFF5EA]/85">
              <span className="size-1.5 rounded-full bg-[#E6A66F]" />
              Liên hệ đặt
            </span>
          ) : pricing.isOutOfStock ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-black/35 text-rose-300 border border-rose-400/25">
              <span className="size-1.5 rounded-full bg-rose-400" />
              Hết hàng
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-black/35 text-emerald-300 border border-emerald-400/25">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Sẵn hàng
            </span>
          )}
        </div>

        {/* Title + Subtitle (left) & Restrained Framed Visual (right) */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <Link
              href={`/product/${product.slug}`}
              title={product.name}
              className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <h3 className="font-heading font-bold text-xl sm:text-[25px] text-[#FFF5EA] group-hover:text-[#F2BC8E] transition-colors duration-150 leading-tight line-clamp-2">
                {compactTitle}
              </h3>
            </Link>

            <p className="text-xs sm:text-sm font-medium text-[#FFF5EA]/70">
              {[duration, usageMode].filter(Boolean).join(" · ")}
            </p>
          </div>

          <Link
            href={`/product/${product.slug}`}
            tabIndex={-1}
            aria-hidden="true"
            className="shrink-0"
          >
            <CompactThumb
              imageUrl={primaryImage}
              name={product.name}
              sizeClass="w-28 sm:w-36 aspect-[16/9]"
              surfaceClass="bg-[#141518] border-white/15 shadow-sm"
            />
          </Link>
        </div>

        {/* Concise Benefit + Warranty */}
        <div className="space-y-1 text-xs sm:text-[13px]">
          {benefitLine && (
            <p className="text-[#FFF5EA]/85 leading-relaxed line-clamp-2">
              {benefitLine}
            </p>
          )}
          <p className={warranty.isWarning ? "text-amber-300 font-medium" : "text-[#FFF5EA]/60"}>
            {warranty.text}
          </p>
        </div>
      </div>

      {/* Footer: Warm Caramel Price + Crisp Caramel CTA Button */}
      <div className="relative z-10 pt-4 mt-5 border-t border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-2.5 flex-wrap tabular-nums">
          {hasDistinctPrices && (
            <span className="text-xs font-medium text-[#FFF5EA]/70">Từ</span>
          )}
          <span className="text-[26px] sm:text-[32px] font-bold tracking-tight text-[#F0B47A] leading-none">
            {formatPrice(pricing.lowestPrice)}
          </span>
          {pricing.comparePrice && pricing.comparePrice > pricing.lowestPrice && (
            <span className="text-sm text-[#FFF5EA]/45 line-through">
              {formatPrice(pricing.comparePrice)}
            </span>
          )}
        </div>

        {isContactOnly ? (
          <a
            href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
              `Chào shop CapyGo, mình cần tư vấn đặt mua gói: ${product.name}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#E6A66F] hover:bg-[#F2BC8E] active:scale-[0.98] text-[#251A14] text-sm font-semibold transition-btn shrink-0"
          >
            <span>Liên hệ Zalo</span>
            <ArrowRight className="size-4" strokeWidth={2.25} />
          </a>
        ) : pricing.isOutOfStock ? (
          <a
            href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
              `Chào shop CapyGo, mình muốn hỏi khi nào có hàng gói: ${product.name}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-white/15 bg-white/8 hover:bg-white/14 active:scale-[0.98] text-[#FFF5EA]/90 text-sm font-medium transition-btn shrink-0"
          >
            <span>Hỏi khi có hàng</span>
          </a>
        ) : (
          <Link
            href={`/product/${product.slug}`}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#E6A66F] hover:bg-[#F2BC8E] active:scale-[0.98] text-[#251A14] text-sm font-semibold transition-btn shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>Chọn gói</span>
            <ArrowRight className="size-4" strokeWidth={2.25} />
          </Link>
        )}
      </div>
    </article>
  )
}

function SecondaryFeaturedCard({ product }: { product: StorefrontProduct }) {
  const pricing = calculateProductPricing(product.variants, product.statusOverride)
  const hasDistinctPrices = new Set(product.variants.map((v) => v.priceCents)).size > 1
  const isContactOnly = product.deliveryType === "contact"
  const compactTitle = getCompactFeaturedTitle(product.name)
  const duration = detectDuration(product, pricing.hasMultipleVariants)
  const usageMode = detectUsageMode(product.name, product.deliveryType)
  const warranty = getShortWarranty(product)
  const primaryImage = product.images?.[0]?.trim() || null

  const metaLine = [duration, usageMode, warranty.isWarning ? "KBH" : null]
    .filter(Boolean)
    .join(" · ")

  return (
    <article className="flex-1 flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-card hover:-translate-y-0.5 hover:border-border/90">
      <div className="flex items-start gap-3">
        <Link
          href={`/product/${product.slug}`}
          tabIndex={-1}
          aria-hidden="true"
          className="shrink-0"
        >
          <CompactThumb
            imageUrl={primaryImage}
            name={product.name}
            sizeClass="w-20 sm:w-24 aspect-[16/9]"
          />
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/product/${product.slug}`}
              title={product.name}
              className="block group min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <h3 className="font-sans font-semibold text-sm sm:text-[15px] text-foreground group-hover:text-primary transition-colors duration-150 leading-snug line-clamp-1">
                {compactTitle}
              </h3>
            </Link>

            {isContactOnly ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 mt-0.5">
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                Liên hệ
              </span>
            ) : pricing.isOutOfStock ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-rose-300/90 shrink-0 mt-0.5">
                <span className="size-1.5 rounded-full bg-rose-400" />
                Hết hàng
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 shrink-0 mt-0.5">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Sẵn hàng
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground truncate">{metaLine}</p>
        </div>
      </div>

      {/* Footer: Calm dark secondary card (never competes with primary caramel card) */}
      <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1.5 tabular-nums min-w-0">
          {hasDistinctPrices && (
            <span className="text-[11px] text-muted-foreground">Từ</span>
          )}
          <span className="text-base font-bold text-foreground">
            {formatPrice(pricing.lowestPrice)}
          </span>
          {pricing.comparePrice && pricing.comparePrice > pricing.lowestPrice && (
            <span className="text-xs text-muted-foreground/70 line-through">
              {formatPrice(pricing.comparePrice)}
            </span>
          )}
        </div>

        {isContactOnly ? (
          <a
            href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
              `Chào shop CapyGo, mình cần tư vấn đặt mua gói: ${product.name}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-border bg-secondary/70 hover:bg-secondary text-foreground text-xs font-medium transition-btn shrink-0"
          >
            Liên hệ
          </a>
        ) : pricing.isOutOfStock ? (
          <a
            href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
              `Chào shop CapyGo, mình muốn hỏi khi nào có hàng gói: ${product.name}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-btn shrink-0"
          >
            Hỏi khi có hàng
          </a>
        ) : (
          <Link
            href={`/product/${product.slug}`}
            className="inline-flex items-center justify-center gap-1 h-9 px-3.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition-btn shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>Chọn gói</span>
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </Link>
        )}
      </div>
    </article>
  )
}

interface FeaturedBentoShowcaseProps {
  products: StorefrontProduct[]
  onViewAllClick: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

export function FeaturedBentoShowcase({
  products,
  onViewAllClick,
}: FeaturedBentoShowcaseProps) {
  if (products.length === 0) return null

  const flagship = products[0]
  const rightStack = products.slice(1, 3)
  const extraRow = products.slice(3, 6)

  return (
    <section
      aria-label="Gói nổi bật"
      className="rounded-2xl border border-border/80 bg-[#121315] p-4 sm:p-6 space-y-4"
    >
      {/* Clean Section Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
            Gói nổi bật
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Các gói tiêu biểu được chọn lọc với giá và điều kiện rõ ràng.
          </p>
        </div>

        <a
          href="#catalog-heading"
          onClick={onViewAllClick}
          className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          Xem tất cả →
        </a>
      </div>

      {/* 60 / 40 Bento Split (lg:grid-cols-12 -> 7 / 5, gap 20-24px) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
        <div className={rightStack.length > 0 ? "lg:col-span-7" : "lg:col-span-12"}>
          <FlagshipCard product={flagship} />
        </div>

        {rightStack.length > 0 && (
          <div className="lg:col-span-5 flex flex-col gap-5">
            {rightStack.map((item) => (
              <SecondaryFeaturedCard key={item.id} product={item} />
            ))}
          </div>
        )}
      </div>

      {/* Optional extra featured items (4–6) */}
      {extraRow.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {extraRow.map((item) => (
            <SecondaryFeaturedCard key={item.id} product={item} />
          ))}
        </div>
      )}
    </section>
  )
}
