import { prisma } from "./db"
import { getFatcatProducts, getFatcatBalance } from "./fatcat"
import { slugify } from "./utils"

export interface SyncResult {
  success: boolean
  totalFatcatProducts: number
  createdCount: number
  updatedCount: number
  error?: string
  balance?: number
}

/**
 * Đồng bộ danh mục sản phẩm, bảng giá sỉ và tồn kho từ FatCat Store vào database
 */
export async function syncFatcatCatalog(): Promise<SyncResult> {
  const [balanceRes, productsRes] = await Promise.all([
    getFatcatBalance(),
    getFatcatProducts(),
  ])

  if (!productsRes.success || !productsRes.products) {
    return {
      success: false,
      totalFatcatProducts: 0,
      createdCount: 0,
      updatedCount: 0,
      error: productsRes.error || "Không thể tải danh sách sản phẩm từ FatCat",
    }
  }

  const fatcatProducts = productsRes.products
  let createdCount = 0
  let updatedCount = 0

  // Đảm bảo có nhóm sản phẩm chung
  let defaultGroup = await prisma.productGroup.findFirst({
    where: { name: "Tài Khoản & Dịch Vụ AI - Bản Quyền" },
  })

  if (!defaultGroup) {
    defaultGroup = await prisma.productGroup.create({
      data: {
        name: "Tài Khoản & Dịch Vụ AI - Bản Quyền",
        badgeText: "Tự Động 24/7",
        badgeColor: "#10b981",
        sortOrder: 1,
      },
    })
  }

  for (const fp of fatcatProducts) {
    // 1. Kiểm tra xem biến thể đã liên kết với providerProductId này chưa
    const existingVariant = await prisma.variant.findFirst({
      where: {
        provider: "fatcat",
        providerProductId: fp.id,
      },
      include: { product: true },
    })

    if (existingVariant) {
      // Cập nhật tồn kho và giá sỉ thời gian thực
      await prisma.variant.update({
        where: { id: existingVariant.id },
        data: {
          providerStock: fp.stock,
          providerPrice: fp.price_vnd,
          // Nếu tồn kho = 0 thì tự động cập nhật
        },
      })

      // Đồng bộ trạng thái còn/hết hàng trên Product
      await prisma.product.update({
        where: { id: existingVariant.productId },
        data: {
          statusOverride: fp.stock === 0 ? "out_of_stock" : "auto",
          serviceInstructions: fp.description || existingVariant.product.serviceInstructions,
        },
      })

      updatedCount++
    } else {
      // 2. Kiểm tra xem tên sản phẩm có khớp với sản phẩm hiện có không (ví dụ sản phẩm tạo trước)
      const baseSlug = slugify(fp.name)
      const existingProduct = await prisma.product.findUnique({
        where: { slug: baseSlug },
        include: { variants: true },
      })

      if (existingProduct) {
        // Gắn provider vào variant đầu tiên hoặc tạo variant mới
        if (existingProduct.variants.length > 0) {
          await prisma.variant.update({
            where: { id: existingProduct.variants[0].id },
            data: {
              provider: "fatcat",
              providerProductId: fp.id,
              providerStock: fp.stock,
              providerPrice: fp.price_vnd,
              syncWithProvider: true,
            },
          })
          await prisma.product.update({
            where: { id: existingProduct.id },
            data: {
              deliveryType: "fatcat",
              statusOverride: fp.stock === 0 ? "out_of_stock" : "auto",
            },
          })
          updatedCount++
          continue
        }
      }

      // Tạo mới sản phẩm hoàn chỉnh đồng bộ từ FatCat
      let slug = baseSlug
      let counter = 1
      while (await prisma.product.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`
      }

      // Tính giá bán lẻ đề xuất (Lợi nhuận gộp ~ 30% - 40%, làm tròn đẹp)
      const wholesalePrice = fp.price_vnd
      const markupRatio = wholesalePrice < 20000 ? 1.5 : wholesalePrice < 100000 ? 1.35 : 1.25
      const retailPrice = Math.round((wholesalePrice * markupRatio) / 1000) * 1000
      const comparePrice = fp.regular_price_vnd ? Math.round((fp.regular_price_vnd * 1.4) / 1000) * 1000 : retailPrice

      await prisma.product.create({
        data: {
          name: fp.name,
          slug,
          description: fp.description || `Sản phẩm ${fp.name} kích hoạt tự động 24/7.`,
          deliveryType: "fatcat",
          serviceInstructions: fp.description,
          visibility: "public",
          statusOverride: fp.stock === 0 ? "out_of_stock" : "auto",
          groupId: defaultGroup.id,
          variants: {
            create: {
              name: "Gói Kích Hoạt Tự Động",
              priceCents: retailPrice > 0 ? retailPrice : 50000,
              compareAtPriceCents: comparePrice > retailPrice ? comparePrice : null,
              provider: "fatcat",
              providerProductId: fp.id,
              providerPrice: fp.price_vnd,
              providerStock: fp.stock,
              syncWithProvider: true,
            },
          },
        },
      })

      createdCount++
    }
  }

  return {
    success: true,
    totalFatcatProducts: fatcatProducts.length,
    createdCount,
    updatedCount,
    balance: balanceRes.data?.balance_vnd || 0,
  }
}
