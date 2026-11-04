"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Package, KeyRound, ShoppingBag, LogOut, ArrowLeft, Layers, Globe, Settings } from "lucide-react"
import { NotificationBell } from "@/components/admin/NotificationBell"
import { ChangePasswordModal } from "@/components/admin/ChangePasswordModal"

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
    { href: "/admin/sources", label: "Danh mục nguồn", icon: Layers },
    { href: "/admin/providers", label: "Đại lý & Kết nối", icon: Globe },
    { href: "/admin/serials", label: "Kho Serials", icon: KeyRound },
    { href: "/admin/orders", label: "Đơn hàng", icon: ShoppingBag },
    { href: "/admin/settings", label: "Cài đặt website", icon: Settings },
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-full md:w-56 border-b md:border-b-0 md:border-r border-border bg-card p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2 pt-1">
            <span className="flex size-6 items-center justify-center rounded bg-secondary border border-border text-xs font-bold text-accent">
              AG
            </span>
            <span className="font-semibold text-sm text-foreground">Quản trị viên</span>
          </div>

          <nav className="space-y-1 text-xs" aria-label="Menu quản trị">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/30 font-semibold"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-border space-y-1 mt-6 md:mt-0 text-xs">
          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors text-left"
          >
            <KeyRound className="size-3.5 text-accent" />
            <span>Đổi mật khẩu</span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Về cửa hàng</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors text-left"
          >
            <LogOut className="size-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground font-mono">BẢNG ĐIỀU KHIỂN HỆ THỐNG</span>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/80 bg-secondary/50 hover:bg-secondary hover:border-primary/40 text-xs font-medium text-foreground transition-all"
                title="Đổi mật khẩu tài khoản"
              >
                <KeyRound className="size-3.5 text-accent" />
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
    </div>
  )
}
