import { PrismaClient } from '@prisma/client'
import { encryptSecret } from '../lib/crypto'
import { getProviderAdapter } from '../lib/providers/registry'

const prisma = new PrismaClient()

export async function seedShopXoaiNon() {
  const apiKey = 'sxn_live_B-SCMDybDWt0tPTpqLWHoTQp5s-sSHjuw2NVSxq3NzE'
  const baseUrl = 'https://shopxoainon.online/api/v1'
  const name = 'Shop Xoài Non (ShopXoaiNon.online)'

  let conn = await prisma.providerConnection.findFirst({
    where: {
      OR: [
        { baseUrl: { contains: 'shopxoainon' } },
        { provider: 'shopxoainon' }
      ]
    }
  })

  const apiKeyEncrypted = encryptSecret(apiKey)
  const apiKeyMasked = apiKey.slice(0, 8) + '••••••••'

  if (!conn) {
    conn = await prisma.providerConnection.create({
      data: {
        name,
        provider: 'shopxoainon',
        baseUrl,
        apiKeyEncrypted,
        apiKeyMasked,
        isEnabled: true,
        balanceVnd: 0,
        balanceUsdt: 0,
        lastSyncStatus: 'success',
      }
    })
    console.log('[Seed] Created ShopXoaiNon connection:', conn.id)
  } else {
    conn = await prisma.providerConnection.update({
      where: { id: conn.id },
      data: {
        name,
        provider: 'shopxoainon',
        baseUrl,
        apiKeyEncrypted,
        apiKeyMasked,
        isEnabled: true,
      }
    })
    console.log('[Seed] Updated ShopXoaiNon connection:', conn.id)
  }

  // Fetch catalog and sync source products
  const adapter = getProviderAdapter('shopxoainon', baseUrl)
  const catRes = await adapter.fetchCatalog({
    provider: 'shopxoainon',
    baseUrl,
    apiKey,
  })

  if (catRes.ok && catRes.products) {
    console.log(`[Seed] Syncing ${catRes.products.length} products from ShopXoaiNon...`)
    for (const p of catRes.products) {
      await prisma.sourceProduct.upsert({
        where: {
          connectionId_externalId: {
            connectionId: conn.id,
            externalId: p.externalId,
          }
        },
        create: {
          connectionId: conn.id,
          provider: 'shopxoainon',
          externalId: p.externalId,
          sourceName: p.sourceName,
          sourceDescription: p.sourceDescription,
          sourcePrice: p.sourcePrice,
          sourceRegularPrice: p.sourceRegularPrice,
          saleQty: p.saleQty,
          sourceStock: p.sourceStock,
          maxQuantity: p.maxQuantity,
          rawJson: p.rawJson,
          editorialStatus: 'new',
          isAddedToStore: false,
        },
        update: {
          sourceName: p.sourceName,
          sourceDescription: p.sourceDescription,
          sourcePrice: p.sourcePrice,
          sourceRegularPrice: p.sourceRegularPrice,
          sourceStock: p.sourceStock,
          rawJson: p.rawJson,
          lastSyncedAt: new Date(),
        }
      })
    }
    console.log('[Seed] Successfully synced products into SourceProduct!')
  }
}

async function main() {
  await seedShopXoaiNon()
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
