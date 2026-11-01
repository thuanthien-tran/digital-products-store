import { prisma } from '../lib/db'
import { encryptSecret, maskApiKey } from '../lib/crypto'

export async function runProviderMigration() {
  console.log('[Migration] Bắt đầu di chuyển dữ liệu sang cấu trúc đa đại lý...')

  const baseUrl = (process.env.FATCAT_API_BASE_URL || process.env.FATCAT_API_URL || 'https://api.fatcatstore.click').replace(/\/+$/, '')
  const rawKey = process.env.FATCAT_API_KEY || ''

  // 1. Ensure default FatCat connection exists
  let defaultConn = await prisma.providerConnection.findFirst({
    where: { provider: 'fatcat' },
  })

  if (!defaultConn) {
    console.log('[Migration] Khởi tạo kết nối đại lý mặc định: "FatCat Store - Mặc định"')
    defaultConn = await prisma.providerConnection.create({
      data: {
        name: 'FatCat Store - Mặc định',
        provider: 'fatcat',
        baseUrl,
        apiKeyEncrypted: rawKey ? encryptSecret(rawKey) : '',
        apiKeyMasked: rawKey ? maskApiKey(rawKey) : 'Chưa cấu hình key',
        isEnabled: true,
      },
    })
  }

  // 2. Link existing SourceProduct records to default connection
  const unlinkedSources = await prisma.sourceProduct.findMany({
    where: { connectionId: null },
  })

  if (unlinkedSources.length > 0) {
    console.log(`[Migration] Đang liên kết ${unlinkedSources.length} sản phẩm nguồn vào kết nối mặc định...`)
    for (const sp of unlinkedSources) {
      await prisma.sourceProduct.update({
        where: { id: sp.id },
        data: {
          connectionId: defaultConn.id,
          // ensure externalId is string
          externalId: String(sp.externalId),
        },
      })
    }
  }

  // 3. Link existing Variants to default connection
  const unlinkedVariants = await prisma.variant.findMany({
    where: {
      provider: 'fatcat',
      connectionId: null,
    },
  })

  if (unlinkedVariants.length > 0) {
    console.log(`[Migration] Đang liên kết ${unlinkedVariants.length} gói biến thể vào kết nối mặc định...`)
    for (const v of unlinkedVariants) {
      // Find matching source product if any
      let sourceProdId: string | null = null
      if (v.providerProductId) {
        const matchingSource = await prisma.sourceProduct.findFirst({
          where: { connectionId: defaultConn.id, externalId: String(v.providerProductId) },
        })
        if (matchingSource) sourceProdId = matchingSource.id
      }

      await prisma.variant.update({
        where: { id: v.id },
        data: {
          connectionId: defaultConn.id,
          sourceProductId: sourceProdId,
        },
      })
    }
  }

  // 4. Update editorialStatus for existing Products if needed
  const unclassifiedProducts = await prisma.product.findMany({
    where: { editorialStatus: 'draft', visibility: 'public' },
  })

  if (unclassifiedProducts.length > 0) {
    console.log(`[Migration] Đồng bộ ${unclassifiedProducts.length} sản phẩm đang public sang trạng thái "published"...`)
    for (const p of unclassifiedProducts) {
      await prisma.product.update({
        where: { id: p.id },
        data: { editorialStatus: 'published' },
      })
    }
  }

  console.log('[Migration] Di chuyển dữ liệu hoàn tất thành công 100%!')
  return { success: true, connectionId: defaultConn.id }
}

if (require.main === module) {
  runProviderMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration Error]', err)
      process.exit(1)
    })
}
