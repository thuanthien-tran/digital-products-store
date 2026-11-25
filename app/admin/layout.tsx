"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  KeyRound,
  ShoppingBag,
  LogOut,
  ArrowLeft,
  Layers,
  Globe,
  Settings,
  Ticket,
  FileSpreadsheet,
  Menu,
  X,
} from "lucide-react"
import { NotificationBell } from "@/components/admin/NotificationBell"
import { ChangePasswordModal } from "@/components/admin/ChangePasswordModal"
import { AdminAutoLogoutListener } from "@/components/admin/AdminAutoLogoutListener"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  matchPrefixes?: string[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Kinh doanh",
    items: [
      { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
      { href: "/admin/orders", label: "Đơn hàng", icon: ShoppingBag, matchPrefixes: ["/admin/orders"] },
      { href: "/admin/products", label: "Sản phẩm", icon: Package, matchPrefixes: ["/admin/products"] },
      { href: "/admin/coupons", label: "Mã giảm giá", icon: Ticket, matchPrefixes: ["/admin/coupons"] },
    ],
  },
  {
    label: "Nguồn hàng",
    items: [
      {
        href: "/admin/sources",
        label: "Danh mục nguồn",
        icon: Layers,
        matchPrefixes: ["/admin/sources", "/admin/fatcat"],
      },
      { href: "/admin/providers", label: "Đại lý & Kết nối", icon: Globe, matchPrefixes: ["/admin/providers"] },
      { href: "/admin/serials", label: "Kho Serials", icon: KeyRound, matchPrefixes: ["/admin/serials"] },
    ],
  },
  {
    label: "Nội dung",
    items: [
      { href: "/admin/price-list", label: "Bảng giá & Menu", icon: FileSpreadsheet, matchPrefixes: ["/admin/price-list"] },
      { href: "/admin/settings", label: "Cài đặt website", icon: Settings, matchPrefixes: ["/admin/settings"] },
    ],
  },
]

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/admin") {
    return pathname === "/admin"
  }
  if (item.matchPrefixes && item.matchPrefixes.length > 0) {
    return item.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }
  return pathname === item.href
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Accessible mobile drawer: Escape close, focus trap, scroll lock
  useEffect(() => {
    if (!mobileDrawerOpen) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const drawerEl = drawerRef.current
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusables = drawerEl
      ? Array.from(drawerEl.querySelectorAll<HTMLElement>(selector))
      : []
    focusables[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileDrawerOpen(false)
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
      document.body.style.overflow = prevOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [mobileDrawerOpen])

  if (pathname === "/admin/login") {
    return <>{children}</>
  }

  const handleLogout = async () => {
    setMobileDrawerOpen(false)
    await fetch("/api/admin/auth", { method: "DELETE" })
    router.push("/admin/login")
    router.refresh()
  }

  const renderSidebarNavigation = (onNavigate?: () => void) => (
    <nav className="space-y-5" aria-label="Menu quản trị">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 block">
            {group.label}
          </span>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = isNavItemActive(pathname, item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2.5 min-h-[38px] px-3 py-2 rounded-xl text-[13.5px] font-medium transition-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                  }`}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const renderSidebarFooter = (onAction?: () => void) => (
    <div className="pt-4 border-t border-border space-y-1 text-[13.5px]">
      <Link
        href="/"
        onClick={onAction}
        className="flex items-center gap-2.5 min-h-[38px] px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn"
      >
        <ArrowLeft className="size-4 shrink-0" />
        <span>Về cửa hàng</span>
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center gap-2.5 min-h-[38px] px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-btn text-left cursor-pointer"
      >
        <LogOut className="size-4 shrink-0" />
        <span>Đăng xuất</span>
      </button>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop Sidebar (fixed width 240px, hidden on mobile) */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:justify-between border-r border-border bg-card p-4 shrink-0 sticky top-0 h-screen overflow-y-auto no-scrollbar">
        <div className="space-y-6">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-2 pt-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary border border-border text-xs font-bold text-primary shrink-0">
              CG
            </span>
            <div className="min-w-0">
              <span className="font-heading font-bold text-sm text-foreground block leading-tight truncate">
                CAPYGO Admin
              </span>
              <span className="text-xs text-muted-foreground block truncate">
                Bảng điều hành
              </span>
            </div>
          </Link>

          {renderSidebarNavigation()}
        </div>

        <div className="mt-6">{renderSidebarFooter()}</div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            aria-hidden="true"
            onClick={() => {
              setMobileDrawerOpen(false)
              menuButtonRef.current?.focus()
            }}
          />
          <div
            id="admin-mobile-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu điều hướng quản trị"
            className="relative z-10 w-72 max-w-[85vw] h-full bg-card border-r border-border p-4 flex flex-col justify-between overflow-y-auto animate-fade-in"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-secondary border border-border text-xs font-bold text-primary">
                    CG
                  </span>
                  <span className="font-heading font-bold text-sm text-foreground">
                    CAPYGO Admin
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false)
                    menuButtonRef.current?.focus()
                  }}
                  aria-label="Đóng menu quản trị"
                  className="inline-flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <X className="size-4" />
                </button>
              </div>

              {renderSidebarNavigation(() => setMobileDrawerOpen(false))}
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false)
                  setIsChangePasswordOpen(true)
                }}
                className="w-full flex items-center gap-2.5 min-h-[38px] px-3 py-2 rounded-xl text-[13.5px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn text-left"
              >
                <KeyRound className="size-4 text-primary shrink-0" />
                <span>Đổi mật khẩu</span>
              </button>
              {renderSidebarFooter(() => setMobileDrawerOpen(false))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Bar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/95 backdrop-blur-md px-4 md:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-expanded={mobileDrawerOpen}
              aria-controls="admin-mobile-drawer"
              aria-label="Mở menu quản trị"
              className="md:hidden inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn"
            >
              <Menu className="size-5" />
            </button>
            <span className="text-xs font-semibold text-muted-foreground truncate">
              Quản trị vận hành CAPYGO
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-medium text-foreground transition-btn cursor-pointer"
              title="Đổi mật khẩu tài khoản"
            >
              <KeyRound className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Đổi mật khẩu</span>
            </button>
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
          <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        currentUsername="thunthin"
      />

      {/* Auto logout on 10 minutes inactivity */}
      <AdminAutoLogoutListener />
    </div>
  )
}
