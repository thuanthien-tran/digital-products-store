import { prisma } from "./db"

export interface VariantPurchasability {
  variantId: string
  productId: string
  productName: string
  variantName: string
  isPurchasable: boolean
  reason:
    | "available"
    | "product_hidden"
    | "product_draft"
    | "admin_suspended"
    | "out_of_stock"
    | "provider_disabled"
    | "source_unavailable"
    | "unverified"
  displayStatus: "in_stock" | "out_of_stock" | "suspended"
  userMessage?: string
  availableStock: number
  localStock: number
  providerStock: number
  minQuantity: number
  maxQuantity: number | null
  unitPriceCents: number
}

export interface ProductPurchasability {
  productId: string
  productName: string
  isPurchasable: boolean
  hasAnyStock: boolean
  variants: VariantPurchasability[]
}

/**
 * Standardized pure evaluation of purchasability for a variant.
 * 
 * INVARIANTS:
 * 1. Admin controls take precedence:
 *    - Product visibility !== 'public' -> NOT purchasable
 *    - Product editorialStatus !== 'published' -> NOT purchasable
 *    - Product statusOverride === 'out_of_stock' -> NOT purchasable
 * 2. Provider stock is only valid if:
 *    - Connection is enabled
 *    - Linked source product is not 'unavailable'
 * 3. Total stock = local available serials + valid provider stock (never double counted)
 * 4. A single out-of-stock variant does NOT make sibling variants out-of-stock.
 */
export function evaluateVariantPurchasability(params: {
  product: {
    id: string
    name: string
    visibility: string
    editorialStatus: string
    statusOverride?: string
    deliveryType?: string
  }
  variant: {
    id: string
    name: string
    priceCents: number
    minQuantity?: number
    maxQuantity?: number | null
    provider?: string | null
    providerStock?: number | null
    connectionId?: string | null
    connection?: { isEnabled: boolean } | null
    sourceProduct?: { sourceStatus: string; sourceStock: number } | null
    isActive?: boolean
  }
  localSerialCount: number
}): VariantPurchasability {
  const { product, variant, localSerialCount } = params

  const minQuantity = Math.max(1, variant.minQuantity ?? 1)
  const maxQuantity = variant.maxQuantity ?? null
  const localStock = Math.max(0, localSerialCount)

  if (variant.isActive === false) {
    return {
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      isPurchasable: false,
      reason: "admin_suspended",
      displayStatus: "suspended",
      userMessage: "Gói này hiện đang tạm ẩn",
      availableStock: 0,
      localStock: 0,
      providerStock: 0,
      minQuantity,
      maxQuantity,
      unitPriceCents: variant.priceCents,
    }
  }

  // 1. Check Admin Product-Level Controls
  if (product.visibility !== "public") {
    return {
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      isPurchasable: false,
      reason: "product_hidden",
      displayStatus: "suspended",
      userMessage: "Sản phẩm hiện đang tạm ẩn",
      availableStock: 0,
      localStock,
      providerStock: 0,
      minQuantity,
      maxQuantity,
      unitPriceCents: variant.priceCents,
    }
  }

  if (product.editorialStatus !== "published") {
    return {
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      isPurchasable: false,
      reason: "product_draft",
      displayStatus: "suspended",
      userMessage: "Sản phẩm chưa được xuất bản",
      availableStock: 0,
      localStock,
      providerStock: 0,
      minQuantity,
      maxQuantity,
      unitPriceCents: variant.priceCents,
    }
  }

  if (product.statusOverride === "out_of_stock") {
    return {
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      isPurchasable: false,
      reason: "admin_suspended",
      displayStatus: "out_of_stock",
      userMessage: "Sản phẩm hiện đang tạm khóa mua bởi quản trị viên",
      availableStock: 0,
      localStock,
      providerStock: 0,
      minQuantity,
      maxQuantity,
      unitPriceCents: variant.priceCents,
    }
  }

  // If admin explicitly overrides status to "in_stock" or deliveryType is "contact"
  if (product.statusOverride === "in_stock" || product.deliveryType === "contact") {
    return {
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      isPurchasable: product.deliveryType !== "contact",
      reason: "available",
      displayStatus: "in_stock",
      availableStock: 999,
      localStock: 999,
      providerStock: 0,
      minQuantity,
      maxQuantity,
      unitPriceCents: variant.priceCents,
    }
  }

  // 2. Evaluate Provider Stock Validity
  const isProviderBacked = Boolean(
    variant.provider ||
    variant.connectionId ||
    product.deliveryType === "fatcat" ||
    product.deliveryType === "dino"
  )

  let validProviderStock = 0
  if (isProviderBacked) {
    const connectionEnabled = variant.connection ? variant.connection.isEnabled : true
    const sourceAvailable = variant.sourceProduct
      ? variant.sourceProduct.sourceStatus !== "unavailable"
      : true

    if (connectionEnabled && sourceAvailable) {
      validProviderStock = Math.max(0, variant.providerStock ?? 0)
    }
  }

  // Total available stock is local physical stock + provider stock
  const totalAvailableStock = localStock + validProviderStock

  if (totalAvailableStock <= 0) {
    const reason =
      isProviderBacked && variant.sourceProduct?.sourceStatus === "unavailable" && localStock === 0
        ? "source_unavailable"
        : isProviderBacked && variant.connection && !variant.connection.isEnabled && localStock === 0
        ? "provider_disabled"
        : "out_of_stock"

    return {
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      isPurchasable: false,
      reason,
      displayStatus: "out_of_stock",
      userMessage:
        reason === "source_unavailable"
          ? "Sản phẩm nguồn từ nhà cung cấp đã ngừng hoạt động"
          : "Gói này hiện đã hết hàng trong kho",
      availableStock: 0,
      localStock,
      providerStock: validProviderStock,
      minQuantity,
      maxQuantity,
      unitPriceCents: variant.priceCents,
    }
  }

  return {
    variantId: variant.id,
    productId: product.id,
    productName: product.name,
    variantName: variant.name,
    isPurchasable: true,
    reason: "available",
    displayStatus: "in_stock",
    availableStock: totalAvailableStock,
    localStock,
    providerStock: validProviderStock,
    minQuantity,
    maxQuantity,
    unitPriceCents: variant.priceCents,
  }
}

/**
 * Loads and evaluates live purchasability for a list of variant IDs from the database.
 */
export async function getLivePurchasabilityByVariantIds(
  variantIds: string[]
): Promise<Map<string, VariantPurchasability>> {
  if (variantIds.length === 0) return new Map()

  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          visibility: true,
          editorialStatus: true,
          statusOverride: true,
          deliveryType: true,
        },
      },
      connection: {
        select: { isEnabled: true },
      },
      sourceProduct: {
        select: { sourceStatus: true, sourceStock: true },
      },
      _count: {
        select: { serials: { where: { status: "available" } } },
      },
    },
  })

  const results = new Map<string, VariantPurchasability>()

  for (const v of variants) {
    const evaluation = evaluateVariantPurchasability({
      product: v.product,
      variant: v,
      localSerialCount: v._count.serials,
    })
    results.set(v.id, evaluation)
  }

  return results
}
