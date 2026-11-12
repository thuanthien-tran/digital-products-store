"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

export interface VisitorStatsPayload {
  onlineCount: number
  totalVisits: number
  todayVisits: number
  showVisitorStats: boolean
}

declare global {
  interface Window {
    __capygoVisitorStats?: VisitorStatsPayload
  }
}

const HEARTBEAT_INTERVAL_MS = 60_000
const MIN_PING_GAP_MS = 10_000

export function VisitorTracker() {
  const pathname = usePathname()
  const lastPingAtRef = useRef<number>(0)

  useEffect(() => {
    if (
      !pathname ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/ktv") ||
      pathname.startsWith("/bang-gia") ||
      pathname.startsWith("/ctv")
    ) return

    let cancelled = false

    const sendPing = async (force = false) => {
      if (cancelled) return
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return

      const now = Date.now()
      if (!force && now - lastPingAtRef.current < MIN_PING_GAP_MS) return
      lastPingAtRef.current = now

      try {
        const res = await fetch("/api/analytics/ping", {
          method: "POST",
          keepalive: true,
        })
        if (!res.ok || cancelled) return

        const data: VisitorStatsPayload = await res.json()
        window.__capygoVisitorStats = data
        window.dispatchEvent(
          new CustomEvent<VisitorStatsPayload>("capygo:visitor-stats", {
            detail: data,
          })
        )
      } catch {
        // Silent fail — analytics must never interrupt storefront UX
      }
    }

    void sendPing(false)

    const intervalId = window.setInterval(() => {
      void sendPing(true)
    }, HEARTBEAT_INTERVAL_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastPingAtRef.current
        if (elapsed >= HEARTBEAT_INTERVAL_MS - 15_000) {
          void sendPing(true)
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [pathname])

  return null
}
