"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { Play, Pause } from "lucide-react"

// =============================================================================
// COLOR PALETTES & CONSTANTS (Cohesive with website dark slate & teal theme)
// =============================================================================

const PALETTE = {
  // Capybara Fur: Warm caramel & natural earthy tones (6 distinct tonal roles)
  capy: {
    highlight: "#d69c67", // Warm golden highlight on crown and top back
    base: "#b37644",      // Primary caramel coat
    midtone: "#91572c",   // Mid shadow & flank curvature
    shadow: "#703e1b",    // Deep body and submerged shadow
    deep: "#4a240e",      // Ear inner fold, eye crease, snout rim
    snoutDark: "#26170d", // Dark charcoal-brown nostrils & mouth
    blush: "rgba(244, 63, 94, 0.45)", // Soft rose blush on cheeks
  },
  // Flushed Angry Capybara Palette ("tức đỏ người" when woken up)
  capyAngry: {
    highlight: "#f87171", // Flushed bright red-coral highlight
    base: "#dc2626",      // Furious bright red coat (tức đỏ người)
    midtone: "#b91c1c",   // Crimson mid-shadow
    shadow: "#991b1b",    // Dark crimson underbelly
    deep: "#450a0a",      // Deepest dark red accents
    snoutDark: "#180606", // Dark charred nose
    blush: "rgba(255, 255, 255, 0.5)", // White anger cheek marks
  },
  // Signature Yuzu Citrus on Head
  yuzu: {
    highlight: "#fef08a",
    base: "#f59e0b",
    shadow: "#d97706",
    leafBase: "#10b981",
    leafHighlight: "#34d399",
  },
  // Scenic Lake & Water Palette
  water: {
    deep: "#042f2e",
    mid: "#0f766e",
    surface: "#115e59",
    highlight: "rgba(45, 212, 191, 0.35)",
    overlay: "rgba(13, 100, 94, 0.48)", // Foreground submerged tint
  },
  // Foliage on Lake Banks
  foliage: {
    dark: "#064e3b",
    mid: "#047857",
    light: "#059669",
    accent: "#10b981",
    trunk: "#3b2314",
    reed: "#059669",
    reedTip: "#a7f3d0",
    lilyPad: "#065f46",
    lotus: "#f43f5e",
    lotusInner: "#fbcfe8",
  },
}

// Particle interface
interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  scale: number
  type: "z" | "anger_steam" | "water_mist"
  char?: string
}

