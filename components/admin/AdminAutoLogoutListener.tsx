"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, LogOut } from "lucide-react"

// 10 minutes timeout in milliseconds
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000
// Warning threshold: show warning modal 60s before logout
const WARNING_BEFORE_LOGOUT_MS = 60 * 1000

export function AdminAutoLogoutListener() {
  const router = useRouter()
  const lastActivityRef = useRef<number>(Date.now())
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const isLoggingOutRef = useRef<boolean>(false)

  const performLogout = useCallback(async (reason: "timeout" = "timeout") => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true

    try {
      await fetch("/api/admin/auth", { method: "DELETE" })
    } catch {
      // Non-blocking
    } finally {
      // Clear client storage if any
      try {
        localStorage.removeItem("admin_last_activity")
      } catch {}
      // Redirect to login with reason
      router.push(`/admin/login?reason=${reason}`)
      router.refresh()
    }
  }, [router])

  // Track user activity
  const resetTimer = useCallback(() => {
    const now = Date.now()
    lastActivityRef.current = now
    try {
      localStorage.setItem("admin_last_activity", String(now))
    } catch {}
    // If warning was showing, dismiss it
    if (secondsRemaining !== null) {
      setSecondsRemaining(null)
    }
  }, [secondsRemaining])

  useEffect(() => {
    // Initial sync with localStorage (in case user was active in another tab)
    const stored = localStorage.getItem("admin_last_activity")
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now()) {
        lastActivityRef.current = parsed
      }
    }

    const events: (keyof WindowEventMap)[] = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ]

    // Throttle event handlers to reduce CPU overhead
    let lastHandled = 0
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastHandled > 2000) {
        lastHandled = now
        resetTimer()
      }
    }

    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }))

    // Cross-tab synchronization via storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "admin_last_activity" && e.newValue) {
        const val = parseInt(e.newValue, 10)
        if (!isNaN(val)) {
          lastActivityRef.current = val
          setSecondsRemaining(null)
        }
      }
    }
    window.addEventListener("storage", handleStorage)

    // Interval check every second
    const interval = setInterval(() => {
      // Check latest from storage in case another tab updated it
      let effectiveLastActivity = lastActivityRef.current
      try {
        const s = localStorage.getItem("admin_last_activity")
        if (s) {
          const p = parseInt(s, 10)
          if (!isNaN(p) && p > effectiveLastActivity) {
            effectiveLastActivity = p
            lastActivityRef.current = p
          }
        }
      } catch {}

      const elapsed = Date.now() - effectiveLastActivity
      const timeLeft = INACTIVITY_TIMEOUT_MS - elapsed

      if (timeLeft <= 0) {
        clearInterval(interval)
        performLogout("timeout")
      } else if (timeLeft <= WARNING_BEFORE_LOGOUT_MS) {
        setSecondsRemaining(Math.ceil(timeLeft / 1000))
      } else {
        setSecondsRemaining(null)
      }
    }, 1000)

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity))
      window.removeEventListener("storage", handleStorage)
      clearInterval(interval)
    }
  }, [performLogout, resetTimer])

  // If not in warning state, render nothing
  if (secondsRemaining === null) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-card p-6 shadow-2xl space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-4 ring-amber-500/20">
          <AlertCircle className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">Cảnh báo hết phiên đăng nhập</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Bạn đã không hoạt động trong một khoảng thời gian. Để đảm bảo an toàn, hệ thống sẽ tự động đăng xuất sau:
          </p>
        </div>
        <div className="py-2">
          <span className="font-mono text-3xl font-black text-amber-500">
            {secondsRemaining}s
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => performLogout("timeout")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="size-3.5" />
            Đăng xuất ngay
          </button>
          <button
            type="button"
            onClick={resetTimer}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition-all shadow-md shadow-primary/20"
          >
            Tiếp tục làm việc
          </button>
        </div>
      </div>
    </div>
  )
}
