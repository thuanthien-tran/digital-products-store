"use client"

import { useState, useRef, useEffect } from "react"
import { ShieldCheck, AlertCircle, ChevronDown } from "lucide-react"

interface ProductDetailSectionsProps {
  highlights: string[]
  instructions: string
  descriptionParagraphs: string[]
  notice: string
  warranty: string
}

function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="text-foreground font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

export function ProductDetailSections({
  highlights,
  instructions,
  descriptionParagraphs,
  notice,
  warranty,
}: ProductDetailSectionsProps) {
  const hasInfo = highlights.length > 0 || descriptionParagraphs.length > 0
  const hasInstructions = instructions.length > 0
  const hasNotice = notice.length > 0

  type TabKey = "info" | "instructions" | "warranty" | "notice"
  const availableTabs: Array<{ key: TabKey; label: string }> = [
    ...(hasInfo ? [{ key: "info" as const, label: "Thông tin" }] : []),
    ...(hasInstructions ? [{ key: "instructions" as const, label: "Hướng dẫn" }] : []),
    { key: "warranty" as const, label: "Bảo hành" },
    ...(hasNotice ? [{ key: "notice" as const, label: "Lưu ý" }] : []),
  ]

  const [activeTab, setActiveTab] = useState<TabKey>(availableTabs[0]?.key || "warranty")
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const tabListRef = useRef<HTMLDivElement>(null)
  const tabIndicatorRef = useRef<HTMLSpanElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const listEl = tabListRef.current
    const indicatorEl = tabIndicatorRef.current
    if (!listEl || !indicatorEl) return

    const updateIndicator = () => {
      const activeBtn = listEl.querySelector<HTMLButtonElement>(`[data-detail-tab="${activeTab}"]`)
      if (!activeBtn) {
        indicatorEl.style.opacity = "0"
        return
      }
      indicatorEl.style.width = `${activeBtn.offsetWidth}px`
      indicatorEl.style.transform = `translate3d(${activeBtn.offsetLeft}px, 0, 0)`
      indicatorEl.style.opacity = "1"
    }

    const rafId = requestAnimationFrame(updateIndicator)
    window.addEventListener("resize", updateIndicator, { passive: true })
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", updateIndicator)
    }
  }, [activeTab])

  // Check if mobile tab content exceeds the fixed compact height
  useEffect(() => {
    const el = contentScrollRef.current
    if (!el) return
    const checkOverflow = () => {
      setHasOverflow(el.scrollHeight > 172)
    }
    const rafId = requestAnimationFrame(checkOverflow)
    window.addEventListener("resize", checkOverflow, { passive: true })
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", checkOverflow)
    }
  }, [activeTab])

  const renderWarrantyBody = (isMobile = false) =>
    warranty ? (
      <p
        className={`${
          isMobile ? "text-[13px]" : "text-sm"
        } text-muted-foreground leading-[1.6] whitespace-pre-line break-words [overflow-wrap:anywhere]`}
      >
        {warranty}
      </p>
    ) : (
      <ul
        className={`space-y-2 ${
          isMobile ? "text-[13px]" : "text-sm"
        } text-muted-foreground leading-[1.6]`}
      >
        <li className="flex items-start gap-2">
          <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
          <span>Chính sách bảo hành áp dụng theo từng gói cụ thể đã ghi rõ trên sản phẩm.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
          <span>Thông tin bàn giao và hóa đơn điện tử được lưu trực tiếp tại trang chi tiết đơn hàng.</span>
        </li>
      </ul>
    )

  return (
    <div className="lg:col-start-1 lg:col-span-7 lg:row-start-2 min-w-0 w-full">
      {/* MOBILE (< lg): Compact Sliding Pill Tabs with standardized height & strict width containment */}
      <div className="lg:hidden min-w-0 w-full rounded-2xl border border-border bg-card p-3.5 space-y-2.5 overflow-hidden">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Chi tiết sản phẩm"
          className="relative flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
        >
          {/* Smooth Sliding Caramel Pill */}
          <span
            ref={tabIndicatorRef}
            aria-hidden="true"
            style={{ opacity: 0 }}
            className="pointer-events-none absolute left-0 top-0 h-[30px] rounded-full bg-primary shadow-[0_4px_12px_-4px_rgba(230,166,111,0.45)] transition-[transform,width,opacity] duration-[200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          />

          {availableTabs.map((tab) => {
            const isSelected = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                data-detail-tab={tab.key}
                aria-selected={isSelected}
                onClick={() => {
                  setActiveTab(tab.key)
                  setIsExpanded(false)
                  if (contentScrollRef.current) {
                    contentScrollRef.current.scrollTop = 0
                  }
                }}
                className={`relative z-10 h-[30px] px-3 rounded-full text-xs font-semibold whitespace-nowrap border shrink-0 active:scale-[0.97] transition-btn cursor-pointer ${
                  isSelected
                    ? "text-primary-foreground border-transparent"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="relative min-w-0">
          <div
            ref={contentScrollRef}
            key={activeTab}
            className={`pt-1 pr-1 text-[13px] text-muted-foreground leading-[1.6] break-words [overflow-wrap:anywhere] animate-grid-switch overflow-y-auto overscroll-contain transition-[height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isExpanded
                ? "h-[360px] pb-2"
                : hasOverflow
                ? "h-[168px] pb-9"
                : "h-[168px]"
            }`}
          >
            {activeTab === "info" && (
              <div className="space-y-2">
                {highlights.length > 0 && (
                  <ul className="space-y-1.5">
                    {highlights.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <span className="min-w-0 flex-1">{renderFormattedText(item)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {descriptionParagraphs.length > 0 && (
                  <div className="space-y-1.5">
                    {descriptionParagraphs.map((para, i) => (
                      <p key={i}>{renderFormattedText(para)}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "instructions" && (
              <div className="whitespace-pre-line">{instructions}</div>
            )}

            {activeTab === "warranty" && renderWarrantyBody(true)}

            {activeTab === "notice" && (
              <div className="text-amber-200/90 whitespace-pre-line">{notice}</div>
            )}
          </div>

          {/* Overlay fade + Expand pill inside the fixed 168px box (zero height shift between tabs) */}
          {hasOverflow && !isExpanded && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card via-card/95 to-transparent flex items-end justify-center pb-0.5">
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="pointer-events-auto inline-flex items-center gap-1 px-3 py-1 rounded-full border border-border/80 bg-card/95 text-[11.5px] font-medium text-primary hover:text-primary/80 active:scale-[0.97] transition-btn cursor-pointer shadow-sm"
              >
                <span>Xem đầy đủ</span>
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {hasOverflow && isExpanded && (
          <div className="pt-1 flex justify-center border-t border-border/50">
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false)
                if (contentScrollRef.current) {
                  contentScrollRef.current.scrollTop = 0
                }
              }}
              className="inline-flex items-center gap-1 pt-1 text-[11.5px] font-medium text-primary hover:text-primary/80 active:scale-[0.97] transition-btn cursor-pointer"
            >
              <span>Thu gọn</span>
              <ChevronDown className="size-3.5 rotate-180" />
            </button>
          </div>
        )}
      </div>

      {/* DESKTOP (lg+): Full Open Editorial Sections */}
      <div className="hidden lg:block space-y-6 pt-2 min-w-0">
        {(highlights.length > 0 || hasInstructions) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
            {highlights.length > 0 && (
              <section className="space-y-2.5 min-w-0">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Điểm nổi bật
                </h2>
                <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
                  {highlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span className="min-w-0 flex-1">{renderFormattedText(item)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {hasInstructions && (
              <section className="space-y-2.5 min-w-0">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Hướng dẫn kích hoạt
                </h2>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">
                  {instructions}
                </div>
              </section>
            )}
          </div>
        )}

        {descriptionParagraphs.length > 0 && (
          <section className="pt-5 border-t border-border space-y-2.5 min-w-0">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Thông tin chi tiết
            </h2>
            <div className="space-y-2 text-sm text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
              {descriptionParagraphs.map((para, i) => (
                <p key={i}>{renderFormattedText(para)}</p>
              ))}
            </div>
          </section>
        )}

        {hasNotice && (
          <section className="pt-5 border-t border-border space-y-2.5 min-w-0">
            <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle className="size-4 text-amber-400" />
              <span>Lưu ý quan trọng</span>
            </h2>
            <div className="text-sm text-amber-200/90 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">
              {notice}
            </div>
          </section>
        )}

        <section className="pt-5 border-t border-border space-y-2.5 min-w-0">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-primary" />
            <span>Chính sách bảo hành</span>
          </h2>
          {renderWarrantyBody(false)}
        </section>
      </div>
    </div>
  )
}
