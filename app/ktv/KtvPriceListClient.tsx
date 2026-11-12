"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
  Lock, 
  KeyRound, 
  RotateCw, 
  Copy, 
  Check, 
  LogOut, 
  ShieldCheck, 
  Phone, 
  AlertCircle
} from "lucide-react"
import { 
  KtvGroup, 
  KtvItem, 
  KtvMeta, 
  KtvPriceListPayload, 
  ThemeConfig, 
  resolveTheme, 
  THEMES 
} from "@/lib/ktv"

interface KtvPriceListClientProps {
  initialAuth: boolean
  initialData: KtvPriceListPayload | null
}

const defaultMeta: KtvMeta = {
  menuTitle: "BẢNG GIÁ",
  menuSubtitle: "Tài khoản • Phần mềm • API",
  footerDomain: "capygo.id.vn",
  footerNote: "KBH: Không bảo hành • Giá và tình trạng có thể thay đổi",
  hotline: "0356.970.964",
  showStock: true,
  showNotes: true,
  showLeaderDots: false,
  currencyUnit: "đ",
  selectedThemeId: "luxury-dark",
  theme: THEMES[0],
}

function formatTimeString(isoString?: string) {
  if (!isoString) return ""
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return ""
  }
}

/**
 * Ambient Aura Background dynamically responsive to the active theme/colors:
 * Soft floating gradient orbs that drift gently in the background.
 */
function AmbientBackground({ theme }: { theme: ThemeConfig }) {
  const accent = theme.accentColor || "#E6A66F"
  const baseBg = theme.bgColor || "#090A0C"

  return (
    <>
      <style jsx global>{`
        @keyframes ambient-drift-1 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(160px, 110px, 0) scale(1.22); }
          100% { transform: translate3d(50px, 200px, 0) scale(0.92); }
        }
        @keyframes ambient-drift-2 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-150px, -120px, 0) scale(1.25); }
          100% { transform: translate3d(-70px, -40px, 0) scale(0.9); }
        }
        @keyframes ambient-drift-3 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(170px, -80px, 0) scale(1.18); }
          100% { transform: translate3d(80px, 100px, 0) scale(1.02); }
        }
        @keyframes ambient-drift-4 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-120px, 90px, 0) scale(1.2); }
          100% { transform: translate3d(-40px, -60px, 0) scale(0.96); }
        }
        .animate-ambient-1 {
          animation: ambient-drift-1 18s ease-in-out infinite alternate;
        }
        .animate-ambient-2 {
          animation: ambient-drift-2 22s ease-in-out infinite alternate;
        }
        .animate-ambient-3 {
          animation: ambient-drift-3 16s ease-in-out infinite alternate;
        }
        .animate-ambient-4 {
          animation: ambient-drift-4 20s ease-in-out infinite alternate;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
        {/* Base background */}
        <div className="absolute inset-0 transition-colors duration-700" style={{ backgroundColor: baseBg }} />

        {/* Orb 1: Accent Glow (Top-Left) */}
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[125px] animate-ambient-1"
          style={{
            willChange: "transform",
            background: `radial-gradient(circle, ${accent}55 0%, ${accent}25 45%, transparent 70%)`,
          }}
        />

        {/* Orb 2: Deep secondary glow (Bottom-Right) */}
        <div
          className="absolute -bottom-36 -right-36 w-[640px] h-[640px] rounded-full blur-[130px] animate-ambient-2"
          style={{
            willChange: "transform",
            background: `radial-gradient(circle, ${accent}45 0%, ${accent}20 50%, transparent 70%)`,
          }}
        />

        {/* Orb 3: Warm Ambient Flare (Center-Left) */}
        <div
          className="absolute top-1/4 -left-36 w-[500px] h-[500px] rounded-full blur-[115px] animate-ambient-3"
          style={{
            willChange: "transform",
            background: `radial-gradient(circle, ${accent}38 0%, ${accent}15 50%, transparent 70%)`,
          }}
        />

        {/* Orb 4: Accent Aura (Center-Right) */}
        <div
          className="absolute top-1/2 -right-32 w-[480px] h-[480px] rounded-full blur-[120px] animate-ambient-4"
          style={{
            willChange: "transform",
            background: `radial-gradient(circle, ${accent}35 0%, ${accent}12 50%, transparent 70%)`,
          }}
        />

        {/* Soft Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, transparent 45%, ${baseBg}cc 100%)`,
          }}
        />
      </div>
    </>
  )
}

