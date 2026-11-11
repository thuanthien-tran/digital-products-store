import { prisma } from './db'
import { slugify } from './utils'

export interface UpdateDraftInput {
  customName?: string
  customPrice?: number
  customDescription?: string
  customGroupId?: string | null
  customWarrantyInfo?: string | null
  customPurchaseLimit?: number | null
  customImages?: string[]
  expectedVersion?: number
}

export interface PublishInput {
  confirmBelowCost?: boolean
  expectedVersion?: number
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Updates the draft / editorial fields of a source product.
 * Does NOT publish to storefront.
 */
export async function updateSourceProductDraft(
  id: string,
  input: UpdateDraftInput
) {
  const current = await prisma.sourceProduct.findUnique({
    where: { id },
  })

  if (!current) {
    throw new Error('Sản phẩm nguồn không tồn tại')
  }

  if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new ConflictError(
      'Dữ liệu sản phẩm đã bị thay đổi bởi phiên làm việc khác. Vui lòng tải lại trang trước khi lưu.'
    )
  }

  // Next editorial status: If currently 'new', transition to 'draft'
  const newEditorialStatus = current.editorialStatus === 'new' ? 'draft' : current.editorialStatus

  const updated = await prisma.sourceProduct.update({
    where: { id },
    data: {
      customName: input.customName !== undefined ? input.customName.trim() : current.customName,
      customPrice: input.customPrice !== undefined ? Math.max(0, Math.floor(input.customPrice)) : current.customPrice,
      customDescription: input.customDescription !== undefined ? input.customDescription : current.customDescription,
      customGroupId: input.customGroupId !== undefined ? input.customGroupId : current.customGroupId,
      customWarrantyInfo: input.customWarrantyInfo !== undefined ? input.customWarrantyInfo : current.customWarrantyInfo,
      customPurchaseLimit: input.customPurchaseLimit !== undefined ? input.customPurchaseLimit : current.customPurchaseLimit,
      customImages: input.customImages ? JSON.stringify(input.customImages) : current.customImages,
      editorialStatus: newEditorialStatus,
      version: { increment: 1 },
    },
  })

  return updated
}

/**
 * Publishes a source product to the storefront.
 * Creates or updates the corresponding Product & Variant with visibility: "public".
 */
