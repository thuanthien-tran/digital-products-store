"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"

// =============================================================================
// COLOR PALETTE (Warm Caramel & Cozy Dark Tech Aesthetic)
// =============================================================================
const PALETTE = {
  capy: {
    highlight: "#d69c67",  // Golden crown & spine highlight
    base: "#b37644",       // Warm caramel main coat
    midtone: "#91572c",    // Flank & snout curve shadow
    shadow: "#703e1b",     // Underbelly, rump curvature & paw shadow
    deep: "#4a240e",       // Deep ear fold & muzzle crease
    snoutDark: "#26170d",  // Charcoal nostrils & mouth line
    blush: "rgba(244, 63, 94, 0.45)", // Cute rosy cheek
  },
  glasses: {
    frame: "#1e293b",
    bridge: "#0f172a",
    lensTint: "rgba(45, 212, 191, 0.22)",
    glintBright: "rgba(255, 255, 255, 0.85)",
    glintSoft: "rgba(255, 255, 255, 0.55)",
  },
  chair: {
    tealRim: "#14b8a6",
    tealBody: "#0f766e",
    tealDark: "#115e59",
    tealShadow: "#042f2e",
    stem: "#475569",
    stemHighlight: "#94a3b8",
    base: "#1e293b",
    wheel: "#0f172a",
  },
  desk: {
    woodHighlight: "#5c3d2e",
    woodTop: "#3d2618",
    woodShadow: "#26170d",
    woodLeg: "#2e1c12",
    legHighlight: "#42281a",
  },
  tech: {
    laptopBody: "#1e293b",
    keyboard: "#0f172a",
    screenGlow: "#14b8a6",
    screenHighlight: "#2dd4bf",
    screenReflection: "rgba(45, 212, 191, 0.25)",
    pawEmblem: "#5eead4",
  },
  props: {
    mugBody: "#f1f5f9",
    mugShadow: "#cbd5e1",
    mugCoffee: "#451a03",
    steam: "rgba(226, 232, 240, 0.45)",
  },
}

// Logical Grid Resolution
const GRID_W = 56
const GRID_H = 44

