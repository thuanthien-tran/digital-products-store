"use client"

export type SoundPresetId = "chime" | "ding" | "pop" | "marimba" | "urgent" | "custom"
export type SoundChannel = "chat" | "order"

export interface SoundPresetMeta {
  id: SoundPresetId
  label: string
  description: string
}

export const SOUND_PRESETS: SoundPresetMeta[] = [
  {
    id: "chime",
    label: "Chuông pha lê",
    description: "2 nốt nhẹ nhàng, êm tai khi làm việc lâu",
  },
  {
    id: "ding",
    label: "Ting Ting (Thu ngân)",
    description: "Âm thanh sắc gọn giống thông báo nhận tiền / chốt đơn",
  },
  {
    id: "pop",
    label: "Bong bóng (Messenger)",
    description: "Tiếng bật ngắn gọn, quen thuộc khi nhắn tin",
  },
  {
    id: "marimba",
    label: "Nhạc chuông 3 nốt ấm",
    description: "Giai điệu 3 nốt rõ ràng, dễ nhận biết",
  },
  {
    id: "urgent",
    label: "Chuông dồn nổi bật",
    description: "Kêu 2 nhịp liên tiếp để không bỏ sót tin/đơn quan trọng",
  },
]

const CHANNEL_STORAGE_KEYS: Record<SoundChannel, string> = {
  chat: "capygo_sound_channel_chat_v1",
  order: "capygo_sound_channel_order_v1",
}

const VALID_PRESETS: SoundPresetId[] = ["chime", "ding", "pop", "marimba", "urgent", "custom"]
const SAFE_CUSTOM_SOUND_REGEX = /^\/api\/uploads\/sounds\/sound-[a-f0-9-]+\.(mp3|wav|ogg|m4a|webm)$/i

export interface SoundPreferences {
  muted: boolean
  preset: SoundPresetId
  volume: number // 0.1 .. 1.0
  customUrl: string | null
  customName: string | null
}

function getDefaultPreferencesForChannel(channel: SoundChannel): SoundPreferences {
  if (channel === "order") {
    return {
      muted: false,
      preset: "ding",
      volume: 0.85,
      customUrl: null,
      customName: null,
    }
  }
  return {
    muted: false,
    preset: "chime",
    volume: 0.75,
    customUrl: null,
    customName: null,
  }
}

const globalForAudio = globalThis as unknown as {
  __capygoAudioCtx?: AudioContext
  __capygoAudioUnlockBound?: boolean
  __capygoActiveAudio?: HTMLAudioElement | null
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!globalForAudio.__capygoAudioCtx) {
    globalForAudio.__capygoAudioCtx = new Ctor()
  }
  return globalForAudio.__capygoAudioCtx
}

export function ensureAudioUnlocked(): void {
  if (typeof window === "undefined") return
  if (globalForAudio.__capygoAudioUnlockBound) return
  globalForAudio.__capygoAudioUnlockBound = true

  const unlock = () => {
    const ctx = getAudioContext()
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => {})
    }
  }

  window.addEventListener("pointerdown", unlock, { passive: true })
  window.addEventListener("keydown", unlock, { passive: true })
}

function normalizeSoundPreferences(raw: Partial<SoundPreferences> | null, channel: SoundChannel): SoundPreferences {
  const defaults = getDefaultPreferencesForChannel(channel)
  if (!raw || typeof raw !== "object") return defaults

  const muted = typeof raw.muted === "boolean" ? raw.muted : defaults.muted
  const rawPreset = raw.preset
  const preset: SoundPresetId =
    rawPreset && VALID_PRESETS.includes(rawPreset) ? rawPreset : defaults.preset
  const rawVol = Number(raw.volume)
  const volume = Number.isFinite(rawVol) ? Math.min(1, Math.max(0.1, rawVol)) : defaults.volume
  const customUrl =
    typeof raw.customUrl === "string" && SAFE_CUSTOM_SOUND_REGEX.test(raw.customUrl)
      ? raw.customUrl
      : null
  const customName = typeof raw.customName === "string" && raw.customName ? raw.customName : null

  return {
    muted,
    preset: preset === "custom" && !customUrl ? defaults.preset : preset,
    volume,
    customUrl,
    customName,
  }
}

export function getChannelSoundPreferences(channel: SoundChannel): SoundPreferences {
  const defaults = getDefaultPreferencesForChannel(channel)
  if (typeof window === "undefined") return defaults

  try {
    const rawJson = localStorage.getItem(CHANNEL_STORAGE_KEYS[channel])
    if (rawJson) {
      return normalizeSoundPreferences(JSON.parse(rawJson) as Partial<SoundPreferences>, channel)
    }

    // One-time legacy migration into the chat channel if user previously saved a sound before separation
    if (channel === "chat") {
      const legacyPreset = localStorage.getItem("capygo_sound_preset") as SoundPresetId | null
      const legacyCustomUrl = localStorage.getItem("capygo_sound_custom_url")
      if (legacyPreset || legacyCustomUrl) {
        return normalizeSoundPreferences(
          {
            muted: localStorage.getItem("capygo_notify_sound_muted") === "1",
            preset: legacyPreset || defaults.preset,
            volume: parseFloat(localStorage.getItem("capygo_sound_volume") || "0.75"),
            customUrl: legacyCustomUrl,
            customName: localStorage.getItem("capygo_sound_custom_name"),
          },
          channel
        )
      }
    }
    return defaults
  } catch {
    return defaults
  }
}

export function saveChannelSoundPreferences(
  channel: SoundChannel,
  patch: Partial<SoundPreferences>
): SoundPreferences {
  const current = getChannelSoundPreferences(channel)
  const next = normalizeSoundPreferences({ ...current, ...patch }, channel)

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHANNEL_STORAGE_KEYS[channel], JSON.stringify(next))
      window.dispatchEvent(new Event("capygo-sound-pref-changed"))
    } catch {}
  }

  return next
}

