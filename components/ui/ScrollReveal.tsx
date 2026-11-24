"use client"

import { ReactNode } from "react"

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  delayMs?: number
}

/**
 * Lightweight, immediate-visibility wrapper.
 * Ensures storefront content is never hidden when JS or IntersectionObserver is delayed,
 * and avoids slow staggered reveals that block customers from scanning products/info.
 */
export function ScrollReveal({
  children,
  className = "",
}: ScrollRevealProps) {
  return <div className={className}>{children}</div>
}
