"use client"

import { useState, useEffect } from "react"
import { Headphones, ArrowUp } from "lucide-react"

const zalo1 = process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964"

export function ZaloWidget() {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 150) {
        setShowScrollTop(true)
      } else {
        setShowScrollTop(false)
      }
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  return (
    <aside
      aria-label="Tiện ích hỗ trợ và điều hướng"
      className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3 print:hidden"
    >
      {/* Nút 1: Hỗ trợ kỹ thuật hình tròn kèm icon tai nghe */}
      <a
        href={`https://zalo.me/${zalo1}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-indigo-600 to-primary text-white shadow-lg shadow-purple-900/30 border border-purple-400/30 hover:scale-110 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Hỗ trợ kỹ thuật qua Zalo"
      >
        <Headphones className="size-5 transition-transform duration-200 group-hover:scale-110" strokeWidth={2} />
        
        {/* Tooltip hiển thị khi hover */}
        <span className="pointer-events-none absolute right-14 whitespace-nowrap rounded-md bg-card/95 border border-border px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 backdrop-blur">
          Hỗ trợ kỹ thuật
        </span>
      </a>

      {/* Nút 2: Nút hình tròn lên đầu trang */}
      <button
        type="button"
        onClick={scrollToTop}
        className={`group relative flex size-10 items-center justify-center rounded-full bg-card/90 border border-border text-muted-foreground shadow-md backdrop-blur hover:bg-secondary hover:text-foreground hover:scale-110 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
        aria-label="Cuộn lên đầu trang"
        title="Lên đầu trang"
      >
        <ArrowUp className="size-4.5 transition-transform duration-200 group-hover:-translate-y-0.5" strokeWidth={2.2} />

        {/* Tooltip */}
        <span className="pointer-events-none absolute right-12 whitespace-nowrap rounded-md bg-card/95 border border-border px-2 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 backdrop-blur">
          Lên đầu trang
        </span>
      </button>
    </aside>
  )
}
