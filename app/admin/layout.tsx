"use client"

import { useState } from "react"
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
} from "lucide-react"
import { NotificationBell } from "@/components/admin/NotificationBell"
import { ChangePasswordModal } from "@/components/admin/ChangePasswordModal"
import { AdminAutoLogoutListener } from "@/components/admin/AdminAutoLogoutListener"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)

  if (pathname === "/admin/login") {
    return <>{children}</>
  }

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" })
    router.push("/admin/login")
    router.refresh()
  }

  const navItems = [
    { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/admin/products", label: "Sản phẩm", icon: Package },
    { href: "/admin/price-list", label: "Bảng giá & Menu", icon: FileSpreadsheet },
    { href: "/admin/sources", label: "Danh mục nguồn", icon: Layers },
    { href: "/admin/providers", label: "Đại lý & Kết nối", icon: Globe },
    { href: "/admin/serials", label: "Kho Serials", icon: KeyRound },
    { href: "/admin/orders", label: "Đơn hàng", icon: ShoppingBag },
    { href: "/admin/coupons", label: "Mã giảm giá", icon: Ticket },
    { href: "/admin/settings", label: "Cài đặt website", icon: Settings },
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-full md:w-60 border-b md:border-b-0 md:border-r border-border bg-card p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-5">
          <div className="flex items-center gap-2.5 px-2 pt-1">
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary border border-border text-xs font-bold text-primary">
              CG
            </span>
            <div className="min-w-0">
              <span className="font-heading font-bold text-sm text-foreground block leading-tight">
                CAPYGO Admin
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Quản trị hệ thống
              </span>
            </div>
          </div>

          <nav className="space-y-1 text-sm" aria-label="Menu quản trị">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl font-medium transition-btn ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                  }`}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-border space-y-1 mt-6 md:mt-0 text-sm">
          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn text-left"
          >
            <KeyRound className="size-4 text-primary shrink-0" />
            <span>Đổi mật khẩu</span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span>Về cửa hàng</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-destructive hover:bg-destructive/10 transition-btn text-left"
          >
            <LogOut className="size-4 shrink-0" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto min-w-0">
        <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <span className="text-xs text-muted-foreground font-semibold tracking-wide">
              Bảng điều khiển hệ thống
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-medium text-foreground transition-btn"
                title="Đổi mật khẩu tài khoản"
              >
                <KeyRound className="size-3.5 text-primary" />
                <span className="hidden sm:inline">Đổi mật khẩu</span>
              </button>
              <NotificationBell />
            </div>
          </div>
          {children}
        </div>
      </main>

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
