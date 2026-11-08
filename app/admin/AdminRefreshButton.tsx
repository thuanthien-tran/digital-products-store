"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export function AdminRefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [lastUpdated, setLastUpdated] = useState<string>("")

  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
  }, [])

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
      setLastUpdated(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    })
  }

  // Tự động làm mới dữ liệu mỗi 45 giây khi tab đang active
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        startTransition(() => {
          router.refresh()
          setLastUpdated(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
        })
      }
    }, 45000)

    return () => clearInterval(interval)
  }, [router])

  return (
    <div className="flex items-center gap-3">
      {lastUpdated && (
        <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
          Cập nhật lúc: <span className="font-mono text-foreground/80">{lastUpdated}</span>
        </span>
      )}
      <button
        onClick={handleRefresh}
        disabled={isPending}
        title="Làm mới số liệu tức thì"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 text-xs font-semibold text-foreground/90 transition-all duration-200 active:scale-95 disabled:opacity-60 shadow-sm cursor-pointer"
      >
        <RefreshCw className={`size-3.5 text-primary ${isPending ? "animate-spin text-primary" : ""}`} />
        <span>{isPending ? "Đang tải..." : "Làm mới"}</span>
      </button>
    </div>
  )
}
