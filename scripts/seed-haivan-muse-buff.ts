import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function seedMergedHaiVanMuse() {
  const haivanConn = await prisma.providerConnection.findFirst({
    where: { provider: 'haivan' },
  })
  if (!haivanConn) {
    console.log('[Seed] HaiVan connection not found, skipping seed.')
    return
  }

  const s10 = await prisma.sourceProduct.findFirst({
    where: { connectionId: haivanConn.id, externalId: 'zz6yyexp' },
  })
  const s20 = await prisma.sourceProduct.findFirst({
    where: { connectionId: haivanConn.id, externalId: 'qw736qpf' },
  })
  const s30 = await prisma.sourceProduct.findFirst({
    where: { connectionId: haivanConn.id, externalId: '6ppl02zg' },
  })

  if (!s10 || !s20 || !s30) {
    console.log('[Seed] Missing one or more of the 3 HaiVan Muse source products, skipping seed.')
    return
  }

  const productName = 'MUSE AI - Buff Token Chính Chủ (10B - 20B - 30B)'
  const slug = 'muse-ai---buff-token-chinh-chu-10b-20b-30b'
  const group = await prisma.productGroup.findFirst({
    where: { name: 'AI' },
  })

  const images = JSON.stringify([
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQHlcTiEvRckKho95h3D4_GexUimtJkx0qK3hTHSiHIrjDJwGAMYI8T-P0&s=10',
  ])

  const description = [
    '**Thông tin & Quyền lợi:**\n- Nạp token trực tiếp vào tài khoản Muse AI thông qua Mã mời (Invite Code).\n- Đầy đủ các gói dung lượng lớn: 10 Tỷ (~10B), 20 Tỷ (~20B), 30 Tỷ (~30B) Token.\n- Xử lý tự động qua hệ thống đại lý Hải Vân Kho Sỉ, an toàn 100% không yêu cầu mật khẩu.',
    '**Hướng dẫn nhận hàng:**\n1. Lấy Mã Mời (Invite Code dạng 6 ký tự, ví dụ: 0FBALX) trong tài khoản Muse AI của bạn.\n2. Điền chính xác Mã Mời khi thanh toán.\n3. Hệ thống sẽ tự động gửi lệnh nạp token vào tài khoản Muse AI của bạn ngay sau khi hoàn tất thanh toán.',
    '**Chính sách bảo hành:**\nBảo hành đủ số lượng token tương ứng theo đúng gói dung lượng đã chọn.',
    '**Lưu ý quan trọng:**\n- Kiểm tra chính xác mã mời trước khi xác nhận đơn hàng.\n- Một đơn hàng nạp tương ứng vào một mã mời duy nhất.',
  ].join('\n\n')

  let product = await prisma.product.findUnique({
    where: { slug },
    include: { variants: true },
  })

  const variantConfigs = [
    {
      name: 'Buff Token 10B (~10 Tỷ Tokens)',
      tokenAmountB: 10,
      providerPrice: 14000,
      priceCents: 21000,
      compareAtPriceCents: 28000,
      sortOrder: 1,
      sourceProduct: s10,
    },
    {
      name: 'Buff Token 20B (~20 Tỷ Tokens)',
      tokenAmountB: 20,
      providerPrice: 24000,
      priceCents: 32000,
      compareAtPriceCents: 45000,
      sortOrder: 2,
      sourceProduct: s20,
    },
    {
      name: 'Buff Token 30B (~30 Tỷ Tokens)',
      tokenAmountB: 30,
      providerPrice: 29000,
      priceCents: 39000,
      compareAtPriceCents: 55000,
      sortOrder: 3,
      sourceProduct: s30,
    },
  ]

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: productName,
        slug,
        groupId: group?.id || null,
        description,
        serviceInstructions: 'Hệ thống tự động gửi lệnh nạp token vào tài khoản theo mã mời bạn đã cung cấp.',
        warrantyTerms: 'Bảo hành đủ số lượng token tương ứng theo gói đã chọn.',
        usageInstructions: 'Đăng nhập vào Muse AI để sử dụng số token vừa được bổ sung.',
        noticeNotes: 'Vui lòng kiểm tra kỹ mã mời trước khi xác nhận thanh toán.',
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
          create: variantConfigs.map((vc) => ({
            name: vc.name,
            tokenAmountB: vc.tokenAmountB,
            provider: 'haivan',
            providerPrice: vc.providerPrice,
            priceCents: vc.priceCents,
            compareAtPriceCents: vc.compareAtPriceCents,
            minQuantity: 1,
            maxQuantity: 1,
            isActive: true,
            sortOrder: vc.sortOrder,
            connectionId: haivanConn.id,
            sourceProductId: vc.sourceProduct.id,
            providerStock: vc.sourceProduct.sourceStock,
          })),
        },
      },
      include: { variants: true },
    })
    console.log('[Seed] Created product:', product.name)
  } else {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        name: productName,
        groupId: group?.id || null,
        description,
        fulfillmentType: 'buff',
        quantityMode: 'fixed_package',
        requiresInviteCode: true,
        visibility: 'public',
        editorialStatus: 'published',
        isFeatured: true,
      },
    })

    for (const vc of variantConfigs) {
      const exV = product.variants.find((v) => v.tokenAmountB === vc.tokenAmountB)
      if (exV) {
        await prisma.variant.update({
          where: { id: exV.id },
          data: {
            name: vc.name,
            providerPrice: vc.providerPrice,
            priceCents: vc.priceCents,
            compareAtPriceCents: vc.compareAtPriceCents,
            provider: 'haivan',
            connectionId: haivanConn.id,
            sourceProductId: vc.sourceProduct.id,
            providerStock: vc.sourceProduct.sourceStock,
            isActive: true,
            sortOrder: vc.sortOrder,
          },
        })
      } else {
        await prisma.variant.create({
          data: {
            productId: product.id,
            name: vc.name,
            tokenAmountB: vc.tokenAmountB,
            providerPrice: vc.providerPrice,
            priceCents: vc.priceCents,
            compareAtPriceCents: vc.compareAtPriceCents,
            provider: 'haivan',
            connectionId: haivanConn.id,
            sourceProductId: vc.sourceProduct.id,
            providerStock: vc.sourceProduct.sourceStock,
            minQuantity: 1,
            maxQuantity: 1,
            isActive: true,
            sortOrder: vc.sortOrder,
          },
        })
      }
    }
  }

  // Mark 3 source products as added
  for (const vc of variantConfigs) {
    await prisma.sourceProduct.updateMany({
      where: { id: vc.sourceProduct.id },
      data: {
        isAddedToStore: true,
        editorialStatus: 'published',
        customPrice: vc.priceCents,
      },
    })
  }

  console.log('[Seed] Successfully ensured merged HaiVan Muse Buff product and variants.')
}

async function main() {
  await seedMergedHaiVanMuse()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
