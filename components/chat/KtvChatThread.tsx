"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  Send,
  ImagePlus,
  Copy,
  Check,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  CheckCheck,
  Volume2,
  VolumeX,
} from "lucide-react"
import type { ChatSender, KtvChatMessageDto } from "@/lib/ktv-chat"
import {
  ensureAudioUnlocked,
  isNotificationSoundMuted,
  playChatMessageSound,
  setNotificationSoundMuted,
} from "@/lib/sound-notify"

export function ChatSoundToggle({
  viewer,
  className = "",
}: {
  viewer: ChatSender
  className?: string
}) {
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    ensureAudioUnlocked()
    const t = setTimeout(() => {
      setMuted(isNotificationSoundMuted())
    }, 0)
    const onStorageSync = () => setMuted(isNotificationSoundMuted())
    window.addEventListener("capygo-sound-pref-changed", onStorageSync)
    return () => {
      clearTimeout(t)
      window.removeEventListener("capygo-sound-pref-changed", onStorageSync)
    }
  }, [])

  const handleToggle = () => {
    const nextMuted = !muted
    setMuted(nextMuted)
    setNotificationSoundMuted(nextMuted)
    window.dispatchEvent(new Event("capygo-sound-pref-changed"))
    if (!nextMuted) {
      playChatMessageSound(viewer, true)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
        muted
          ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/10"
          : "text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25"
      } ${className}`}
      title={muted ? "Âm thanh thông báo đang tắt — bấm để bật" : "Âm thanh thông báo đang bật — bấm để tắt"}
      aria-label={muted ? "Bật âm thanh thông báo" : "Tắt âm thanh thông báo"}
    >
      {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
      <span className="hidden sm:inline">{muted ? "Tắt tiếng" : "Chuông"}</span>
    </button>
  )
}

interface KtvChatThreadProps {
  viewer: ChatSender
  fetchUrl: string
  postUrl: string
  uploadUrl: string
  deleteBaseUrl?: string
  accentColor?: string
  onUnauthorized?: () => void
  onUnreadUpdate?: (count: number) => void
  onUserActivity?: () => void
}

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso)
    const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    const day = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
    return `${time} · ${day}`
  } catch {
    return ""
  }
}

export function KtvChatThread({
  viewer,
  fetchUrl,
  postUrl,
  uploadUrl,
  deleteBaseUrl,
  accentColor = "#E6A66F",
  onUnauthorized,
  onUnreadUpdate,
  onUserActivity,
}: KtvChatThreadProps) {
  const [messages, setMessages] = useState<KtvChatMessageDto[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KtvChatMessageDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const listEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastCountRef = useRef(0)
  const initializedRef = useRef(false)
  const lastIncomingIdRef = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`${fetchUrl}?markRead=1&t=${Date.now()}`, { cache: "no-store" })
      if (res.status === 401) {
        onUnauthorized?.()
        return
      }
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        const next: KtvChatMessageDto[] = Array.isArray(json.messages) ? json.messages : []
        const latestIncoming = [...next].reverse().find((m) => m.sender !== viewer) || null

        if (!initializedRef.current) {
          initializedRef.current = true
          lastIncomingIdRef.current = latestIncoming?.id || null
        } else if (latestIncoming && latestIncoming.id !== lastIncomingIdRef.current) {
          lastIncomingIdRef.current = latestIncoming.id
          playChatMessageSound(viewer)
        }

        setMessages(next)
        onUnreadUpdate?.(json.unreadCount || 0)
        if (next.length > lastCountRef.current) {
          setTimeout(scrollToBottom, 60)
        }
        lastCountRef.current = next.length
      }
    } catch {
      // keep existing messages
    } finally {
      setLoading(false)
    }
  }, [fetchUrl, onUnauthorized, onUnreadUpdate, scrollToBottom, viewer])

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void loadMessages()
    }, 0)
    const timer = setInterval(() => {
      void loadMessages()
    }, 2500)
    return () => {
      clearTimeout(initTimer)
      clearInterval(timer)
    }
  }, [loadMessages])

  const uploadFile = async (file: File) => {
    if (uploadingImage) return
    onUserActivity?.()
    setUploadingImage(true)
    setErrorMsg(null)

    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: form,
      })
      if (res.status === 401) {
        onUnauthorized?.()
        return
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success || !json.url) {
        setErrorMsg(json.error || "Không thể tải ảnh lên")
        return
      }
      setPendingImageUrl(json.url)
    } catch {
      setErrorMsg("Lỗi kết nối khi tải ảnh")
    } finally {
      setUploadingImage(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) void uploadFile(file)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          void uploadFile(file)
          return
        }
      }
    }
  }

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (sending || uploadingImage) return
    const text = draft.trim()
    if (!text && !pendingImageUrl) return

    onUserActivity?.()
    setSending(true)
    setErrorMsg(null)

    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || null,
          imageUrl: pendingImageUrl,
        }),
      })
      if (res.status === 401) {
        onUnauthorized?.()
        return
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success || !json.message) {
        setErrorMsg(json.error || "Không thể gửi tin nhắn")
        return
      }

      setDraft("")
      setPendingImageUrl(null)
      setMessages((prev) => [...prev, json.message])
      lastCountRef.current += 1
      setTimeout(scrollToBottom, 50)
    } catch {
      setErrorMsg("Lỗi kết nối máy chủ khi gửi")
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onUserActivity?.()
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteBaseUrl || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`${deleteBaseUrl}/${deleteTarget.id}`, { method: "DELETE" })
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id))
        setDeleteTarget(null)
      } else {
        const json = await res.json().catch(() => ({}))
        setErrorMsg(json.error || "Không thể xóa tin nhắn")
        setDeleteTarget(null)
      }
    } catch {
      setErrorMsg("Lỗi kết nối khi xóa")
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages timeline */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" />
            <span>Đang tải tin nhắn...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-xs text-zinc-400 space-y-1.5">
            <p className="font-semibold text-zinc-200">Chưa có tin nhắn nào</p>
            <p>Nhắn trực tiếp hoặc dán/tải ảnh bill chuyển khoản (Ctrl+V) để trao đổi nhanh ngay tại đây.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender === viewer
            const readByOther = viewer === "admin" ? msg.isReadByKtv : msg.isReadByAdmin
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-zinc-400">
                  <span className="font-semibold">
                    {isMine ? "Bạn" : msg.sender === "admin" ? msg.senderLabel || "Admin" : msg.senderLabel || "KTV"}
                  </span>
                  <span>·</span>
                  <span>{formatMessageTime(msg.createdAt)}</span>
                </div>

                <div className="group flex items-end gap-1.5 max-w-[85%]">
                  {isMine && deleteBaseUrl && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(msg)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-rose-400 transition-opacity cursor-pointer"
                      title="Xóa tin nhắn"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}

                  {isMine && msg.message && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.message || "")}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-zinc-200 transition-opacity cursor-pointer"
                      title="Sao chép"
                    >
                      {copiedId === msg.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    </button>
                  )}

                  <div
                    style={isMine ? { backgroundColor: accentColor, color: "#090A0C" } : undefined}
                    className={`rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm space-y-2 ${
                      isMine
                        ? "rounded-br-sm font-medium"
                        : "rounded-bl-sm bg-zinc-800/90 border border-white/10 text-zinc-100"
                    }`}
                  >
                    {msg.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(msg.imageUrl)}
                        className="block overflow-hidden rounded-xl border border-black/15 cursor-zoom-in"
                      >
                        <img
                          src={msg.imageUrl}
                          alt="Ảnh đính kèm trong chat"
                          className="max-h-52 w-auto object-contain bg-black/20"
                        />
                      </button>
                    )}

                    {msg.message && (
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    )}
                  </div>

                  {!isMine && msg.message && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.message || "")}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-zinc-200 transition-opacity cursor-pointer"
                      title="Sao chép"
                    >
                      {copiedId === msg.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    </button>
                  )}

                  {!isMine && deleteBaseUrl && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(msg)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-rose-400 transition-opacity cursor-pointer"
                      title="Xóa tin nhắn"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>

                {isMine && (
                  <span className="mt-0.5 px-1 text-[10px] text-zinc-500 flex items-center gap-0.5">
                    <CheckCheck className={`size-3 ${readByOther ? "text-emerald-400" : "text-zinc-500"}`} />
                    <span>{readByOther ? "Đã xem" : "Đã gửi"}</span>
                  </span>
                )}
              </div>
            )
          })
        )}
        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="border-t border-white/10 bg-zinc-950/90 p-3 space-y-2 shrink-0"
      >
        {errorMsg && (
          <div className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[11px] flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="cursor-pointer">
              <X className="size-3" />
            </button>
          </div>
        )}

        {pendingImageUrl && (
          <div className="relative inline-flex items-center gap-2 p-1.5 rounded-xl border border-white/15 bg-zinc-900">
            <img
              src={pendingImageUrl}
              alt="Ảnh chuẩn bị gửi"
              className="h-14 w-14 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={() => setPendingImageUrl(null)}
              className="size-6 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 cursor-pointer"
              title="Bỏ ảnh này"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            disabled={uploadingImage}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-white/15 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 shrink-0 cursor-pointer disabled:opacity-50"
            title="Chọn ảnh từ máy (hoặc dán Ctrl+V)"
          >
            {uploadingImage ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          </button>

          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Nhập tin nhắn (Enter gửi, Ctrl+V dán ảnh)..."
            className="flex-1 max-h-28 min-h-[40px] px-3 py-2 rounded-xl border border-white/15 bg-zinc-900 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60 resize-none"
          />

          <button
            type="submit"
            disabled={sending || uploadingImage || (!draft.trim() && !pendingImageUrl)}
            style={{ backgroundColor: accentColor, color: "#090A0C" }}
            className="inline-flex h-10 px-3.5 items-center justify-center gap-1.5 rounded-xl text-xs font-black shrink-0 hover:opacity-90 disabled:opacity-40 cursor-pointer"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span>Gửi</span>
          </button>
        </div>
      </form>

      {/* Lightbox Image Preview */}
      {previewImageUrl &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setPreviewImageUrl(null)}
          >
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
              aria-label="Đóng ảnh"
            >
              <X className="size-5" />
            </button>
            <img
              src={previewImageUrl}
              alt="Xem ảnh phóng to"
              className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}

      {/* Delete Message Confirmation */}
      {deleteTarget &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-xs rounded-2xl border border-rose-500/40 bg-zinc-950 p-4 space-y-3 text-xs text-white shadow-2xl">
              <h4 className="font-bold text-rose-300 flex items-center gap-1.5 text-sm">
                <Trash2 className="size-4" />
                <span>Xóa tin nhắn này?</span>
              </h4>
              <p className="text-zinc-400">Tin nhắn sẽ bị xóa khỏi đoạn chat của cả Admin và KTV.</p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 rounded-lg border border-white/15 text-zinc-300 hover:bg-white/10 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmDelete}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {deleting ? "Đang xóa..." : "Xóa"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
