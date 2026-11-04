"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Bell,
  CheckCheck,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  FileText,
  ArrowRight,
  Filter,
} from "lucide-react"
import Link from "next/link"

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  metadata?: string | null
  link?: string | null
  isRead: boolean
  createdAt: string
}

type TabType = "all" | "price" | "new" | "warning"

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/admin/notifications")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {
      // silent
    }
  }

  useEffect(() => {
    void fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const markAllAsRead = async () => {
    try {
      await fetch("/api/admin/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      // silent
    }
  }

  const markOneAsRead = async (id: string) => {
    try {
      await fetch("/api/admin/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silent
    }
  }

  // Handle Bell Click: Open dropdown & automatically clear badge count
  const handleToggleOpen = () => {
    const nextState = !isOpen
    setIsOpen(nextState)
    if (nextState && unreadCount > 0) {
      // Auto mark all as read on open so the badge disappears
      void markAllAsRead()
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "new_product":
        return <Sparkles className="size-4 text-emerald-400 shrink-0" />
      case "price_change":
        return <TrendingUp className="size-4 text-amber-400 shrink-0" />
      case "desc_change":
        return <FileText className="size-4 text-blue-400 shrink-0" />
      case "discontinued":
      case "stock_status":
      case "sync_error":
        return <AlertTriangle className="size-4 text-rose-400 shrink-0" />
      default:
        return <AlertCircle className="size-4 text-muted-foreground shrink-0" />
    }
  }

  // Filter notifications by tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === "price") {
      return notifications.filter((n) => n.type === "price_change")
    }
    if (activeTab === "new") {
      return notifications.filter((n) => n.type === "new_product")
    }
    if (activeTab === "warning") {
      return notifications.filter(
        (n) => n.type === "discontinued" || n.type === "sync_error" || n.type === "desc_change"
      )
    }
    return notifications
  }, [notifications, activeTab])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className="relative p-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
        aria-label="Thông báo quản trị"
        title={unreadCount > 0 ? `Có ${unreadCount} thông báo mới` : "Thông báo hệ thống"}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse shadow-md">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-[420px] rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 flex flex-col max-h-[520px]">
          {/* Header */}
          <div className="p-3.5 border-b border-border/80 flex items-center justify-between bg-secondary/30">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="size-3.5 text-primary" />
                Thông Báo Quản Trị
              </span>
              {unreadCount > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold">
                  {unreadCount} mới
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium">
                  Đã xem hết
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-secondary transition-colors font-medium"
              title="Đánh dấu tất cả thông báo trong kho là đã đọc"
            >
              <CheckCheck className="size-3 text-primary" />
              <span>Đọc tất cả</span>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-border/60 bg-secondary/10 px-2 py-1 gap-1 text-[11px] overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors shrink-0 ${
                activeTab === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("price")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors shrink-0 ${
                activeTab === "price"
                  ? "bg-amber-500 text-black shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              Biến động giá ({notifications.filter((n) => n.type === "price_change").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors shrink-0 ${
                activeTab === "new"
                  ? "bg-emerald-500 text-black shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              Sản phẩm mới ({notifications.filter((n) => n.type === "new_product").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("warning")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors shrink-0 ${
                activeTab === "warning"
                  ? "bg-rose-500 text-white shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              Cảnh báo
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/50 text-xs">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-1">
                <Filter className="size-6 mx-auto opacity-30 mb-1" />
                <p className="font-medium">Không có thông báo nào trong mục này</p>
                <p className="text-[11px] opacity-70">Các thông báo mới từ đại lý sẽ hiển thị ở đây</p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 flex gap-3 hover:bg-secondary/40 transition-colors ${
                    !n.isRead ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={`text-xs leading-snug ${
                          !n.isRead
                            ? "font-bold text-foreground"
                            : "font-medium text-foreground/85"
                        }`}
                      >
                        {n.title}
                      </h4>
                      {!n.isRead && (
                        <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                      <span>{new Date(n.createdAt).toLocaleString("vi-VN")}</span>
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => {
                            if (!n.isRead) void markOneAsRead(n.id)
                            setIsOpen(false)
                          }}
                          className="text-primary hover:underline flex items-center gap-0.5 font-bold"
                        >
                          <span>Xem chi tiết</span>
                          <ArrowRight className="size-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