export function OfficeCapybara() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Behavioral & physics state stored in ref (0 React re-renders during loop)
  const animRef = useRef({
    lastTimestamp: 0,
    elapsedTime: 0,
    isIntersecting: true,
    isTabVisible: true,

    // Interaction state: "working" | "waving"
    mode: "working" as "working" | "waving",
    modeTimer: 0,
    cooldown: 0,

    // Micro-motion timers
    typingPhase: 0,
    blinkTimer: 3.6,
    blinkAmount: 0,
    earTwitchTimer: 4.5,
    earTwitchAmount: 0,
    glassesAdjustTimer: 7.5,
    glassesAdjustAmount: 0,
    screenPulse: 1.0,
    steamPhase: 0,
    wavePhase: 0,
  })

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Viewport intersection & Tab visibility tracking
  useEffect(() => {
    const s = animRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          s.isIntersecting = entry.isIntersecting
        }
      },
      { threshold: 0.05 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    const handleVisibility = () => {
      s.isTabVisible = document.visibilityState === "visible"
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  // ===========================================================================
  // MODULAR RENDERING FUNCTIONS (Crisp Grid-Aligned Pixels)
  // ===========================================================================

  const drawChair = (px: (x: number, y: number, w: number, h: number, c: string) => void) => {
    const ch = PALETTE.chair
    // 1. Curved backrest behind capybara
    px(8, 12, 5, 2, ch.tealRim)
    px(6, 14, 2, 16, ch.tealShadow)
    px(8, 14, 4, 16, ch.tealBody)
    px(12, 14, 2, 16, ch.tealRim)

    // 2. Thick ergonomic seat cushion
    px(9, 30, 18, 1, ch.tealRim)
    px(8, 31, 19, 3, ch.tealBody)
    px(8, 33, 19, 1, ch.tealShadow)

    // 3. Hydraulic steel stem
    px(16, 34, 3, 5, ch.stem)
    px(17, 34, 1, 5, ch.stemHighlight)

    // 4. Wheeled star base
    px(10, 39, 15, 2, ch.base)
    px(9, 41, 3, 2, ch.wheel)
    px(22, 41, 3, 2, ch.wheel)
  }

  const drawDeskAndProps = (
    px: (x: number, y: number, w: number, h: number, c: string) => void,
    steamPhase: number
  ) => {
    const dk = PALETTE.desk
    const pr = PALETTE.props

    // 1. Thick wooden desktop
    px(34, 26, 20, 1, dk.woodHighlight)
    px(34, 27, 20, 2, dk.woodTop)
    px(34, 29, 20, 1, dk.woodShadow)

    // 2. Sturdy wooden table leg
    px(50, 30, 3, 12, dk.woodLeg)
    px(51, 30, 1, 12, dk.legHighlight)

    // 3. Ceramic coffee mug
    px(49, 21, 4, 5, pr.mugBody)
    px(52, 22, 1, 4, pr.mugShadow)
    px(49, 21, 4, 1, pr.mugCoffee)
    px(53, 22, 1, 3, pr.mugShadow) // handle

    // Wisps of rising steam
    const steamY = 18 - Math.floor((steamPhase * 3) % 4)
    px(50 + Math.sin(steamY) * 1, steamY, 1, 1, pr.steam)
  }

  const drawCapybaraBody = (px: (x: number, y: number, w: number, h: number, c: string) => void) => {
    const cp = PALETTE.capy

    // Rump curvature & dark contour
    px(14, 19, 3, 4, cp.deep)
    px(13, 22, 2, 7, cp.deep)
    px(14, 29, 3, 3, cp.deep)
    px(15, 21, 6, 10, cp.shadow)

    // Round plump barrel torso
    px(17, 18, 12, 14, cp.base)
    px(19, 17, 7, 2, cp.highlight) // golden spine
    px(17, 26, 12, 6, cp.midtone)  // lower flank shadow
    px(16, 31, 12, 2, cp.shadow)   // belly fold

    // Chubby hind foot resting under the chair
    px(18, 33, 4, 2, cp.shadow)
    px(19, 34, 3, 1, cp.deep)
  }

  const drawCapybaraHead = (
    px: (x: number, y: number, w: number, h: number, c: string) => void,
    blinkAmount: number,
    earTwitchAmount: number,
    isWaving: boolean
  ) => {
    const cp = PALETTE.capy
    const gl = PALETTE.glasses

    // 1. Crown & skull (large, chubby ~43% character height)
    px(21, 5, 8, 2, cp.highlight)
    px(20, 6, 11, 2, cp.highlight)
    px(18, 7, 3, 2, cp.base)
    px(17, 8, 2, 7, cp.shadow) // back skull shadow
    px(20, 7, 13, 11, cp.base)  // main head volume

    // 2. Muzzle (short, broad, blunt snout)
    px(31, 7, 5, 3, cp.highlight) // top snout bridge
    px(32, 9, 5, 4, cp.base)
    px(34, 11, 4, 8, cp.midtone)  // blunt front block
    px(35, 12, 3, 6, cp.shadow)

    // Dark charcoal nose & nostrils
    px(37, 12, 2, 4, cp.snoutDark)
    px(36, 13, 1, 2, cp.snoutDark)
    px(38, 13, 1, 1, "#110603") // nostril hole

    // Gentle, peaceful mouth line
    px(34, 18, 4, 1, cp.deep)
    px(36, 19, 2, 1, cp.deep)
    px(27, 18, 8, 2, cp.shadow) // jawline underside

    // 3. Cute rounded ear on top of head with micro-twitch
    const earShift = earTwitchAmount > 0.3 ? -1 : 0
    px(18 + earShift, 3, 4, 3, cp.shadow)
    px(19 + earShift, 4, 2, 2, cp.deep)

    // 4. Rosy cheek blush
    px(29, 15, 4, 2, cp.blush)

    // 5. Large Round Spectacles (Kính gọng tròn rõ nét)
    px(26, 8, 7, 1, gl.frame)   // top rim
    px(26, 15, 7, 1, gl.frame)  // bottom rim
    px(25, 9, 1, 6, gl.frame)   // left rim
    px(33, 9, 1, 6, gl.frame)   // right rim
    px(33, 11, 3, 1, gl.bridge) // nose bridge
    px(20, 10, 5, 1, gl.frame)  // temple to ear

    // Lens glass tint & reflection
    px(26, 9, 7, 6, gl.lensTint)
    px(27, 9, 2, 1, gl.glintBright)
    px(26, 10, 1, 2, gl.glintSoft)

    // 6. Eye behind lens
    if (isWaving) {
      // Adorable smiling upward curve (^ ^)
      px(28, 12, 4, 1, cp.snoutDark)
      px(29, 11, 2, 1, cp.snoutDark)
    } else if (blinkAmount > 0.4) {
      // Peaceful closed eyelid
      px(28, 13, 4, 1, cp.snoutDark)
    } else {
      // Calm, focused eye with bright pupil glint
      px(28, 12, 3, 2, cp.snoutDark)
      px(29, 12, 1, 1, "#ffffff")
    }
  }

  const drawArmsAndPaws = (
    px: (x: number, y: number, w: number, h: number, c: string) => void,
    typingPhase: number,
    isWaving: boolean,
    wavePhase: number,
    glassesAdjustAmount: number
  ) => {
    const cp = PALETTE.capy

    if (isWaving) {
      // Left arm rests on desk
      px(29, 22, 9, 3, cp.base)
      px(37, 24, 3, 2, cp.midtone)

      // Right arm waves cheerfully!
      const waveX = Math.round(33 + Math.sin(wavePhase) * 2)
      const waveY = Math.round(7 + Math.cos(wavePhase * 0.8) * 1.5)
      px(27, 16, 5, 4, cp.base)
      px(31, 12, 4, 4, cp.midtone)
      px(waveX, waveY, 4, 4, cp.base)
      px(waveX + 1, waveY, 2, 2, cp.highlight)
    } else if (glassesAdjustAmount > 0.2) {
      // Adjusting glasses with gentle paw tap
      px(27, 17, 5, 4, cp.base)
      px(31, 13, 4, 4, cp.midtone) // paw touching glasses rim

      // Left paw typing
      px(29, 23, 8, 3, cp.base)
      px(37, 24, 3, 2, cp.shadow)
    } else {
      // Natural gentle typing on keyboard: paws alternating
      const alt = Math.sin(typingPhase) > 0 ? 1 : 0
      // Right arm & paw
      px(27, 22, 10, 3, cp.base)
      px(36, 24 - alt, 3, 2, cp.shadow)

      // Left arm & paw
      px(29, 24, 8, 2, cp.midtone)
      px(38, 25 - (1 - alt), 3, 2, cp.shadow)
    }
  }

  const drawLaptop = (
    px: (x: number, y: number, w: number, h: number, c: string) => void,
    screenPulse: number
  ) => {
    const tc = PALETTE.tech

    // Laptop base / keyboard on desk
    px(37, 24, 10, 2, tc.laptopBody)
    px(38, 24, 8, 1, tc.keyboard)

    // Laptop screen opened at ~115 degree angle towards Capybara
    px(45, 13, 3, 12, tc.laptopBody) // outer bezel
    px(44, 14, 2, 10, `rgba(20, 184, 166, ${screenPulse * 0.95})`) // glowing screen
    px(43, 15, 1, 8, `rgba(45, 212, 191, ${screenPulse * 0.7})`)

    // Cute paw emblem on back of lid
    px(47, 18, 1, 1, tc.pawEmblem)
    px(47, 16, 1, 1, tc.pawEmblem)
    px(48, 17, 1, 2, tc.pawEmblem)

    // Ambient teal glow reflected onto Capybara snout & desk
    px(38, 17, 1, 3, "rgba(45, 212, 191, 0.28)")
    px(37, 25, 7, 1, tc.screenReflection)
  }

  // ===========================================================================
  // MASTER ANIMATION LOOP
  // ===========================================================================
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number

    const renderLoop = (timestamp: number) => {
      const s = animRef.current

      if (!s.lastTimestamp) s.lastTimestamp = timestamp
      const dt = Math.min((timestamp - s.lastTimestamp) / 1000, 0.1)
      s.lastTimestamp = timestamp

      // Halt execution if outside viewport or tab is inactive
      if (!s.isIntersecting || !s.isTabVisible) {
        animationFrameId = requestAnimationFrame(renderLoop)
        return
      }

      // Responsive canvas scaling with devicePixelRatio
      const container = containerRef.current
      if (container) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const targetW = Math.round(container.clientWidth * dpr)
        const targetH = Math.round(container.clientHeight * dpr)

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW
          canvas.height = targetH
        }
      }

      const W = canvas.width
      const H = canvas.height
      if (W === 0 || H === 0) {
        animationFrameId = requestAnimationFrame(renderLoop)
        return
      }

      // Exact pixel scale factor to ensure uniform pixels
      const scale = W / GRID_W
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, W, H)

      const px = (x: number, y: number, w: number, h: number, color: string) => {
        ctx.fillStyle = color
        ctx.fillRect(
          Math.floor(x * scale),
          Math.floor(y * scale),
          Math.ceil(w * scale),
          Math.ceil(h * scale)
        )
      }

      // Static render if prefers-reduced-motion is active
      if (prefersReducedMotion) {
        drawChair(px)
        drawDeskAndProps(px, 0)
        drawCapybaraBody(px)
        drawCapybaraHead(px, 0, 0, false)
        drawLaptop(px, 1.0)
        drawArmsAndPaws(px, 0, false, 0, 0)
        return
      }

      // Update state delta
      s.elapsedTime += dt
      if (s.cooldown > 0) s.cooldown -= dt

      if (s.mode === "waving") {
        s.modeTimer -= dt
        s.wavePhase += dt * 10
        if (s.modeTimer <= 0) s.mode = "working"
      } else {
        // Typing motion
        s.typingPhase += dt * 8

        // Eye Blink
        s.blinkTimer -= dt
        if (s.blinkTimer <= 0) {
          s.blinkAmount = 1
          s.blinkTimer = 3.4 + Math.random() * 3.0
        }
        if (s.blinkAmount > 0) {
          s.blinkAmount = Math.max(0, s.blinkAmount - dt * 6)
        }

        // Ear Twitch
        s.earTwitchTimer -= dt
        if (s.earTwitchTimer <= 0) {
          s.earTwitchAmount = 1
          s.earTwitchTimer = 4.2 + Math.random() * 3.5
        }
        if (s.earTwitchAmount > 0) {
          s.earTwitchAmount = Math.max(0, s.earTwitchAmount - dt * 5)
        }

        // Occasional glasses adjustment
        s.glassesAdjustTimer -= dt
        if (s.glassesAdjustTimer <= 0) {
          s.glassesAdjustAmount = 1
          s.glassesAdjustTimer = 8.0 + Math.random() * 5.0
        }
        if (s.glassesAdjustAmount > 0) {
          s.glassesAdjustAmount = Math.max(0, s.glassesAdjustAmount - dt * 2.5)
        }
      }

      s.screenPulse = Math.sin(s.elapsedTime * 3) * 0.15 + 0.85
      s.steamPhase += dt * 2

      // Draw all layers in strict depth order
      drawChair(px)
      drawDeskAndProps(px, s.steamPhase)
      drawCapybaraBody(px)
      drawCapybaraHead(px, s.blinkAmount, s.earTwitchAmount, s.mode === "waving")
      drawLaptop(px, s.screenPulse)
      drawArmsAndPaws(
        px,
        s.typingPhase,
        s.mode === "waving",
        s.wavePhase,
        s.glassesAdjustAmount
      )

      animationFrameId = requestAnimationFrame(renderLoop)
    }

    animationFrameId = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animationFrameId)
  }, [prefersReducedMotion])

  // Trigger friendly wave interaction
  const triggerWave = useCallback(() => {
    const s = animRef.current
    if (s.cooldown > 0) return

    s.mode = "waving"
    s.modeTimer = 1.4 // Waves for 1.4 seconds
    s.cooldown = 2.2 // Cooldown prevents spamming
  }, [])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Capybara nhân viên văn phòng đeo kính làm việc tại bàn với laptop"
      tabIndex={0}
      onPointerEnter={triggerWave}
      onClick={triggerWave}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          triggerWave()
        }
      }}
      className="relative shrink-0 w-[120px] sm:w-[155px] md:w-[180px] h-[95px] sm:h-[122px] md:h-[142px] cursor-pointer select-none rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-200 hover:scale-105 active:scale-95"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  )
}
