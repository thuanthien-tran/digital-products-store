"use client"

export type SoundPresetId = "chime" | "ding" | "pop" | "marimba" | "urgent" | "custom"

export interface SoundPresetMeta {
  id: SoundPresetId
  label: string
  description: string
}

export const SOUND_PRESETS: SoundPresetMeta[] = [
  {
    id: "chime",
    label: "Chuông pha lê (Mặc định)",
    description: "2 nốt nhẹ nhàng, êm tai khi làm việc lâu",
  },
  {
    id: "ding",
    label: "Ting Ting (Thu ngân)",
    description: "Âm thanh sắc gọn giống thông báo nhận tiền",
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
    description: "Kêu 2 nhịp liên tiếp để không bỏ sót tin quan trọng",
  },
]

const MUTE_KEY = "capygo_notify_sound_muted"
const PRESET_KEY = "capygo_sound_preset"
const VOLUME_KEY = "capygo_sound_volume"
const CUSTOM_URL_KEY = "capygo_sound_custom_url"
const CUSTOM_NAME_KEY = "capygo_sound_custom_name"

const SAFE_CUSTOM_SOUND_REGEX = /^\/api\/uploads\/sounds\/sound-[a-f0-9-]+\.(mp3|wav|ogg|m4a|webm)$/i

export interface SoundPreferences {
  muted: boolean
  preset: SoundPresetId
  volume: number // 0.1 .. 1.0
  customUrl: string | null
  customName: string | null
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

export function getSoundPreferences(): SoundPreferences {
  if (typeof window === "undefined") {
    return {
      muted: false,
      preset: "chime",
      volume: 0.75,
      customUrl: null,
      customName: null,
    }
  }

  try {
    const muted = localStorage.getItem(MUTE_KEY) === "1"
    const rawPreset = localStorage.getItem(PRESET_KEY) as SoundPresetId | null
    const validPresets: SoundPresetId[] = ["chime", "ding", "pop", "marimba", "urgent", "custom"]
    const preset: SoundPresetId = rawPreset && validPresets.includes(rawPreset) ? rawPreset : "chime"
    const rawVol = parseFloat(localStorage.getItem(VOLUME_KEY) || "0.75")
    const volume = Number.isFinite(rawVol) ? Math.min(1, Math.max(0.1, rawVol)) : 0.75
    const rawCustomUrl = localStorage.getItem(CUSTOM_URL_KEY)
    const customUrl = rawCustomUrl && SAFE_CUSTOM_SOUND_REGEX.test(rawCustomUrl) ? rawCustomUrl : null
    const customName = localStorage.getItem(CUSTOM_NAME_KEY) || null

    return {
      muted,
      preset: preset === "custom" && !customUrl ? "chime" : preset,
      volume,
      customUrl,
      customName,
    }
  } catch {
    return {
      muted: false,
      preset: "chime",
      volume: 0.75,
      customUrl: null,
      customName: null,
    }
  }
}

export function saveSoundPreferences(patch: Partial<SoundPreferences>): SoundPreferences {
  const current = getSoundPreferences()
  const next: SoundPreferences = {
    ...current,
    ...patch,
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MUTE_KEY, next.muted ? "1" : "0")
      localStorage.setItem(PRESET_KEY, next.preset)
      localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0.1, next.volume))))
      if (next.customUrl && SAFE_CUSTOM_SOUND_REGEX.test(next.customUrl)) {
        localStorage.setItem(CUSTOM_URL_KEY, next.customUrl)
      } else {
        localStorage.removeItem(CUSTOM_URL_KEY)
      }
      if (next.customName) {
        localStorage.setItem(CUSTOM_NAME_KEY, next.customName)
      } else {
        localStorage.removeItem(CUSTOM_NAME_KEY)
      }
      window.dispatchEvent(new Event("capygo-sound-pref-changed"))
    } catch {}
  }

  return next
}

export function isNotificationSoundMuted(): boolean {
  return getSoundPreferences().muted
}

export function setNotificationSoundMuted(muted: boolean): void {
  saveSoundPreferences({ muted })
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

export function playNotificationSound(
  role: "admin_chat" | "ktv_chat" | "admin_alert",
  override?: {
    preset?: SoundPresetId
    customUrl?: string | null
    volume?: number
    force?: boolean
  }
): void {
  const prefs = getSoundPreferences()
  if (!override?.force && prefs.muted) return

  const preset = override?.preset || prefs.preset
  const volume = override?.volume ?? prefs.volume
  const customUrl = override?.customUrl !== undefined ? override.customUrl : prefs.customUrl

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
        playSynthPreset("chime", volume, role === "ktv_chat")
      })
      return
    } catch {
      // Fallback to default synth chime
    }
  }

  const synthId: Exclude<SoundPresetId, "custom"> =
    preset === "custom" ? "chime" : preset

  if (role === "admin_alert" && synthId === "chime") {
    playSynthPreset("marimba", volume, false)
    return
  }

  playSynthPreset(synthId, volume, role === "ktv_chat")
}

export function playChatMessageSound(viewer: "admin" | "ktv", force = false): void {
  playNotificationSound(viewer === "admin" ? "admin_chat" : "ktv_chat", { force })
}

export function playAdminAlertSound(): void {
  playNotificationSound("admin_alert")
}
