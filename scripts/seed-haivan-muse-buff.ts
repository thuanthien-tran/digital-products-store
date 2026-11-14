import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function seedMergedAllBuffMuse() {
  const shoptoolConn = await prisma.providerConnection.findFirst({
    where: { provider: { in: ['shoptool', 'shoptoolgiare'] } },
  })
  const shoptoolSource = await prisma.sourceProduct.findFirst({
    where: { externalId: 'buff_muse' },
  })

  const haivanConn = await prisma.providerConnection.findFirst({
    where: { provider: 'haivan' },
  })

  let s5 = null
  let s10 = null
  let s20 = null
  let s30 = null
  if (haivanConn) {
    s5 = await prisma.sourceProduct.findFirst({
      where: { connectionId: haivanConn.id, OR: [{ externalId: 'xyqzgjze' }, { sourceName: { contains: '5 TỶ' } }] },
    })
    s10 = await prisma.sourceProduct.findFirst({
      where: { connectionId: haivanConn.id, externalId: 'zz6yyexp' },
    })
    s20 = await prisma.sourceProduct.findFirst({
      where: { connectionId: haivanConn.id, externalId: 'qw736qpf' },
    })
    s30 = await prisma.sourceProduct.findFirst({
      where: { connectionId: haivanConn.id, externalId: '6ppl02zg' },
    })
  }

  const productName = 'MUSE AI - Buff Token Chính Chủ (1B - 5B - 10B - 20B - 30B)'
  const slug = 'muse-ai---buff-token-chinh-chu-10b-20b-30b'
  const group = await prisma.productGroup.findFirst({
    where: { name: 'AI' },
  })

  const images = JSON.stringify([
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQHlcTiEvRckKho95h3D4_GexUimtJkx0qK3hTHSiHIrjDJwGAMYI8T-P0&s=10',
  ])

  const description = [
    '**Thông tin & Quyền lợi:**\n- Nạp token trực tiếp vào tài khoản Muse AI thông qua Mã mời (Invite Code).\n- Đầy đủ các gói dung lượng linh hoạt: 1 Tỷ (~1B), 5 Tỷ (~5B), 10 Tỷ (~10B), 20 Tỷ (~20B), 30 Tỷ (~30B) Token.\n- Xử lý tự động hóa 24/7 qua kết nối đại lý chuyên biệt, an toàn 100% không yêu cầu mật khẩu.',
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
      name: 'Buff Token 1B (~1 Tỷ Tokens)',
      tokenAmountB: 1,
      provider: 'shoptool',
      providerPrice: 2500,
      priceCents: 5000,
      compareAtPriceCents: 8000,
      sortOrder: 1,
      connectionId: shoptoolConn?.id || null,
      sourceProductId: shoptoolSource?.id || null,
      providerStock: 999,
    },
    {
      name: 'Buff Token 5B (~5 Tỷ Tokens)',
      tokenAmountB: 5,
      provider: 'haivan',
      providerPrice: s5?.sourcePrice || 7500,
      priceCents: 11000,
      compareAtPriceCents: 16000,
      sortOrder: 2,
      connectionId: haivanConn?.id || null,
      sourceProductId: s5?.id || null,
      providerStock: s5?.sourceStock || 18,
    },
    {
      name: 'Buff Token 10B (~10 Tỷ Tokens)',
      tokenAmountB: 10,
      provider: 'haivan',
      providerPrice: 14000,
      priceCents: 21000,
      compareAtPriceCents: 28000,
      sortOrder: 3,
      connectionId: haivanConn?.id || null,
      sourceProductId: s10?.id || null,
      providerStock: s10?.sourceStock || 59,
    },
    {
      name: 'Buff Token 20B (~20 Tỷ Tokens)',
      tokenAmountB: 20,
      provider: 'haivan',
      providerPrice: 24000,
      priceCents: 32000,
      compareAtPriceCents: 45000,
      sortOrder: 4,
      connectionId: haivanConn?.id || null,
      sourceProductId: s20?.id || null,
      providerStock: s20?.sourceStock || 25,
    },
    {
      name: 'Buff Token 30B (~30 Tỷ Tokens)',
      tokenAmountB: 30,
      provider: 'haivan',
      providerPrice: 29000,
      priceCents: 39000,
      compareAtPriceCents: 55000,
      sortOrder: 5,
      connectionId: haivanConn?.id || null,
      sourceProductId: s30?.id || null,
      providerStock: s30?.sourceStock || 29,
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
            provider: vc.provider,
            providerPrice: vc.providerPrice,
            priceCents: vc.priceCents,
            compareAtPriceCents: vc.compareAtPriceCents,
            minQuantity: 1,
            maxQuantity: 1,
            isActive: true,
            sortOrder: vc.sortOrder,
            connectionId: vc.connectionId,
            sourceProductId: vc.sourceProductId,
            providerStock: vc.providerStock,
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
            provider: vc.provider,
            connectionId: vc.connectionId,
            sourceProductId: vc.sourceProductId,
            providerStock: vc.providerStock,
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
            provider: vc.provider,
            connectionId: vc.connectionId,
            sourceProductId: vc.sourceProductId,
            providerStock: vc.providerStock,
            minQuantity: 1,
            maxQuantity: 1,
            isActive: true,
            sortOrder: vc.sortOrder,
          },
        })
      }
    }
  }

  // Hide or remove older separate products to keep catalog clean
  const standaloneProds = await prisma.product.findMany({
    where: {
      OR: [
        { slug: 'dich-vu-bo-sung-token-muse-ai' },
        { slug: 'muse---buff-5-ty' },
        { name: 'MUSE - BUFF 5 TỶ' },
        { name: 'MUSE Buff 5 tỷ' },
      ],
    },
    include: { variants: true },
  })
  for (const sp of standaloneProds) {
    if (sp.id === product.id) continue
    await prisma.variant.deleteMany({ where: { productId: sp.id } })
    await prisma.product.delete({ where: { id: sp.id } })
  }

  console.log('[Seed] Successfully ensured merged 5-tier Muse Buff product (1B, 5B, 10B, 20B, 30B).')
}

async function main() {
  await seedMergedAllBuffMuse()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
