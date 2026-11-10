import { prisma } from './db'
import { slugify } from './utils'
import { normalizeDescription } from './description-normalizer'
import { calculateExpectedBuffCost } from './buff-pricing'

export interface AddToStoreResult {
  success: boolean
  createdCount: number
  alreadyAddedCount: number
  productIds: string[]
}

export interface UpdateProductInput {
  name?: string
  groupId?: string | null
  description?: string
  highlights?: string[]
  isFeatured?: boolean
  warrantyTerms?: string | null
  usageInstructions?: string | null
  noticeNotes?: string | null
  deliveryType?: string
  fulfillmentType?: string
  quantityMode?: string
  requiresInviteCode?: boolean
  statusOverride?: string
  images?: string[]
  isCustomized?: boolean
  variants?: Array<{
    id?: string
    name: string
    priceCents: number
    compareAtPriceCents?: number | null
    providerPrice?: number | null
    minQuantity?: number
    maxQuantity?: number | null
    connectionId?: string | null
    sourceProductId?: string | null
    tokenAmountB?: number | null
    isActive?: boolean
    sortOrder?: number
    _delete?: boolean
  }>
  action?: 'save_draft' | 'publish_now'
  visibility?: string
  editorialStatus?: string
  sortOrder?: number
  confirmBelowCost?: boolean
}

/**
 * Creates draft products from selected source products.
 * Never publishes to storefront, never triggers purchasing calls.
 * Idempotent: re-calling on already added items is safely skipped.
 */
