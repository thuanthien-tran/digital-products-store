"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Search, X, RefreshCw, Layers, ChevronDown, SlidersHorizontal } from "lucide-react"
import { ProductCard, type ProductCardVariant } from "@/components/storefront/ProductCard"
import { normalizeVietnamese } from "@/lib/utils"

export type StorefrontVariant = ProductCardVariant

export interface StorefrontProduct {
  id: string
  name: string
  slug: string
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
}

type PriceRangeKey = "all" | "under_50k" | "50k_100k" | "100k_200k" | "above_200k"
type SortOptionKey = "default" | "price_asc" | "price_desc" | "name_asc" | "name_desc"

const viCollator = new Intl.Collator("vi", { sensitivity: "base", numeric: true })

export function StorefrontCatalog({ groups, products }: StorefrontCatalogProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [priceRange, setPriceRange] = useState<PriceRangeKey>("all")
  const [sortBy, setSortBy] = useState<SortOptionKey>("default")
  const [liveStockMap, setLiveStockMap] = useState<Record<string, { availableStock: number; isPurchasable: boolean }>>({})

  const allVariantIds = useMemo(() => {
    return products.flatMap((p) => p.variants.map((v) => v.id))
  }, [products])

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
    if (Object.keys(liveStockMap).length === 0) return products
    return products.map((p) => ({
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
  }, [products, liveStockMap])

  // Filter groups to only those with public products
  const activeGroups = useMemo(() => {
    return groups
      .filter((g) => productsWithLiveStock.some((p) => p.groupId === g.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        count: productsWithLiveStock.filter((p) => p.groupId === g.id).length,
      }))
  }, [groups, productsWithLiveStock])

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
    }

    return sorted
  }, [productsWithLiveStock, selectedGroup, searchQuery, priceRange, sortBy])

  const handleResetFilters = () => {
    setSearchQuery("")
    setSelectedGroup("all")
    setPriceRange("all")
    setSortBy("default")
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

  return (
    <section id="products" className="space-y-4 sm:space-y-5 scroll-mt-24 pt-6 sm:pt-8 border-t border-border/70">
      {/* 1. Tiêu đề H2 Danh mục sản phẩm */}
      <div className="space-y-1 text-left">
        <h2 className="text-xl sm:text-2xl md:text-[28px] font-black tracking-tight text-foreground">
          Danh mục sản phẩm
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Khám phá và lựa chọn các gói dịch vụ, tài khoản bản quyền phù hợp với bạn
        </p>
      </div>

      {/* Search Bar, Price Filter & Sort Controls */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card/70 backdrop-blur space-y-3.5 shadow-xs">
        {/* Row 1: Search Input & Filter Dropdowns */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Input */}
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

          {/* Controls: Price Range Filter & Sort */}
          <div className="flex items-center gap-2">
            {/* Price Filter */}
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

            {/* Price Sort Order */}
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

        {/* Row 2: Category Filter Pills */}
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

      {/* Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-accent" aria-hidden="true" />
          <span className="text-sm sm:text-base font-bold text-foreground">
            {currentGroupName ? `Danh mục: ${currentGroupName}` : "Danh sách sản phẩm"}
          </span>
          <span className="text-xs text-muted-foreground font-mono font-medium">
            ({filteredProducts.length} sản phẩm)
          </span>
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

            {currentGroupName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-foreground border border-border">
                <span>{currentGroupName}</span>
                <button
                  type="button"
                  onClick={() => setSelectedGroup("all")}
                  aria-label="Bỏ chọn danh mục"
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

      {/* Product Grid / Empty State */}
      {products.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border border-border/60 bg-card/60 p-8 space-y-3 animate-fade-up backdrop-blur">
          <div className="inline-flex size-12 items-center justify-center rounded-full bg-secondary text-primary mx-auto mb-1">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <p className="text-base font-bold text-foreground">Cửa hàng đang chuẩn bị sản phẩm mới</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Hệ thống đang cập nhật danh mục và các gói tài khoản. Quý khách vui lòng quay lại sau ít phút!
          </p>
        </div>
      ) : filteredProducts.length === 0 ? (
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
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {filteredProducts.map((p, idx) => (
            <div
              key={`${selectedGroup}-${p.id}`}
              style={{ animationDelay: `${idx * 40}ms` }}
              className="animate-fade-up h-full"
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
      )}
    </section>
  )
}
