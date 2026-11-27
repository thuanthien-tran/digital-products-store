"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageCircle, Eye } from "lucide-react"
import type { VisitorStatsPayload } from "@/components/storefront/VisitorTracker"

const ZALO_PHONE = process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964"

interface FooterProps {
  initialSettings?: {
    siteName: string
    logoUrl: string | null
    initials: string
  } | null
}

export function Footer({ initialSettings }: FooterProps) {
  const currentYear = new Date().getFullYear()
  const pathname = usePathname()
  const cleanZaloPhone = ZALO_PHONE.replace(/\D/g, "")

  const [settings, setSettings] = useState(
    () =>
      initialSettings || {
        siteName: process.env.NEXT_PUBLIC_STORE_NAME || "CAPYGO",
        logoUrl: null,
        initials: "CG",
      }
  )
  const [visitorStats, setVisitorStats] = useState<VisitorStatsPayload | null>(null)

  useEffect(() => {
    if (!initialSettings) {
      fetch("/api/site-settings")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.siteName) {
            setSettings({
              siteName: data.siteName,
              logoUrl: data.logoUrl || null,
              initials: data.initials || "CG",
            })
          }
        })
        .catch(() => {})
    }
  }, [initialSettings])

  useEffect(() => {
    if (typeof window !== "undefined" && window.__capygoVisitorStats) {
      setVisitorStats(window.__capygoVisitorStats)
    } else {
      fetch("/api/analytics/stats")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: VisitorStatsPayload | null) => {
          if (data) setVisitorStats(data)
        })
        .catch(() => {})
    }

    const handleStatsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<VisitorStatsPayload>
      if (customEvent.detail) {
        setVisitorStats(customEvent.detail)
      }
    }

    window.addEventListener("capygo:visitor-stats", handleStatsUpdate)
    return () => {
      window.removeEventListener("capygo:visitor-stats", handleStatsUpdate)
    }
  }, [])

  const handleNavScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

    if (pathname === "/") {
      e.preventDefault()
      const element = document.getElementById(targetId)
      if (element) {
        const prefersReduced =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches

        element.scrollIntoView({
          behavior: prefersReduced ? "auto" : "smooth",
        })
        window.history.pushState(null, "", `#${targetId}`)
      }
    }
  }

  return (
    <footer className="border-t border-border bg-card/70 text-foreground mt-10 sm:mt-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-5 pb-16 sm:py-6 space-y-3.5 sm:space-y-4">
        {/* Row 1: Brand + Navigation & Zalo (Brand + Zalo stay on 1 compact line on mobile) */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex size-7 items-center justify-center rounded-lg bg-secondary border border-border text-[11px] font-bold text-primary tracking-wider overflow-hidden shrink-0">
                {settings.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.logoUrl}
                    alt={settings.siteName}
                    className="size-full object-cover"
                  />
                ) : (
                  settings.initials
                )}
              </span>
              <span className="font-heading font-bold text-sm tracking-tight text-foreground shrink-0">
                {settings.siteName}
              </span>
              <span className="hidden lg:inline text-border select-none" aria-hidden="true">
                ·
              </span>
              <span className="hidden lg:inline text-xs text-muted-foreground truncate">
                Tài khoản, phần mềm, dịch vụ nâng cấp &amp; API
              </span>
            </div>

            {/* Mobile-only compact Zalo button on the same top line */}
            <a
              href={`https://zalo.me/${cleanZaloPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="md:hidden inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 text-[11px] font-semibold transition-btn shrink-0"
            >
              <MessageCircle className="size-3 shrink-0" />
              <span>Zalo</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-x-3.5 sm:gap-x-4 gap-y-1.5">
            <Link
              href="/san-pham"
              className="text-xs sm:text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              Sản phẩm
            </Link>
            <Link
              href="/lookup"
              className="text-xs sm:text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              Tra cứu đơn
            </Link>
            <Link
              href="/#how"
              onClick={(e) => handleNavScroll(e, "how")}
              className="text-xs sm:text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              Hướng dẫn
            </Link>
            <Link
              href="/#faq"
              onClick={(e) => handleNavScroll(e, "faq")}
              className="text-xs sm:text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              FAQ
            </Link>
            <a
              href={`https://zalo.me/${cleanZaloPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 text-xs font-semibold transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageCircle className="size-3.5 shrink-0" />
              <span>Liên hệ Zalo</span>
            </a>
          </div>
        </div>

        {/* Row 2: Copyright, Visitor Stats & Legal Links + Compact Disclaimer */}
        <div className="border-t border-border/70 pt-3 space-y-2">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-[11px] sm:text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <p>© {currentYear} {settings.siteName}.</p>

              {visitorStats?.showVisitorStats && (
                <div
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/80 border border-border text-[10.5px] sm:text-[11px] text-muted-foreground"
                  title="Thống kê lượt truy cập thực tế"
                >
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                    <span>
                      Online:{" "}
                      <strong className="font-semibold text-emerald-400 tabular-nums">
                        {visitorStats.onlineCount.toLocaleString("vi-VN")}
                      </strong>
                    </span>
                  </span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3 text-primary shrink-0" aria-hidden="true" />
                    <span>
                      Tổng:{" "}
                      <strong className="font-semibold text-foreground tabular-nums">
                        {visitorStats.totalVisits.toLocaleString("vi-VN")}
                      </strong>
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] sm:text-xs">
              <Link
                href="/dieu-khoan-dich-vu"
                className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Điều khoản
              </Link>
              <Link
                href="/chinh-sach-bao-hanh"
                className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Bảo hành &amp; Hoàn tiền
              </Link>
              <Link
                href="/chinh-sach-bao-mat"
                className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Bảo vệ dữ liệu
              </Link>
            </div>
          </div>

          <p className="text-[10.5px] sm:text-[11px] text-muted-foreground/70 leading-snug sm:leading-relaxed pr-12 sm:pr-0">
            <span className="text-muted-foreground font-medium">Miễn trừ trách nhiệm:</span>{" "}
            {settings.siteName} là nền tảng phân phối dịch vụ số độc lập. Tên gọi, logo và hình ảnh bên thứ ba thuộc quyền sở hữu của các tổ chức tương ứng và chỉ dùng để mô tả sản phẩm.
          </p>
        </div>
      </div>
    </footer>
  )
}