export async function publishSourceProduct(
  id: string,
  actorUsername: string,
  options?: PublishInput
) {
  const source = await prisma.sourceProduct.findUnique({
    where: { id },
    include: {
      product: {
        include: { variants: true },
      },
    },
  })

  if (!source) {
    throw new Error('Sản phẩm nguồn không tồn tại')
  }

  if (options?.expectedVersion !== undefined && source.version !== options.expectedVersion) {
    throw new ConflictError(
      'Dữ liệu sản phẩm đã bị thay đổi bởi phiên làm việc khác. Vui lòng tải lại trang.'
    )
  }

  const displayName = (source.customName || source.sourceName || '').trim()
  if (!displayName) {
    throw new ValidationError('Tên sản phẩm hiển thị không được để trống')
  }

  const sellingPrice = source.customPrice !== null && source.customPrice !== undefined ? source.customPrice : 0
  if (!Number.isInteger(sellingPrice) || sellingPrice <= 0) {
    throw new ValidationError('Giá bán niêm yết phải là số nguyên dương lớn hơn 0')
  }

  // Below cost protection
  if (sellingPrice < source.sourcePrice && !options?.confirmBelowCost) {
    throw new ValidationError(
      `CẢNH BÁO: Giá bán (${sellingPrice.toLocaleString('vi-VN')} đ) thấp hơn giá sỉ đại lý (${source.sourcePrice.toLocaleString('vi-VN')} đ). Vui lòng xác nhận để tiếp tục.`
    )
  }

  const description = source.customDescription || source.sourceDescription || `Sản phẩm ${displayName}`

  // Default group assignment
  let groupId = source.customGroupId
  if (!groupId) {
    const defaultGroup = await prisma.productGroup.findFirst({
      where: { visibility: 'public' },
      orderBy: { sortOrder: 'asc' },
    })
    groupId = defaultGroup?.id || null
  }

  let linkedProductId = source.productId
  let linkedVariantId = source.variantId

  if (!linkedProductId || !source.product) {
    // Generate unique slug
    let baseSlug = slugify(displayName)
    if (!baseSlug) baseSlug = `product-${source.externalId}`
    let slug = baseSlug
    let counter = 1
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`
    }

    const newProduct = await prisma.product.create({
      data: {
        name: displayName,
        slug,
        description,
        groupId,
        deliveryType: source.provider === 'fatcat' ? 'fatcat' : 'serials',
        serviceInstructions: source.customWarrantyInfo || source.sourceDescription,
        visibility: 'public',
        statusOverride: source.sourceStock === 0 ? 'out_of_stock' : 'auto',
        images: source.customImages || '[]',
        variants: {
          create: {
            name: displayName,
            priceCents: sellingPrice,
            compareAtPriceCents: source.sourceRegularPrice ? Math.round(source.sourceRegularPrice * 1.35) : null,
            provider: source.provider,
            providerProductId: Number.isInteger(Number(source.externalId)) ? Number(source.externalId) : null,
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

    linkedProductId = newProduct.id
    linkedVariantId = newProduct.variants[0]?.id || null
  } else {
    // Update existing storefront product
    await prisma.product.update({
      where: { id: linkedProductId },
      data: {
        name: displayName,
        description,
        groupId,
        serviceInstructions: source.customWarrantyInfo || source.sourceDescription,
        visibility: 'public',
        statusOverride: source.sourceStock === 0 ? 'out_of_stock' : 'auto',
        images: source.customImages || '[]',
      },
    })

    const targetVariantId = linkedVariantId || source.product.variants[0]?.id
    if (targetVariantId) {
      await prisma.variant.update({
        where: { id: targetVariantId },
        data: {
          name: displayName,
          priceCents: sellingPrice,
          provider: source.provider,
          providerProductId: Number.isInteger(Number(source.externalId)) ? Number(source.externalId) : null,
          providerPrice: source.sourcePrice,
          providerStock: source.sourceStock,
          connectionId: source.connectionId,
          sourceProductId: source.id,
        },
      })
      linkedVariantId = targetVariantId
    }
  }

  // Update SourceProduct status
  const updated = await prisma.sourceProduct.update({
    where: { id },
    data: {
      productId: linkedProductId,
      variantId: linkedVariantId,
      editorialStatus: 'published',
      publishedAt: new Date(),
      publishedBy: actorUsername,
      hasChangeAlert: false,
      changeAlertDetails: null,
      version: { increment: 1 },
    },
    include: { product: true },
  })

  return updated
}

/**
 * Unpublishes a source product from storefront.
 * Sets Product visibility to "hidden".
 */
export async function unpublishSourceProduct(id: string, actorUsername: string) {
  const source = await prisma.sourceProduct.findUnique({
    where: { id },
    include: { product: true },
  })

  if (!source) {
    throw new Error('Sản phẩm nguồn không tồn tại')
  }

  if (source.product) {
    await prisma.product.update({
      where: { id: source.product.id },
      data: { visibility: 'hidden' },
    })
  }

  const updated = await prisma.sourceProduct.update({
    where: { id },
    data: {
      editorialStatus: 'draft',
      publishedBy: actorUsername,
      version: { increment: 1 },
    },
  })

  return updated
}

/**
 * Ignores a source product.
 * If currently published, unpublishes it first.
 */
export async function ignoreSourceProduct(id: string, actorUsername: string) {
  const source = await prisma.sourceProduct.findUnique({
    where: { id },
    include: { product: true },
  })

  if (!source) {
    throw new Error('Sản phẩm nguồn không tồn tại')
  }

  if (source.product) {
    await prisma.product.update({
      where: { id: source.product.id },
      data: { visibility: 'hidden' },
    })
  }

  const updated = await prisma.sourceProduct.update({
    where: { id },
    data: {
      editorialStatus: 'ignored',
      hasChangeAlert: false,
      publishedBy: actorUsername,
      version: { increment: 1 },
    },
  })

  return updated
}

/**
 * Restores an ignored source product back to 'draft'.
 */
export async function restoreIgnoredSourceProduct(id: string) {
  const source = await prisma.sourceProduct.findUnique({
    where: { id },
  })

  if (!source) {
    throw new Error('Sản phẩm nguồn không tồn tại')
  }

  const updated = await prisma.sourceProduct.update({
    where: { id },
    data: {
      editorialStatus: 'draft',
      version: { increment: 1 },
    },
  })

  return updated
}
