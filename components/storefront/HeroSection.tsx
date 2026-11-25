"use client"

import Link from "next/link"
import { ArrowDown, ShieldCheck, FileCheck2, Clock } from "lucide-react"
import { PixelCapybara } from "@/components/storefront/PixelCapybara"
import type { SiteSettingsData } from "@/lib/settings"

interface HeroSectionProps {
  settings?: SiteSettingsData | null
}

const TRUST_NOTES = [
  {
    icon: ShieldCheck,
    text: "Chính sách bảo hành rõ theo từng gói",
  },
  {
    icon: FileCheck2,
    text: "Thông tin bàn giao hiển thị trong đơn hàng",
  },
  {
    icon: Clock,
    text: "Thời gian xử lý tùy loại sản phẩm",
  },
]

function renderHeroTitle(rawTitle: string, titleColor?: string | null, highlightColor?: string | null) {
  const parts = rawTitle.split(/(\*\*.*?\*\*)/g)
  const baseColor = titleColor?.trim() || undefined
  const accentColor = highlightColor?.trim() || undefined

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span
          key={index}
          style={accentColor ? { color: accentColor } : undefined}
          className={accentColor ? "inline" : "text-primary inline"}
        >
          {part.slice(2, -2)}
        </span>
      )
    }
    return (
      <span key={index} style={baseColor ? { color: baseColor } : undefined}>
        {part}
      </span>
    )
  })
}

export function HeroSection({ settings }: HeroSectionProps) {
  const heroTitle =
    settings?.heroTitle?.trim() || "Tài khoản và công cụ số cho nhu cầu của bạn."
  const heroSubtitle =
    settings?.heroSubtitle?.trim() ||
    "Chọn gói phù hợp, xem rõ giá, hình thức bàn giao và điều kiện bảo hành trước khi thanh toán."
  const heroCtaText = settings?.heroCtaText?.trim() || "Khám phá các gói"

  const handleScrollToCatalog = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    const target =
      document.getElementById("catalog-heading") ||
      document.getElementById("products")
    if (target) {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      })
      window.history.pushState(null, "", "#catalog-heading")
    }
  }

  return (
    <section className="w-full rounded-2xl border border-border bg-card p-5 sm:p-7 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Left: Core message & primary action */}
        <div className="lg:col-span-7 space-y-4">
          <div className="space-y-2.5">
            <h1 className="font-heading font-bold tracking-tight text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.18] text-foreground">
              {renderHeroTitle(heroTitle, settings?.heroTitleColor, settings?.heroHighlightColor)}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
              {heroSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="#catalog-heading"
              onClick={handleScrollToCatalog}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-caramel-light active:scale-[0.98] transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span>{heroCtaText}</span>
              <ArrowDown className="size-4" strokeWidth={2.25} />
            </a>

            <Link
              href="/san-pham"
              className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl border border-border bg-background hover:bg-secondary text-foreground font-medium text-sm transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Xem tất cả sản phẩm
            </Link>
          </div>

          {/* Concise, honest operational notes */}
          <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70">
            {TRUST_NOTES.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="inline-flex items-center gap-2 text-xs sm:text-[13px] text-muted-foreground"
              >
                <Icon className="size-3.5 text-primary shrink-0" strokeWidth={2} />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Signature Pixel Capybara Mascot (compact on mobile, side-by-side on desktop) */}
        <div className="lg:col-span-5">
          <PixelCapybara />
        </div>
      </div>
    </section>
  )
}
