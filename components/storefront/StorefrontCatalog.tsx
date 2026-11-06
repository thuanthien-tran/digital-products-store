"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Search, X, RefreshCw, Layers, ChevronDown, ChevronUp, SlidersHorizontal, Star, ChevronLeft, ChevronRight, EyeOff } from "lucide-react"
import { ProductCard, type ProductCardVariant } from "@/components/storefront/ProductCard"
import { calculateProductPricing } from "@/lib/pricing"
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

const ITEMS_PER_PAGE = 9 // 3x3 grid layout (3 rows x 3 columns on desktop)

type PriceRangeKey = "all" | "under_50k" | "50k_100k" | "100k_200k" | "above_200k"
type SortOptionKey = "default" | "price_asc" | "price_desc" | "name_asc" | "name_desc"

const viCollator = new Intl.Collator("vi", { sensitivity: "base", numeric: true })

export function StorefrontCatalog({
  groups,
  products,
  showFeatured = true,
  title = "Danh mục sản phẩm",
  subtitle,
  sidebarLayout = false,
}: StorefrontCatalogProps) {
  const [catalogProducts, setCatalogProducts] = useState<StorefrontProduct[]>(products)
  const [catalogGroups, setCatalogGroups] = useState<StorefrontGroup[]>(groups)
  const [selectedGroup, setSelectedGroup] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [priceRange, setPriceRange] = useState<PriceRangeKey>("all")
  const [sortBy, setSortBy] = useState<SortOptionKey>("default")
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [isFilterCollapsed, setIsFilterCollapsed] = useState<boolean>(false)
  const [isSearchHidden, setIsSearchHidden] = useState<boolean>(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false)
  const [liveStockMap, setLiveStockMap] = useState<Record<string, { availableStock: number; isPurchasable: boolean }>>({})

  // Sync state if server props change
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
    // 1. BroadcastChannel: Instant cross-tab sync when Admin mutates products
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel("store_catalog_sync")
      bc.onmessage = () => {
        void fetchLiveCatalog()
      }
    } catch {}

    // 2. Storage event: Cross-tab / cross-window sync fallback
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "store_catalog_sync") {
        void fetchLiveCatalog()
      }
    }
    window.addEventListener("storage", handleStorage)

    // 3. Tab visibility & focus: Refresh when user switches back to store tab
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void fetchLiveCatalog()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityOrFocus)
    window.addEventListener("focus", handleVisibilityOrFocus)

    // 4. Background polling every 10 seconds while tab is active
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
        const res = await fetch(`/api/store/availability?variantIds=${encodeURIComponent(idBatch)}`, {
          cache: "no-store",
        })
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

  // Featured Products (Sản phẩm nổi bật)
  // Shared live stock data with zero duplicate polling
  // Hiển thị cả sản phẩm còn hàng lẫn đã hết hàng theo lựa chọn của Admin
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
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })
      window.history.pushState(null, "", "#catalog-heading")
    }
  }

  // Featured Carousel Mobile State & Controls
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const featuredCarouselRef = useRef<HTMLDivElement>(null)
  const activeFeaturedIdRef = useRef<string | null>(null)

  // Maintain active featured slide by product ID during background sync/inventory updates
  useEffect(() => {
    if (featuredProducts.length === 0) {
      setFeaturedIndex(0)
      activeFeaturedIdRef.current = null
      return
    }

    // Preserve product by ID if still in list
    if (activeFeaturedIdRef.current) {
      const existingIdx = featuredProducts.findIndex((p) => p.id === activeFeaturedIdRef.current)
      if (existingIdx !== -1) {
        setFeaturedIndex(existingIdx)
        return
      }
    }

    // Otherwise safely clamp index
    setFeaturedIndex((prev) => {
      const clamped = Math.min(prev, featuredProducts.length - 1)
      activeFeaturedIdRef.current = featuredProducts[clamped]?.id || null
      return clamped
    })
  }, [featuredProducts])

  // Track slide on swipe via IntersectionObserver (lightweight, zero-lag)
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
      {
        root: container,
        threshold: 0.5,
      }
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
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
        inline: "start",
      })
      setFeaturedIndex(index)
      const idAttr = target.getAttribute("data-product-id")
      if (idAttr) activeFeaturedIdRef.current = idAttr
    }
  }

  const handlePrevFeatured = () => {
    if (featuredIndex > 0) {
      scrollFeaturedTo(featuredIndex - 1)
    }
  }

  const handleNextFeatured = () => {
    if (featuredIndex < featuredProducts.length - 1) {
      scrollFeaturedTo(featuredIndex + 1)
    }
  }

  // Filter groups to only those with public products
  const activeGroups = useMemo(() => {
    return catalogGroups
      .filter((g) => productsWithLiveStock.some((p) => p.groupId === g.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        count: productsWithLiveStock.filter((p) => p.groupId === g.id).length,
      }))
  }, [catalogGroups, productsWithLiveStock])

  // Helper to compute representative lowest price for each product
  const getProductLowestPrice = (p: StorefrontProduct): number => {
    if (!p.variants || p.variants.length === 0) return 0
    const inStock = p.variants.filter((v) => v.availableStock > 0)
    const pool = inStock.length > 0 ? inStock : p.variants
    return pool.reduce((min, v) => (v.priceCents < min ? v.priceCents : min), pool[0].priceCents)
  }

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const qTrim = searchQuery.trim().toLowerCase()
    const qNorm = normalizeVietnamese(searchQuery)

    const list = productsWithLiveStock.filter((p) => {
      // 1. Category filter
      const matchGroup = selectedGroup === "all" || p.groupId === selectedGroup
      if (!matchGroup) return false

      // 2. Price Range filter
      const lowestPrice = getProductLowestPrice(p)
      if (priceRange === "under_50k" && lowestPrice >= 50000) return false
      if (priceRange === "50k_100k" && (lowestPrice < 50000 || lowestPrice > 100000)) return false
      if (priceRange === "100k_200k" && (lowestPrice < 100000 || lowestPrice > 200000)) return false
      if (priceRange === "above_200k" && lowestPrice <= 200000) return false

      // 3. Search query filter
      if (!qTrim) return true

      const nameLow = p.name.toLowerCase()
      const nameNorm = normalizeVietnamese(p.name)
      if (nameLow.includes(qTrim) || nameNorm.includes(qNorm)) return true

      const groupLow = p.groupName.toLowerCase()
      const groupNorm = normalizeVietnamese(p.groupName)
      if (groupLow.includes(qTrim) || groupNorm.includes(qNorm)) return true

      const descLow = (p.description || "").toLowerCase()
      const descNorm = normalizeVietnamese(p.description || "")
      if (descLow.includes(qTrim) || descNorm.includes(qNorm)) return true

      const matchVariant = p.variants.some((v) => {
        const vLow = v.name.toLowerCase()
        const vNorm = normalizeVietnamese(v.name)
        return vLow.includes(qTrim) || vNorm.includes(qNorm)
      })
      if (matchVariant) return true

      return false
    })

    // Sort order (immutable with stable copy)
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

  // Reset to page 1 whenever any filter or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedGroup, searchQuery, priceRange, sortBy])

  // Pagination for 3x3 layout
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
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })
    }
  }

  // Selected group name
  const currentGroupName = useMemo(() => {
    if (selectedGroup === "all") return null
    return groups.find((g) => g.id === selectedGroup)?.name || null
  }, [groups, selectedGroup])

  const trimmedQuery = searchQuery.trim()
  const hasActiveFilters = Boolean(
    trimmedQuery || selectedGroup !== "all" || priceRange !== "all" || sortBy !== "default"
  )

  const priceRangeLabels: Record<PriceRangeKey, string> = {
    all: "Tất cả mức giá",
    under_50k: "Dưới 50k",
    "50k_100k": "50k - 100k",
    "100k_200k": "100k - 200k",
    above_200k: "Trên 200k",
  }

  const sortOptionLabels: Record<SortOptionKey, string> = {
    default: "Sắp xếp mặc định",
    price_asc: "Giá: Thấp đến cao",
    price_desc: "Giá: Cao đến thấp",
    name_asc: "Tên: A – Z",
    name_desc: "Tên: Z – A",
  }

  const renderProductGridContent = () => {
    if (products.length === 0) {
      return (
        <div className="py-20 text-center rounded-2xl border border-border/60 bg-card/60 p-8 space-y-3 animate-fade-up backdrop-blur">
          <div className="inline-flex size-12 items-center justify-center rounded-full bg-secondary text-primary mx-auto mb-1">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <p className="text-base font-bold text-foreground">Cửa hàng đang chuẩn bị sản phẩm mới</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Hệ thống đang cập nhật danh mục và các gói tài khoản. Quý khách vui lòng quay lại sau ít phút!
          </p>
        </div>
      )
    }

    if (filteredProducts.length === 0) {
      return (
        <div className="py-16 text-center rounded-2xl border border-border/70 bg-card/60 p-8 space-y-3 animate-fade-up backdrop-blur">
          <div className="inline-flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground mx-auto">
            <Search className="size-6 text-muted-foreground/70" />
          </div>
          <h3 className="text-base font-bold text-foreground">Chưa tìm thấy sản phẩm phù hợp</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Thử tìm bằng từ khóa khác hoặc xóa bộ lọc để xem toàn bộ danh mục sản phẩm đang kinh doanh.
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              onClick={handleResetFilters}
              className="text-xs h-9 px-4 font-semibold active-bounce bg-accent text-accent-foreground hover:opacity-90"
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              <span>Xem toàn bộ sản phẩm</span>
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6 items-stretch">
          {paginatedProducts.map((p, idx) => (
            <div
              key={`${selectedGroup}-${p.id}`}
              style={{ animationDelay: `${idx * 40}ms` }}
              className="animate-fade-up h-full flex flex-col min-w-0"
            >
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

        {/* Grid Tabs / Pagination Switcher (3x3 Grid Navigation) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center pt-4 sm:pt-6 border-t border-border/60">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center" role="navigation" aria-label="Phân trang danh mục sản phẩm">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(validPage - 1)}
                disabled={validPage <= 1}
                className="h-9 px-2.5 sm:px-3 text-xs font-medium border-border/80 hover:bg-secondary disabled:opacity-35 disabled:cursor-not-allowed"
                aria-label="Trang trước"
              >
                <ChevronLeft className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Trang trước</span>
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
                      className={`size-9 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center border ${
                        isActive
                          ? "bg-caramel text-black border-caramel shadow-sm shadow-caramel/25 font-bold scale-105"
                          : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary border-border/70"
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
                className="h-9 px-2.5 sm:px-3 text-xs font-medium border-border/80 hover:bg-secondary disabled:opacity-35 disabled:cursor-not-allowed"
                aria-label="Trang sau"
              >
                <span className="hidden sm:inline">Trang sau</span>
                <ChevronRight className="size-4 sm:ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <section id="products" className="scroll-mt-24 pt-6 sm:pt-8 border-t border-border/70">
      {/* Khu "Sản phẩm nổi bật" (Chỉ hiển thị khi có sản phẩm thỏa điều kiện bán) */}
      {showFeatured && featuredProducts.length > 0 && (
        <div className="relative mb-8 sm:mb-12 p-3.5 sm:p-7 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-caramel/[0.08] via-card/65 to-card/45 border-2 border-caramel/35 shadow-2xl shadow-black/35 ring-1 ring-caramel/20 overflow-hidden">
          {/* Ambient Warm Spotlight Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[32rem] h-56 bg-caramel/20 blur-3xl rounded-full"
          />

          <div className="relative space-y-4 sm:space-y-6">
            {/* Tiêu đề khu nổi bật: Cho phép wrap trên màn hình hẹp */}
            <div className="flex items-center justify-between gap-2.5 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="size-8 rounded-xl bg-gradient-to-br from-caramel/30 to-caramel/10 border border-caramel/45 flex items-center justify-center text-caramel shadow-md shadow-caramel/20 shrink-0">
                  <Star className="size-4 fill-caramel text-caramel" aria-hidden="true" />
                </span>
                <h2 className="text-[20px] sm:text-2xl md:text-[26px] font-heading font-bold tracking-tight text-oat-cream truncate">
                  Sản phẩm nổi bật
                </h2>
              </div>
              <a
                href="#catalog-heading"
                onClick={handleScrollToCatalog}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-caramel hover:text-espresso bg-caramel/15 hover:bg-caramel border border-caramel/40 px-3.5 py-1.5 rounded-full transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-caramel/50 shadow-xs shrink-0"
              >
                <span>Xem tất cả</span>
                <span className="transition-transform duration-200 motion-safe:group-hover:translate-x-1">→</span>
              </a>
            </div>

            {/* Carousel Container: Mobile 1 card trọn vẹn / Desktop 3 cột */}
            <div className="w-full overflow-hidden">
              <div
                ref={featuredCarouselRef}
                role="region"
                aria-label="Danh sách sản phẩm nổi bật"
                tabIndex={0}
                className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-0 sm:gap-6 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 snap-x snap-mandatory focus:outline-none focus:ring-1 focus:ring-caramel/40 rounded-2xl scrollbar-none items-stretch touch-pan-y"
              >
                {featuredProducts.map((p, idx) => (
                  <div
                    key={`featured-${p.id}`}
                    data-featured-slide
                    data-slide-index={idx}
                    data-product-id={p.id}
                    className="w-full flex-none shrink-0 sm:w-auto sm:flex-initial snap-start snap-always sm:snap-align-none h-full flex flex-col min-w-0"
                  >
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
                      featured={true}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Carousel Controls: [Nút trước]  1 / N  [Nút sau] */}
            {featuredProducts.length > 1 && (
              <div className="flex sm:hidden items-center justify-between pt-1 px-1 select-none">
                <button
                  type="button"
                  onClick={handlePrevFeatured}
                  disabled={featuredIndex === 0}
                  aria-label="Xem sản phẩm nổi bật trước"
                  className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl border border-border/80 bg-card/90 text-foreground hover:bg-caramel/20 hover:text-caramel-light hover:border-caramel/40 disabled:opacity-35 disabled:cursor-not-allowed transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel"
                >
                  <ChevronLeft className="size-5" />
                  <span className="sr-only">Trước</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground/90 tabular-nums">
                    {featuredIndex + 1} / {featuredProducts.length}
                  </span>
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    {featuredProducts.map((_, i) => (
                      <span
                        key={i}
                        className={`transition-all duration-300 rounded-full ${
                          i === featuredIndex
                            ? "w-4 h-1.5 bg-caramel"
                            : "w-1.5 h-1.5 bg-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNextFeatured}
                  disabled={featuredIndex >= featuredProducts.length - 1}
                  aria-label="Xem sản phẩm nổi bật tiếp theo"
                  className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl border border-border/80 bg-card/90 text-foreground hover:bg-caramel/20 hover:text-caramel-light hover:border-caramel/40 disabled:opacity-35 disabled:cursor-not-allowed transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel"
                >
                  <ChevronRight className="size-5" />
                  <span className="sr-only">Sau</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Tiêu đề H2 Danh mục sản phẩm (Chỉ hiển thị khi có title) */}
      {title ? (
        <div id="catalog-heading" className={`space-y-1 text-left scroll-mt-24 ${showFeatured && featuredProducts.length > 0 ? "pt-1 sm:pt-2" : ""}`}>
          <h2 className="text-[22px] sm:text-2xl md:text-[28px] font-heading font-bold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground font-normal">
              {subtitle}
            </p>
          )}
        </div>
      ) : (
        <div id="catalog-heading" className="scroll-mt-24" />
      )}

      {sidebarLayout ? (
        /* ========================================================================= */
        /* BỐ CỤC CHUYÊN NGHIỆP: BỘ LỌC CỐ ĐỊNH BÊN TRÁI + TÌM KIẾM & SẢN PHẨM BÊN PHẢI */
        /* ========================================================================= */
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8 pt-2">
          {/* Nút mở/đóng bộ lọc trên thiết bị di động (< lg) */}
          <div className="lg:hidden w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
              className="w-full h-11 flex items-center justify-between px-4 rounded-2xl border-border/80 bg-card/90 text-xs font-semibold text-foreground shadow-xs active-bounce"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-caramel" />
                <span>Bộ lọc & Danh mục</span>
                {selectedGroup !== "all" && (
                  <span className="px-2 py-0.5 rounded-full bg-caramel/15 text-caramel-light text-[11px] font-bold">
                    {currentGroupName}
                  </span>
                )}
              </div>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${isMobileFilterOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>

          {/* CỘT TRÁI: BỘ LỌC CỐ ĐỊNH THEO MÀN HÌNH (STICKY SIDEBAR) */}
          <aside className={`w-full lg:w-64 xl:w-72 shrink-0 lg:sticky lg:top-[90px] sm:lg:top-[104px] self-start lg:max-h-[calc(100vh-124px)] lg:overflow-y-auto no-scrollbar space-y-4 ${isMobileFilterOpen ? "block" : "hidden lg:block"}`}>
            <div className="rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl p-4 sm:p-5 space-y-5 shadow-sm">
              {/* Header Bộ Lọc */}
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-caramel" />
                  <h3 className="font-heading font-bold text-sm text-foreground tracking-tight">
                    Bộ lọc sản phẩm
                  </h3>
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs text-caramel hover:text-caramel-light hover:underline font-semibold flex items-center gap-1 active-bounce"
                  >
                    <RefreshCw className="size-3" />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>

              {/* 1. Danh Mục Sản Phẩm (Dạng danh sách dọc đẹp mắt) */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 block">
                  Danh mục sản phẩm
                </span>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setSelectedGroup("all")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 active-bounce ${
                      selectedGroup === "all"
                        ? "bg-caramel/15 text-caramel-light border border-caramel/35 font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-transparent"
                    }`}
                  >
                    <span>Tất cả sản phẩm</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold tabular-nums ${
                      selectedGroup === "all" ? "bg-caramel text-black font-bold" : "bg-secondary text-muted-foreground"
                    }`}>
                      {products.length}
                    </span>
                  </button>

                  {activeGroups.map((g) => {
                    const isSelected = selectedGroup === g.id
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGroup(g.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 active-bounce ${
                          isSelected
                            ? "bg-caramel/15 text-caramel-light border border-caramel/35 font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-transparent"
                        }`}
                      >
                        <span className="truncate pr-2">{g.name}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold tabular-nums shrink-0 ${
                          isSelected ? "bg-caramel text-black font-bold" : "bg-secondary text-muted-foreground"
                        }`}>
                          {g.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. Khoảng Giá */}
              <div className="space-y-2 pt-3 border-t border-border/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 block">
                  Khoảng giá
                </span>
                <div className="space-y-1">
                  {(
                    [
                      { key: "all", label: "Tất cả mức giá" },
                      { key: "under_50k", label: "Dưới 50.000 ₫" },
                      { key: "50k_100k", label: "50.000 ₫ – 100.000 ₫" },
                      { key: "100k_200k", label: "100.000 ₫ – 200.000 ₫" },
                      { key: "above_200k", label: "Trên 200.000 ₫" },
                    ] as const
                  ).map((opt) => {
                    const isSelected = priceRange === opt.key
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setPriceRange(opt.key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 active-bounce ${
                          isSelected
                            ? "bg-caramel/15 text-caramel-light border border-caramel/35 font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-transparent"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && (
                          <span className="size-2 rounded-full bg-caramel shadow-[0_0_6px_rgba(230,166,111,0.8)]" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 3. Sắp Xếp Sản Phẩm */}
              <div className="space-y-2 pt-3 border-t border-border/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 block">
                  Sắp xếp theo
                </span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOptionKey)}
                    aria-label="Sắp xếp sản phẩm"
                    className="w-full h-10 pl-3 pr-8 rounded-xl bg-background/90 border border-border/80 text-foreground text-xs font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all cursor-pointer appearance-none shadow-inner"
                  >
                    <option value="default">Sắp xếp mặc định</option>
                    <option value="price_asc">Giá: Thấp đến cao</option>
                    <option value="price_desc">Giá: Cao đến thấp</option>
                    <option value="name_asc">Tên: A – Z</option>
                    <option value="name_desc">Tên: Z – A</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </aside>

          {/* CỘT PHẢI: DUY NHẤT THANH TÌM KIẾM + LƯỚI SẢN PHẨM 3x3 */}
          <div className="flex-1 min-w-0 space-y-4 sm:space-y-5 w-full">
            {/* DUY NHẤT THANH TÌM KIẾM (Gọn gàng, thanh mảnh, cố định khi cuộn) */}
            <div className="sticky top-[90px] sm:top-[104px] z-20 py-1">
              <div className="relative w-full">
                <input
                  type="search"
                  autoComplete="off"
                  placeholder="Tìm kiếm theo tên sản phẩm hoặc gói dịch vụ…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 sm:h-12 pl-11 pr-10 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/90 text-foreground text-sm placeholder:text-muted-foreground/75 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-xl shadow-black/40"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-caramel pointer-events-none z-10" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-secondary transition-colors z-10"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Context Bar */}
            {(hasActiveFilters || currentGroupName) && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2 flex-wrap">
                  {currentGroupName && (
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-accent" aria-hidden="true" />
                      <span className="text-sm font-bold text-foreground">
                        Danh mục: {currentGroupName}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium tabular-nums">
                        ({filteredProducts.length} sản phẩm)
                      </span>
                    </div>
                  )}
                </div>

                {/* Active Filter Chips */}
                {hasActiveFilters && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {trimmedQuery && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent border border-accent/30">
                        <span>Từ khóa: “{trimmedQuery}”</span>
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          aria-label="Xóa từ khóa"
                          className="hover:opacity-75"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    )}

                    {priceRange !== "all" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-foreground border border-border">
                        <span>Giá: {priceRangeLabels[priceRange]}</span>
                        <button
                          type="button"
                          onClick={() => setPriceRange("all")}
                          aria-label="Bỏ lọc giá"
                          className="hover:opacity-75"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    )}

                    {sortBy !== "default" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-foreground border border-border">
                        <span>{sortOptionLabels[sortBy]}</span>
                        <button
                          type="button"
                          onClick={() => setSortBy("default")}
                          aria-label="Đặt lại sắp xếp"
                          className="hover:opacity-75"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <RefreshCw className="size-2.5" />
                      <span>Xóa bộ lọc</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Product Grid / Empty State */}
            {renderProductGridContent()}
          </div>
        </div>
      ) : (
        /* GIAO DIỆN MẶC ĐỊNH CHO TRANG CHỦ (THANH NGANG) */
        <>
          <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card/70 backdrop-blur space-y-3.5 shadow-xs mt-4 sm:mt-5">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  autoComplete="off"
                  placeholder="Tìm tên sản phẩm hoặc gói…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-9 rounded-xl bg-background/80 border border-border/80 text-foreground text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value as PriceRangeKey)}
                    aria-label="Lọc theo mức giá"
                    className="w-full sm:w-auto h-11 pl-3 pr-8 rounded-xl bg-background/80 border border-border/80 text-foreground text-xs font-medium focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer appearance-none shadow-inner"
                  >
                    <option value="all">Tất cả mức giá</option>
                    <option value="under_50k">Dưới 50.000 ₫</option>
                    <option value="50k_100k">50.000 ₫ - 100.000 ₫</option>
                    <option value="100k_200k">100.000 ₫ - 200.000 ₫</option>
                    <option value="above_200k">Trên 200.000 ₫</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>

                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOptionKey)}
                    aria-label="Sắp xếp sản phẩm"
                    className="w-full sm:w-auto h-11 pl-3 pr-8 rounded-xl bg-background/80 border border-border/80 text-foreground text-xs font-medium focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer appearance-none shadow-inner"
                  >
                    <option value="default">Sắp xếp mặc định</option>
                    <option value="price_asc">Giá: Thấp đến cao</option>
                    <option value="price_desc">Giá: Cao đến thấp</option>
                    <option value="name_asc">Tên: A – Z</option>
                    <option value="name_desc">Tên: Z – A</option>
                  </select>
                  <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Danh mục sản phẩm"
              className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar text-xs"
            >
              <button
                role="tab"
                aria-selected={selectedGroup === "all"}
                onClick={() => setSelectedGroup("all")}
                className={`px-3.5 py-1.5 rounded-full font-medium transition-all duration-150 active-bounce whitespace-nowrap border shrink-0 ${
                  selectedGroup === "all"
                    ? "bg-accent/15 text-accent border-accent/40 font-semibold shadow-xs"
                    : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border/70 hover:border-border"
                }`}
              >
                Tất cả ({products.length})
              </button>

              {activeGroups.map((g) => {
                const isSelected = selectedGroup === g.id
                return (
                  <button
                    key={g.id}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedGroup(g.id)}
                    className={`px-3.5 py-1.5 rounded-full font-medium transition-all duration-150 active-bounce whitespace-nowrap border shrink-0 ${
                      isSelected
                        ? "bg-accent/15 text-accent border-accent/40 font-semibold shadow-xs"
                        : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border/70 hover:border-border"
                    }`}
                  >
                    {g.name} ({g.count})
                  </button>
                )
              })}
            </div>
          </div>

          {(hasActiveFilters || currentGroupName) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60 mt-4">
              <div className="flex items-center gap-2 flex-wrap">
                {currentGroupName && (
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-accent" aria-hidden="true" />
                    <span className="text-sm sm:text-base font-bold text-foreground">
                      Danh mục: {currentGroupName}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium tabular-nums">
                      ({filteredProducts.length} sản phẩm)
                    </span>
                  </div>
                )}
              </div>

              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  {trimmedQuery && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent border border-accent/30">
                      <span>Từ khóa: “{trimmedQuery}”</span>
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        aria-label="Xóa từ khóa"
                        className="hover:opacity-75"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  )}

                  {priceRange !== "all" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-foreground border border-border">
                      <span>Giá: {priceRangeLabels[priceRange]}</span>
                      <button
                        type="button"
                        onClick={() => setPriceRange("all")}
                        aria-label="Bỏ lọc giá"
                        className="hover:opacity-75"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  )}

                  {sortBy !== "default" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-foreground border border-border">
                      <span>{sortOptionLabels[sortBy]}</span>
                      <button
                        type="button"
                        onClick={() => setSortBy("default")}
                        aria-label="Đặt lại sắp xếp"
                        className="hover:opacity-75"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <RefreshCw className="size-2.5" />
                    <span>Xóa bộ lọc</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            {renderProductGridContent()}
          </div>
        </>
      )}
    </section>
  )
}
