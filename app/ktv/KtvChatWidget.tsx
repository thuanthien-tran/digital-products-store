"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { MessageCircle, X } from "lucide-react"
import type { ThemeConfig } from "@/lib/ktv"
import { ChatSoundToggle, KtvChatThread } from "@/components/chat/KtvChatThread"
import { ensureAudioUnlocked, playChatMessageSound } from "@/lib/sound-notify"

interface KtvChatWidgetProps {
  activeTheme: ThemeConfig
  onSessionExpired: () => void
  onActivity: () => void
}

export function KtvChatWidget({
  activeTheme,
  onSessionExpired,
  onActivity,
}: KtvChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const prevUnreadRef = useRef<number | null>(null)

  const accent = activeTheme.accentColor || "#E6A66F"

  const pollUnread = useCallback(async () => {
    try {
      const res = await fetch(`/api/ctv/chat?summaryOnly=1&t=${Date.now()}`, { cache: "no-store" })
      if (res.status === 401) {
        onSessionExpired()
        return
      }
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        const nextUnread = Number(json.unreadCount || 0)
        if (prevUnreadRef.current !== null && nextUnread > prevUnreadRef.current) {
          playChatMessageSound("ktv")
        }
        prevUnreadRef.current = nextUnread
        setUnreadCount(nextUnread)
      }
    } catch {
      // silent
    }
  }, [onSessionExpired])

  useEffect(() => {
    ensureAudioUnlocked()
  }, [])

  useEffect(() => {
    if (isOpen) return
    const initTimer = setTimeout(() => {
      void pollUnread()
    }, 0)
    const timer = setInterval(() => {
      void pollUnread()
    }, 8000)
    return () => {
      clearTimeout(initTimer)
      clearInterval(timer)
    }
  }, [isOpen, pollUnread])

  const handleOpen = () => {
    onActivity()
    setIsOpen(true)
    prevUnreadRef.current = 0
    setUnreadCount(0)
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <>
      {/* Floating launcher button */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleOpen}
          style={{ backgroundColor: accent, color: "#090A0C" }}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 h-12 px-4 rounded-full font-black text-xs sm:text-sm shadow-[0_12px_30px_rgba(0,0,0,0.45)] hover:scale-[1.03] active:scale-[0.98] transition-transform cursor-pointer"
        >
          <MessageCircle className="size-4 stroke-[2.5]" />
          <span>Chat Admin</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Floating chat panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Chat trực tiếp với Admin"
          className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[390px] h-[520px] max-h-[80vh] rounded-2xl border border-white/20 bg-zinc-950/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0"
            style={{ backgroundColor: `${activeTheme.containerBg}f0` }}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-flex size-8 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}25`, color: accent }}
              >
                <MessageCircle className="size-4" />
              </span>
              <div>
                <h3 className="text-xs font-black text-white">Chat trực tiếp với Admin</h3>
                <p className="text-[10px] text-zinc-400">Hỗ trợ gửi chữ &amp; ảnh bill (Ctrl+V)</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <ChatSoundToggle viewer="ktv" />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Thu gọn khung chat"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <KtvChatThread
              viewer="ktv"
              fetchUrl="/api/ctv/chat"
              postUrl="/api/ctv/chat"
              uploadUrl="/api/ctv/chat/upload"
              accentColor={accent}
              onUnauthorized={onSessionExpired}
              onUnreadUpdate={setUnreadCount}
              onUserActivity={onActivity}
            />
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
