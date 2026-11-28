"use client"

const MUTE_STORAGE_KEY = "capygo_notify_sound_muted"

const globalForAudio = globalThis as unknown as {
  __capygoAudioCtx?: AudioContext
  __capygoAudioUnlockBound?: boolean
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

/**
 * Registers one-time interaction listeners so browser autoplay policies allow
 * background notification chimes to play cleanly after the user clicks anywhere.
 */
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

export function isNotificationSoundMuted(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function setNotificationSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0")
  } catch {}
}

function playToneSequence(
  notes: Array<{ freq: number; startOffset: number; duration: number; volume: number; type?: OscillatorType }>
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

      gain.gain.setValueAtTime(0.0001, baseTime + note.startOffset)
      gain.gain.exponentialRampToValueAtTime(note.volume, baseTime + note.startOffset + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + note.startOffset + note.duration)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(baseTime + note.startOffset)
      osc.stop(baseTime + note.startOffset + note.duration + 0.02)
    } catch {
      // Ignore audio scheduling errors in restricted contexts
    }
  }
}

/**
 * Plays a pleasant two-tone notification chime when an incoming chat message arrives.
 */
export function playChatMessageSound(viewer: "admin" | "ktv", force = false): void {
  if (!force && isNotificationSoundMuted()) return
  if (viewer === "admin") {
    // Crisp E5 -> B5 chime for Admin
    playToneSequence([
      { freq: 659.25, startOffset: 0, duration: 0.14, volume: 0.16, type: "sine" },
      { freq: 987.77, startOffset: 0.11, duration: 0.24, volume: 0.18, type: "triangle" },
    ])
  } else {
    // Bright G5 -> D6 chime for KTV
    playToneSequence([
      { freq: 783.99, startOffset: 0, duration: 0.14, volume: 0.16, type: "sine" },
      { freq: 1174.66, startOffset: 0.11, duration: 0.24, volume: 0.18, type: "triangle" },
    ])
  }
}

/**
 * Plays a three-note alert chime when a new storefront/admin notification arrives.
 */
export function playAdminAlertSound(): void {
  if (isNotificationSoundMuted()) return
  playToneSequence([
    { freq: 587.33, startOffset: 0, duration: 0.12, volume: 0.14, type: "sine" },
    { freq: 880.0, startOffset: 0.1, duration: 0.12, volume: 0.16, type: "sine" },
    { freq: 1174.66, startOffset: 0.2, duration: 0.24, volume: 0.17, type: "triangle" },
  ])
}
