"use client"

import { useState, useMemo, useEffect, useRef, useId } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Search,
  X,
  RefreshCw,
  ChevronDown,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { ProductCard, type ProductCardVariant } from "@/components/storefront/ProductCard"
import { FeaturedBentoShowcase } from "@/components/storefront/FeaturedBentoShowcase"
import { normalizeVietnamese } from "@/lib/utils"

export type StorefrontVariant = ProductCardVariant

export interface StorefrontProduct {
  id: string
  name: string
  slug: string
  isFeatured?: boolean
  sortOrder?: number
  description?: string
  images?: string[]
  groupId: string | null
  groupName: string
  deliveryType: string
  statusOverride?: string
  highlights?: string[]
  warrantyTerms?: string | null
  noticeNotes?: string | null
  variants: StorefrontVariant[]
}

export interface StorefrontGroup {
  id: string
  name: string
}

interface StorefrontCatalogProps {
  groups: StorefrontGroup[]
  products: StorefrontProduct[]
  showFeatured?: boolean
  title?: string
  subtitle?: string
  sidebarLayout?: boolean
}

const ITEMS_PER_PAGE = 9

type PriceRangeKey = "all" | "under_50k" | "50k_100k" | "100k_200k" | "above_200k"
type SortOptionKey = "default" | "price_asc" | "price_desc" | "name_asc" | "name_desc"

const viCollator = new Intl.Collator("vi", { sensitivity: "base", numeric: true })

