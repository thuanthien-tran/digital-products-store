"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { OfficeCapybara } from "@/components/storefront/OfficeCapybara"

const ZALO_PHONE = process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964"

interface FooterProps {
  initialSettings?: {
    siteName: string
    logoUrl: string | null
    initials: string
  }
}

export function Footer({ initialSettings }: FooterProps) {
  const currentYear = new Date().getFullYear()
  const pathname = usePathname()
  const cleanZaloPhone = ZALO_PHONE.replace(/\D/g, "")

  const [settings, setSettings] = useState(() => initialSettings || {
    siteName: process.env.NEXT_PUBLIC_STORE_NAME || "ACCGIARE",
    logoUrl: null,
    initials: "AG",
  })

  useEffect(() => {
    if (!initialSettings) {
      fetch("/api/site-settings")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.siteName) {
            setSettings({
              siteName: data.siteName,
              logoUrl: data.logoUrl || null,
              initials: data.initials || "AG",
            })
          }
        })
        .catch(() => {})
    }
  }, [initialSettings])

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
    <footer className="border-t border-border/60 bg-[#101416] text-foreground mt-16 sm:mt-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 lg:px-12 py-8 sm:py-10 space-y-6 sm:space-y-8">
        {/* HÀNG CHÍNH */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 sm:gap-8">
          {/* Nhóm bên trái: Capybara pixel art & Thương hiệu */}
          <div className="flex items-center gap-3.5 sm:gap-5">
            <OfficeCapybara />

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-7 sm:size-8 items-center justify-center rounded-lg bg-secondary border border-border text-xs font-bold text-accent tracking-wider shadow-xs overflow-hidden">
                  {settings.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={settings.logoUrl}
                      alt={settings.siteName}
                      className="size-full object-cover rounded-lg"
                    />
                  ) : (
                    settings.initials
                  )}
                </span>
                <span className="font-heading font-black text-base sm:text-lg tracking-tight text-foreground">
                  {settings.siteName}
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-muted-foreground/90 max-w-sm sm:max-w-md leading-relaxed">
                Tài khoản và phần mềm phục vụ công việc, sáng tạo và học tập.
              </p>
            </div>
          </div>

          {/* Nhóm bên phải: Điều hướng & Nút Zalo */}
          <div className="flex flex-wrap items-center gap-x-5 sm:gap-x-6 gap-y-3 pt-2 lg:pt-0">
            <Link
              href="/#products"
              onClick={(e) => handleNavScroll(e, "products")}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md transition-colors duration-150"
            >
              Sản phẩm
            </Link>

            <Link
              href="/#how"
              onClick={(e) => handleNavScroll(e, "how")}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md transition-colors duration-150"
            >
              Hướng dẫn mua hàng
            </Link>

            <Link
              href="/#faq"
              onClick={(e) => handleNavScroll(e, "faq")}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md transition-colors duration-150"
            >
              FAQ
            </Link>

            <a
              href={`https://zalo.me/${cleanZaloPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl border border-teal-500/50 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 hover:border-teal-400 hover:text-teal-200 text-xs sm:text-sm font-medium transition-all duration-150 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
            >
              <MessageCircle className="size-4 shrink-0 text-teal-400" />
              <span>Liên hệ Zalo</span>
            </a>
          </div>
        </div>

        {/* HÀNG CUỐI: Đường phân cách mảnh, Bản quyền & Chính sách */}
        <div className="border-t border-border/50 pt-5 sm:pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs text-muted-foreground">
          <p>© {currentYear} {settings.siteName}</p>

          <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 text-xs">
            <Link
              href="/#faq"
              onClick={(e) => handleNavScroll(e, "faq")}
              className="hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded transition-colors duration-150"
            >
              Điều khoản dịch vụ
            </Link>
            <Link
              href="/#faq"
              onClick={(e) => handleNavScroll(e, "faq")}
              className="hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded transition-colors duration-150"
            >
              Chính sách bảo hành
            </Link>
            <Link
              href="/#faq"
              onClick={(e) => handleNavScroll(e, "faq")}
              className="hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded transition-colors duration-150"
            >
              Chính sách bảo mật
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
