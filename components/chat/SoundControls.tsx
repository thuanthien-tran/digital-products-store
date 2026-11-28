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
} from "lucide-react"
import type { ChatSender } from "@/lib/ktv-chat"
import {
  ensureAudioUnlocked,
  getSoundPreferences,
  playNotificationSound,
  saveSoundPreferences,
  SOUND_PRESETS,
  type SoundPreferences,
  type SoundPresetId,
} from "@/lib/sound-notify"

export function ChatSoundToggle({
  viewer,
  className = "",
}: {
  viewer: ChatSender
  className?: string
}) {
  const [prefs, setPrefs] = useState<SoundPreferences>({
    muted: false,
    preset: "chime",
    volume: 0.75,
    customUrl: null,
    customName: null,
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ensureAudioUnlocked()
    const syncTimer = setTimeout(() => {
      setPrefs(getSoundPreferences())
    }, 0)
    const onChange = () => setPrefs(getSoundPreferences())
    window.addEventListener("capygo-sound-pref-changed", onChange)
    return () => {
      clearTimeout(syncTimer)
      window.removeEventListener("capygo-sound-pref-changed", onChange)
    }
  }, [])

  const role = viewer === "admin" ? "admin_chat" : "ktv_chat"

  const handleToggleMute = () => {
    const next = saveSoundPreferences({ muted: !prefs.muted })
    setPrefs(next)
    if (!next.muted) {
      playNotificationSound(role, { force: true })
    }
  }

  const handleSelectPreset = (presetId: SoundPresetId) => {
    const next = saveSoundPreferences({ preset: presetId, muted: false })
    setPrefs(next)
    playNotificationSound(role, {
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

      const next = saveSoundPreferences({
        preset: "custom",
        muted: false,
        customUrl: json.url,
        customName: json.name || file.name,
      })
      setPrefs(next)
      playNotificationSound(role, {
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
    const next = saveSoundPreferences({
      preset: prefs.preset === "custom" ? "chime" : prefs.preset,
      customUrl: null,
      customName: null,
    })
    setPrefs(next)
  }

  return (
    <>
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={handleToggleMute}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
            prefs.muted
              ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/10"
              : "text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25"
          }`}
          title={prefs.muted ? "Âm thanh đang tắt — bấm để bật" : "Âm thanh đang bật — bấm để tắt"}
          aria-label={prefs.muted ? "Bật âm thanh" : "Tắt âm thanh"}
        >
          {prefs.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          <span className="hidden sm:inline">{prefs.muted ? "Tắt tiếng" : "Chuông"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setUploadError(null)
            setPickerOpen(true)
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-[11px] font-semibold text-zinc-200 transition-colors cursor-pointer"
          title="Chọn kiểu âm thanh thông báo hoặc tải nhạc chuông riêng"
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
              aria-label="Tùy chỉnh âm thanh thông báo"
              className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 text-white shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-900/70">
                <div className="flex items-center gap-2">
                  <Music className="size-4 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold">Âm Thanh Thông Báo Tùy Chọn</h3>
                    <p className="text-[11px] text-zinc-400">
                      Chọn kiểu chuông có sẵn hoặc tải lên file nhạc chuông riêng
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

              <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                {/* Volume Slider */}
                <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">
                      Âm lượng chuông ({Math.round(prefs.volume * 100)}%)
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md cursor-pointer ${
                        prefs.muted
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {prefs.muted ? "Đang tắt tiếng" : "Đang bật"}
                    </button>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(prefs.volume * 100)}
                    onChange={(e) => {
                      const nextVol = Number(e.target.value) / 100
                      const next = saveSoundPreferences({ volume: nextVol })
                      setPrefs(next)
                    }}
                    onMouseUp={() => playNotificationSound(role, { force: true })}
                    onTouchEnd={() => playNotificationSound(role, { force: true })}
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
                      const active = prefs.preset === preset.id
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
                              playNotificationSound(role, {
                                preset: preset.id,
                                volume: prefs.volume,
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
                    Âm thanh riêng của bạn (MP3, WAV, OGG, M4A ≤ 2MB)
                  </p>

                  {uploadError && (
                    <div className="p-2.5 rounded-xl border border-rose-500/35 bg-rose-500/15 text-rose-200 flex items-center gap-1.5">
                      <AlertCircle className="size-4 shrink-0 text-rose-400" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {prefs.customUrl && (
                    <div
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                        prefs.preset === "custom"
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
                          {prefs.preset === "custom" && (
                            <Check className="size-3.5 text-amber-400 shrink-0" />
                          )}
                          <span className="font-bold text-emerald-300 truncate">
                            {prefs.customName || "File âm thanh tùy chọn"}
                          </span>
                        </div>
                        <span className="text-[10.5px] text-zinc-400 block mt-0.5">
                          Bấm để dùng file này làm chuông thông báo
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            playNotificationSound(role, {
                              preset: "custom",
                              customUrl: prefs.customUrl,
                              volume: prefs.volume,
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
                          title="Xóa âm thanh riêng"
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
                          {prefs.customUrl
                            ? "Đổi file âm thanh khác từ máy"
                            : "Tải file âm thanh của bạn lên"}
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
