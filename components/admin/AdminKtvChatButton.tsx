"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { MessageCircle, X } from "lucide-react"
import { ChatSoundToggle, KtvChatThread } from "@/components/chat/KtvChatThread"
import { ensureAudioUnlocked, playChatMessageSound } from "@/lib/sound-notify"

export function AdminKtvChatButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const prevUnreadRef = useRef<number | null>(null)

  const pollUnread = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ktv-chat?summaryOnly=1&t=${Date.now()}`, {
        cache: "no-store",
      })
      if (!res.ok) return
      const json = await res.json().catch(() => ({}))
      if (json.success) {
        const nextUnread = Number(json.unreadCount || 0)
        if (prevUnreadRef.current !== null && nextUnread > prevUnreadRef.current) {
          playChatMessageSound("admin")
        }
        prevUnreadRef.current = nextUnread
        setUnreadCount(nextUnread)
      }
    } catch {
      // silent
    }
  }, [])

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

  useEffect(() => {
    const handleOpenEvent = () => {
      setIsOpen(true)
      prevUnreadRef.current = 0
      setUnreadCount(0)
    }
    window.addEventListener("capygo-open-ktv-chat", handleOpenEvent)
    return () => window.removeEventListener("capygo-open-ktv-chat", handleOpenEvent)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
          prevUnreadRef.current = 0
          setUnreadCount(0)
        }}
        className="relative inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-semibold text-foreground transition-btn cursor-pointer"
        title="Chat trực tiếp với KTV trên giao diện /ktv"
      >
        <MessageCircle className="size-3.5 text-primary" />
        <span className="hidden sm:inline">Chat KTV</span>
        {unreadCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Chat với KTV"
              className="relative z-10 w-full max-w-md h-full bg-zinc-950 border-l border-border shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-card shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary/15 border border-primary/30 text-primary">
                    <MessageCircle className="size-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Chat Trực Tiếp Với KTV</h2>
                    <p className="text-[11px] text-muted-foreground">
                      Đồng bộ tức thì sang màn hình /ktv · Hỗ trợ gửi ảnh (Ctrl+V)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <ChatSoundToggle viewer="admin" />
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                    aria-label="Đóng khung chat KTV"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <KtvChatThread
                  viewer="admin"
                  fetchUrl="/api/admin/ktv-chat"
                  postUrl="/api/admin/ktv-chat"
                  uploadUrl="/api/admin/ktv-chat/upload"
                  deleteBaseUrl="/api/admin/ktv-chat"
                  accentColor="#E6A66F"
                  onUnreadUpdate={setUnreadCount}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
