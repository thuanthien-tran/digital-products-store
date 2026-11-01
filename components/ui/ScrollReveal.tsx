"use client"

import { useEffect, useRef, useState, ReactNode } from "react"

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  delayMs?: number
}

export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false)
  const domRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) {
      const timer = setTimeout(() => setIsVisible(true), 0)
      return () => clearTimeout(timer)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            if (domRef.current) {
              observer.unobserve(domRef.current)
            }
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    )

    const currentTarget = domRef.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [])

  return (
    <div
      ref={domRef}
      style={{
        transitionDuration: "600ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        transitionDelay: `${delayMs}ms`,
      }}
      className={`transition-all ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-6 pointer-events-none"
      } ${className}`}
    >
      {children}
    </div>
  )
}
