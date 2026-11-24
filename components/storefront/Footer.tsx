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
    <footer className="border-t border-border bg-card text-foreground mt-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {/* Main Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Brand */}
          <div className="space-y-2 max-w-md">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-secondary border border-border text-xs font-bold text-primary tracking-wider overflow-hidden shrink-0">
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
              <span className="font-heading font-bold text-base tracking-tight text-foreground">
                {settings.siteName}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cửa hàng tài khoản, phần mềm, dịch vụ nâng cấp và API phục vụ công việc, sáng tạo và học tập.
            </p>
          </div>

          {/* Navigation & Support */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/san-pham"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              Sản phẩm
            </Link>
            <Link
              href="/lookup"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              Tra cứu đơn
            </Link>
            <Link
              href="/#how"
              onClick={(e) => handleNavScroll(e, "how")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              Hướng dẫn
            </Link>
            <Link
              href="/#faq"
              onClick={(e) => handleNavScroll(e, "faq")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              FAQ
            </Link>
            <a
              href={`https://zalo.me/${cleanZaloPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 text-sm font-medium transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageCircle className="size-4 shrink-0" />
              <span>Liên hệ Zalo</span>
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-3.5 rounded-xl border border-border bg-background/60 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground/90 font-medium">Miễn trừ trách nhiệm:</strong>{" "}
          {settings.siteName} là nền tảng phân phối dịch vụ số độc lập. Tên gọi, logo và hình ảnh của các thương hiệu bên thứ ba thuộc quyền sở hữu của các tổ chức tương ứng và chỉ dùng cho mục đích mô tả sản phẩm.
        </div>

        {/* Bottom Row */}
        <div className="border-t border-border pt-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <p>© {currentYear} {settings.siteName}. Bảo lưu mọi quyền.</p>

            {visitorStats?.showVisitorStats && (
              <div
                className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-secondary border border-border text-xs text-muted-foreground"
                title="Thống kê lượt truy cập thực tế"
              >
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  <span>
                    Đang truy cập:{" "}
                    <strong className="font-semibold text-emerald-400 tabular-nums">
                      {visitorStats.onlineCount.toLocaleString("vi-VN")}
                    </strong>
                  </span>
                </span>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3.5 text-primary shrink-0" aria-hidden="true" />
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

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <Link
              href="/dieu-khoan-dich-vu"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Điều khoản dịch vụ
            </Link>
            <Link
              href="/chinh-sach-bao-hanh"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Chính sách bảo hành &amp; Hoàn tiền
            </Link>
            <Link
              href="/chinh-sach-bao-mat"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Bảo vệ dữ liệu cá nhân
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
