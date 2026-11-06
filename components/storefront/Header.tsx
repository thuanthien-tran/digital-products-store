"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, ShoppingBag, BookOpen, HelpCircle, Phone, Home } from "lucide-react"

interface HeaderProps {
  initialSettings?: {
    siteName: string
    logoUrl: string | null
    initials: string
  } | null
}

export function Header({ initialSettings }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

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

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Handle hash scrolling when arriving from another page or hash changes
  useEffect(() => {
    if (typeof window === "undefined") return

    const scrollToHash = () => {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      const element = document.getElementById(hash)
      if (element) {
        requestAnimationFrame(() => {
          element.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          })
        })
      }
    }

    scrollToHash()
    window.addEventListener("hashchange", scrollToHash)
    return () => window.removeEventListener("hashchange", scrollToHash)
  }, [pathname])

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setMobileMenuOpen(false)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

    if (href === "/" && pathname === "/") {
      e.preventDefault()
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })
      return
    }

    if (href.startsWith("/#")) {
      const targetId = href.replace("/#", "")
      if (pathname === "/") {
        e.preventDefault()
        const element = document.getElementById(targetId)
        if (element) {
          element.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          })
          window.history.pushState(null, "", `#${targetId}`)
        }
      }
    }
  }

  const navLinks = [
    { href: "/", label: "Trang chủ", icon: Home },
    { href: "/san-pham", label: "Sản phẩm & Gói", icon: ShoppingBag },
    { href: "/#how", label: "Hướng dẫn mua hàng", icon: BookOpen },
    { href: "/#faq", label: "Hỗ trợ & FAQ", icon: HelpCircle },
  ]

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 relative ${
        scrolled
          ? "border-b border-border/80 bg-background/80 backdrop-blur-xl shadow-lg shadow-black/40"
          : "border-b border-border/40 bg-background/60 backdrop-blur-md"
      }`}
    >
      {/* Vệt ánh sáng gradient loang tinh tế ở đáy viền Header (Phong cách Vercel/Apple Studio) */}
      <div
        className={`pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] w-3/5 max-w-4xl bg-gradient-to-r from-transparent via-caramel/50 to-transparent transition-opacity duration-500 ${
          scrolled ? "opacity-100" : "opacity-40"
        }`}
      />

      <div className="mx-auto flex h-18 sm:h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-8 lg:px-12 relative">
        {/* [KHỐI TRÁI]: Logo Thương Hiệu Cửa Hàng */}
        <div className="flex items-center gap-3.5 shrink-0 z-10">
          <Link href="/" className="flex items-center gap-3.5 group active-bounce">
            <span className="flex size-11 sm:size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary via-card to-secondary border border-border/80 text-sm font-bold text-accent tracking-wider shadow-md transition-all duration-300 group-hover:scale-105 group-hover:border-accent/60 group-hover:shadow-xl group-hover:shadow-caramel/20 overflow-hidden">
              {settings.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logoUrl}
                  alt={settings.siteName}
                  className="size-full object-cover rounded-2xl"
                />
              ) : (
                settings.initials
              )}
            </span>
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-base sm:text-lg tracking-tight text-foreground transition-colors duration-200 group-hover:text-accent">
                {settings.siteName}
              </span>
            </div>
          </Link>
        </div>

        {/* [KHỐI GIỮA]: Menu Điều Hướng Căn Giữa Tuyệt Đối + Hiệu Ứng Underline Glow */}
        <nav
          className="hidden md:flex items-center gap-1 lg:gap-2 absolute left-1/2 -translate-x-1/2 z-10"
          aria-label="Điều hướng chính"
        >
          {navLinks.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`group relative px-4 py-2.5 text-xs lg:text-sm font-medium transition-all duration-200 rounded-xl active-bounce ${
                  isActive
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                <span>{link.label}</span>

                {/* Đường kẻ phát sáng Neon Underline mở rộng từ tâm khi Hover hoặc Active */}
                <span
                  className={`absolute bottom-0.5 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-caramel via-caramel-light to-caramel transition-all duration-300 ease-out origin-center ${
                    isActive
                      ? "scale-x-100 opacity-100 shadow-[0_0_10px_rgba(230,166,111,0.6)]"
                      : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100 group-hover:shadow-[0_0_8px_rgba(230,166,111,0.4)]"
                  }`}
                />
              </Link>
            )
          })}
        </nav>

        {/* [KHỐI PHẢI]: Hotline Hỗ trợ, Badge Trạng Thái Tự Động 24/7 & Nút Menu Mobile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-10">
          {/* Hotline / Zalo Support Link */}
          <a
            href="https://zalo.me/0356970964"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 hover:bg-secondary border border-border/80 hover:border-caramel/50 text-xs font-medium text-muted-foreground hover:text-caramel-light transition-all backdrop-blur shadow-sm group"
            title="Nhắn tin Zalo hỗ trợ: 0356 970 964"
          >
            <Phone className="size-3 text-caramel group-hover:scale-110 transition-transform" />
            <span>Hỗ trợ: <strong className="font-semibold text-foreground group-hover:text-caramel-light tabular-nums">0356 970 964</strong></span>
          </a>

          {/* Badge Hệ Thống Tự Động Online */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/30 border border-emerald-500/20 text-xs font-medium text-emerald-400 backdrop-blur shadow-sm">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Tự động 24/7</span>
          </div>

          {/* Nút Hamburger Mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active-bounce focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu với hiệu ứng kính mờ và chia khối */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card/95 backdrop-blur-xl px-5 py-5 space-y-2 animate-fade-down shadow-2xl">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/50 text-xs text-muted-foreground">
            <span>Danh mục điều hướng</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Hệ thống online</span>
            </div>
          </div>

          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                  isActive
                    ? "bg-caramel/15 text-caramel-light font-semibold border border-caramel/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className={`size-4 ${isActive ? "text-caramel" : "text-accent"}`} strokeWidth={1.75} />
                <span>{link.label}</span>
              </Link>
            )
          })}

          <div className="pt-2 border-t border-border/40">
            <a
              href="https://zalo.me/0356970964"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/70 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 text-caramel" />
                <span>Hỗ trợ Zalo:</span>
                <span className="font-bold text-foreground tabular-nums">0356 970 964</span>
              </div>
              <span className="text-[11px] text-caramel font-semibold">Nhắn tin ↗</span>
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
