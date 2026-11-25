"use client"

import { useRef, useEffect } from "react"
import Link from "next/link"
import { ArrowDown, Search } from "lucide-react"
import { PixelCapybara } from "@/components/storefront/PixelCapybara"
import type { SiteSettingsData } from "@/lib/settings"

interface HeroSectionProps {
  settings?: SiteSettingsData | null
}

const TRUST_NOTES = [
  "Bảo hành rõ theo từng gói",
  "Bàn giao trực tiếp trong đơn hàng",
  "Hỗ trợ nhanh qua Zalo",
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
  const sectionRef = useRef<HTMLElement>(null)
  const capyWrapperRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  // Ultra-subtle desktop-only cursor parallax on Capybara visual (never on text, zero React state)
  useEffect(() => {
    const section = sectionRef.current
    const capyEl = capyWrapperRef.current
    if (!section || !capyEl) return

    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!supportsFinePointer || prefersReducedMotion) return

    let targetX = 0
    let targetY = 0

    const applyTransform = () => {
      rafRef.current = null
      capyEl.style.transform = `translate3d(${targetX.toFixed(2)}px, ${targetY.toFixed(2)}px, 0)`
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      const rect = section.getBoundingClientRect()
      const relX = (e.clientX - rect.left) / rect.width - 0.5
      const relY = (e.clientY - rect.top) / rect.height - 0.5
      targetX = Math.max(-4, Math.min(4, relX * 8))
      targetY = Math.max(-3, Math.min(3, relY * 6))
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(applyTransform)
      }
    }

    const handlePointerLeave = () => {
      targetX = 0
      targetY = 0
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(applyTransform)
      }
    }

    section.addEventListener("pointermove", handlePointerMove, { passive: true })
    section.addEventListener("pointerleave", handlePointerLeave, { passive: true })

    return () => {
      section.removeEventListener("pointermove", handlePointerMove)
      section.removeEventListener("pointerleave", handlePointerLeave)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      capyEl.style.transform = ""
    }
  }, [])

  const heroTitle =
    settings?.heroTitle?.trim() || "Công cụ số phù hợp. **Chọn gói dễ dàng.**"
  const heroSubtitle =
    settings?.heroSubtitle?.trim() ||
    "Khám phá tài khoản, phần mềm và API với giá, thời hạn và điều kiện bàn giao rõ ràng."
  const heroCtaText = settings?.heroCtaText?.trim() || "Khám phá sản phẩm"

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
    <section
      ref={sectionRef}
      className="relative w-full rounded-2xl border border-border bg-card px-5 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-7 overflow-hidden"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
        {/* Left: Core message & distinct primary/secondary actions on stable high-contrast surface */}
        <div className="relative z-10 lg:col-span-7 space-y-4">
          <div className="space-y-2">
            <h1 className="font-heading font-bold tracking-tight text-[24px] sm:text-[30px] lg:text-[36px] leading-[1.18] text-foreground">
              {renderHeroTitle(heroTitle, settings?.heroTitleColor, settings?.heroHighlightColor)}
            </h1>
            <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed max-w-xl">
              {heroSubtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 pt-0.5">
            <a
              href="#catalog-heading"
              onClick={handleScrollToCatalog}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-caramel-light active:scale-[0.98] transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span>{heroCtaText}</span>
              <ArrowDown className="size-4 shrink-0" strokeWidth={2.25} />
            </a>

            <Link
              href="/lookup"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-border bg-background hover:bg-secondary text-foreground font-medium text-sm transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="size-3.5 text-muted-foreground shrink-0" />
              <span>Tra cứu đơn hàng</span>
            </Link>
          </div>

          {/* Concise single-line operational summary */}
          <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {TRUST_NOTES.map((text, idx) => (
              <span key={text} className="inline-flex items-center gap-2">
                {idx > 0 && (
                  <span className="text-border select-none" aria-hidden="true">
                    ·
                  </span>
                )}
                <span>{text}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right: Signature Pixel Capybara with soft drifting caramel ambient light behind illustration */}
        <div className="relative lg:col-span-5">
          <div
            aria-hidden="true"
            className="hidden sm:block pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(230,166,111,0.22)_0%,rgba(230,166,111,0.06)_45%,transparent_72%)] blur-2xl ambient-caramel-orb"
          />
          <div
            ref={capyWrapperRef}
            className="relative z-10 transition-transform duration-300 ease-out"
          >
            <PixelCapybara />
          </div>
        </div>
      </div>
    </section>
  )
}
