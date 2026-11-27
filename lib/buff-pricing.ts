/**
 * Centralized pricing & tier configuration for Buff Token Muse AI
 */

export interface BuffPackageConfig {
  name: string
  tokenAmountB: number // Amount in Billions (B)
  expectedCost: number // Wholesale cost in VND from provider
  defaultPrice: number // Suggested selling price in VND
  defaultComparePrice?: number // Suggested compare-at price
}

export const MUSE_BUFF_STANDARD_PACKAGES: BuffPackageConfig[] = [
  {
    name: 'Nạp 1B Token Muse AI',
    tokenAmountB: 1,
    expectedCost: 3000,
    defaultPrice: 5000,
    defaultComparePrice: 8000,
  },
  {
    name: 'Nạp 5B Token Muse AI',
    tokenAmountB: 5,
    expectedCost: 15000,
    defaultPrice: 25000,
    defaultComparePrice: 35000,
  },
  {
    name: 'Nạp 10B Token Muse AI',
    tokenAmountB: 10,
    expectedCost: 20000,
    defaultPrice: 39000,
    defaultComparePrice: 60000,
  },
  {
    name: 'Nạp 20B Token Muse AI',
    tokenAmountB: 20,
    expectedCost: 40000,
    defaultPrice: 75000,
    defaultComparePrice: 110000,
  },
  {
    name: 'Nạp 30B Token Muse AI',
    tokenAmountB: 30,
    expectedCost: 60000,
    defaultPrice: 109000,
    defaultComparePrice: 160000,
  },
]

/**
 * Calculates expected provider wholesale cost according to provider tier policy:
 * - Under 10B: 3.000đ / 1B
 * - From 10B: 2.000đ / 1B
 */
export function calculateExpectedBuffCost(tokenAmountB: number): number {
  if (!tokenAmountB || tokenAmountB <= 0) return 0
  const ratePerB = tokenAmountB >= 10 ? 2000 : 3000
  return tokenAmountB * ratePerB
}

/**
 * Normalizes and validates an Invite Code
 */
export function normalizeInviteCode(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.trim().toUpperCase()
}

export function isValidInviteCode(code: string): boolean {
  const normalized = normalizeInviteCode(code)
  // Alphanumeric, 4 to 20 chars
  return /^[A-Z0-9]{4,20}$/.test(normalized)
}

export interface BuffVariantRateSource {
  id: string
  name: string
  priceCents: number
  tokenAmountB: number | null
}

/**
 * Computes deterministic, server-authoritative VND price for any 1..30B buff amount
 * using active product variants from the database.
 */
export function computeCustomBuffPrice(
  tokenAmountB: number,
  variants: BuffVariantRateSource[]
): { priceCents: number; matchedVariant: BuffVariantRateSource | null; isCustomAmount: boolean } {
  const clampedB = Math.min(Math.max(1, Math.floor(tokenAmountB)), 30)
  const withB = variants
    .map((v) => {
      const parsedB =
        v.tokenAmountB ??
        (() => {
          const m = v.name.match(/(\d+)\s*b\b/i)
          return m ? parseInt(m[1], 10) : 1
        })()
      return { ...v, resolvedB: parsedB }
    })
    .filter((v) => v.resolvedB > 0)
    .sort((a, b) => a.resolvedB - b.resolvedB)

  if (withB.length === 0) {
    const fallbackRate = clampedB >= 10 ? 3900 : 5000
    return {
      priceCents: clampedB * fallbackRate,
      matchedVariant: null,
      isCustomAmount: true,
    }
  }

  const exact = withB.find((v) => v.resolvedB === clampedB)
  if (exact) {
    return {
      priceCents: exact.priceCents,
      matchedVariant: exact,
      isCustomAmount: false,
    }
  }

  // Find highest tier <= clampedB, or fallback to lowest tier (usually 1B)
  const lowerTiers = withB.filter((v) => v.resolvedB <= clampedB)
  const tier = lowerTiers[lowerTiers.length - 1] || withB[0]
  const rawPrice = Math.round((tier.priceCents * clampedB) / tier.resolvedB / 500) * 500

  return {
    priceCents: Math.max(1000, rawPrice),
    matchedVariant: withB[0],
    isCustomAmount: true,
  }
}
