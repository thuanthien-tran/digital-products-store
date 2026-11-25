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
        <strong className="font-semibold text-foreground tabular-nums">
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-foreground border border-border">
              <span>“{trimmedQuery}”</span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Xóa từ khóa tìm kiếm"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}

          {priceRange !== "all" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-foreground border border-border">
              <span>{priceRangeLabels[priceRange]}</span>
              <button
                type="button"
                onClick={() => setPriceRange("all")}
                aria-label="Bỏ lọc giá"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </span>
          )}

          {sortBy !== "default" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-foreground border border-border">
              <span>{sortOptionLabels[sortBy]}</span>
              <button
                type="button"
                onClick={() => setSortBy("default")}
                aria-label="Đặt lại sắp xếp"
                className="text-muted-foreground hover:text-foreground"
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
        {/* Responsive Grid: 1 col on narrow mobile so prices/conditions stay crisp, 2 cols sm, 3 cols lg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
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

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            className="flex items-center justify-center pt-5 border-t border-border"
            aria-label="Phân trang danh mục sản phẩm"
          >
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(validPage - 1)}
                disabled={validPage <= 1}
                className="h-10 px-3 rounded-xl text-xs font-medium border-border hover:bg-secondary disabled:opacity-35"
                aria-label="Trang trước"
              >
                <ChevronLeft className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Trước</span>
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  const isActive = page === validPage
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => handlePageChange(page)}
                      aria-current={isActive ? "page" : undefined}
                      className={`size-10 rounded-xl text-sm font-semibold transition-btn flex items-center justify-center border ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary border-border"
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(validPage + 1)}
                disabled={validPage >= totalPages}
                className="h-10 px-3 rounded-xl text-xs font-medium border-border hover:bg-secondary disabled:opacity-35"
                aria-label="Trang sau"
              >
                <span className="hidden sm:inline">Sau</span>
                <ChevronRight className="size-4 sm:ml-1" />
              </Button>
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

          {/* Sidebar Filters (desktop sticky, collapsible on mobile — 1 DOM tree, no duplicate IDs) */}
          <aside
            id={`${catalogId}-sidebar-filters`}
            className={`w-full lg:w-64 shrink-0 lg:sticky lg:top-20 self-start space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5 ${
              isMobileFilterOpen ? "block" : "hidden lg:block"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" />
                <span>Bộ lọc</span>
              </h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Đặt lại
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground block">
                Danh mục
              </span>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroup("all")
                    setIsMobileFilterOpen(false)
                  }}
                  className={`w-full min-h-[40px] flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-btn ${
                    selectedGroup === "all"
                      ? "bg-primary/15 text-primary border border-primary/35 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                  }`}
                >
                  <span>Tất cả</span>
                  <span className="text-xs tabular-nums">{productsWithLiveStock.length}</span>
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
                      className={`w-full min-h-[40px] flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-btn ${
                        isSelected
                          ? "bg-primary/15 text-primary border border-primary/35 font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                      }`}
                    >
                      <span className="truncate pr-2 text-left">{g.name}</span>
                      <span className="text-xs tabular-nums shrink-0">{g.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-2 pt-3 border-t border-border">
              <span className="text-xs font-semibold text-muted-foreground block">
                Khoảng giá
              </span>
              <div className="space-y-1">
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
                      className={`w-full min-h-[38px] flex items-center justify-between px-3 py-1.5 rounded-xl text-sm transition-btn ${
                        isSelected
                          ? "bg-primary/15 text-primary border border-primary/35 font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
                      }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sort */}
            <div className="space-y-2 pt-3 border-t border-border">
              <label
                htmlFor={`${catalogId}-sidebar-sort`}
                className="text-xs font-semibold text-muted-foreground block"
              >
                Sắp xếp
              </label>
              <div className="relative">
                <select
                  id={`${catalogId}-sidebar-sort`}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOptionKey)}
                  style={{ WebkitAppearance: "none", MozAppearance: "none" }}
                  className="w-full h-10 pl-3 pr-9 rounded-xl bg-background border border-border text-foreground text-sm leading-normal focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 appearance-none bg-none cursor-pointer"
                >
                  <option value="default">Mặc định</option>
                  <option value="price_asc">Giá: Thấp đến cao</option>
                  <option value="price_desc">Giá: Cao đến thấp</option>
                  <option value="name_asc">Tên: A – Z</option>
                  <option value="name_desc">Tên: Z – A</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </aside>

          {/* Right: Search + Results + Grid */}
          <div className="flex-1 min-w-0 space-y-5 w-full">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <input
                id={`${catalogId}-search`}
                type="search"
                autoComplete="off"
                placeholder="Tìm phần mềm, AI, gói nâng cấp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm sản phẩm"
                className="w-full h-12 pl-10 pr-10 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-btn"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {renderResultSummary()}
            {renderProductGridContent()}
          </div>
        </div>
        </>
      ) : (
        /* Home Editorial Flow: 1) Tìm kiếm & danh mục -> 2) Gói nổi bật -> 3) Danh sách sản phẩm */
        <div className="space-y-8">
          <div className="space-y-3">
            {/* Prominent Search Bar */}
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <input
                id={`${catalogId}-home-search`}
                type="search"
                autoComplete="off"
                placeholder="Tìm phần mềm, AI, gói nâng cấp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm sản phẩm"
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-btn"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Category Tabs (left) + Price & Sort Controls (right) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Category Strip with smooth sliding active pill + subtle right fade on mobile */}
              <div className="relative min-w-0 flex-1">
                <div
                  ref={tabListRef}
                  role="tablist"
                  aria-label="Danh mục sản phẩm"
                  className="relative flex items-center gap-1.5 overflow-x-auto pb-0.5 pr-6 lg:pr-0 no-scrollbar"
                >
                  {/* Sliding Caramel Indicator Pill */}
                  <span
                    ref={tabIndicatorRef}
                    aria-hidden="true"
                    style={{ opacity: 0 }}
                    className="pointer-events-none absolute left-0 top-0 h-[36px] rounded-full bg-primary transition-[transform,width,opacity] duration-[210ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  />

                  <button
                    type="button"
                    role="tab"
                    data-category-tab="all"
                    aria-selected={selectedGroup === "all"}
                    onClick={() => setSelectedGroup("all")}
                    className={`relative z-10 min-h-[36px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap border shrink-0 transition-btn ${
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
                        className={`relative z-10 min-h-[36px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap border shrink-0 transition-btn ${
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
                  className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent lg:hidden"
                />
              </div>

              {/* Clean Single-Arrow Price & Sort Controls */}
              <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value as PriceRangeKey)}
                  aria-label="Lọc theo mức giá"
                  className="w-full sm:w-auto h-9 px-3 rounded-xl bg-card border border-border text-foreground text-xs sm:text-sm leading-normal focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 cursor-pointer"
                >
                  <option value="all">Giá: Tất cả</option>
                  <option value="under_50k">Dưới 50.000₫</option>
                  <option value="50k_100k">50.000₫ – 100.000₫</option>
                  <option value="100k_200k">100.000₫ – 200.000₫</option>
                  <option value="above_200k">Trên 200.000₫</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOptionKey)}
                  aria-label="Sắp xếp sản phẩm"
                  className="w-full sm:w-auto h-9 px-3 rounded-xl bg-card border border-border text-foreground text-xs sm:text-sm leading-normal focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 cursor-pointer"
                >
                  <option value="default">Sắp xếp: Mặc định</option>
                  <option value="price_asc">Giá: Thấp → Cao</option>
                  <option value="price_desc">Giá: Cao → Thấp</option>
                  <option value="name_asc">Tên: A – Z</option>
                  <option value="name_desc">Tên: Z – A</option>
                </select>
              </div>
            </div>
          </div>

          {renderFeaturedSection()}

          <div id="catalog-heading" className="scroll-mt-20 space-y-5">
            {title && (
              <div className="space-y-1">
                <h2 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
                  {title}
                </h2>
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
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
