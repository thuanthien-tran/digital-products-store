import { formatPrice } from "./utils"

export interface PricingVariant {
  id?: string
  name: string
  priceCents: number
  compareAtPriceCents?: number | null
  availableStock?: number
  providerStock?: number | null
}

export interface ProductPricingSummary {
  lowestVariant: PricingVariant | null
  priceText: string
  hasMultipleVariants: boolean
  lowestPrice: number
  comparePrice: number | null
  discountPercent: number | null
  savings: number | null
  hasStock: boolean
  isOutOfStock: boolean
}

/**
 * Calculates pricing, strikethrough, discount %, and stock state for a product.
 * Guarantees:
 * 1. Picks lowest price variant among in-stock variants (or fallback to all variants if all out-of-stock).
 * 2. Uses the EXACT compare price belonging to that lowest price variant (never mixes variants).
 * 3. Only considers discount valid if compareAtPriceCents > priceCents and discountPercent >= 1%.
 * 4. Respects manual statusOverride ("in_stock", "out_of_stock", "auto").
 */
export function calculateProductPricing(
  variants: PricingVariant[] = [],
  statusOverride: string = "auto"
): ProductPricingSummary {
  if (!variants || variants.length === 0) {
    return {
      lowestVariant: null,
      priceText: "0 ₫",
      hasMultipleVariants: false,
      lowestPrice: 0,
      comparePrice: null,
      discountPercent: null,
      savings: null,
      hasStock: false,
      isOutOfStock: true,
    }
  }

  // Determine stock availability
  const anyStockAvailable = variants.some(
    (v) => (v.availableStock ?? v.providerStock ?? 0) > 0
  )
  const hasStock =
    statusOverride === "in_stock"
      ? true
      : statusOverride === "out_of_stock"
      ? false
      : anyStockAvailable

  // Find representative variant (lowest price among in-stock variants if possible)
  const inStockPool = variants.filter(
    (v) => (v.availableStock ?? v.providerStock ?? 0) > 0
  )
  const candidatePool = hasStock && inStockPool.length > 0 ? inStockPool : variants

  const lowestVariant = candidatePool.reduce((prev, curr) =>
    curr.priceCents < prev.priceCents ? curr : prev,
    candidatePool[0]
  )

  const lowestPrice = lowestVariant?.priceCents ?? 0
  const rawCompare = lowestVariant?.compareAtPriceCents ?? null

  let comparePrice: number | null = null
  let discountPercent: number | null = null
  let savings: number | null = null

  if (rawCompare && rawCompare > lowestPrice) {
    const diff = rawCompare - lowestPrice
    const pct = Math.floor((diff / rawCompare) * 100)
    if (pct >= 1) {
      comparePrice = rawCompare
      savings = diff
      discountPercent = pct
    }
  }

  return {
    lowestVariant,
    priceText: formatPrice(lowestPrice),
    hasMultipleVariants: variants.length > 1,
    lowestPrice,
    comparePrice,
    discountPercent,
    savings,
    hasStock,
    isOutOfStock: !hasStock,
  }
}