interface Ripple {
  x: number
  y: number
  r: number
  maxR: number
  alpha: number
  color?: string
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PixelCapybara() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // User motion preference & interactive controls (initialized with prefers-reduced-motion check)
  const [isPaused, setIsPaused] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    }
    return false
  })
  const isPausedRef = useRef(isPaused)

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // Touch tracking to distinguish swipe-scroll from real tap
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null)

  // Master game loop state (stored in ref for smooth, garbage-free 60+ FPS execution)
  const stateRef = useRef({
    // Time & delta tracking
    lastTimestamp: 0,
    elapsedTime: 0,
    isIntersecting: true,
    isTabVisible: true,

    // Capybara Behavioral States: "sleeping" | "happy" | "annoyed"
    behaviorState: "sleeping" as "sleeping" | "happy" | "annoyed",
    stateTimer: 0,        // Remaining duration for active non-idle state
    angerCooldown: 0,     // Prevents infinite anger spam loop
    angerBlushLevel: 0,   // Smooth 0 -> 1 fade envelope for localized anger blush

    // Rapid spam click tracking (15 clicks within 4.5s)
    clickTimestamps: [] as number[],

    // Micro-motion phases
    breathPhase: 0,       // 3.5s smooth breathing cycle
    earTwitchTimer: 3.2,  // Irregular ear wiggles
    earTwitchAmount: 0,
    blinkTimer: 4.0,      // Eye flutter
    blinkAmount: 0,
    clickVibrationTimer: 0, // Click vibration / tactile shake phase

    // Environmental elements
    ripples: [] as Ripple[],
    particles: [] as Particle[],
    particleId: 0,
    fireflies: [
      { x: 70, y: 35, vx: 12, vy: -6, alpha: 0.6 },
      { x: 160, y: 55, vx: -10, vy: 8, alpha: 0.8 },
      { x: 640, y: 38, vx: 8, vy: 10, alpha: 0.7 },
      { x: 720, y: 60, vx: -14, vy: -7, alpha: 0.5 },
    ],

    // Anchor coordinates (calculated dynamically per frame)
    anchors: {
      headX: 0,
      headY: 0,
      snoutX: 0,
      snoutY: 0,
      cheekX: 0,
      cheekY: 0,
      waterContactY: 0,
      capyBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    },
  })

  // ---------------------------------------------------------------------------
  // INTERACTION HANDLERS (Safe unified pointer handling, no double firing)
  // ---------------------------------------------------------------------------

  const handlePointerInteraction = useCallback((clientX: number, clientY: number) => {
    const s = stateRef.current
    const canvas = canvasRef.current
    if (!canvas) return

    // Accurate hit-testing using canvas bounding client rect
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    // Convert display client coordinates to canvas internal pixel coordinates
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = (clientX - rect.left) * scaleX
    const canvasY = (clientY - rect.top) * scaleY

    const bounds = s.anchors.capyBounds
    const hitCapybara =
      canvasX >= bounds.minX &&
      canvasX <= bounds.maxX &&
      canvasY >= bounds.minY &&
      canvasY <= bounds.maxY

    const now = performance.now()

    if (hitCapybara) {
      // 1. Capybara was clicked / tapped!
      s.clickTimestamps.push(now)
      // Keep only clicks within last 4.5 seconds
      s.clickTimestamps = s.clickTimestamps.filter((t) => now - t <= 4500)

      // Trigger tactile vibration response
      s.clickVibrationTimer = 0.35 // 350ms vibration decay

      // Immediate water ripple at Capybara's water line from the impact
      if (s.ripples.length < 10) {
        s.ripples.push({
          x: s.anchors.capyBounds.minX + (s.anchors.capyBounds.maxX - s.anchors.capyBounds.minX) * 0.5,
          y: s.anchors.waterContactY,
          r: 4,
          maxR: 35,
          alpha: 0.75,
        })
      }

      // Check if user spammed 15 times and cooldown expired
      if (s.clickTimestamps.length >= 15 && s.angerCooldown <= 0) {
        s.behaviorState = "annoyed"
        s.stateTimer = 1.8 // Annoyed for 1.8 seconds
        s.angerCooldown = 3.5 // Cooldown to prevent endless anger loop
        s.clickTimestamps = [] // Reset click history

        // Spawn annoyed steam puff from nostrils
        s.particles.push({
          id: s.particleId++,
          x: s.anchors.snoutX,
          y: s.anchors.snoutY,
          vx: 24,
          vy: -12,
          alpha: 0.85,
          scale: 1.4,
          type: "anger_steam",
        })

        // Physical haptic vibration for angry reaction (double pulse)
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate?.([35, 45, 35])
          } catch {
            // Ignore devices where vibrate is restricted
          }
        }
      } else {
        if (s.behaviorState !== "annoyed") {
          // Happy reaction: gentle eye flutter, blush, wiggle ear
          s.behaviorState = "happy"
          s.stateTimer = 1.2
          s.earTwitchAmount = 1
        }

        // Physical haptic vibration for gentle tap
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate?.(18)
          } catch {
            // Ignore devices where vibrate is restricted
          }
        }
      }
    } else {
      // 2. Clicked on the open lake water -> gentle localized ripple
      if (s.ripples.length < 8) {
        s.ripples.push({
          x: canvasX,
          y: Math.max(canvasY, s.anchors.waterContactY - 10),
          r: 4,
          maxR: 26,
          alpha: 0.6,
        })
      }
    }
  }, [])

  // Touch event listeners: distinguish swipes from taps
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: performance.now(),
      }
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return
    const touch = e.changedTouches[0]
    if (!touch) return

    const dx = touch.clientX - touchStartPos.current.x
    const dy = touch.clientY - touchStartPos.current.y
    const distance = Math.hypot(dx, dy)
    const duration = performance.now() - touchStartPos.current.time

    // Only trigger if movement was minimal (tap, not swipe/scroll)
    if (distance < 10 && duration < 500) {
      handlePointerInteraction(touch.clientX, touch.clientY)
    }
    touchStartPos.current = null
  }

  // Pointer click listener (mouse / stylus)
  const onPointerDown = (e: React.PointerEvent) => {
    // Only handle primary mouse button (touch handled by touchEnd to avoid double trigger)
    if (e.pointerType === "mouse" && e.button === 0) {
      handlePointerInteraction(e.clientX, e.clientY)
    }
  }

  // Keyboard accessibility (Space / Enter)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.repeat) return // Prevent key-repeat spam
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      const s = stateRef.current
      handlePointerInteraction(s.anchors.cheekX, s.anchors.cheekY)
    }
  }

  // ---------------------------------------------------------------------------
  // REDUCED MOTION DETECTION & VISIBILITY MANAGEMENT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Listen for system prefers-reduced-motion dynamic changes
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handleChange = (e: MediaQueryListEvent) => {
      setIsPaused(e.matches)
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    // Visibility API: pause when tab inactive
    const handleVisibility = () => {
      stateRef.current.isTabVisible = document.visibilityState === "visible"
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  useEffect(() => {
    // IntersectionObserver: pause when out of viewport
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        stateRef.current.isIntersecting = entry.isIntersecting
      },
      { threshold: 0.05 }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // ---------------------------------------------------------------------------
  // MAIN ANIMATION LOOP (DeltaTime, Resolution-Aware, Pixel Art Snapped)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number

    // Pixel drawing helper (snaps coordinates to whole pixels)
    function px(x: number, y: number, w: number, h: number, color: string) {
      if (!ctx) return
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
    }

    // Japanese Manga Anger Mark 💢
    function drawAngerMark(x: number, y: number, size = 8) {
      if (!ctx) return
      ctx.strokeStyle = "#ef4444"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(Math.round(x - size), Math.round(y - size / 2))
      ctx.lineTo(Math.round(x - size / 2), Math.round(y - size / 2))
      ctx.lineTo(Math.round(x - size / 2), Math.round(y - size))
      ctx.moveTo(Math.round(x + size / 2), Math.round(y - size))
      ctx.lineTo(Math.round(x + size / 2), Math.round(y - size / 2))
      ctx.lineTo(Math.round(x + size), Math.round(y - size / 2))
      ctx.moveTo(Math.round(x + size), Math.round(y + size / 2))
      ctx.lineTo(Math.round(x + size / 2), Math.round(y + size / 2))
      ctx.lineTo(Math.round(x + size / 2), Math.round(y + size))
      ctx.moveTo(Math.round(x - size / 2), Math.round(y + size))
      ctx.lineTo(Math.round(x - size / 2), Math.round(y + size / 2))
      ctx.lineTo(Math.round(x - size), Math.round(y + size / 2))
      ctx.stroke()
    }

    // Master Animation Frame Loop
    function loop(now: number) {
      if (!ctx) return
      const s = stateRef.current

      // Calculate deltaTime clamped to max 0.1s to avoid jumps on tab switch
      if (!s.lastTimestamp) s.lastTimestamp = now
      const dt = Math.min((now - s.lastTimestamp) / 1000, 0.1)
      s.lastTimestamp = now

      // Halt execution when off-screen or tab hidden (TRUE 0% CPU consumption)
      if (!s.isIntersecting || !s.isTabVisible) {
        animId = requestAnimationFrame(loop)
        return
      }

      // Check canvas dimensions vs container for crisp, distortion-free rendering
      if (containerRef.current && canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const displayW = Math.round(containerRef.current.clientWidth)
        const displayH = Math.round(containerRef.current.clientHeight)
        const targetW = Math.round(displayW * dpr)
        const targetH = Math.round(displayH * dpr)

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW
          canvas.height = targetH
        }
      }

      const W = canvas ? canvas.width : 800
      const H = canvas ? canvas.height : 140
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ctx.imageSmoothingEnabled = false

      // Update state physics if not paused
      if (!isPausedRef.current) {
        s.elapsedTime += dt

        // 1. Natural Breathing Cycle (~3.6s sine)
        s.breathPhase += dt * 1.75

        // 2. Ear Twitch Timer
        s.earTwitchTimer -= dt
        if (s.earTwitchTimer <= 0) {
          s.earTwitchAmount = 1
          s.earTwitchTimer = 3.0 + Math.random() * 3.5
        }
        if (s.earTwitchAmount > 0) {
          s.earTwitchAmount = Math.max(0, s.earTwitchAmount - dt * 3.5)
        }

        // 3. Eye Flutter Timer
        s.blinkTimer -= dt
        if (s.blinkTimer <= 0) {
          s.blinkAmount = 1
          s.blinkTimer = 3.8 + Math.random() * 4.0
        }
        if (s.blinkAmount > 0) {
          s.blinkAmount = Math.max(0, s.blinkAmount - dt * 4.5)
        }

        // 4. Behavioral State Timer & Anger Blush Smoothing
        if (s.behaviorState !== "sleeping") {
          s.stateTimer -= dt
          if (s.stateTimer <= 0) {
            s.behaviorState = "sleeping"
          }
        }
        if (s.angerCooldown > 0) {
          s.angerCooldown -= dt
        }
        if (s.clickVibrationTimer > 0) {
          s.clickVibrationTimer = Math.max(0, s.clickVibrationTimer - dt)
        }

        // Smooth localized anger blush fade envelope (fades in quickly, eases out gently)
        const targetBlush = s.behaviorState === "annoyed" ? 1.0 : 0.0
        const blushSpeed = s.behaviorState === "annoyed" ? 4.5 : 2.0
        s.angerBlushLevel = Math.max(0, Math.min(1, s.angerBlushLevel + (targetBlush - s.angerBlushLevel) * Math.min(1, dt * blushSpeed)))

        // 5. Environmental Fireflies Movement
        for (const f of s.fireflies) {
          f.x += f.vx * dt * dpr
          f.y += f.vy * dt * dpr
          if (f.x < 30 * dpr || f.x > W - 30 * dpr) f.vx *= -1
          if (f.y < 20 * dpr || f.y > H * 0.65) f.vy *= -1
        }

        // 6. Spawn sleeping "z" particles if peacefully sleeping
        if (s.behaviorState === "sleeping" && s.particles.filter((p) => p.type === "z").length < 4) {
          if (Math.random() < 0.015) {
            s.particles.push({
              id: s.particleId++,
              x: s.anchors.snoutX + 4 * dpr,
              y: s.anchors.snoutY - 2 * dpr,
              vx: 10 * dpr,
              vy: -18 * dpr,
              alpha: 0.85,
              scale: 1,
              type: "z",
              char: Math.random() > 0.5 ? "Z" : "z",
            })
          }
        }

        // 7. Update Particles
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const p = s.particles[i]
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.alpha -= (p.type === "anger_steam" ? 0.75 : 0.28) * dt

          if (p.alpha <= 0 || p.y < 0) {
            s.particles.splice(i, 1)
          }
        }

        // 8. Update Water Ripples
        for (let i = s.ripples.length - 1; i >= 0; i--) {
          const r = s.ripples[i]
          r.r += 14 * dt * dpr
          r.alpha -= 0.35 * dt
          if (r.alpha <= 0 || r.r >= r.maxR * dpr) {
            s.ripples.splice(i, 1)
          }
        }
      }

      // Dynamic Layout Calculations
      // Responsive Camera: Capybara stays centrally framed and comfortably sized across desktop & mobile
      const P = Math.max(1.8, Math.min(2.5, (H / 140) * 2.2)) * dpr // Logic pixel scale
      const capyCenterX = W * 0.5
      const waterLineY = H * 0.72 // Waterline at ~72% height

      const breathOffset = isPausedRef.current ? 0 : Math.sin(s.breathPhase) * 1.3 * dpr
      const capyY = waterLineY - 8 * P + breathOffset // Submerged depth: ~45% of lower body rests underwater!

      // Click Vibration / Shake Physics (decaying sine spring oscillation on click)
      let vibX = 0
      let vibY = 0
      if (!isPausedRef.current && s.clickVibrationTimer > 0) {
        const decay = s.clickVibrationTimer / 0.35 // 1 -> 0
        const freq = 46
        const amp = (s.behaviorState === "annoyed" ? 3.5 : 2.2) * decay * dpr
        vibX = Math.sin(s.clickVibrationTimer * freq) * amp
        vibY = Math.cos(s.clickVibrationTimer * freq * 0.75) * (amp * 0.6)
      }

      const capyRenderX = capyCenterX + vibX
      const capyRenderY = capyY + vibY

      // Update interactive anchors
      s.anchors.headX = capyCenterX + 16 * P
      s.anchors.headY = capyY - 2 * P
      s.anchors.snoutX = capyCenterX + 32 * P
      s.anchors.snoutY = capyY + 4 * P
      s.anchors.cheekX = capyCenterX + 18 * P
      s.anchors.cheekY = capyY + 5 * P
      s.anchors.waterContactY = waterLineY
      s.anchors.capyBounds = {
        minX: capyCenterX - 28 * P,
        maxX: capyCenterX + 36 * P,
        minY: capyY - 14 * P,
        maxY: waterLineY + 12 * P,
      }

      // =======================================================================
      // ORDERED LAYER RENDERING (Strict Depth & Aesthetics)
      // 1. Sky & Distant Mountain
      // 2. Shore Trees & Foliage
      // 3. Background Water Surface
      // 4. Capybara (Submerged)
      // 5. Foreground Water Overlay (Submerges Lower Torso/Paws)
      // 6. Water Contact Ripples & Near Lily Pads
      // 7. Particles (Hearts, Steam, Zzz, Anger Mark)
      // =======================================================================

      ctx.clearRect(0, 0, W, H)

      // -----------------------------------------------------------------------
      // LAYER 1: SKY & DISTANT MISTY MOUNTAINS
      // -----------------------------------------------------------------------
      const skyGrad = ctx.createLinearGradient(0, 0, 0, waterLineY)
      skyGrad.addColorStop(0, "#08101e")
      skyGrad.addColorStop(0.65, "#0b1928")
      skyGrad.addColorStop(1, "#0d262a")
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, W, waterLineY)

      // Distant Mountain Silhouette
      ctx.fillStyle = "rgba(12, 30, 42, 0.72)"
      ctx.beginPath()
      ctx.moveTo(0, waterLineY)
      ctx.lineTo(W * 0.1, waterLineY * 0.45)
      ctx.lineTo(W * 0.28, waterLineY * 0.72)
      ctx.lineTo(W * 0.48, waterLineY * 0.4)
      ctx.lineTo(W * 0.68, waterLineY * 0.65)
      ctx.lineTo(W * 0.88, waterLineY * 0.48)
      ctx.lineTo(W, waterLineY * 0.68)
      ctx.lineTo(W, waterLineY)
      ctx.closePath()
      ctx.fill()

      // Fireflies in Night Air
      for (const f of s.fireflies) {
        ctx.fillStyle = `rgba(94, 234, 212, ${f.alpha * (0.6 + Math.sin(s.elapsedTime * 2) * 0.35)})`
        ctx.fillRect(Math.round(f.x), Math.round(f.y), Math.round(2 * dpr), Math.round(2 * dpr))
      }

      // -----------------------------------------------------------------------
      // LAYER 2: SHORE TREES & LUSH FOLIAGE (Responsive Placement)
      // -----------------------------------------------------------------------
      const drawPine = (rootX: number, scale: number, flip = false) => {
        const mult = flip ? -1 : 1
        // Trunk
        ctx.fillStyle = PALETTE.foliage.trunk
        ctx.fillRect(Math.round(rootX), Math.round(waterLineY - 42 * scale), Math.round(7 * scale), Math.round(44 * scale))

        // Foliage stepped tiers
        const tiers = [PALETTE.foliage.dark, PALETTE.foliage.mid, PALETTE.foliage.light]
        for (let l = 0; l < 3; l++) {
          const ly = waterLineY - (38 + l * 14) * scale
          const lw = (30 - l * 6) * scale
          ctx.fillStyle = tiers[l]
          ctx.beginPath()
          ctx.moveTo(Math.round(rootX + 3.5 * scale), Math.round(ly - 14 * scale))
          ctx.lineTo(Math.round(rootX + 3.5 * scale - lw * mult), Math.round(ly + 6 * scale))
          ctx.lineTo(Math.round(rootX + 3.5 * scale + lw * mult), Math.round(ly + 6 * scale))
          ctx.closePath()
          ctx.fill()
        }
      }

      // Left Bank Trees
      drawPine(Math.max(15 * dpr, W * 0.06), 0.85 * dpr, false)
      if (W > 500 * dpr) {
        drawPine(W * 0.16, 0.68 * dpr, true)
      }

      // Right Bank Trees
      drawPine(Math.min(W - 35 * dpr, W * 0.92), 0.82 * dpr, true)
      if (W > 500 * dpr) {
        drawPine(W * 0.82, 0.65 * dpr, false)
      }

      // Water Reeds along banks
      const drawReeds = (startX: number, count: number) => {
        for (let i = 0; i < count; i++) {
          const rx = startX + i * 8 * dpr
          const rh = (14 + (i % 3) * 6) * dpr
          ctx.fillStyle = i % 2 === 0 ? PALETTE.foliage.reed : PALETTE.foliage.accent
          ctx.fillRect(Math.round(rx), Math.round(waterLineY - rh), Math.round(2 * dpr), Math.round(rh))
          ctx.fillStyle = PALETTE.foliage.reedTip
          ctx.fillRect(Math.round(rx - 0.5 * dpr), Math.round(waterLineY - rh - 2 * dpr), Math.round(3 * dpr), Math.round(2 * dpr))
        }
      }
      drawReeds(W * 0.18, 4)
      drawReeds(W * 0.76, 4)

      // -----------------------------------------------------------------------
      // LAYER 3: BACKGROUND WATER SURFACE & REFLECTIONS
      // -----------------------------------------------------------------------
      const waterGrad = ctx.createLinearGradient(0, waterLineY, 0, H)
      waterGrad.addColorStop(0, PALETTE.water.mid)
      waterGrad.addColorStop(0.4, PALETTE.water.surface)
      waterGrad.addColorStop(1, PALETTE.water.deep)
      ctx.fillStyle = waterGrad
      ctx.fillRect(0, waterLineY, W, H - waterLineY)

      // Soft segmented water reflections (replaces harsh solid neon line)
      ctx.fillStyle = "rgba(45, 212, 191, 0.4)"
      for (let x = 10 * dpr; x < W; x += 36 * dpr) {
        ctx.fillRect(Math.round(x), Math.round(waterLineY), Math.round(18 * dpr), Math.round(1.5 * dpr))
      }

      // -----------------------------------------------------------------------
      // LAYER 4: DETAILED PIXEL CAPYBARA (True Anatomy, Chubby & Stepped Pixel Curves)
      // -----------------------------------------------------------------------
      // Natural warm caramel fur palette is preserved across the full body
      const c = PALETTE.capy
      const yz = PALETTE.yuzu

      // 15-20% Shorter Body Length (Barrel Torso ~34 Logic Pixels)
      // Stepped Pixel Curves on Back and Rump:
      px(capyRenderX - 20 * P, capyRenderY + 2 * P, 36 * P, 11 * P, c.base)
      px(capyRenderX - 18 * P, capyRenderY, 30 * P, 3 * P, c.highlight) // Golden spine highlight
      px(capyRenderX - 22 * P, capyRenderY + 4 * P, 4 * P, 8 * P, c.shadow)   // Rounded stepped rump
      px(capyRenderX - 24 * P, capyRenderY + 6 * P, 3 * P, 5 * P, c.deep)     // Back curvature
      px(capyRenderX - 18 * P, capyRenderY + 11 * P, 35 * P, 4 * P, c.shadow) // Submerged belly fold

      // Front Chest & Neck connection
      px(capyRenderX + 12 * P, capyRenderY + 1 * P, 12 * P, 12 * P, c.base)
      px(capyRenderX + 10 * P, capyRenderY + 5 * P, 4 * P, 7 * P, c.midtone) // Soft neck crease

      // Paws: resting forward in water (gentle rounded pads, no canine claws)
      px(capyRenderX + 10 * P, capyRenderY + 11 * P, 7 * P, 3 * P, c.shadow)
      px(capyRenderX + 18 * P, capyRenderY + 11.5 * P, 7 * P, 3 * P, c.shadow)

      // HEAD: Blunt snout, deep rounded square jaw
      const headOffset = s.behaviorState === "annoyed" ? (Math.random() - 0.5) * 1.5 * dpr : 0
      const headX = capyRenderX + 16 * P + headOffset
      const headY = capyRenderY - 4 * P + headOffset

      px(headX, headY, 18 * P, 13 * P, c.base)
      px(headX + 2 * P, headY - 1.5 * P, 14 * P, 2 * P, c.highlight) // Flat top crown
      px(headX + 8 * P, headY + 1 * P, 12 * P, 12 * P, c.midtone)   // Snout front block

      // Localized angry blush: front torso, neck connection, cheek and snout
      // Keeps back body, rump, paws, orange and scenery at normal palette
      if (s.angerBlushLevel > 0.01) {
        const a = s.angerBlushLevel
        // Front chest & neck connection flush
        px(capyRenderX + 11 * P, capyRenderY + 2 * P, 13 * P, 9 * P, `rgba(244, 63, 94, ${(0.42 * a).toFixed(3)})`)
        px(capyRenderX + 13 * P, capyRenderY + 4 * P, 9 * P, 6 * P, `rgba(225, 29, 72, ${(0.32 * a).toFixed(3)})`)

        // Head, cheek & lower face flush (anchored to headX, headY)
        px(headX + 2 * P, headY + 3.5 * P, 14 * P, 7 * P, `rgba(244, 63, 94, ${(0.44 * a).toFixed(3)})`)
        px(headX + 4 * P, headY + 1.5 * P, 8 * P, 3.5 * P, `rgba(251, 113, 133, ${(0.35 * a).toFixed(3)})`)
        px(headX + 8 * P, headY + 3 * P, 8 * P, 6.5 * P, `rgba(244, 63, 94, ${(0.38 * a).toFixed(3)})`)
      }

      // Nose: moderate charcoal-brown tip with nostrils high on the snout
      px(headX + 18 * P, headY + 4 * P, 3 * P, 5 * P, c.snoutDark)
      px(headX + 17 * P, headY + 4.5 * P, 2 * P, 3 * P, c.snoutDark)
      px(headX + 15 * P, headY + 9 * P, 4 * P, 1.2 * P, c.deep) // Gentle mouth line

      // EYE: Peaceful Closed Eyelid vs Happy Smile vs Annoyed Furrow
      const eyeX = headX + 7 * P
      const eyeY = headY + 3.5 * P

      if (s.behaviorState === "annoyed") {
        // Annoyed Expression: sharp furrowed brow and squinting pout
        px(eyeX - 1 * P, eyeY - 1.5 * P, 6 * P, 1.5 * P, c.deep)
        px(eyeX, eyeY, 4 * P, 2 * P, c.snoutDark)
        px(eyeX + 1 * P, eyeY + 0.5 * P, 1.5 * P, 1.5 * P, "#ffffff") // Tiny white glint
      } else if (s.behaviorState === "happy" || s.blinkAmount > 0) {
        // Happy / Blinking Expression: soft upward curve (^ ^)
        px(eyeX - 0.5 * P, eyeY + 1 * P, 4.5 * P, 1.5 * P, c.snoutDark)
        px(eyeX + 0.5 * P, eyeY, 2 * P, 1.2 * P, c.snoutDark)
      } else {
        // Natural Sleeping Eye: gentle horizontal closed eyelid with subtle crease
        px(eyeX - 0.5 * P, eyeY + 0.5 * P, 4.5 * P, 1.4 * P, c.snoutDark)
        px(eyeX - 1 * P, eyeY - 0.5 * P, 2 * P, 1 * P, c.deep)
      }

      // Gentle cheek blush when Happy
      if (s.behaviorState === "happy") {
        px(headX + 8 * P, headY + 6.5 * P, 4 * P, 2 * P, c.blush)
      }

      // EAR: Small, rounded, naturally perched high on head (with micro twitch)
      const earTwitch = s.earTwitchAmount > 0 ? (s.earTwitchAmount * 3 % 2 === 0 ? -1.5 * P : 0) : 0
      px(headX - 1 * P + earTwitch, headY - 4 * P, 4 * P, 4.5 * P, c.shadow)
      px(headX + earTwitch, headY - 3 * P, 2 * P, 2.5 * P, c.deep)

      // YUZU CITRUS ON HEAD: Follows head with slight natural lag
      const orangeWobble = s.behaviorState === "annoyed" ? (Math.random() - 0.5) * 2 * dpr : 0
      const orangeX = headX + 7 * P + orangeWobble
      const orangeY = headY - 8.5 * P + orangeWobble

      // Orange spherical body
      px(orangeX - 3 * P, orangeY, 7 * P, 5 * P, yz.base)
      px(orangeX - 2 * P, orangeY - 1 * P, 5 * P, 1.5 * P, yz.highlight)
      px(orangeX - 3 * P, orangeY + 3.5 * P, 7 * P, 1.5 * P, yz.shadow)

      // Green Leaf with tip
      px(orangeX, orangeY - 2.5 * P, 2 * P, 2 * P, yz.leafBase)
      px(orangeX + 1.5 * P, orangeY - 3 * P, 2.5 * P, 1.5 * P, yz.leafHighlight)

      // -----------------------------------------------------------------------
      // LAYER 5: FOREGROUND WATER OVERLAY (Submerges Belly & Creates Depth)
      // -----------------------------------------------------------------------
      ctx.fillStyle = PALETTE.water.overlay
      ctx.fillRect(capyRenderX - 24 * P, waterLineY - 1.5 * P, 56 * P, 16 * P)

      // Caustic water contact rim around Capybara torso
      ctx.fillStyle = PALETTE.water.highlight
      ctx.fillRect(capyRenderX - 22 * P, waterLineY - 0.5 * P, 52 * P, 1.5 * P)

      // -----------------------------------------------------------------------
      // LAYER 6: WATER CONTACT RIPPLES & NEAR LILY PADS
      // -----------------------------------------------------------------------
      for (const r of s.ripples) {
        ctx.strokeStyle = `rgba(45, 212, 191, ${r.alpha * 0.45})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.r * 2.2, r.r * 0.5, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Lily Pads (foreground water)
      const drawLilyPad = (lx: number, ly: number, radius: number, hasFlower = false) => {
        ctx.fillStyle = PALETTE.foliage.lilyPad
        ctx.beginPath()
        ctx.ellipse(lx, ly, radius * 1.5, radius * 0.55, 0, 0, Math.PI * 1.85)
        ctx.lineTo(lx, ly)
        ctx.closePath()
        ctx.fill()

        if (hasFlower) {
          ctx.fillStyle = PALETTE.foliage.lotus
          ctx.beginPath()
          ctx.arc(lx - 2 * dpr, ly - 2 * dpr, 3.5 * dpr, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = PALETTE.foliage.lotusInner
          ctx.beginPath()
          ctx.arc(lx - 2 * dpr, ly - 3 * dpr, 1.8 * dpr, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      drawLilyPad(capyCenterX - 65 * P, waterLineY + 6 * P, 10 * P, true)
      drawLilyPad(capyCenterX + 55 * P, waterLineY + 7 * P, 11 * P, true)

      // -----------------------------------------------------------------------
      // LAYER 7: PARTICLES & INTERACTION EFFECTS
      // -----------------------------------------------------------------------
      for (const p of s.particles) {
        if (p.type === "z") {
          ctx.fillStyle = `rgba(45, 212, 191, ${p.alpha * 0.85})`
          ctx.font = `bold ${Math.round(11 * p.scale * dpr)}px monospace`
          ctx.fillText(p.char || "z", Math.round(p.x), Math.round(p.y))
        } else if (p.type === "anger_steam") {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.75})`
          ctx.beginPath()
          ctx.arc(Math.round(p.x), Math.round(p.y), Math.round(3.5 * p.scale * dpr), 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Manga Anger Mark 💢 when Annoyed
      if (s.behaviorState === "annoyed") {
        const veinY = headY - 14 * P + Math.sin(s.elapsedTime * 8) * 1.5 * dpr
        drawAngerMark(headX + 2 * P, veinY, 7 * dpr)
      }

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl border border-teal-500/25 bg-slate-950/75 backdrop-blur-xl shadow-2xl overflow-hidden select-none transition-all duration-300 hover:border-teal-500/40"
    >
      {/* Top subtle glow rim */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-teal-400/40 to-transparent pointer-events-none" />

      {/* Top Left Hint Line */}
      <div className="absolute top-2.5 left-3 pointer-events-none z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-teal-500/25 text-[11px] font-medium text-teal-300 backdrop-blur-md shadow-sm">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-teal-400" />
        </span>
        <span>Chạm vào để đánh thức Capypara</span>
      </div>

      {/* Accessible Motion Pause / Play Control (Top Right) */}
      <button
        type="button"
        onClick={() => setIsPaused(!isPaused)}
        aria-label={isPaused ? "Tiếp tục chuyển động capybara" : "Tạm dừng chuyển động capybara"}
        title={isPaused ? "Tiếp tục chuyển động" : "Tạm dừng chuyển động"}
        className="absolute top-2.5 right-3 z-10 p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 text-teal-300/80 hover:text-teal-200 border border-teal-500/20 backdrop-blur-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </button>

      {/* Interactive Capybara Canvas Area */}
      <div
        role="button"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onKeyDown={onKeyDown}
        className="relative w-full h-[115px] sm:h-[126px] md:h-[135px] cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 rounded-2xl"
        aria-label="Capybara pixel ngâm hồ nước thư giãn. Chạm vào để đánh thức."
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    </div>
  )
}