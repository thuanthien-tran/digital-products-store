"use client"

import { Zap, ShieldCheck, Clock, QrCode, ArrowDown } from "lucide-react"
import { PixelCapybara } from "@/components/storefront/PixelCapybara"

const SLOGAN_FEATURES = [
  {
    icon: Zap,
    title: "Giao Hàng Siêu Tốc",
    desc: "Nhận tài khoản ngay qua màn hình và email.",
    theme: {
      card: "border-border/75 hover:border-blue-500/50 hover:bg-blue-950/30 hover:shadow-lg hover:shadow-blue-950/25",
      iconBg: "bg-blue-500/10 border-blue-500/25 text-blue-400 group-hover:border-blue-500/45 group-hover:bg-blue-500/20 group-hover:text-blue-300",
    },
  },
  {
    icon: QrCode,
    title: "VietQR Thông Minh",
    desc: "Quét QR, duyệt đơn trong 3–5 giây.",
    theme: {
      card: "border-border/75 hover:border-emerald-500/50 hover:bg-emerald-950/30 hover:shadow-lg hover:shadow-emerald-950/25",
      iconBg: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 group-hover:border-emerald-500/45 group-hover:bg-emerald-500/20 group-hover:text-emerald-300",
    },
  },
  {
    icon: ShieldCheck,
    title: "Bảo Hành Trọn Gói",
    desc: "Bảo hành 1 đổi 1 suốt thời hạn sử dụng.",
    theme: {
      card: "border-border/75 hover:border-purple-500/50 hover:bg-purple-950/30 hover:shadow-lg hover:shadow-purple-950/25",
      iconBg: "bg-purple-500/10 border-purple-500/25 text-purple-400 group-hover:border-purple-500/45 group-hover:bg-purple-500/20 group-hover:text-purple-300",
    },
  },
  {
    icon: Clock,
    title: "Hỗ Trợ Kỹ Thuật 24/7",
    desc: "Hỗ trợ kỹ thuật qua Zalo 0356 970 964",
    theme: {
      card: "border-border/75 hover:border-amber-500/50 hover:bg-amber-950/30 hover:shadow-lg hover:shadow-amber-950/25",
      iconBg: "bg-amber-500/10 border-amber-500/25 text-amber-400 group-hover:border-amber-500/45 group-hover:bg-amber-500/20 group-hover:text-amber-300",
    },
  },
]

export function HeroSection() {
  const handleScrollToProducts = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    const target = document.getElementById("products")
    if (target) {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })
      window.history.pushState(null, "", "#products")
    }
  }

  return (
    <section className="relative pt-1 sm:pt-3 pb-1 sm:pb-2 space-y-3.5 sm:space-y-4 w-full overflow-hidden">
      {/* 1. Atmospheric Studio Spotlight Beam & Ambient Depth */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-full max-w-4xl h-72 pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        {/* Soft Radial Teal Spotlight */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[480px] sm:w-[680px] h-[300px] bg-[radial-gradient(ellipse_at_top,rgba(15,118,110,0.22),rgba(13,148,136,0.07)_50%,transparent_75%)] blur-2xl" />

        {/* Crisp Studio Rim Light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[1px] bg-gradient-to-r from-transparent via-teal-400/40 to-transparent" />
      </div>

      {/* Centered Headline Container */}
      <div className="text-center space-y-2 sm:space-y-2.5 max-w-3xl mx-auto px-2">
        {/* 1. Nhãn nhỏ giới thiệu */}
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium border border-teal-500/25 bg-teal-950/40 text-teal-300 backdrop-blur-md shadow-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span>Cửa hàng tài khoản &amp; phần mềm</span>
          </div>
        </div>

        {/* 2. Tiêu đề H1 */}
        <h1
          className="text-2xl sm:text-3xl md:text-[38px] lg:text-[42px] font-black tracking-tight leading-[1.18] text-foreground animate-fade-up max-w-2xl mx-auto"
          style={{ animationDelay: "100ms" }}
        >
          Những công cụ quen thuộc,{" "}
          <span className="bg-gradient-to-r from-teal-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
            nhiều gói để lựa chọn.
          </span>
        </h1>

        {/* 3. Mô tả */}
        <p
          className="text-xs sm:text-sm text-muted-foreground/90 max-w-xl mx-auto leading-relaxed animate-fade-up"
          style={{ animationDelay: "200ms" }}
        >
          Khám phá các gói Canva, YouTube Premium, Duolingo và những dịch vụ đang có tại cửa hàng. Chọn sản phẩm để xem giá và thông tin chi tiết.
        </p>

        {/* 4. Nút chính "Khám phá các gói" */}
        <div className="pt-0.5 sm:pt-1 animate-fade-up" style={{ animationDelay: "250ms" }}>
          <a
            href="#products"
            onClick={handleScrollToProducts}
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-2 sm:py-2.5 rounded-full bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-teal-950/30 hover:shadow-teal-500/20 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background group"
          >
            <span>Khám phá các gói</span>
            <ArrowDown className="size-4 transition-transform duration-200 group-hover:translate-y-0.5" strokeWidth={2.5} />
          </a>
        </div>
      </div>

      {/* 4.5. Chill Pixel Capybara Ambient Mascot */}
      <div className="animate-fade-up w-full" style={{ animationDelay: "300ms" }}>
        <PixelCapybara />
      </div>

      {/* 5. 4 Slogan / Feature Cards (Unified motion, distinct accent colors) */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 w-full animate-fade-up pt-0 sm:pt-0.5"
        style={{ animationDelay: "350ms" }}
      >
        {SLOGAN_FEATURES.map((item, idx) => {
          const IconComponent = item.icon
          return (
            <div
              key={idx}
              className={`group flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border bg-card/65 backdrop-blur-md transition-all duration-200 ease-out hover:-translate-y-0.5 cursor-default select-none ${item.theme.card}`}
            >
              <div
                className={`size-10 sm:size-11 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 ${item.theme.iconBg}`}
              >
                <IconComponent className="size-5 sm:size-5.5" strokeWidth={2.2} />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h3 className="font-bold text-sm sm:text-[14.5px] text-foreground group-hover:text-white transition-colors duration-200 tracking-tight leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground/85 group-hover:text-slate-200 transition-colors duration-200 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
