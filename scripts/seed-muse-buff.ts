import { PrismaClient } from '@prisma/client'
import { MUSE_BUFF_STANDARD_PACKAGES } from '../lib/buff-pricing'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Seeding/Ensuring Dịch Vụ Bổ Sung Token Muse AI ---')

  const connection = await prisma.providerConnection.findFirst({
    where: { provider: 'shoptool' },
  })

  const sourceProduct = await prisma.sourceProduct.findFirst({
    where: { externalId: 'buff_muse', provider: 'shoptool' },
  })

  const defaultGroup = await prisma.productGroup.findFirst({
    where: { visibility: 'public' },
    orderBy: { sortOrder: 'asc' },
  })

  const productName = 'Dịch Vụ Bổ Sung Token Muse AI'
  const slug = 'dich-vu-bo-sung-token-muse-ai'

  let product = await prisma.product.findFirst({
    where: {
      OR: [
        { slug },
        { name: productName },
      ],
    },
    include: { variants: true },
  })

  const description = [
    '**Thông tin & Quyền lợi:**\n- Nạp token trực tiếp vào tài khoản Muse AI thông qua Mã mời (Invite Code).\n- Tự động buff qua hệ thống đại lý ShopTool Giá Rẻ, theo dõi tiến trình trực tiếp.\n- Không cần mật khẩu, an toàn tuyệt đối 100%.',
    '**Hướng dẫn sử dụng & Nhận hàng:**\n1. Lấy Mã Mời (Invite Code dạng 6 ký tự, ví dụ: 0FBALX) trong tài khoản Muse AI của bạn.\n2. Điền chính xác Mã Mời khi thanh toán.\n3. Sau khi thanh toán hoàn tất, hệ thống tự động đẩy lệnh nạp token vào tài khoản của bạn ngay lập tức.',
    '**Chính sách bảo hành:**\nBảo hành đủ số lượng token đã nạp theo đúng gói đã chọn.',
    '**Lưu ý quan trọng:**\n- Kiểm tra chính xác mã mời trước khi thanh toán.\n- Một đơn hàng tương ứng với một lần nạp vào một mã mời duy nhất.',
  ].join('\n\n')

  const images = JSON.stringify([
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQHlcTiEvRckKho95h3D4_GexUimtJkx0qK3hTHSiHIrjDJwGAMYI8T-P0&s=10',
  ])

  if (!product) {
    console.log('Creating new product:', productName)
    product = await prisma.product.create({
      data: {
        name: productName,
        slug,
        groupId: defaultGroup?.id || null,
        description,
        serviceInstructions: 'Hệ thống tự động nạp token vào tài khoản theo mã mời bạn đã cung cấp.',
        warrantyTerms: 'Bảo hành đủ số lượng token đã nạp.',
        usageInstructions: 'Đăng nhập vào Muse AI để sử dụng số token vừa được bổ sung.',
        noticeNotes: 'Vui lòng kiểm tra kỹ mã mời trước khi xác nhận đơn.',
        images,
        deliveryType: 'service',
        fulfillmentType: 'buff',
        quantityMode: 'fixed_package',
        requiresInviteCode: true,
        visibility: 'public',
        editorialStatus: 'published',
        statusOverride: 'auto',
        isFeatured: true,
        sortOrder: 1,
        variants: {
          create: MUSE_BUFF_STANDARD_PACKAGES.map((pkg, idx) => ({
            name: pkg.name,
            tokenAmountB: pkg.tokenAmountB,
            providerPrice: pkg.expectedCost,
            priceCents: pkg.defaultPrice,
            compareAtPriceCents: pkg.defaultComparePrice || null,
            minQuantity: 1,
            maxQuantity: 1,
            isActive: true,
            sortOrder: idx + 1,
            provider: 'shoptool',
            connectionId: connection?.id || null,
            sourceProductId: sourceProduct?.id || null,
            providerStock: 999,
          })),
        },
      },
      include: { variants: true },
    })
    console.log('Successfully created product with', product.variants.length, 'variants.')
  } else {
    console.log('Product already exists, updating configuration & variants...')
    await prisma.product.update({
      where: { id: product.id },
      data: {
        fulfillmentType: 'buff',
        quantityMode: 'fixed_package',
        requiresInviteCode: true,
        deliveryType: 'service',
        description,
      },
    })

    // Upsert the 5 variants
    for (const [idx, pkg] of MUSE_BUFF_STANDARD_PACKAGES.entries()) {
      const existingV = product.variants.find((v) => v.tokenAmountB === pkg.tokenAmountB || v.name === pkg.name)
      if (existingV) {
        await prisma.variant.update({
          where: { id: existingV.id },
          data: {
            name: pkg.name,
            tokenAmountB: pkg.tokenAmountB,
            providerPrice: pkg.expectedCost,
            priceCents: existingV.priceCents || pkg.defaultPrice,
            compareAtPriceCents: existingV.compareAtPriceCents || pkg.defaultComparePrice,
            minQuantity: 1,
            maxQuantity: 1,
            isActive: true,
            sortOrder: idx + 1,
            provider: 'shoptool',
            connectionId: connection?.id || null,
            sourceProductId: sourceProduct?.id || null,
            providerStock: 999,
          },
        })
      } else {
        await prisma.variant.create({
          data: {
            productId: product.id,
            name: pkg.name,
            tokenAmountB: pkg.tokenAmountB,
            providerPrice: pkg.expectedCost,
            priceCents: pkg.defaultPrice,
            compareAtPriceCents: pkg.defaultComparePrice || null,
            minQuantity: 1,
            maxQuantity: 1,
            isActive: true,
            sortOrder: idx + 1,
            provider: 'shoptool',
            connectionId: connection?.id || null,
            sourceProductId: sourceProduct?.id || null,
            providerStock: 999,
          },
        })
      }
    }
    console.log('Product and variants updated successfully.')
  }

  if (sourceProduct && product) {
    await prisma.sourceProduct.update({
      where: { id: sourceProduct.id },
      data: {
        isAddedToStore: true,
        productId: product.id,
        variantId: product.variants[0]?.id || null,
      },
    })
  }

  console.log('--- Done! ---')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
