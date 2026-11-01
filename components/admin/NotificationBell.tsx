"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, CheckCheck, Sparkles, TrendingUp, AlertTriangle, AlertCircle, FileText, ArrowRight } from "lucide-react"
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

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/notifications")
        if (res.ok && mounted) {
          const data = await res.json()
          setNotifications(data.notifications || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch {
        // silent
      }
    }

    void poll()
    const interval = setInterval(poll, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
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

  const markAsRead = async (id?: string) => {
    try {
      await fetch("/api/admin/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      })
      if (id) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        setUnreadCount(0)
      }
    } catch {
      // silent
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
        return <AlertTriangle className="size-4 text-rose-400 shrink-0" />
      default:
        return <AlertCircle className="size-4 text-muted-foreground shrink-0" />
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
        aria-label="Thông báo quản trị"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="p-3.5 border-b border-border/80 flex items-center justify-between bg-secondary/30">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-foreground uppercase tracking-wider">
                Thông Báo Quản Trị
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-semibold">
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAsRead()}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="size-3" />
                <span>Đọc tất cả</span>
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/50 text-xs">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Bell className="size-8 mx-auto mb-2 opacity-30" />
                <p>Không có thông báo mới</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 flex gap-3 hover:bg-secondary/40 transition-colors ${
                    !n.isRead ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-xs leading-snug ${!n.isRead ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                        {n.title}
                      </h4>
                      {!n.isRead && (
                        <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground">
                      <span>{new Date(n.createdAt).toLocaleString("vi-VN")}</span>
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => {
                            if (!n.isRead) markAsRead(n.id)
                            setIsOpen(false)
                          }}
                          className="text-primary hover:underline flex items-center gap-0.5 font-medium"
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
