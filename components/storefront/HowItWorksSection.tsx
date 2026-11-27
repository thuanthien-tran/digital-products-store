"use client"

import { useRef, useEffect, useState } from "react"
import Link from "next/link"
import { Layers, Mail, QrCode, CheckCircle2, ArrowRight } from "lucide-react"

const STEPS = [
  {
    step: "01",
    icon: Layers,
    title: "Chọn gói phù hợp",
    desc: "Xem rõ hình thức sử dụng (chính chủ, slot, cấp sẵn), thời hạn và điều kiện bảo hành.",
  },
  {
    step: "02",
    icon: Mail,
    title: "Nhập thông tin nhận đơn",
    desc: "Điền email nhận đơn hàng (kèm mã mời nếu mua gói nạp token).",
  },
  {
    step: "03",
    icon: QrCode,
    title: "Chuyển khoản VietQR",
    desc: "Quét mã VietQR hoặc chuyển khoản đúng số tiền và nội dung mã đơn.",
  },
  {
    step: "04",
    icon: CheckCircle2,
    title: "Nhận trong đơn hàng",
    desc: "Thông tin bàn giao hiển thị trực tiếp trên trang đơn hàng sau khi đối soát.",
  },
] as const

function StepCard({
  icon: Icon,
  title,
  desc,
  index,
  revealed,
}: {
  icon: typeof Layers
  title: string
  desc: string
  index: number
  revealed: boolean
}) {
  const cardRef = useRef<HTMLLIElement>(null)
  const borderGlowRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)

  const handlePointerMove = (e: React.PointerEvent<HTMLLIElement>) => {
    if (e.pointerType !== "mouse" || !cardRef.current) return
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    cardRef.current.style.setProperty("--card-x", `${x}px`)
    cardRef.current.style.setProperty("--card-y", `${y}px`)
    if (borderGlowRef.current) borderGlowRef.current.style.opacity = "1"
    if (spotlightRef.current) spotlightRef.current.style.opacity = "1"
  }

  const handlePointerLeave = () => {
    if (borderGlowRef.current) borderGlowRef.current.style.opacity = "0"
    if (spotlightRef.current) spotlightRef.current.style.opacity = "0"
  }

  return (
    <li
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        transitionDelay: revealed ? `${index * 60}ms` : "0ms",
      }}
      className={`group relative flex flex-col justify-between rounded-xl sm:rounded-2xl border border-border bg-card p-3.5 sm:p-5 transition-[transform,opacity,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_16px_36px_-18px_rgba(230,166,111,0.3)] ${
        revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      {/* 1.5px Cursor-Tracking Caramel Border Glow */}
      <div
        ref={borderGlowRef}
        aria-hidden="true"
        style={{ opacity: 0 }}
        className="card-border-glow z-20"
      />

      {/* Subtle Inner Caramel Spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl overflow-hidden"
      >
        <div
          ref={spotlightRef}
          style={{
            opacity: 0,
            background:
              "radial-gradient(240px circle at var(--card-x, 50%) var(--card-y, 50%), rgba(242, 188, 142, 0.16), transparent 70%)",
          }}
          className="absolute inset-0 transition-opacity duration-200"
        />
      </div>

      {/* Content — Minimal Editorial Step Card (compact 2x2 on mobile) */}
      <div className="relative z-10 space-y-2.5 sm:space-y-4">
        <div className="size-8 sm:size-11 rounded-lg sm:rounded-xl bg-gradient-to-b from-secondary/90 to-background border border-border/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] group-hover:border-primary/60 group-hover:from-primary/15 group-hover:to-background group-hover:shadow-[inset_0_1px_0_rgba(255,245,234,0.16),0_8px_20px_-8px_rgba(230,166,111,0.45)] flex items-center justify-center text-foreground/90 group-hover:text-primary transition-[transform,background-color,border-color,color,box-shadow] duration-200 group-hover:scale-[1.04] shrink-0">
          <Icon className="size-4 sm:size-[19px]" strokeWidth={1.75} />
        </div>

        <div className="space-y-1 sm:space-y-2">
          <div
            aria-hidden="true"
            className="h-[2px] w-5 sm:w-6 rounded-full bg-primary/40 group-hover:w-10 sm:group-hover:w-12 group-hover:bg-primary transition-[width,background-color] duration-200"
          />
          <h3 className="font-heading font-semibold text-[13px] sm:text-base text-foreground group-hover:text-primary transition-colors duration-150 leading-snug pt-0.5">
            {title}
          </h3>
          <p className="text-[11.5px] sm:text-[13px] text-muted-foreground leading-snug sm:leading-relaxed">
            {desc}
          </p>
        </div>
      </div>
    </li>
  )
}

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(true)

  // One-time scroll reveal (never hides content if IntersectionObserver unavailable)
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.95) {
      return
    }

    setRevealed(false)
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="how"
      className="space-y-3.5 sm:space-y-5 pt-6 sm:pt-8 border-t border-border scroll-mt-20"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-0.5 sm:space-y-1">
          <h2 className="font-heading font-bold text-lg sm:text-2xl tracking-tight text-foreground">
            Hướng dẫn mua hàng
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Quy trình đặt hàng và nhận sản phẩm tại CAPYGO.
          </p>
        </div>
        <Link
          href="/lookup"
          className="group/link inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-primary sm:text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          <span>Tra cứu đơn</span>
          <ArrowRight className="size-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5" />
        </Link>
      </div>

      <div className="relative">
        {/* Desktop Connecting Pipeline Rail with Travelling Caramel Light Beam */}
        <div
          aria-hidden="true"
          className="hidden lg:block pointer-events-none absolute top-[40px] left-[8%] right-[8%] h-px bg-border/80 overflow-hidden z-0"
        >
          <div className="h-full w-1/4 bg-gradient-to-r from-transparent via-primary to-transparent step-rail-pulse" />
        </div>

        {/* Responsive 2x2 compact mobile/tablet -> 4-col desktop */}
        <ol className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 items-stretch">
          {STEPS.map((item, idx) => (
            <StepCard
              key={item.step}
              icon={item.icon}
              title={item.title}
              desc={item.desc}
              index={idx}
              revealed={revealed}
            />
          ))}
        </ol>
      </div>
    </section>
  )
}