export function StorefrontCatalog({
  groups,
  products,
  showFeatured = true,
  title = "Danh sách sản phẩm",
  subtitle,
  sidebarLayout = false,
}: StorefrontCatalogProps) {
  const catalogId = useId()
  const [catalogProducts, setCatalogProducts] = useState<StorefrontProduct[]>(products)
  const [catalogGroups, setCatalogGroups] = useState<StorefrontGroup[]>(groups)
  const [selectedGroup, setSelectedGroup] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [priceRange, setPriceRange] = useState<PriceRangeKey>("all")
  const [sortBy, setSortBy] = useState<SortOptionKey>("default")
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false)
  const [liveStockMap, setLiveStockMap] = useState<
    Record<string, { availableStock: number; isPurchasable: boolean }>
  >({})
  const tabListRef = useRef<HTMLDivElement>(null)
  const tabIndicatorRef = useRef<HTMLSpanElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Press "/" anywhere (outside inputs) to jump straight to search
  useEffect(() => {
    const handleSlashShortcut = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener("keydown", handleSlashShortcut)
    return () => window.removeEventListener("keydown", handleSlashShortcut)
  }, [])

  useEffect(() => {
    setCatalogProducts(products)
  }, [products])

  useEffect(() => {
    setCatalogGroups(groups)
  }, [groups])

  // Live Auto-Sync catalog from server API
  const fetchLiveCatalog = async () => {
    try {
      const res = await fetch("/api/store/catalog", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.products)) {
        setCatalogProducts(data.products)
      }
      if (Array.isArray(data.groups)) {
        setCatalogGroups(data.groups)
      }
    } catch {
      // silent
    }
  }

  // Cross-tab and visibility auto-sync listeners
  useEffect(() => {
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel("store_catalog_sync")
      bc.onmessage = () => {
        void fetchLiveCatalog()
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "store_catalog_sync") {
        void fetchLiveCatalog()
      }
    }
    window.addEventListener("storage", handleStorage)

    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void fetchLiveCatalog()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityOrFocus)
    window.addEventListener("focus", handleVisibilityOrFocus)

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        void fetchLiveCatalog()
      }
    }, 10000)

    return () => {
      if (bc) bc.close()
      window.removeEventListener("storage", handleStorage)
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
      window.removeEventListener("focus", handleVisibilityOrFocus)
      clearInterval(interval)
    }
  }, [])

  const allVariantIds = useMemo(() => {
    return catalogProducts.flatMap((p) => p.variants.map((v) => v.id))
  }, [catalogProducts])

  // Periodic lightweight live stock update (paused when tab is hidden)
  useEffect(() => {
    if (allVariantIds.length === 0) return

    let isMounted = true
    const checkAvailability = async () => {
      if (typeof document !== "undefined" && document.hidden) return
      try {
        const idBatch = allVariantIds.slice(0, 50).join(",")
        const res = await fetch(
          `/api/store/availability?variantIds=${encodeURIComponent(idBatch)}`,
          { cache: "no-store" }
        )
        if (!res.ok) return
        const data = await res.json()
        if (data.items && isMounted) {
          setLiveStockMap((prev) => {
            const next = { ...prev }
            for (const item of data.items) {
              next[item.variantId] = {
                availableStock: item.availableStock,
                isPurchasable: item.isPurchasable,
              }
            }
            return next
          })
        }
      } catch {
        // silent
      }
    }

    const interval = setInterval(checkAvailability, 25000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [allVariantIds])

  const productsWithLiveStock = useMemo(() => {
    if (Object.keys(liveStockMap).length === 0) return catalogProducts
    return catalogProducts.map((p) => ({
      ...p,
      variants: p.variants.map((v) => {
        const live = liveStockMap[v.id]
        if (!live) return v
        return {
          ...v,
          availableStock: live.availableStock,
        }
      }),
    }))
  }, [catalogProducts, liveStockMap])

  // Featured Products ("Gói nổi bật" — strictly respects Admin's selection and sortOrder)
  const featuredProducts = useMemo(() => {
    return productsWithLiveStock
      .filter((p) => Boolean(p.isFeatured))
      .sort((a, b) => {
        const orderA = a.sortOrder ?? 0
        const orderB = b.sortOrder ?? 0
        if (orderA !== orderB) return orderA - orderB
        return a.id.localeCompare(b.id)
      })
      .slice(0, 6)
  }, [productsWithLiveStock])

  const handleScrollToCatalog = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    const target = document.getElementById("catalog-heading")
    if (target) {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      })
      window.history.pushState(null, "", "#catalog-heading")
    }
  }

  // Featured Carousel Mobile Controls
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const featuredCarouselRef = useRef<HTMLDivElement>(null)
  const activeFeaturedIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (featuredProducts.length === 0) {
      setFeaturedIndex(0)
      activeFeaturedIdRef.current = null
      return
    }

    if (activeFeaturedIdRef.current) {
      const existingIdx = featuredProducts.findIndex(
        (p) => p.id === activeFeaturedIdRef.current
      )
      if (existingIdx !== -1) {
        setFeaturedIndex(existingIdx)
        return
      }
    }

    setFeaturedIndex((prev) => {
      const clamped = Math.min(prev, featuredProducts.length - 1)
      activeFeaturedIdRef.current = featuredProducts[clamped]?.id || null
      return clamped
    })
  }, [featuredProducts])

  useEffect(() => {
    const container = featuredCarouselRef.current
    if (!container || featuredProducts.length <= 1) return

    const slides = container.querySelectorAll<HTMLElement>("[data-featured-slide]")
    if (slides.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idxAttr = entry.target.getAttribute("data-slide-index")
            const idAttr = entry.target.getAttribute("data-product-id")
            if (idxAttr !== null) {
              const parsed = parseInt(idxAttr, 10)
              if (!isNaN(parsed)) {
                setFeaturedIndex(parsed)
                if (idAttr) activeFeaturedIdRef.current = idAttr
              }
            }
          }
        }
      },
      { root: container, threshold: 0.5 }
    )

    slides.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [featuredProducts])

  const scrollFeaturedTo = (index: number) => {
    const container = featuredCarouselRef.current
    if (!container) return
    const slides = container.querySelectorAll<HTMLElement>("[data-featured-slide]")
    const target = slides[index]
    if (target) {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "nearest",
        inline: "start",
      })
      setFeaturedIndex(index)
      const idAttr = target.getAttribute("data-product-id")
      if (idAttr) activeFeaturedIdRef.current = idAttr
    }
  }

  const activeGroups = useMemo(() => {
    return catalogGroups
      .filter((g) => productsWithLiveStock.some((p) => p.groupId === g.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        count: productsWithLiveStock.filter((p) => p.groupId === g.id).length,
      }))
  }, [catalogGroups, productsWithLiveStock])

  const getProductLowestPrice = (p: StorefrontProduct): number => {
    if (!p.variants || p.variants.length === 0) return 0
    const inStock = p.variants.filter((v) => v.availableStock > 0)
    const pool = inStock.length > 0 ? inStock : p.variants
    return pool.reduce(
      (min, v) => (v.priceCents < min ? v.priceCents : min),
      pool[0].priceCents
    )
  }

  const filteredProducts = useMemo(() => {
    const qTrim = searchQuery.trim().toLowerCase()
    const qNorm = normalizeVietnamese(searchQuery)

    const list = productsWithLiveStock.filter((p) => {
      if (selectedGroup !== "all" && p.groupId !== selectedGroup) return false

      const lowestPrice = getProductLowestPrice(p)
      if (priceRange === "under_50k" && lowestPrice >= 50000) return false
      if (priceRange === "50k_100k" && (lowestPrice < 50000 || lowestPrice > 100000)) return false
      if (priceRange === "100k_200k" && (lowestPrice < 100000 || lowestPrice > 200000)) return false
      if (priceRange === "above_200k" && lowestPrice <= 200000) return false

      if (!qTrim) return true

      if (
        p.name.toLowerCase().includes(qTrim) ||
        normalizeVietnamese(p.name).includes(qNorm)
      ) {
        return true
      }
      if (
        p.groupName.toLowerCase().includes(qTrim) ||
        normalizeVietnamese(p.groupName).includes(qNorm)
      ) {
        return true
      }
      if (
        (p.description || "").toLowerCase().includes(qTrim) ||
        normalizeVietnamese(p.description || "").includes(qNorm)
      ) {
        return true
      }

      return p.variants.some(
        (v) =>
          v.name.toLowerCase().includes(qTrim) ||
          normalizeVietnamese(v.name).includes(qNorm)
      )
    })

    const sorted = [...list]
    if (sortBy === "price_asc") {
      sorted.sort((a, b) => getProductLowestPrice(a) - getProductLowestPrice(b))
    } else if (sortBy === "price_desc") {
      sorted.sort((a, b) => getProductLowestPrice(b) - getProductLowestPrice(a))
    } else if (sortBy === "name_asc") {
      sorted.sort((a, b) => viCollator.compare(a.name, b.name))
    } else if (sortBy === "name_desc") {
      sorted.sort((a, b) => viCollator.compare(b.name, a.name))
    } else {
      sorted.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    }

    return sorted
  }, [productsWithLiveStock, selectedGroup, searchQuery, priceRange, sortBy])

  const handleResetFilters = () => {
    setSearchQuery("")
    setSelectedGroup("all")
    setPriceRange("all")
    setSortBy("default")
    setCurrentPage(1)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedGroup, searchQuery, priceRange, sortBy])

  // Smooth GPU sliding pill behind active category tab (zero layout shift)
  useEffect(() => {
    const listEl = tabListRef.current
    const indicatorEl = tabIndicatorRef.current
    if (!listEl || !indicatorEl) return

    const updateIndicator = () => {
      const activeBtn = listEl.querySelector<HTMLButtonElement>(
        `[data-category-tab="${CSS.escape(selectedGroup)}"]`
      )
      if (!activeBtn) {
        indicatorEl.style.opacity = "0"
        return
      }
      indicatorEl.style.width = `${activeBtn.offsetWidth}px`
      indicatorEl.style.transform = `translate3d(${activeBtn.offsetLeft}px, 0, 0)`
      indicatorEl.style.opacity = "1"

      // Auto-center active category tab on mobile when strip overflows horizontally
      if (listEl.scrollWidth > listEl.clientWidth + 4) {
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        activeBtn.scrollIntoView({
          behavior: prefersReduced ? "auto" : "smooth",
          inline: "center",
          block: "nearest",
        })
      }
    }

    const rafId = requestAnimationFrame(updateIndicator)
    window.addEventListener("resize", updateIndicator, { passive: true })
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", updateIndicator)
    }
  }, [selectedGroup, catalogGroups, productsWithLiveStock.length])

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1
  const validPage = Math.min(Math.max(1, currentPage), totalPages)

  const paginatedProducts = useMemo(() => {
    const start = (validPage - 1) * ITEMS_PER_PAGE
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredProducts, validPage])

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === validPage) return
    setCurrentPage(page)
    const target = document.getElementById("catalog-heading")
    if (target) {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      })
    }
  }

  const currentGroupName = useMemo(() => {
    if (selectedGroup === "all") return null
    return catalogGroups.find((g) => g.id === selectedGroup)?.name || null
  }, [catalogGroups, selectedGroup])

  const trimmedQuery = searchQuery.trim()
  const hasActiveFilters = Boolean(
    trimmedQuery || selectedGroup !== "all" || priceRange !== "all" || sortBy !== "default"
  )

  const priceRangeLabels: Record<PriceRangeKey, string> = {
    all: "Tất cả mức giá",
    under_50k: "Dưới 50.000₫",
    "50k_100k": "50.000₫ – 100.000₫",
    "100k_200k": "100.000₫ – 200.000₫",
    above_200k: "Trên 200.000₫",
  }

  const sortOptionLabels: Record<SortOptionKey, string> = {
    default: "Sắp xếp mặc định",
    price_asc: "Giá: Thấp đến cao",
    price_desc: "Giá: Cao đến thấp",
    name_asc: "Tên: A – Z",
    name_desc: "Tên: Z – A",
  }

  const renderResultSummary = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-sm">
      <p className="text-muted-foreground">
        Hiển thị{" "}
        <strong
          key={filteredProducts.length}
          className="inline-block font-semibold text-foreground tabular-nums animate-price-flash"
        >
          {filteredProducts.length}
        </strong>{" "}
        sản phẩm
        {currentGroupName ? (
          <>
            {" "}
            trong <strong className="font-semibold text-foreground">{currentGroupName}</strong>
          </>
        ) : null}
      </p>

      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {trimmedQuery && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-foreground border border-border animate-chip-in">
              <span>“{trimmedQuery}”</span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Xóa từ khóa tìm kiếm"
                className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}

          {priceRange !== "all" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-foreground border border-border animate-chip-in">
              <span>{priceRangeLabels[priceRange]}</span>
              <button
                type="button"
                onClick={() => setPriceRange("all")}
                aria-label="Bỏ lọc giá"
                className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}

          {sortBy !== "default" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-foreground border border-border animate-chip-in">
              <span>{sortOptionLabels[sortBy]}</span>
              <button
                type="button"
                onClick={() => setSortBy("default")}
                aria-label="Đặt lại sắp xếp"
                className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-btn"
          >
            <RefreshCw className="size-3.5" />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      )}
    </div>
  )

  const renderProductGridContent = () => {
    if (products.length === 0) {
      return (
        <EmptyState
          title="Cửa hàng đang cập nhật sản phẩm"
          description="Danh mục đang được bổ sung. Vui lòng quay lại sau hoặc nhắn Zalo nếu bạn cần tìm gói cụ thể."
        />
      )
    }

    if (filteredProducts.length === 0) {
      return (
        <EmptyState
          icon={<Search className="size-5" />}
          title="Không tìm thấy sản phẩm phù hợp"
          description="Thử đổi từ khóa tìm kiếm (ví dụ: Canva, ChatGPT, YouTube, Muse) hoặc xóa bộ lọc đang áp dụng."
          action={
            <Button
              type="button"
              onClick={handleResetFilters}
              className="h-11 px-5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-caramel-light transition-btn"
            >
              <RefreshCw className="size-4 mr-1.5" />
              <span>Xóa bộ lọc và xem tất cả</span>
            </Button>
          }
        />
      )
    }

    return (
      <div className="space-y-6">
        {/* Responsive Grid: 2 cols on mobile for compact browsing, 3 cols on desktop */}
        <div
          key={`${selectedGroup}-${priceRange}-${sortBy}-${validPage}`}
          className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-5 items-stretch animate-grid-switch"
        >
          {paginatedProducts.map((p) => (
            <div key={`${selectedGroup}-${p.id}`} className="h-full flex flex-col min-w-0">
              <ProductCard
                id={p.id}
                name={p.name}
                slug={p.slug}
                description={p.description}
                images={p.images}
                groupId={p.groupId}
                groupName={p.groupName}
                deliveryType={p.deliveryType}
                statusOverride={p.statusOverride}
                highlights={p.highlights}
                warrantyTerms={p.warrantyTerms}
                noticeNotes={p.noticeNotes}
                variants={p.variants}
              />
            </div>
          ))}
        </div>

        {/* Pagination — Clean Single-Row Floating Bubble Buttons */}
        {totalPages > 1 && (
          <nav
            className="flex items-center justify-center pt-5 sm:pt-6 border-t border-border"
            aria-label="Phân trang danh mục sản phẩm"
          >
            <div className="inline-flex items-center gap-1.5 sm:gap-2 flex-nowrap justify-center">
              <button
                type="button"
                onClick={() => handlePageChange(validPage - 1)}
                disabled={validPage <= 1}
                className="group/prev inline-flex items-center justify-center size-8 sm:w-auto sm:h-10 sm:px-3.5 rounded-full text-xs font-medium border border-border bg-card text-foreground hover:border-primary/60 hover:text-primary disabled:opacity-35 disabled:cursor-not-allowed pagination-bubble cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Trang trước"
              >
                <span aria-hidden="true" className="micro-bubble-a" />
                <span aria-hidden="true" className="micro-bubble-b" />
                <ChevronLeft className="size-3.5 sm:size-4 sm:mr-1 transition-transform duration-150 group-hover/prev:-translate-x-0.5" />
                <span className="hidden sm:inline">Trước</span>
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  const isActive = page === validPage
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => handlePageChange(page)}
                      aria-current={isActive ? "page" : undefined}
                      className={`size-8 sm:size-10 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0 ${
                        isActive
                          ? "text-[#251A14] border-[#FCE0C2]/80 font-bold pagination-bubble-active"
                          : "bg-card text-muted-foreground hover:text-foreground hover:border-primary/60 hover:bg-secondary border-border pagination-bubble"
                      }`}
                    >
                      <span aria-hidden="true" className="micro-bubble-a" />
                      <span aria-hidden="true" className="micro-bubble-b" />
                      <span>{page}</span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(validPage + 1)}
                disabled={validPage >= totalPages}
                className="group/next inline-flex items-center justify-center size-8 sm:w-auto sm:h-10 sm:px-3.5 rounded-full text-xs font-semibold border border-border bg-card text-foreground hover:border-primary/60 hover:text-primary disabled:opacity-35 disabled:cursor-not-allowed pagination-bubble cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Trang sau"
              >
                <span aria-hidden="true" className="micro-bubble-a" />
                <span aria-hidden="true" className="micro-bubble-b" />
                <span className="hidden sm:inline">Sau</span>
                <ChevronRight className="size-3.5 sm:size-4 sm:ml-1 transition-transform duration-150 group-hover/next:translate-x-0.5" />
              </button>
            </div>
          </nav>
        )}
      </div>
    )
  }

  const renderFeaturedSection = () => {
    if (!showFeatured || featuredProducts.length === 0 || hasActiveFilters) return null
    return (
      <FeaturedBentoShowcase
        products={featuredProducts}
        onViewAllClick={handleScrollToCatalog}
      />
    )
  }

  return (
    <section id="products" className="scroll-mt-20 space-y-8">
      {sidebarLayout ? (
        <>
          <div id="catalog-heading" className="scroll-mt-20 space-y-1">
            {title ? (
              <>
                <h2 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
                  {title}
                </h2>
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
              </>
            ) : null}
          </div>
          <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* Mobile filter toggle (single source of truth — toggles sidebar visibility on < lg) */}
          <div className="lg:hidden w-full">
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen((prev) => !prev)}
              aria-expanded={isMobileFilterOpen}
              aria-controls={`${catalogId}-sidebar-filters`}
              className="w-full min-h-[44px] flex items-center justify-between px-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-btn"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" />
                <span>Bộ lọc &amp; Danh mục</span>
                {currentGroupName && (
                  <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-primary font-semibold">
                    {currentGroupName}
                  </span>
                )}
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform duration-150 ${
                  isMobileFilterOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Sidebar Filters (Linear-style sleek sticky sidebar, collapsible on mobile) */}
          <aside
            id={`${catalogId}-sidebar-filters`}
            className={`w-full lg:w-64 shrink-0 lg:sticky lg:top-20 self-start space-y-5 rounded-2xl border border-border/80 bg-card/85 backdrop-blur-sm p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
              isMobileFilterOpen ? "block" : "hidden lg:block"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" />
                <span>Bộ lọc</span>
              </h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-primary hover:text-caramel-light transition-colors cursor-pointer"
                >
                  Đặt lại
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="space-y-1.5">
              <span className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75 block">
                Danh mục
              </span>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroup("all")
                    setIsMobileFilterOpen(false)
                  }}
                  className={`group/item relative w-full min-h-[38px] flex items-center justify-between px-3 py-1.5 rounded-xl text-[13px] transition-ui cursor-pointer ${
                    selectedGroup === "all"
                      ? "bg-primary/14 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  {selectedGroup === "all" && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full bg-primary"
                    />
                  )}
                  <span className="transition-transform duration-150 group-hover/item:translate-x-0.5">
                    Tất cả
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[11px] tabular-nums ${
                      selectedGroup === "all"
                        ? "bg-primary/20 text-primary font-semibold"
                        : "text-muted-foreground/75"
                    }`}
                  >
                    {productsWithLiveStock.length}
                  </span>
                </button>
                {activeGroups.map((g) => {
                  const isSelected = selectedGroup === g.id
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroup(g.id)
                        setIsMobileFilterOpen(false)
                      }}
                      className={`group/item relative w-full min-h-[38px] flex items-center justify-between px-3 py-1.5 rounded-xl text-[13px] transition-ui cursor-pointer ${
                        isSelected
                          ? "bg-primary/14 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full bg-primary"
                        />
                      )}
                      <span className="truncate pr-2 text-left transition-transform duration-150 group-hover/item:translate-x-0.5">
                        {g.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[11px] tabular-nums shrink-0 ${
                          isSelected
                            ? "bg-primary/20 text-primary font-semibold"
                            : "text-muted-foreground/75"
                        }`}
                      >
                        {g.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-1.5 pt-3.5 border-t border-border/70">
              <span className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75 block">
                Khoảng giá
              </span>
              <div className="space-y-0.5">
                {(
                  [
                    { key: "all", label: "Tất cả mức giá" },
                    { key: "under_50k", label: "Dưới 50.000₫" },
                    { key: "50k_100k", label: "50.000₫ – 100.000₫" },
                    { key: "100k_200k", label: "100.000₫ – 200.000₫" },
                    { key: "above_200k", label: "Trên 200.000₫" },
                  ] as const
                ).map((opt) => {
                  const isSelected = priceRange === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setPriceRange(opt.key)
                        setIsMobileFilterOpen(false)
                      }}
                      className={`group/item relative w-full min-h-[36px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13px] transition-ui cursor-pointer ${
                        isSelected
                          ? "bg-primary/14 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-1.5 rounded-full shrink-0 transition-colors duration-150 ${
                          isSelected
                            ? "bg-primary shadow-[0_0_8px_rgba(230,166,111,0.8)]"
                            : "bg-border group-hover/item:bg-muted-foreground"
                        }`}
                      />
                      <span className="transition-transform duration-150 group-hover/item:translate-x-0.5">
                        {opt.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sort */}
            <div className="space-y-2 pt-3.5 border-t border-border/70">
              <label
                htmlFor={`${catalogId}-sidebar-sort`}
                className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75 block"
              >
                Sắp xếp
              </label>
              <select
                id={`${catalogId}-sidebar-sort`}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOptionKey)}
                className="w-full h-10 px-3 rounded-xl bg-background/85 border border-border hover:border-primary/45 text-foreground text-[13px] leading-normal focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-btn cursor-pointer"
              >
                <option value="default">Mặc định</option>
                <option value="price_asc">Giá: Thấp → Cao</option>
                <option value="price_desc">Giá: Cao → Thấp</option>
                <option value="name_asc">Tên: A – Z</option>
                <option value="name_desc">Tên: Z – A</option>
              </select>
            </div>
          </aside>

          {/* Right: Sticky Command-Style Luminous Search + Results + Grid */}
          <div className="flex-1 min-w-0 space-y-3.5 sm:space-y-5 w-full">
            <div className="sticky top-16 z-30 -mx-2 px-2 py-2 bg-background/90 backdrop-blur-md">
              <div className="group relative flex items-center w-full h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-card/95 border border-border/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_-14px_rgba(0,0,0,0.75)] hover:border-border focus-within:border-primary/65 focus-within:bg-card focus-within:shadow-[0_0_0_3px_rgba(230,166,111,0.14),0_12px_28px_-14px_rgba(230,166,111,0.35)] transition-[border-color,background-color,box-shadow] duration-200">
                <div className="pl-3 sm:pl-4 pr-2 sm:pr-2.5 flex items-center pointer-events-none">
                  <Search className="size-4 sm:size-[18px] text-muted-foreground group-focus-within:text-primary group-focus-within:scale-105 transition-[color,transform] duration-150" />
                </div>

                <input
                  ref={searchInputRef}
                  id={`${catalogId}-search`}
                  type="search"
                  autoComplete="off"
                  placeholder="Tìm phần mềm, AI, gói nâng cấp..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      if (searchQuery) setSearchQuery("")
                      else e.currentTarget.blur()
                    }
                  }}
                  aria-label="Tìm kiếm sản phẩm"
                  className="flex-1 min-w-0 h-full bg-transparent text-foreground text-[13.5px] sm:text-[15px] placeholder:text-muted-foreground/75 focus:outline-none pr-2 sm:pr-3 [&::-webkit-search-cancel-button]:hidden"
                />

                <div className="pr-2 sm:pr-2.5 flex items-center gap-1.5 shrink-0">
                  {searchQuery ? (
                    <>
                      <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-medium tabular-nums bg-primary/15 text-primary border border-primary/25 animate-chip-in">
                        {filteredProducts.length}
                        <span className="hidden sm:inline">&nbsp;kết quả</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("")
                          searchInputRef.current?.focus()
                        }}
                        aria-label="Xóa từ khóa tìm kiếm"
                        className="inline-flex size-7 sm:size-8 items-center justify-center rounded-lg sm:rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary active:scale-95 transition-btn animate-chip-in cursor-pointer"
                      >
                        <X className="size-3.5 sm:size-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="hidden md:flex items-center gap-1 mr-1">
                        {["ChatGPT", "YouTube", "Canva", "Claude"].map((kw) => (
                          <button
                            key={kw}
                            type="button"
                            onClick={() => {
                              setSearchQuery(kw)
                              searchInputRef.current?.focus()
                            }}
                            className="px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground bg-background/70 border border-border/70 hover:text-primary hover:border-primary/40 hover:bg-primary/10 active:scale-95 transition-btn cursor-pointer"
                          >
                            {kw}
                          </button>
                        ))}
                      </div>
                      <kbd
                        title="Nhấn phím / để tìm nhanh"
                        className="hidden sm:inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md border border-border/90 bg-background/90 text-[11px] font-mono font-semibold text-muted-foreground/80 select-none"
                      >
                        /
                      </kbd>
                    </>
                  )}
                </div>
              </div>
            </div>

            {renderResultSummary()}
            {renderProductGridContent()}
          </div>
        </div>
        </>
      ) : (
        /* Home Editorial Flow: 1) Sticky Search Bar -> 2) Categories & Filters -> 3) Danh sách sản phẩm */
        <div className="space-y-3 sm:space-y-5">
          {/* Sticky Command-Style Search Bar (pins right below Header on both PC & Mobile while scrolling) */}
          <div className="sticky top-16 z-30 -mx-2 px-2 py-2 bg-background/90 backdrop-blur-md">
            <div className="group relative flex items-center w-full h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-card/95 border border-border/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_20px_-14px_rgba(0,0,0,0.75)] hover:border-border focus-within:border-primary/65 focus-within:bg-card focus-within:shadow-[0_0_0_3px_rgba(230,166,111,0.14),0_12px_28px_-14px_rgba(230,166,111,0.35)] transition-[border-color,background-color,box-shadow] duration-200">
              <div className="pl-3 sm:pl-4 pr-2 sm:pr-2.5 flex items-center pointer-events-none">
                <Search className="size-4 sm:size-[18px] text-muted-foreground group-focus-within:text-primary group-focus-within:scale-105 transition-[color,transform] duration-150" />
              </div>

              <input
                ref={searchInputRef}
                id={`${catalogId}-home-search`}
                type="search"
                autoComplete="off"
                placeholder="Tìm phần mềm, AI, gói nâng cấp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    if (searchQuery) setSearchQuery("")
                    else e.currentTarget.blur()
                  }
                }}
                aria-label="Tìm kiếm sản phẩm"
                className="flex-1 min-w-0 h-full bg-transparent text-foreground text-[13.5px] sm:text-[15px] placeholder:text-muted-foreground/75 focus:outline-none pr-2 sm:pr-3 [&::-webkit-search-cancel-button]:hidden"
              />

              {/* Right slot: Live count + Clear when typing, or quick keywords + "/" keycap when empty */}
              <div className="pr-2 sm:pr-2.5 flex items-center gap-1.5 shrink-0">
                {searchQuery ? (
                  <>
                    <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-medium tabular-nums bg-primary/15 text-primary border border-primary/25 animate-chip-in">
                      {filteredProducts.length}
                      <span className="hidden sm:inline">&nbsp;kết quả</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("")
                        searchInputRef.current?.focus()
                      }}
                      aria-label="Xóa từ khóa tìm kiếm"
                      className="inline-flex size-7 sm:size-8 items-center justify-center rounded-lg sm:rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary active:scale-95 transition-btn animate-chip-in cursor-pointer"
                    >
                      <X className="size-3.5 sm:size-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="hidden md:flex items-center gap-1 mr-1">
                      {["ChatGPT", "YouTube", "Canva", "Claude"].map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => {
                            setSearchQuery(kw)
                            searchInputRef.current?.focus()
                          }}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground bg-background/70 border border-border/70 hover:text-primary hover:border-primary/40 hover:bg-primary/10 active:scale-95 transition-btn cursor-pointer"
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                    <kbd
                      title="Nhấn phím / để tìm nhanh"
                      className="hidden sm:inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md border border-border/90 bg-background/90 text-[11px] font-mono font-semibold text-muted-foreground/80 select-none"
                    >
                      /
                    </kbd>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Category Tabs (left) + Price & Sort Controls (right) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3">
              {/* Category Strip with smooth sliding active pill + subtle right fade on mobile */}
              <div className="relative min-w-0 flex-1">
                <div
                  ref={tabListRef}
                  role="tablist"
                  aria-label="Danh mục sản phẩm"
                  className="relative flex items-center gap-1.5 overflow-x-auto pb-0.5 pr-8 lg:pr-0 no-scrollbar"
                >
                  {/* Sliding Caramel Indicator Pill */}
                  <span
                    ref={tabIndicatorRef}
                    aria-hidden="true"
                    style={{ opacity: 0 }}
                    className="pointer-events-none absolute left-0 top-0 h-[30px] sm:h-[36px] rounded-full bg-primary shadow-[0_4px_14px_-4px_rgba(230,166,111,0.45)] transition-[transform,width,opacity] duration-[210ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  />

                  <button
                    type="button"
                    role="tab"
                    data-category-tab="all"
                    aria-selected={selectedGroup === "all"}
                    onClick={() => setSelectedGroup("all")}
                    className={`relative z-10 h-[30px] sm:h-[36px] px-2.5 sm:px-3.5 rounded-full text-[11.5px] sm:text-sm font-medium whitespace-nowrap border shrink-0 active:scale-[0.97] transition-btn ${
                      selectedGroup === "all"
                        ? "text-primary-foreground border-transparent font-semibold"
                        : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary border-border"
                    }`}
                  >
                    Tất cả ({productsWithLiveStock.length})
                  </button>

                  {activeGroups.map((g) => {
                    const isSelected = selectedGroup === g.id
                    return (
                      <button
                        key={g.id}
                        type="button"
                        role="tab"
                        data-category-tab={g.id}
                        aria-selected={isSelected}
                        onClick={() => setSelectedGroup(g.id)}
                        className={`relative z-10 h-[30px] sm:h-[36px] px-2.5 sm:px-3.5 rounded-full text-[11.5px] sm:text-sm font-medium whitespace-nowrap border shrink-0 active:scale-[0.97] transition-btn ${
                          isSelected
                            ? "text-primary-foreground border-transparent font-semibold"
                            : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary border-border"
                        }`}
                      >
                        {g.name} ({g.count})
                      </button>
                    )
                  })}
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background via-background/85 to-transparent lg:hidden"
                />
              </div>

              {/* Clean Single-Arrow Price & Sort Controls (concise labels so mobile never truncates) */}
              <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value as PriceRangeKey)}
                  aria-label="Lọc theo mức giá"
                  className={`w-full sm:w-auto h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-xl sm:rounded-full bg-card border text-[11.5px] sm:text-sm leading-normal focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-btn cursor-pointer ${
                    priceRange !== "all"
                      ? "border-primary/50 text-primary font-medium"
                      : "border-border hover:border-primary/45 text-foreground"
                  }`}
                >
                  <option value="all">Giá: Tất cả</option>
                  <option value="under_50k">Dưới 50.000₫</option>
                  <option value="50k_100k">50k – 100k</option>
                  <option value="100k_200k">100k – 200k</option>
                  <option value="above_200k">Trên 200.000₫</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOptionKey)}
                  aria-label="Sắp xếp sản phẩm"
                  className={`w-full sm:w-auto h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-xl sm:rounded-full bg-card border text-[11.5px] sm:text-sm leading-normal focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-btn cursor-pointer ${
                    sortBy !== "default"
                      ? "border-primary/50 text-primary font-medium"
                      : "border-border hover:border-primary/45 text-foreground"
                  }`}
                >
                  <option value="default">Mặc định</option>
                  <option value="price_asc">Giá tăng dần</option>
                  <option value="price_desc">Giá giảm dần</option>
                  <option value="name_asc">Tên A – Z</option>
                  <option value="name_desc">Tên Z – A</option>
                </select>
              </div>
            </div>

          {renderFeaturedSection()}

          <div id="catalog-heading" className="scroll-mt-32 space-y-3 sm:space-y-5">
            {title && (
              <div className="space-y-0.5 sm:space-y-1">
                <h2 className="font-heading font-bold text-lg sm:text-2xl tracking-tight text-foreground">
                  {title}
                </h2>
                {subtitle && <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
              </div>
            )}
            {renderResultSummary()}
            {renderProductGridContent()}
          </div>
        </div>
      )}
    </section>
  )
}