export function KtvPriceListClient({ initialAuth, initialData }: KtvPriceListClientProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initialAuth)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState("")
  const [isSubmittingPin, setIsSubmittingPin] = useState(false)

  // Live Data initialized from Server Component (Zero Loading Spinner / Zero Jitter)
  const [groups, setGroups] = useState<KtvGroup[]>(initialData?.groups || [])
  const [meta, setMeta] = useState<KtvMeta>(initialData?.meta || defaultMeta)
  const [lastUpdated, setLastUpdated] = useState<string>(formatTimeString(initialData?.updatedAt))
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Quick Copy state
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null)

  const pinInputRef = useRef<HTMLInputElement>(null)

  // Current active theme resolved dynamically
  const activeTheme: ThemeConfig = meta.theme || resolveTheme(meta.selectedThemeId, meta.customColors)

  // Auto-focus PIN input if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setTimeout(() => pinInputRef.current?.focus(), 80)
    }
  }, [isAuthenticated])

  // Fetch or refresh live menu data (in-place background refresh, never blanks the screen)
  const fetchLiveMenu = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch(`/api/ctv/price-list?t=${Date.now()}`, { cache: "no-store" })
      if (res.status === 401) {
        setIsAuthenticated(false)
        return
      }
      const data = await res.json()
      if (res.ok && data.success) {
        setIsAuthenticated(true)
        setGroups(data.groups || [])
        if (data.meta) setMeta(data.meta)
        if (data.updatedAt) setLastUpdated(formatTimeString(data.updatedAt))
      } else {
        setIsAuthenticated(false)
      }
    } catch {
      // Keep existing data on error, don't flash
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle PIN submit
  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!pinInput.trim()) {
      setPinError("Vui lòng nhập mã PIN")
      return
    }

    setIsSubmittingPin(true)
    setPinError("")
    try {
      const res = await fetch("/api/ctv/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPinInput("")
        setIsAuthenticated(true)
        // Load data immediately
        await fetchLiveMenu()
      } else {
        setPinError(data.error || "Mã PIN không chính xác")
      }
    } catch {
      setPinError("Lỗi kết nối khi kiểm tra mã PIN")
    } finally {
      setIsSubmittingPin(false)
    }
  }

  // Handle Logout (Clear PIN session)
  const handleLogout = async () => {
    if (!confirm("Bạn có muốn đăng xuất khỏi cổng xem bảng giá KTV?")) return
    try {
      await fetch("/api/ctv/auth", { method: "DELETE" })
      setIsAuthenticated(false)
      setGroups([])
    } catch {}
  }

  // Format price
  const formatPrice = (price: number) => {
    if (meta.currencyUnit === "k") {
      return `${Math.round(price / 1000)}k`
    }
    return `${price.toLocaleString("vi-VN")}${meta.currencyUnit}`
  }

  // Copy quick quote text for a single item
  const handleCopyItemQuote = async (item: KtvItem) => {
    try {
      const stockText = item.stock > 0 ? `Còn ${item.stock}` : "Tạm hết"
      const text = `${item.name}${item.note ? ` (${item.note})` : ""}: ${formatPrice(item.price)} (${stockText})`
      await navigator.clipboard.writeText(text)
      setCopiedItemId(item.id)
      setTimeout(() => setCopiedItemId(null), 2500)
    } catch {}
  }

  // SCREEN 1: PIN ENTRY LOCK SCREEN (Ultra-modern, sleek, compact)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center p-4 selection:bg-white/20">
        <AmbientBackground theme={activeTheme} />

        <div 
          className="w-full max-w-[320px] rounded-2xl backdrop-blur-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-center relative overflow-hidden space-y-5 border"
          style={{
            backgroundColor: `${activeTheme.containerBg}e6`,
            borderColor: `${activeTheme.accentColor}33`,
            color: activeTheme.textColor,
          }}
        >
          {/* Header */}
          <div className="flex flex-col items-center">
            <div 
              className="size-12 rounded-xl flex items-center justify-center mb-2.5 shadow-inner border"
              style={{
                backgroundColor: `${activeTheme.accentColor}18`,
                borderColor: `${activeTheme.accentColor}40`,
                color: activeTheme.accentColor,
              }}
            >
              <KeyRound className="size-5" />
            </div>
            <span 
              className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full border"
              style={{
                backgroundColor: `${activeTheme.accentColor}15`,
                borderColor: `${activeTheme.accentColor}35`,
                color: activeTheme.accentColor,
              }}
            >
              KTV Premium
            </span>
            <h1 
              className="text-lg sm:text-xl font-black tracking-wider uppercase mt-2"
              style={{ color: activeTheme.textColor }}
            >
              MENU CAPYGO
            </h1>
          </div>

          {/* PIN Form */}
          <form onSubmit={handleVerifyPin} className="space-y-3.5">
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  ref={pinInputRef}
                  type="password"
                  autoComplete="off"
                  placeholder="Nhập mã PIN..."
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value)
                    setPinError("")
                  }}
                  style={{
                    color: activeTheme.textColor,
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-white/15 bg-black/40 text-center font-mono font-bold text-sm tracking-[0.25em] placeholder:text-white/30 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs focus:outline-none focus:ring-1 focus:ring-white/40 transition-all"
                />
              </div>
              {pinError && (
                <p className="text-[11px] text-rose-400 flex items-center justify-center gap-1 font-medium">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{pinError}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmittingPin || !pinInput}
              style={{
                backgroundColor: activeTheme.accentColor,
                color: activeTheme.bgColor === "#FFFFFF" || activeTheme.id === "clean-light" ? "#FFFFFF" : "#0A0B0E",
              }}
              className="w-full py-2.5 rounded-xl active:scale-[0.98] text-xs font-bold tracking-wide uppercase transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {isSubmittingPin ? (
                <>
                  <div className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Đang mở...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  <span>Mở khóa</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // SCREEN 2: LIVE KTV PRICE LIST & STOCK TRACKER (Fully synchronized with Admin's custom colors)
  return (
    <div 
      className="min-h-screen relative pb-16 transition-colors duration-500"
      style={{ color: activeTheme.textColor }}
    >
      <AmbientBackground theme={activeTheme} />

      {/* Sticky Top Status & Action Bar */}
      <header 
        className="sticky top-0 z-30 backdrop-blur-md border-b px-4 py-3 shadow-md transition-colors"
        style={{
          backgroundColor: `${activeTheme.containerBg}dd`,
          borderColor: `${activeTheme.accentColor}25`,
        }}
      >
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3 text-xs">
          {/* Live Status indicator */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex size-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <span 
                className="font-bold block truncate text-[11px] sm:text-xs tracking-wider"
                style={{ color: activeTheme.accentColor }}
              >
                MENU CAPYGO
              </span>
              {lastUpdated && (
                <span 
                  className="text-[10px] hidden sm:inline"
                  style={{ color: activeTheme.mutedColor }}
                >
                  Cập nhật: {lastUpdated}
                </span>
              )}
            </div>
          </div>

          {/* Refresh & Logout Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchLiveMenu}
              disabled={isRefreshing}
              style={{
                borderColor: `${activeTheme.accentColor}33`,
                backgroundColor: `${activeTheme.accentColor}12`,
                color: activeTheme.textColor,
              }}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Làm mới menu"
            >
              <RotateCw 
                className={`size-3 ${isRefreshing ? "animate-spin" : ""}`} 
                style={{ color: activeTheme.accentColor }}
              />
              <span className="hidden sm:inline">{isRefreshing ? "Đang tải..." : "Làm mới"}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={{ color: activeTheme.mutedColor }}
              className="p-1.5 rounded-lg hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Đăng xuất khỏi bảng giá"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl mx-auto px-4 pt-5 space-y-4 relative z-10">
        {/* The Live Board Display (Exact Theme Colors & Styling) */}
        <div 
          className="rounded-2xl border backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative select-none transition-all duration-300"
          style={{
            backgroundColor: `${activeTheme.containerBg}ea`,
            borderColor: `${activeTheme.accentColor}33`,
            color: activeTheme.textColor,
          }}
        >
          {/* Header */}
          <div 
            className="text-center pb-5 mb-5 border-b"
            style={{ borderColor: `${activeTheme.accentColor}25` }}
          >
            <h2 
              className="text-3xl sm:text-4xl font-black tracking-wider uppercase mb-1 drop-shadow-sm"
              style={{ color: activeTheme.textColor }}
            >
              {meta.menuTitle || "BẢNG GIÁ"}
            </h2>
            {meta.menuSubtitle && (
              <p 
                className="text-xs sm:text-sm font-medium tracking-wide"
                style={{ color: activeTheme.mutedColor }}
              >
                {meta.menuSubtitle}
              </p>
            )}
          </div>

          {/* Categories & Products */}
          <div className="space-y-6">
            {groups.length === 0 ? (
              <div 
                className="py-12 text-center text-xs"
                style={{ color: activeTheme.mutedColor }}
              >
                Chưa có sản phẩm nào được công bố trong menu.
              </div>
            ) : (
              groups.map((group) => {
                if (group.items.length === 0) return null

                return (
                  <div key={`ktv-group-${group.id}`} className="space-y-2.5">
                    {/* Group Title with Dynamic Color Divider */}
                    <div className="flex items-center gap-3 pt-2">
                      <span 
                        className="text-[12px] sm:text-sm font-black tracking-widest uppercase"
                        style={{ color: activeTheme.accentColor }}
                      >
                        {group.name}
                      </span>
                      <div 
                        className="flex-1 h-[1.5px]" 
                        style={{ backgroundColor: activeTheme.dividerColor || activeTheme.accentColor, opacity: 0.55 }}
                      />
                    </div>

                    {/* Group Items */}
                    <div className="space-y-1.5 pl-0.5">
                      {group.items.map((item) => {
                        const inStock = item.stock > 0
                        const isCopied = copiedItemId === item.id

                        return (
                          <div
                            key={item.id}
                            className="group flex items-baseline justify-between gap-3 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                          >
                            {/* Product Name & optional Note */}
                            <div className="min-w-0 flex-1 leading-snug">
                              <span
                                className="text-[12px] sm:text-[13px] font-semibold tracking-wide transition-colors"
                                style={{
                                  color: inStock ? activeTheme.textColor : `${activeTheme.mutedColor}99`,
                                }}
                              >
                                {item.name}
                              </span>
                              {meta.showNotes && item.note && (
                                <span 
                                  className="text-[11px] ml-1.5 font-normal italic"
                                  style={{ color: activeTheme.mutedColor }}
                                >
                                  ({item.note})
                                </span>
                              )}
                            </div>

                            {/* Stock Badge & Price & Quick Copy */}
                            <div className="flex items-center gap-2.5 shrink-0">
                              {/* Live Stock Badge */}
                              {meta.showStock && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide ${
                                    inStock
                                      ? item.stock <= 3
                                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                        : "bg-white/10 text-current border border-white/10"
                                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  }`}
                                >
                                  {inStock ? `Còn ${item.stock}` : "Hết"}
                                </span>
                              )}

                              {/* Price */}
                              <span
                                className="text-[13px] sm:text-[14px] font-black tracking-tight"
                                style={{
                                  color: inStock 
                                    ? (activeTheme.priceColor || activeTheme.textColor)
                                    : activeTheme.mutedColor,
                                }}
                              >
                                {formatPrice(item.price)}
                              </span>

                              {/* Quick Quote Copy Button */}
                              <button
                                type="button"
                                onClick={() => handleCopyItemQuote(item)}
                                className={`p-1 rounded transition-all ${
                                  isCopied
                                    ? "text-emerald-400 bg-emerald-500/20"
                                    : "opacity-60 hover:opacity-100 group-hover:opacity-100"
                                }`}
                                style={{ color: isCopied ? undefined : activeTheme.mutedColor }}
                                title="Sao chép cú pháp báo giá gửi khách"
                              >
                                {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Branding & Notes */}
          <div 
            className="mt-8 pt-5 border-t text-center space-y-1.5"
            style={{ borderColor: `${activeTheme.accentColor}25` }}
          >
            {meta.footerDomain && (
              <p 
                className="text-xs sm:text-sm font-black tracking-widest uppercase"
                style={{ color: activeTheme.accentColor }}
              >
                {meta.footerDomain}
              </p>
            )}
            {meta.footerNote && (
              <p 
                className="text-[10px] sm:text-[11px] leading-relaxed"
                style={{ color: activeTheme.mutedColor }}
              >
                {meta.footerNote}
              </p>
            )}
            {meta.hotline && (
              <p 
                className="text-[10px] sm:text-[11px] font-semibold"
                style={{ color: `${activeTheme.textColor}cc` }}
              >
                Hotline / Zalo: <span className="font-mono font-bold" style={{ color: activeTheme.accentColor }}>{meta.hotline}</span>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
