"use client"

import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  Volume2,
  VolumeX,
  Music,
  Play,
  Upload,
  Check,
  X,
  Loader2,
  Trash2,
  AlertCircle,
  MessageCircle,
  ShoppingBag,
} from "lucide-react"
import type { ChatSender } from "@/lib/ktv-chat"
import {
  ensureAudioUnlocked,
  getChannelSoundPreferences,
  playSoundForChannel,
  saveChannelSoundPreferences,
  SOUND_PRESETS,
  type SoundChannel,
  type SoundPreferences,
  type SoundPresetId,
} from "@/lib/sound-notify"

export function ChatSoundToggle({
  viewer,
  channel = "chat",
  label,
  className = "",
}: {
  viewer: ChatSender
  channel?: SoundChannel
  label?: string
  className?: string
}) {
  const [chatPrefs, setChatPrefs] = useState<SoundPreferences>(() =>
    getChannelSoundPreferences("chat")
  )
  const [orderPrefs, setOrderPrefs] = useState<SoundPreferences>(() =>
    getChannelSoundPreferences("order")
  )
  const [modalChannel, setModalChannel] = useState<SoundChannel>(channel)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ensureAudioUnlocked()
    const syncAll = () => {
      setChatPrefs(getChannelSoundPreferences("chat"))
      setOrderPrefs(getChannelSoundPreferences("order"))
    }
    const syncTimer = setTimeout(syncAll, 0)
    window.addEventListener("capygo-sound-pref-changed", syncAll)
    return () => {
      clearTimeout(syncTimer)
      window.removeEventListener("capygo-sound-pref-changed", syncAll)
    }
  }, [])

  const activeButtonPrefs = channel === "order" ? orderPrefs : chatPrefs
  const activeModalPrefs = modalChannel === "order" ? orderPrefs : chatPrefs

  const setPrefsForChannel = (target: SoundChannel, next: SoundPreferences) => {
    if (target === "order") setOrderPrefs(next)
    else setChatPrefs(next)
  }

  const handleToggleChannelMute = (target: SoundChannel) => {
    const curr = target === "order" ? orderPrefs : chatPrefs
    const next = saveChannelSoundPreferences(target, { muted: !curr.muted })
    setPrefsForChannel(target, next)
    if (!next.muted) {
      playSoundForChannel(target, { viewer, force: true })
    }
  }

  const handleSelectPreset = (presetId: SoundPresetId) => {
    const next = saveChannelSoundPreferences(modalChannel, {
      preset: presetId,
      muted: false,
    })
    setPrefsForChannel(modalChannel, next)
    playSoundForChannel(modalChannel, {
      viewer,
      preset: presetId,
      customUrl: next.customUrl,
      volume: next.volume,
      force: true,
    })
  }

  const handleUploadCustomSound = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || uploading) return

    const targetChannel = modalChannel
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/uploads/sounds", {
        method: "POST",
        body: form,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success || !json.url) {
        setUploadError(json.error || "Không thể tải file âm thanh")
        return
      }

      const next = saveChannelSoundPreferences(targetChannel, {
        preset: "custom",
        muted: false,
        customUrl: json.url,
        customName: json.name || file.name,
      })
      setPrefsForChannel(targetChannel, next)
      playSoundForChannel(targetChannel, {
        viewer,
        preset: "custom",
        customUrl: next.customUrl,
        volume: next.volume,
        force: true,
      })
    } catch {
      setUploadError("Lỗi kết nối máy chủ khi tải file âm thanh")
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveCustom = () => {
    const next = saveChannelSoundPreferences(modalChannel, {
      preset:
        activeModalPrefs.preset === "custom"
          ? modalChannel === "order"
            ? "ding"
            : "chime"
          : activeModalPrefs.preset,
      customUrl: null,
      customName: null,
    })
    setPrefsForChannel(modalChannel, next)
  }

  const buttonText =
    label || (channel === "order" ? "Chuông đơn" : "Chuông chat")

  return (
    <>
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={() => handleToggleChannelMute(channel)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
            activeButtonPrefs.muted
              ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/10 border border-white/10"
              : "text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25"
          }`}
          title={
            activeButtonPrefs.muted
              ? `${buttonText} đang tắt — bấm để bật`
              : `${buttonText} đang bật — bấm để tắt`
          }
          aria-label={activeButtonPrefs.muted ? `Bật ${buttonText}` : `Tắt ${buttonText}`}
        >
          {activeButtonPrefs.muted ? (
            <VolumeX className="size-3.5" />
          ) : (
            <Volume2 className="size-3.5" />
          )}
          <span className="hidden sm:inline">
            {activeButtonPrefs.muted ? "Tắt tiếng" : buttonText}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setModalChannel(channel)
            setUploadError(null)
            setPickerOpen(true)
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-[11px] font-semibold text-zinc-200 transition-colors cursor-pointer"
          title="Cài đặt riêng âm thanh Tin nhắn và âm thanh Chốt đơn"
        >
          <Music className="size-3 text-amber-400" />
          <span className="hidden sm:inline">Đổi âm</span>
        </button>
      </div>

      {pickerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Cấu hình âm thanh riêng"
              className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 text-white shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-900/70">
                <div className="flex items-center gap-2">
                  <Music className="size-4 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold">Cấu Hình Âm Thanh Riêng</h3>
                    <p className="text-[11px] text-zinc-400">
                      Tùy chỉnh độc lập âm thanh Tin nhắn và âm thanh Chốt đơn / Đơn mới
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Channel Tabs: Tin nhắn vs Chốt đơn */}
              <div className="grid grid-cols-2 gap-1.5 p-3 pb-0 bg-zinc-900/30">
                <button
                  type="button"
                  onClick={() => {
                    setModalChannel("chat")
                    setUploadError(null)
                  }}
                  className={`flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    modalChannel === "chat"
                      ? "bg-amber-400 text-black border-amber-300 shadow-xs"
                      : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <MessageCircle className="size-3.5" />
                  <span>Âm thanh Tin nhắn</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalChannel("order")
                    setUploadError(null)
                  }}
                  className={`flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    modalChannel === "order"
                      ? "bg-emerald-400 text-black border-emerald-300 shadow-xs"
                      : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <ShoppingBag className="size-3.5" />
                  <span>Âm thanh Chốt đơn</span>
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
                <div className="px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-[11px] text-zinc-300">
                  {modalChannel === "chat" ? (
                    <span>
                      Áp dụng khi có <strong className="text-amber-300">tin nhắn chat mới</strong> giữa Admin và KTV.
                    </span>
                  ) : (
                    <span>
                      Áp dụng khi <strong className="text-emerald-300">nhập đơn / nhận đơn mới / chốt đối soát</strong> của KTV &amp; Admin.
                    </span>
                  )}
                </div>

                {/* Volume Slider */}
                <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">
                      Âm lượng ({Math.round(activeModalPrefs.volume * 100)}%)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleChannelMute(modalChannel)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md cursor-pointer ${
                        activeModalPrefs.muted
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {activeModalPrefs.muted ? "Kênh này đang tắt" : "Kênh này đang bật"}
                    </button>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(activeModalPrefs.volume * 100)}
                    onChange={(e) => {
                      const nextVol = Number(e.target.value) / 100
                      const next = saveChannelSoundPreferences(modalChannel, { volume: nextVol })
                      setPrefsForChannel(modalChannel, next)
                    }}
                    onMouseUp={() => playSoundForChannel(modalChannel, { viewer, force: true })}
                    onTouchEnd={() => playSoundForChannel(modalChannel, { viewer, force: true })}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                {/* Built-in Presets */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Âm thanh có sẵn
                  </p>
                  <div className="space-y-1.5">
                    {SOUND_PRESETS.map((preset) => {
                      const active = activeModalPrefs.preset === preset.id
                      return (
                        <div
                          key={preset.id}
                          className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-colors ${
                            active
                              ? "border-amber-400/60 bg-amber-500/10"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectPreset(preset.id)}
                            className="flex-1 text-left cursor-pointer min-w-0"
                          >
                            <div className="flex items-center gap-1.5">
                              {active && <Check className="size-3.5 text-amber-400 shrink-0" />}
                              <span className="font-bold text-white truncate">{preset.label}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {preset.description}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              playSoundForChannel(modalChannel, {
                                viewer,
                                preset: preset.id,
                                volume: activeModalPrefs.volume,
                                force: true,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 bg-black/40 hover:bg-white/10 text-[11px] font-semibold shrink-0 cursor-pointer"
                            title="Nghe thử"
                          >
                            <Play className="size-3 text-amber-400" />
                            <span>Thử</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Custom Audio Upload */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    File âm thanh riêng cho mục này (MP3, WAV, OGG, M4A ≤ 2MB)
                  </p>

                  {uploadError && (
                    <div className="p-2.5 rounded-xl border border-rose-500/35 bg-rose-500/15 text-rose-200 flex items-center gap-1.5">
                      <AlertCircle className="size-4 shrink-0 text-rose-400" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {activeModalPrefs.customUrl && (
                    <div
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                        activeModalPrefs.preset === "custom"
                          ? "border-amber-400/60 bg-amber-500/10"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectPreset("custom")}
                        className="flex-1 text-left min-w-0 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          {activeModalPrefs.preset === "custom" && (
                            <Check className="size-3.5 text-amber-400 shrink-0" />
                          )}
                          <span className="font-bold text-emerald-300 truncate">
                            {activeModalPrefs.customName || "File âm thanh tùy chọn"}
                          </span>
                        </div>
                        <span className="text-[10.5px] text-zinc-400 block mt-0.5">
                          Bấm để chọn làm chuông {modalChannel === "order" ? "Chốt đơn" : "Tin nhắn"}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            playSoundForChannel(modalChannel, {
                              viewer,
                              preset: "custom",
                              customUrl: activeModalPrefs.customUrl,
                              volume: activeModalPrefs.volume,
                              force: true,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 bg-black/40 hover:bg-white/10 text-[11px] font-semibold cursor-pointer"
                        >
                          <Play className="size-3 text-emerald-400" />
                          <span>Thử</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveCustom}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                          title="Xóa file âm thanh này"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,.mp3,.wav,.ogg,.m4a,.webm"
                    onChange={handleUploadCustomSound}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-10 rounded-xl border border-dashed border-amber-400/50 bg-amber-500/5 hover:bg-amber-500/15 text-amber-300 font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Đang tải âm thanh lên...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="size-4" />
                        <span>
                          {activeModalPrefs.customUrl
                            ? "Đổi file âm thanh khác cho mục này"
                            : `Tải file âm thanh ${
                                modalChannel === "order" ? "Chốt đơn" : "Tin nhắn"
                              } từ máy`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end px-5 py-3 border-t border-white/10 bg-zinc-900/50">
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black cursor-pointer"
                >
                  Xong
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
