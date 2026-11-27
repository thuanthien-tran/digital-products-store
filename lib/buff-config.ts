import { prisma } from "./db"
import { calculateExpectedBuffCost, MUSE_BUFF_STANDARD_PACKAGES } from "./buff-pricing"

export const BUFF_MUSE_TIERS = [1, 5, 10, 20, 30] as const

export interface BuffMuseTierConfig {
  tokenAmountB: number
  variantId: string | null
  name: string
  priceCents: number
  compareAtPriceCents: number | null
  isActive: boolean
}

export interface BuffMuseAdminConfig {
  existsInDb: boolean
  productId: string | null
  productSlug: string | null
  productName: string
  isEnabled: boolean // true when visibility=public, editorialStatus=published, statusOverride !== "out_of_stock"
  statusOverride: string
  tiers: BuffMuseTierConfig[]
}

export async function findTargetBuffMuseProduct() {
  const candidates = await prisma.product.findMany({
    where: { fulfillmentType: "buff" },
    include: {
      variants: {
        orderBy: [{ tokenAmountB: "asc" }, { sortOrder: "asc" }, { priceCents: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  })

  if (candidates.length === 0) return null

  return (
    candidates.find(
      (p) =>
        p.visibility === "public" &&
        p.editorialStatus === "published" &&
        p.statusOverride !== "out_of_stock" &&
        p.variants.length > 0
    ) ||
    candidates.find((p) => p.slug === "dich-vu-bo-sung-token-muse-ai") ||
    candidates.find((p) => p.variants.length > 0) ||
    candidates[0]
  )
}

export async function getBuffMuseAdminConfig(): Promise<BuffMuseAdminConfig> {
  const product = await findTargetBuffMuseProduct()

  const tiers: BuffMuseTierConfig[] = BUFF_MUSE_TIERS.map((b) => {
    const std = MUSE_BUFF_STANDARD_PACKAGES.find((p) => p.tokenAmountB === b)
    const matchedVariant = product?.variants.find((v) => {
      if (v.tokenAmountB === b) return true
      const m = v.name.match(/\b(\d+)\s*b\b/i)
      return m ? parseInt(m[1], 10) === b : false
    })

    return {
      tokenAmountB: b,
      variantId: matchedVariant?.id || null,
      name: matchedVariant?.name || std?.name || `Nạp ${b}B Token Muse AI`,
      priceCents: matchedVariant?.priceCents ?? std?.defaultPrice ?? b * 5000,
      compareAtPriceCents: matchedVariant?.compareAtPriceCents ?? std?.defaultComparePrice ?? null,
      isActive: matchedVariant ? matchedVariant.isActive : true,
    }
  })

  const isEnabled = Boolean(
    product &&
      product.visibility === "public" &&
      product.editorialStatus === "published" &&
      product.statusOverride !== "out_of_stock"
  )

  return {
    existsInDb: Boolean(product),
    productId: product?.id || null,
    productSlug: product?.slug || null,
    productName: product?.name || "Buff Token Muse AI Chính Chủ",
    isEnabled,
    statusOverride: product?.statusOverride || "auto",
    tiers,
  }
}

export interface SaveBuffMuseInput {
  productName: string
  isEnabled: boolean
  tiers: Array<{
    tokenAmountB: number
    priceCents: number
    compareAtPriceCents: number | null
    isActive: boolean
  }>
}

export async function saveBuffMuseAdminConfig(input: SaveBuffMuseInput): Promise<BuffMuseAdminConfig> {
  const cleanName = input.productName.trim() || "Buff Token Muse AI Chính Chủ"
  const nextStatusOverride = input.isEnabled ? "auto" : "out_of_stock"

  const existing = await findTargetBuffMuseProduct()

  await prisma.$transaction(async (tx) => {
    let targetProductId = existing?.id || null

    if (!targetProductId) {
      let group = await tx.productGroup.findFirst({
        where: { name: { contains: "AI" } },
        orderBy: { sortOrder: "asc" },
      })
      if (!group) {
        group = await tx.productGroup.create({
          data: {
            name: "AI",
            sortOrder: 0,
          },
        })
      }

      const uniqueSlug = "dich-vu-bo-sung-token-muse-ai"
      const slugClash = await tx.product.findUnique({ where: { slug: uniqueSlug } })
      const finalSlug = slugClash ? `buff-token-muse-ai-${Date.now()}` : uniqueSlug

      const created = await tx.product.create({
        data: {
          name: cleanName,
          slug: finalSlug,
          groupId: group.id,
          description:
            "Dịch vụ nạp bổ sung Token Muse AI chính chủ theo Mã mời (Invite Code). Tự động đối soát thanh toán VietQR.",
          deliveryType: "service",
          fulfillmentType: "buff",
          quantityMode: "flexible",
          requiresInviteCode: true,
          visibility: "public",
          editorialStatus: "published",
          statusOverride: nextStatusOverride,
          images: JSON.stringify(["/muse-ai-capygo-v1.png"]),
        },
      })
      targetProductId = created.id
    } else {
      await tx.product.update({
        where: { id: targetProductId },
        data: {
          name: cleanName,
          fulfillmentType: "buff",
          deliveryType: "service",
          quantityMode: "flexible",
          requiresInviteCode: true,
          visibility: "public",
          editorialStatus: "published",
          statusOverride: nextStatusOverride,
        },
      })
    }

    const existingVariants = await tx.variant.findMany({
      where: { productId: targetProductId },
    })

    for (let idx = 0; idx < input.tiers.length; idx++) {
      const t = input.tiers[idx]
      const std = MUSE_BUFF_STANDARD_PACKAGES.find((p) => p.tokenAmountB === t.tokenAmountB)
      const matched = existingVariants.find((v) => {
        if (v.tokenAmountB === t.tokenAmountB) return true
        const m = v.name.match(/\b(\d+)\s*b\b/i)
        return m ? parseInt(m[1], 10) === t.tokenAmountB : false
      })

      if (matched) {
        await tx.variant.update({
          where: { id: matched.id },
          data: {
            priceCents: t.priceCents,
            compareAtPriceCents: t.compareAtPriceCents,
            tokenAmountB: t.tokenAmountB,
            isActive: t.isActive,
            sortOrder: idx,
          },
        })
      } else {
        await tx.variant.create({
          data: {
            productId: targetProductId,
            name: std?.name || `Nạp ${t.tokenAmountB}B Token Muse AI`,
            priceCents: t.priceCents,
            compareAtPriceCents: t.compareAtPriceCents,
            tokenAmountB: t.tokenAmountB,
            providerPrice: calculateExpectedBuffCost(t.tokenAmountB),
            maxQuantity: 5,
            isActive: t.isActive,
            sortOrder: idx,
          },
        })
      }
    }
  })

  return getBuffMuseAdminConfig()
}