export async function addSourceProductsToStore(
  sourceProductIds: string[],
  _actorUsername?: string
): Promise<AddToStoreResult> {
  void _actorUsername
  let createdCount = 0
  let alreadyAddedCount = 0
  const productIds: string[] = []

  const sources = await prisma.sourceProduct.findMany({
    where: { id: { in: sourceProductIds } },
    include: {
      connection: true,
      product: true,
    },
  })

  // Get default group for initial categorization
  const defaultGroup = await prisma.productGroup.findFirst({
    where: { visibility: 'public' },
    orderBy: { sortOrder: 'asc' },
  })

  for (const source of sources) {
    // Idempotency: if already created and product exists, skip duplicate creation
    if (source.isAddedToStore && source.productId && source.product) {
      alreadyAddedCount++
      productIds.push(source.productId)
      continue
    }

    const displayName = (source.customName || source.sourceName).trim()
    const wholesale = source.sourcePrice
    const markupRatio = wholesale < 20000 ? 1.5 : wholesale < 100000 ? 1.35 : 1.25
    const suggestedRetail = Math.round((wholesale * markupRatio) / 1000) * 1000

    // Standardize copy layout
    const normalized = normalizeDescription(displayName, source.sourceDescription || '')

    // Generate unique slug
    let baseSlug = slugify(displayName)
    if (!baseSlug) baseSlug = `item-${source.externalId}`
    let slug = baseSlug
    let counter = 1
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`
    }

    const providerProductIdInt = Number.isInteger(Number(source.externalId)) ? Number(source.externalId) : null

    // Extract image URL from source raw data if present
    const initialImages: string[] = []
    try {
      if (source.rawJson) {
        const raw = JSON.parse(source.rawJson)
        const img = raw.image_url || raw.image || raw.thumbnail || raw.icon_url || raw.avatar
        if (img && typeof img === 'string' && img.startsWith('http')) {
          initialImages.push(img.trim())
        }
      }
    } catch {
      // ignore
    }

    // Create Draft Product (visibility: hidden, editorialStatus: draft)
    const newProduct = await prisma.product.create({
      data: {
        name: displayName,
        slug,
        groupId: defaultGroup?.id || null,
        description: normalized.fullFormattedText,
        warrantyTerms: normalized.warranty,
        usageInstructions: normalized.instructions,
        noticeNotes: normalized.notes,
        serviceInstructions: normalized.instructions,
        images: JSON.stringify(initialImages),
        deliveryType: source.provider === 'fatcat' ? 'fatcat' : 'serials',
        visibility: 'hidden', // BẢN NHÁP ẨN
        editorialStatus: 'draft',
        hasPendingChanges: false,
        statusOverride: source.sourceStock === 0 ? 'out_of_stock' : 'auto',
        variants: {
          create: {
            name: displayName,
            priceCents: suggestedRetail,
            compareAtPriceCents: source.sourceRegularPrice ? Math.round(source.sourceRegularPrice * 1.35) : null,
            provider: source.provider,
            providerProductId: providerProductIdInt,
            providerPrice: source.sourcePrice,
            providerStock: source.sourceStock,
            connectionId: source.connectionId,
            sourceProductId: source.id,
            syncWithProvider: true,
          },
        },
      },
      include: { variants: true },
    })

    // Update SourceProduct record
    await prisma.sourceProduct.update({
      where: { id: source.id },
      data: {
        isAddedToStore: true,
        editorialStatus: 'draft',
        productId: newProduct.id,
        variantId: newProduct.variants[0]?.id || null,
        customPrice: suggestedRetail,
      },
    })

    createdCount++
    productIds.push(newProduct.id)
  }

  return {
    success: true,
    createdCount,
    alreadyAddedCount,
    productIds,
  }
}

/**
 * Updates a product's draft settings.
 * If product is currently published, saves as staged changes without altering live storefront prices.
 */
export async function updateProductDetails(
  productId: string,
  input: UpdateProductInput,
  _actorUsername?: string
) {
  void _actorUsername
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true },
  })

  if (!product) {
    throw new Error('Sản phẩm không tồn tại')
  }

  // Direct live update: Applied immediately to database and live storefront
  const updatedData: Record<string, unknown> = {
    hasPendingChanges: false,
    draftSnapshot: null,
    isCustomized: input.isCustomized !== undefined ? input.isCustomized : true,
    customizedAt: input.isCustomized === false ? null : new Date(),
  }

  if (input.name !== undefined) updatedData.name = input.name.trim()
  if (input.groupId !== undefined) updatedData.groupId = input.groupId || null
  if (input.description !== undefined) updatedData.description = input.description
  if (input.warrantyTerms !== undefined) updatedData.warrantyTerms = input.warrantyTerms
  if (input.usageInstructions !== undefined) {
    updatedData.usageInstructions = input.usageInstructions
    updatedData.serviceInstructions = input.usageInstructions
  }
  if (input.noticeNotes !== undefined) updatedData.noticeNotes = input.noticeNotes
  if (input.deliveryType !== undefined) updatedData.deliveryType = input.deliveryType
  if (input.fulfillmentType !== undefined) updatedData.fulfillmentType = input.fulfillmentType
  if (input.quantityMode !== undefined) updatedData.quantityMode = input.quantityMode
  if (input.requiresInviteCode !== undefined) updatedData.requiresInviteCode = Boolean(input.requiresInviteCode)
  if (input.statusOverride !== undefined) updatedData.statusOverride = input.statusOverride
  if (input.images !== undefined) updatedData.images = JSON.stringify(input.images)
  if (input.highlights !== undefined) updatedData.highlights = JSON.stringify(input.highlights)
  if (input.isFeatured !== undefined) updatedData.isFeatured = Boolean(input.isFeatured)

  if (input.action === 'publish_now') {
    updatedData.visibility = 'public'
    updatedData.editorialStatus = 'published'
  } else if (input.action === 'save_draft') {
    updatedData.visibility = 'hidden'
    updatedData.editorialStatus = 'draft'
  }

  if (input.visibility !== undefined) updatedData.visibility = input.visibility
  if (input.editorialStatus !== undefined) updatedData.editorialStatus = input.editorialStatus
  if (input.sortOrder !== undefined) updatedData.sortOrder = Number(input.sortOrder)

  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: updatedData,
    include: { variants: true },
  })

  // Update variants if provided
  if (Array.isArray(input.variants)) {
    const isBuff = input.fulfillmentType === 'buff' || product.fulfillmentType === 'buff'
    const defaultSource = await prisma.sourceProduct.findFirst({
      where: { externalId: 'buff_muse', provider: 'shoptool' },
      select: { id: true, connectionId: true, provider: true },
    })

    for (const [idx, vInput] of input.variants.entries()) {
      if (vInput._delete && vInput.id) {
        // Only delete if there are other variants remaining
        const remainingCount = await prisma.variant.count({ where: { productId } })
        if (remainingCount > 1) {
          await prisma.variant.delete({ where: { id: vInput.id } })
        }
        continue
      }

      // Auto-extract tokenAmountB from variant name if not provided (e.g. "Buff Token 10B" -> 10)
      let resolvedTokenB = vInput.tokenAmountB !== undefined ? vInput.tokenAmountB : null
      if (!resolvedTokenB && vInput.name) {
        const match = vInput.name.match(/(\d+)\s*b\b/i)
        if (match) {
          resolvedTokenB = parseInt(match[1], 10)
        }
      }

      const isBuffVariant = isBuff || Boolean(resolvedTokenB) || /buff|\d+b/i.test(`${product.name} ${vInput.name}`)
      const expectedBuffCost = resolvedTokenB ? calculateExpectedBuffCost(resolvedTokenB) : null
      const providerPrice = vInput.providerPrice !== undefined
        ? (vInput.providerPrice ? Math.max(0, Math.floor(vInput.providerPrice)) : null)
        : expectedBuffCost

      if (vInput.id) {
        await prisma.variant.update({
          where: { id: vInput.id },
          data: {
            name: vInput.name.trim(),
            priceCents: Math.max(0, Math.floor(vInput.priceCents)),
            compareAtPriceCents: vInput.compareAtPriceCents ? Math.max(0, Math.floor(vInput.compareAtPriceCents)) : null,
            providerPrice,
            providerStock: isBuffVariant ? 999 : undefined,
            minQuantity: vInput.minQuantity || 1,
            maxQuantity: vInput.maxQuantity || null,
            connectionId: vInput.connectionId !== undefined ? vInput.connectionId : (isBuffVariant && defaultSource ? defaultSource.connectionId : undefined),
            sourceProductId: vInput.sourceProductId !== undefined ? vInput.sourceProductId : (isBuffVariant && defaultSource ? defaultSource.id : undefined),
            provider: isBuffVariant ? 'shoptool' : undefined,
            tokenAmountB: resolvedTokenB,
            isActive: vInput.isActive !== undefined ? Boolean(vInput.isActive) : true,
            sortOrder: vInput.sortOrder !== undefined ? vInput.sortOrder : idx,
          },
        })
      } else if (vInput.name && vInput.priceCents >= 0) {
        // Create new variant
        await prisma.variant.create({
          data: {
            productId,
            name: vInput.name.trim(),
            priceCents: Math.max(0, Math.floor(vInput.priceCents)),
            compareAtPriceCents: vInput.compareAtPriceCents ? Math.max(0, Math.floor(vInput.compareAtPriceCents)) : null,
            providerPrice,
            providerStock: isBuffVariant ? 999 : 0,
            minQuantity: vInput.minQuantity || 1,
            maxQuantity: vInput.maxQuantity || null,
            connectionId: vInput.connectionId || (isBuffVariant && defaultSource ? defaultSource.connectionId : null),
            sourceProductId: vInput.sourceProductId || (isBuffVariant && defaultSource ? defaultSource.id : null),
            provider: isBuffVariant ? 'shoptool' : null,
            tokenAmountB: resolvedTokenB,
            isActive: vInput.isActive !== undefined ? Boolean(vInput.isActive) : true,
            sortOrder: vInput.sortOrder !== undefined ? vInput.sortOrder : idx,
          },
        })
      }
    }
  }

  return {
    success: true,
    staged: false,
    product: updatedProduct,
  }
}

/**
 * Publishes a product to storefront.
 * Applies any staged changes, sets visibility: "public", editorialStatus: "published".
 */
export async function publishProductToStore(
  productId: string,
  _actorUsername: string,
  options?: { confirmBelowCost?: boolean }
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        include: {
          connection: true,
          sourceProduct: true,
        },
      },
    },
  })

  if (!product) {
    throw new Error('Sản phẩm không tồn tại')
  }

  // Below cost validation
  for (const v of product.variants) {
    const wholesale = v.providerPrice || v.sourceProduct?.sourcePrice || (v.tokenAmountB ? calculateExpectedBuffCost(v.tokenAmountB) : 0)
    if (wholesale > 0 && v.priceCents < wholesale && !options?.confirmBelowCost) {
      throw new Error(
        `CẢNH BÁO: Giá bán gói "${v.name}" (${v.priceCents.toLocaleString('vi-VN')} đ) thấp hơn giá sỉ đại lý (${wholesale.toLocaleString('vi-VN')} đ). Vui lòng xác nhận để tiếp tục.`
      )
    }
  }

  const finalData: Record<string, unknown> = {
    visibility: 'public',
    editorialStatus: 'published',
    hasPendingChanges: false,
    draftSnapshot: null,
  }

  // If there are staged changes, apply them
  if (product.draftSnapshot) {
    try {
      const staged = JSON.parse(product.draftSnapshot)
      if (staged.name) finalData.name = staged.name
      if (staged.groupId !== undefined) finalData.groupId = staged.groupId
      if (staged.description) finalData.description = staged.description
      if (staged.warrantyTerms !== undefined) finalData.warrantyTerms = staged.warrantyTerms
      if (staged.usageInstructions !== undefined) {
        finalData.usageInstructions = staged.usageInstructions
        finalData.serviceInstructions = staged.usageInstructions
      }
      if (staged.noticeNotes !== undefined) finalData.noticeNotes = staged.noticeNotes
      if (staged.images) finalData.images = JSON.stringify(staged.images)

      if (Array.isArray(staged.variants)) {
        for (const sv of staged.variants) {
          if (sv.id) {
            await prisma.variant.update({
              where: { id: sv.id },
              data: {
                name: sv.name,
                priceCents: Math.max(0, Math.floor(sv.priceCents)),
                compareAtPriceCents: sv.compareAtPriceCents ? Math.max(0, Math.floor(sv.compareAtPriceCents)) : null,
                providerPrice: sv.providerPrice !== undefined ? (sv.providerPrice ? Math.max(0, Math.floor(sv.providerPrice)) : null) : undefined,
              },
            })
          }
        }
      }
    } catch {
      // Ignore parse failure, proceed to publish current fields
    }
  }

  const published = await prisma.product.update({
    where: { id: productId },
    data: finalData,
    include: { variants: true },
  })

  return published
}

/**
 * Hides a product from the storefront (sets visibility: "hidden", editorialStatus: "hidden").
 */
export async function hideProductFromStore(productId: string, _actorUsername?: string) {
  void _actorUsername
  const hidden = await prisma.product.update({
    where: { id: productId },
    data: {
      visibility: 'hidden',
      editorialStatus: 'hidden',
    },
  })
  return hidden
}
