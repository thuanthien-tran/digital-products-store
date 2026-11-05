"use client"

import { Zap, ShieldCheck, Clock, QrCode, ArrowDown } from "lucide-react"
import { PixelCapybara } from "@/components/storefront/PixelCapybara"
import type { SiteSettingsData } from "@/lib/settings"

interface HeroSectionProps {
  settings?: SiteSettingsData | null
}

function renderHeroTitle(rawTitle: string, titleColor: string, highlightColor: string) {
  const parts = rawTitle.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const text = part.slice(2, -2)
      return (
        <span
          key={index}
          style={{ color: highlightColor }}
          className="inline font-extrabold"
        >
          {text}
        </span>
      )
    }
    return (
      <span key={index} style={{ color: titleColor }}>
        {part}
      </span>
    )
  })
}

const SLOGAN_FEATURES = [
  {
    icon: Zap,
    title: "Giao Hàng Siêu Tốc",
    desc: "Nhận tài khoản ngay qua màn hình và email.",
    theme: {
      card: "border-border/75 hover:border-caramel/50 hover:bg-secondary/40 hover:shadow-lg hover:shadow-black/25",
      iconBg: "bg-caramel/10 border-caramel/25 text-caramel group-hover:border-caramel/45 group-hover:bg-caramel/20 group-hover:text-caramel-light",
    },
  },
  {
    icon: QrCode,
    title: "VietQR Thông Minh",
    desc: "Quét QR, duyệt đơn trong 3–5 giây.",
    theme: {
      card: "border-border/75 hover:border-sage/50 hover:bg-secondary/40 hover:shadow-lg hover:shadow-black/25",
      iconBg: "bg-sage/10 border-sage/25 text-sage group-hover:border-sage/45 group-hover:bg-sage/20 group-hover:text-sage",
    },
  },
  {
    icon: ShieldCheck,
    title: "Bảo Hành Trọn Gói",
    desc: "Bảo hành 1 đổi 1 suốt thời hạn sử dụng.",
    theme: {
      card: "border-border/75 hover:border-caramel/50 hover:bg-secondary/40 hover:shadow-lg hover:shadow-black/25",
      iconBg: "bg-caramel/10 border-caramel/25 text-caramel group-hover:border-caramel/45 group-hover:bg-caramel/20 group-hover:text-caramel-light",
    },
  },
  {
    icon: Clock,
    title: "Hỗ Trợ Kỹ Thuật 24/7",
    desc: "Hỗ trợ kỹ thuật qua Zalo 0356 970 964",
    theme: {
      card: "border-border/75 hover:border-caramel/50 hover:bg-secondary/40 hover:shadow-lg hover:shadow-black/25",
      iconBg: "bg-caramel/10 border-caramel/25 text-caramel group-hover:border-caramel/45 group-hover:bg-caramel/20 group-hover:text-caramel-light",
    },
  },
]

export function HeroSection({ settings }: HeroSectionProps) {
  const heroTitle = settings?.heroTitle || "Những công cụ quen thuộc, **nhiều gói để lựa chọn.**"
  const heroSubtitle =
    settings?.heroSubtitle ||
    "Khám phá các gói Canva, YouTube Premium, Duolingo và những dịch vụ đang có tại cửa hàng. Chọn sản phẩm để xem giá và thông tin chi tiết."
  const titleColor = settings?.heroTitleColor || "#FAF4ED"
  const highlightColor = settings?.heroHighlightColor || "#E6A66F"
  const heroCtaText = settings?.heroCtaText || "Khám phá các gói"

  const handleScrollToCatalog = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    const target = document.getElementById("catalog-heading") || document.getElementById("products")
    if (target) {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })
      window.history.pushState(null, "", "#catalog-heading")
    }
  }

  return (
    <section className="relative pt-1 sm:pt-3 pb-1 sm:pb-2 space-y-3.5 sm:space-y-4 w-full overflow-hidden">
      {/* 1. Atmospheric Studio Spotlight Beam & Ambient Depth */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-full max-w-4xl h-72 pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        {/* Soft Radial Caramel Spotlight */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[480px] sm:w-[680px] h-[300px] bg-[radial-gradient(ellipse_at_top,rgba(230,166,111,0.18),rgba(242,188,142,0.06)_50%,transparent_75%)] blur-2xl" />

        {/* Crisp Studio Rim Light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[1px] bg-gradient-to-r from-transparent via-caramel/40 to-transparent" />
      </div>

      {/* Centered Headline Container */}
      <div className="text-center space-y-2.5 sm:space-y-3 max-w-4xl lg:max-w-5xl mx-auto px-2 sm:px-4">
        {/* 1. Nhãn nhỏ giới thiệu */}
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium border border-caramel/30 bg-caramel/10 text-caramel-light backdrop-blur-md shadow-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span>Cửa hàng tài khoản &amp; phần mềm</span>
          </div>
        </div>

        {/* 2. Tiêu đề H1 */}
        <h1
          className="font-heading text-[28px] sm:text-[34px] md:text-[40px] lg:text-[46px] font-extrabold tracking-tight leading-[1.25] animate-fade-up max-w-3xl sm:max-w-4xl lg:max-w-5xl mx-auto"
          style={{ animationDelay: "100ms" }}
        >
          {renderHeroTitle(heroTitle, titleColor, highlightColor)}
        </h1>

        {/* 3. Mô tả */}
        <p
          className="font-sans font-normal text-[15px] sm:text-base text-muted-foreground/90 max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto leading-[1.6] animate-fade-up whitespace-pre-line"
          style={{ animationDelay: "200ms" }}
        >
          {heroSubtitle}
        </p>

        {/* 4. Nút chính CTA */}
        <div className="pt-0.5 sm:pt-1 animate-fade-up" style={{ animationDelay: "250ms" }}>
          <a
            href="#catalog-heading"
            onClick={handleScrollToCatalog}
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-caramel hover:bg-caramel-light active:bg-[#D9955C] text-espresso font-semibold text-sm sm:text-[15px] shadow-md shadow-black/30 hover:shadow-caramel/25 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel-light focus-visible:ring-offset-2 focus-visible:ring-offset-background group"
          >
            <span>{heroCtaText}</span>
            <ArrowDown className="size-4 transition-transform duration-200 group-hover:translate-y-0.5" strokeWidth={2.5} />
          </a>
        </div>
      </div>

      {/* 4.5. Chill Pixel Capybara Ambient Mascot */}
      <div className="animate-fade-up w-full" style={{ animationDelay: "300ms" }}>
        <PixelCapybara />
      </div>

      {/* 5. 4 Slogan / Feature Cards (Unified motion, distinct accent colors) */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 w-full animate-fade-up pt-0 sm:pt-0.5"
        style={{ animationDelay: "350ms" }}
      >
        {SLOGAN_FEATURES.map((item, idx) => {
          const IconComponent = item.icon
          return (
            <div
              key={idx}
              className={`group flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border bg-card/65 backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-0.5 cursor-default select-none ${item.theme.card}`}
            >
              <div
                className={`size-10 sm:size-11 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 ${item.theme.iconBg}`}
              >
                <IconComponent className="size-5 sm:size-5.5" strokeWidth={2.2} />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h3 className="font-semibold text-sm sm:text-[14.5px] text-foreground group-hover:text-white transition-colors duration-200 tracking-tight leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground/85 group-hover:text-slate-200 transition-colors duration-200 leading-relaxed font-normal">
                  {item.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