function playToneSequence(
  notes: Array<{ freq: number; startOffset: number; duration: number; volume: number; type?: OscillatorType }>,
  masterVolume: number
): void {
  if (typeof window === "undefined") return
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {})
  }

  const baseTime = ctx.currentTime + 0.015
  for (const note of notes) {
    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = note.type || "sine"
      osc.frequency.setValueAtTime(note.freq, baseTime + note.startOffset)

      const targetVol = Math.max(0.01, Math.min(0.6, note.volume * masterVolume))
      gain.gain.setValueAtTime(0.0001, baseTime + note.startOffset)
      gain.gain.exponentialRampToValueAtTime(targetVol, baseTime + note.startOffset + 0.014)
      gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + note.startOffset + note.duration)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(baseTime + note.startOffset)
      osc.stop(baseTime + note.startOffset + note.duration + 0.025)
    } catch {
      // Ignore Web Audio errors in locked contexts
    }
  }
}

function playSynthPreset(preset: Exclude<SoundPresetId, "custom">, volume: number, isKtv: boolean): void {
  const shift = isKtv ? 1.12 : 1

  switch (preset) {
    case "ding":
      playToneSequence(
        [
          { freq: 1318.51 * shift, startOffset: 0, duration: 0.16, volume: 0.22, type: "sine" },
          { freq: 1760.0 * shift, startOffset: 0.12, duration: 0.3, volume: 0.24, type: "sine" },
        ],
        volume
      )
      return
    case "pop":
      playToneSequence(
        [
          { freq: 520 * shift, startOffset: 0, duration: 0.07, volume: 0.25, type: "sine" },
          { freq: 920 * shift, startOffset: 0.045, duration: 0.09, volume: 0.26, type: "triangle" },
        ],
        volume
      )
      return
    case "marimba":
      playToneSequence(
        [
          { freq: 587.33 * shift, startOffset: 0, duration: 0.12, volume: 0.2, type: "triangle" },
          { freq: 783.99 * shift, startOffset: 0.1, duration: 0.12, volume: 0.22, type: "triangle" },
          { freq: 1046.5 * shift, startOffset: 0.2, duration: 0.24, volume: 0.24, type: "sine" },
        ],
        volume
      )
      return
    case "urgent":
      playToneSequence(
        [
          { freq: 880 * shift, startOffset: 0, duration: 0.1, volume: 0.24, type: "triangle" },
          { freq: 1174.66 * shift, startOffset: 0.1, duration: 0.1, volume: 0.25, type: "triangle" },
          { freq: 880 * shift, startOffset: 0.24, duration: 0.1, volume: 0.24, type: "triangle" },
          { freq: 1318.51 * shift, startOffset: 0.34, duration: 0.2, volume: 0.28, type: "sine" },
        ],
        volume
      )
      return
    case "chime":
    default:
      playToneSequence(
        [
          { freq: 659.25 * shift, startOffset: 0, duration: 0.14, volume: 0.22, type: "sine" },
          { freq: 987.77 * shift, startOffset: 0.11, duration: 0.25, volume: 0.24, type: "triangle" },
        ],
        volume
      )
  }
}

export function playSoundForChannel(
  channel: SoundChannel,
  override?: {
    viewer?: "admin" | "ktv"
    preset?: SoundPresetId
    customUrl?: string | null
    volume?: number
    force?: boolean
  }
): void {
  const prefs = getChannelSoundPreferences(channel)
  if (!override?.force && prefs.muted) return

  const preset = override?.preset || prefs.preset
  const volume = override?.volume ?? prefs.volume
  const customUrl = override?.customUrl !== undefined ? override.customUrl : prefs.customUrl
  const isKtv = override?.viewer === "ktv"

  if (preset === "custom" && customUrl && SAFE_CUSTOM_SOUND_REGEX.test(customUrl)) {
    try {
      if (globalForAudio.__capygoActiveAudio) {
        globalForAudio.__capygoActiveAudio.pause()
        globalForAudio.__capygoActiveAudio.currentTime = 0
      }
      const audio = new Audio(customUrl)
      audio.volume = Math.min(1, Math.max(0.1, volume))
      globalForAudio.__capygoActiveAudio = audio
      void audio.play().catch(() => {
        playSynthPreset(channel === "order" ? "ding" : "chime", volume, isKtv)
      })
      return
    } catch {
      // Fallback to built-in synth preset
    }
  }

  const synthId: Exclude<SoundPresetId, "custom"> =
    preset === "custom" ? (channel === "order" ? "ding" : "chime") : preset

  playSynthPreset(synthId, volume, isKtv)
}

export function playChatMessageSound(viewer: "admin" | "ktv", force = false): void {
  playSoundForChannel("chat", { viewer, force })
}

export function playOrderSound(viewer: "admin" | "ktv" = "admin", force = false): void {
  playSoundForChannel("order", { viewer, force })
}

export function playAdminAlertSound(force = false): void {
  playSoundForChannel("order", { viewer: "admin", force })
}

export function playNotificationSound(
  role: "admin_chat" | "ktv_chat" | "admin_alert" | "ktv_order",
  override?: {
    preset?: SoundPresetId
    customUrl?: string | null
    volume?: number
    force?: boolean
  }
): void {
  const channel: SoundChannel =
    role === "admin_alert" || role === "ktv_order" ? "order" : "chat"
  const viewer: "admin" | "ktv" =
    role === "ktv_chat" || role === "ktv_order" ? "ktv" : "admin"

  playSoundForChannel(channel, { ...override, viewer })
}
