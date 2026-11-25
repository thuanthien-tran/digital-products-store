"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, ShoppingBag, Search, HelpCircle, MessageCircle } from "lucide-react"

const ZALO_PHONE = (process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964").replace(/\D/g, "")

interface HeaderProps {
  initialSettings?: {
    siteName: string
    logoUrl: string | null
    initials: string
  } | null
}

export function Header({ initialSettings }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Smooth scroll-aware glass elevation without changing header height
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 12
      setIsScrolled((prev) => (prev === next ? prev : next))
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const [settings, setSettings] = useState(
    () =>
      initialSettings || {
        siteName: process.env.NEXT_PUBLIC_STORE_NAME || "CAPYGO",
        logoUrl: null,
        initials: "CG",
      }
  )

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

  // Close on Escape, trap focus inside mobile drawer, and lock body scroll cleanly
  useEffect(() => {
    if (!mobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const drawerEl = drawerRef.current
    const focusableSelectors =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusables = drawerEl
      ? Array.from(drawerEl.querySelectorAll<HTMLElement>(focusableSelectors))
      : []

    focusables[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false)
        menuButtonRef.current?.focus()
        return
      }

      if (e.key === "Tab" && focusables.length > 0) {
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [mobileMenuOpen])

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
    { href: "/san-pham", label: "Sản phẩm", icon: ShoppingBag },
    { href: "/lookup", label: "Tra cứu đơn", icon: Search },
    { href: "/#faq", label: "Hỗ trợ", icon: HelpCircle },
  ]

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-[background-color,border-color,box-shadow] duration-[210ms] ${
        isScrolled
          ? "border-border bg-background/88 backdrop-blur-md shadow-[0_8px_24px_-16px_rgba(0,0,0,0.75)]"
          : "border-border/60 bg-background/95 backdrop-blur-xs"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Logo */}
        <Link
          href="/"
          onClick={(e) => handleNavClick(e, "/")}
          className="flex items-center gap-3 shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-card border border-border text-xs font-bold text-primary tracking-wider overflow-hidden shrink-0 transition-btn group-hover:border-primary/50">
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
          <span className="font-heading font-bold text-base tracking-tight text-foreground group-hover:text-primary transition-colors duration-150 whitespace-nowrap">
            {settings.siteName}
          </span>
        </Link>

        {/* Center/Right: Navigation (Flex layout — never overlaps on medium screens) */}
        <div className="hidden md:flex items-center gap-1 lg:gap-2 min-w-0">
          <nav className="flex items-center gap-1" aria-label="Điều hướng chính">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/san-pham"
                  ? pathname.startsWith("/san-pham")
                  : link.href === "/lookup"
                  ? pathname.startsWith("/lookup")
                  : false
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`px-3.5 py-2 text-sm font-medium rounded-xl transition-btn whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "bg-secondary text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="h-4 w-px bg-border mx-1.5" aria-hidden="true" />

          <a
            href={`https://zalo.me/${ZALO_PHONE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-border bg-card hover:bg-secondary hover:border-primary/40 text-sm font-medium text-foreground transition-btn whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageCircle className="size-4 text-primary shrink-0" />
            <span>Zalo hỗ trợ</span>
          </a>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="md:hidden inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-drawer"
          aria-label={mobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          ref={drawerRef}
          role="dialog"
          aria-label="Menu điều hướng di động"
          className="md:hidden border-b border-border bg-card px-4 py-4 space-y-1.5 animate-fade-in"
        >
          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive =
              link.href === "/san-pham"
                ? pathname.startsWith("/san-pham")
                : link.href === "/lookup"
                ? pathname.startsWith("/lookup")
                : false
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`flex items-center gap-3 min-h-[44px] px-3.5 py-2.5 text-sm font-medium rounded-xl transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? "bg-secondary text-foreground font-semibold border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                }`}
              >
                <Icon className="size-4 text-primary shrink-0" strokeWidth={1.75} />
                <span>{link.label}</span>
              </Link>
            )
          })}

          <div className="pt-2 mt-2 border-t border-border">
            <a
              href={`https://zalo.me/${ZALO_PHONE}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between min-h-[44px] px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium text-foreground hover:border-primary/40 transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2.5">
                <MessageCircle className="size-4 text-primary shrink-0" />
                <span>Nhắn tin Zalo hỗ trợ</span>
              </span>
              <span className="text-xs text-primary font-semibold">Mở ↗</span>
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
