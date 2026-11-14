import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function mergeMuse5B() {
  console.log('[MergeMuse5B] Starting consolidation of Muse 5B into Muse Buff product...')

  // 1. Find Hải Vân connection
  const haivanConn = await prisma.providerConnection.findFirst({
    where: {
      OR: [
        { provider: 'haivan' },
        { provider: 'shopbot' },
        { name: { contains: 'Hải Vân' } },
        { name: { contains: 'HaiVan' } },
        { baseUrl: { contains: 'haivankhosi' } },
      ],
    },
  })

  // 2. Find the 5B SourceProduct from HaiVan (externalId: 'xyqzgjze')
  let s5 = await prisma.sourceProduct.findFirst({
    where: {
      OR: [
        { externalId: 'xyqzgjze' },
        { sourceName: { contains: 'BUFF 5' } },
        { sourceName: { contains: '5 TỶ' } },
        { sourceName: { contains: '5 tỷ' } }
      ]
    }
  })

  // 3. Find the consolidated Muse AI Buff product
  let consolidatedProd = await prisma.product.findFirst({
    where: {
      OR: [
        { slug: 'muse-ai---buff-token-chinh-chu-10b-20b-30b' },
        { name: { contains: 'Buff Token Chính Chủ' } }
      ]
    },
    include: { variants: true }
  })

  if (!consolidatedProd) {
    console.error('[MergeMuse5B] Consolidated Muse AI Buff product not found')
    return
  }

  const newProductName = 'MUSE AI - Buff Token Chính Chủ (1B - 5B - 10B - 20B - 30B)'

  // 4. Update the consolidated product title & description
  await prisma.product.update({
    where: { id: consolidatedProd.id },
    data: {
      name: newProductName,
      quantityMode: 'flexible',
      editorialStatus: 'published',
      visibility: 'public',
      description: [
        '**Thông tin & Quyền lợi:**\n- Nạp token trực tiếp vào tài khoản Muse AI thông qua Mã mời (Invite Code).\n- Đầy đủ các gói dung lượng linh hoạt: 1 Tỷ (~1B), 5 Tỷ (~5B), 10 Tỷ (~10B), 20 Tỷ (~20B), 30 Tỷ (~30B) Token.\n- Xử lý tự động hóa 24/7 qua kết nối đại lý chuyên biệt, an toàn 100% không yêu cầu mật khẩu.',
        '**Hướng dẫn nhận hàng:**\n1. Lấy Mã Mời (Invite Code dạng 6 ký tự, ví dụ: 0FBALX) trong tài khoản Muse AI của bạn.\n2. Điền chính xác Mã Mời khi thanh toán.\n3. Hệ thống sẽ tự động gửi lệnh nạp token vào tài khoản Muse AI của bạn ngay sau khi hoàn tất thanh toán.',
        '**Chính sách bảo hành:**\nBảo hành đủ số lượng token tương ứng theo đúng gói dung lượng đã chọn.',
        '**Lưu ý quan trọng:**\n- Kiểm tra chính xác mã mời trước khi xác nhận đơn hàng.\n- Một đơn hàng nạp tương ứng vào một mã mời duy nhất.',
      ].join('\n\n')
    }
  })

  // 5. Ensure the 5B variant exists in the consolidated product
  let v5 = consolidatedProd.variants.find(v => v.tokenAmountB === 5 || v.name.includes('5B') || v.name.includes('5 Tỷ'))

  if (!v5) {
    v5 = await prisma.variant.create({
      data: {
        productId: consolidatedProd.id,
        name: 'Buff Token 5B (~5 Tỷ Tokens)',
        tokenAmountB: 5,
        provider: 'haivan',
        providerPrice: s5?.sourcePrice ?? 7500,
        priceCents: 11000,
        compareAtPriceCents: 16000,
        providerStock: s5?.sourceStock ?? 18,
        minQuantity: 1,
        maxQuantity: 5,
        isActive: true,
        sortOrder: 2,
        connectionId: haivanConn?.id ?? s5?.connectionId ?? null,
        sourceProductId: s5?.id ?? null
      }
    })
    console.log('[MergeMuse5B] Created variant Buff Token 5B:', v5.id)
  } else {
    v5 = await prisma.variant.update({
      where: { id: v5.id },
      data: {
        name: 'Buff Token 5B (~5 Tỷ Tokens)',
        tokenAmountB: 5,
        provider: 'haivan',
        providerPrice: s5?.sourcePrice ?? 7500,
        priceCents: 11000,
        compareAtPriceCents: 16000,
        providerStock: s5?.sourceStock ?? 18,
        minQuantity: 1,
        maxQuantity: 5,
        isActive: true,
        sortOrder: 2,
        connectionId: haivanConn?.id ?? s5?.connectionId ?? null,
        sourceProductId: s5?.id ?? null
      }
    })
    console.log('[MergeMuse5B] Updated existing 5B variant:', v5.id)
  }

  // 6. Update sortOrders for all variants: 1B (1), 5B (2), 10B (3), 20B (4), 30B (5)
  const allVariants = await prisma.variant.findMany({
    where: { productId: consolidatedProd.id }
  })
  for (const v of allVariants) {
    let targetOrder = 1
    if (v.tokenAmountB === 1 || v.name.includes('1B')) targetOrder = 1
    else if (v.tokenAmountB === 5 || v.name.includes('5B')) targetOrder = 2
    else if (v.tokenAmountB === 10 || v.name.includes('10B')) targetOrder = 3
    else if (v.tokenAmountB === 20 || v.name.includes('20B')) targetOrder = 4
    else if (v.tokenAmountB === 30 || v.name.includes('30B')) targetOrder = 5

    await prisma.variant.update({
      where: { id: v.id },
      data: { sortOrder: targetOrder, maxQuantity: 5 }
    })
  }

  // 7. If the standalone product "MUSE - BUFF 5 TỶ" exists, delete it
  const standaloneProds = await prisma.product.findMany({
    where: {
      id: { not: consolidatedProd.id },
      OR: [
        { slug: 'muse---buff-5-ty' },
        { name: 'MUSE - BUFF 5 TỶ' },
        { name: 'MUSE Buff 5 tỷ' },
        { name: { contains: 'BUFF 5 TỶ' } }
      ]
    },
    include: { variants: true }
  })

  for (const sp of standaloneProds) {
    console.log('[MergeMuse5B] Cleaning up standalone product:', sp.name, sp.id)
    // Delete variants first
    await prisma.variant.deleteMany({
      where: { productId: sp.id }
    })
    // Delete product
    await prisma.product.delete({
      where: { id: sp.id }
    })
  }

  // 8. Link SourceProduct to variant
  if (s5) {
    await prisma.sourceProduct.update({
      where: { id: s5.id },
      data: {
        isAddedToStore: true,
        variantId: v5.id,
      },
    })
  }

  // 9. Update SiteSettings priceListConfig if needed
  const settings = await prisma.siteSettings.findFirst()
  if (settings?.priceListConfig) {
    try {
      const config = JSON.parse(settings.priceListConfig)
      let modified = false
      if (Array.isArray(config.groups)) {
        for (const g of config.groups) {
          // Remove any standalone 5 tỷ item
          if (Array.isArray(g.items)) {
            const beforeLen = g.items.length
            g.items = g.items.filter((it: any) => !it.name?.includes('MUSE - BUFF 5 TỶ') && !it.name?.includes('BUFF 5 TỶ'))
            if (g.items.length !== beforeLen) modified = true

            // Update title of the consolidated item if present
            for (const it of g.items) {
              if (it.name?.includes('MUSE AI - Buff Token Chính Chủ')) {
                it.name = newProductName
                modified = true
              }
            }
          }
        }
      }
      if (modified) {
        await prisma.siteSettings.update({
          where: { id: settings.id },
          data: { priceListConfig: JSON.stringify(config) }
        })
        console.log('[MergeMuse5B] Updated SiteSettings priceListConfig')
      }
    } catch {}
  }

  console.log('[MergeMuse5B] Consolidation completed successfully!')
}

async function main() {
  await mergeMuse5B()
}

main().catch(console.error).finally(() => prisma.$disconnect())
