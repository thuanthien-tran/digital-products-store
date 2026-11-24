"use client"

import { useState, useEffect } from "react"
import { Headphones, ArrowUp } from "lucide-react"

const zalo1 = (process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964").replace(/\D/g, "")

export function ZaloWidget() {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 240)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    })
  }

  return (
    <aside
      aria-label="Tiện ích hỗ trợ và điều hướng"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-30 flex flex-col items-center gap-2 print:hidden"
    >
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="flex size-10 items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-btn shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Cuộn lên đầu trang"
          title="Lên đầu trang"
        >
          <ArrowUp className="size-4" strokeWidth={2} />
        </button>
      )}

      <a
        href={`https://zalo.me/${zalo1}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground border border-primary/40 hover:bg-caramel-light transition-btn shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Hỗ trợ kỹ thuật qua Zalo"
        title="Hỗ trợ kỹ thuật qua Zalo"
      >
        <Headphones className="size-5" strokeWidth={2} />
        <span className="pointer-events-none hidden sm:block absolute right-14 whitespace-nowrap rounded-lg bg-card border border-border px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
          Hỗ trợ Zalo
        </span>
      </a>
    </aside>
  )
}
