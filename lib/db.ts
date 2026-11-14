import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  schemaEnsured: boolean | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

let migrationPromise: Promise<void> | null = null

export async function ensureDatabaseSchema(): Promise<void> {
  if (globalForPrisma.schemaEnsured) return
  if (!migrationPromise) {
    migrationPromise = (async () => {
      try {
        const tableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info("Product");`
        )
        if (Array.isArray(tableInfo) && tableInfo.length > 0) {
          const cols = new Set(tableInfo.map((col) => col.name))
          if (!cols.has('isFeatured')) {
            console.log('[AutoMigration] Adding missing isFeatured column to Product table...')
            await prisma.$executeRawUnsafe(
              `ALTER TABLE "Product" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT 0;`
            )
          }
          if (!cols.has('fulfillmentType')) {
            await prisma.$executeRawUnsafe(
              `ALTER TABLE "Product" ADD COLUMN "fulfillmentType" TEXT NOT NULL DEFAULT 'serials';`
            )
          }
          if (!cols.has('quantityMode')) {
            await prisma.$executeRawUnsafe(
              `ALTER TABLE "Product" ADD COLUMN "quantityMode" TEXT NOT NULL DEFAULT 'flexible';`
            )
          }
          if (!cols.has('requiresInviteCode')) {
            await prisma.$executeRawUnsafe(
              `ALTER TABLE "Product" ADD COLUMN "requiresInviteCode" BOOLEAN NOT NULL DEFAULT 0;`
            )
          }
          // Clean up orphaned isFeatured flags on non-published or hidden/draft products
          try {
            await prisma.$executeRawUnsafe(
              `UPDATE "Product" SET "isFeatured" = 0 WHERE "isFeatured" = 1 AND ("editorialStatus" != 'published' OR "visibility" != 'public');`
            )
          } catch {}
        }

        // Check Variant table columns
        const variantTableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info("Variant");`
        )
        if (Array.isArray(variantTableInfo) && variantTableInfo.length > 0) {
          const cols = new Set(variantTableInfo.map((c) => c.name))
          if (!cols.has('tokenAmountB')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Variant" ADD COLUMN "tokenAmountB" INTEGER;`)
          }
          if (!cols.has('isActive')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Variant" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT 1;`)
          }
        }

        // Check SiteSettings table
        const settingsTableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info("SiteSettings");`
        )
        if (Array.isArray(settingsTableInfo) && settingsTableInfo.length > 0) {
          const cols = new Set(settingsTableInfo.map((c) => c.name))
          if (!cols.has('heroTitle')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "SiteSettings" ADD COLUMN "heroTitle" TEXT;`)
          }
          if (!cols.has('heroSubtitle')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "SiteSettings" ADD COLUMN "heroSubtitle" TEXT;`)
          }
          if (!cols.has('heroTitleColor')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "SiteSettings" ADD COLUMN "heroTitleColor" TEXT DEFAULT '#FAF4ED';`)
          }
          if (!cols.has('heroHighlightColor')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "SiteSettings" ADD COLUMN "heroHighlightColor" TEXT DEFAULT '#E6A66F';`)
          }
          if (!cols.has('heroCtaText')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "SiteSettings" ADD COLUMN "heroCtaText" TEXT DEFAULT 'Khám phá các gói';`)
          }
          if (!cols.has('ctvPin')) {
            try { await prisma.$executeRawUnsafe(`ALTER TABLE "SiteSettings" ADD COLUMN "ctvPin" TEXT DEFAULT '888888';`) } catch {}
          }
          if (!cols.has('ctvAccessEnabled')) {
            try { await prisma.$executeRawUnsafe(`ALTER TABLE "SiteSettings" ADD COLUMN "ctvAccessEnabled" BOOLEAN NOT NULL DEFAULT 1;`) } catch {}
          }
          if (!cols.has('priceListConfig')) {
            try { await prisma.$executeRawUnsafe(`ALTER TABLE "SiteSettings" ADD COLUMN "priceListConfig" TEXT;`) } catch {}
          }
        }

        // Check Order table columns & backfill
        const orderTableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info("Order");`
        )
        if (Array.isArray(orderTableInfo) && orderTableInfo.length > 0) {
          const cols = new Set(orderTableInfo.map((c) => c.name))
          if (!cols.has('subtotalCents')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "subtotalCents" INTEGER NOT NULL DEFAULT 0;`)
            // Backfill existing orders: subtotalCents = totalCents
            await prisma.$executeRawUnsafe(`UPDATE "Order" SET "subtotalCents" = "totalCents" WHERE "subtotalCents" = 0;`)
          }
          if (!cols.has('discountCents')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;`)
          }
          if (!cols.has('couponId')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "couponId" TEXT;`)
          }
          if (!cols.has('couponCode')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT;`)
          }
          if (!cols.has('couponSnapshot')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "couponSnapshot" TEXT;`)
          }
          if (!cols.has('idempotencyKey')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;`)
          }
          if (!cols.has('inviteCode')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN "inviteCode" TEXT;`)
          }
        }

        // Check OrderItem table columns
        const orderItemTableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
          `PRAGMA table_info("OrderItem");`
        )
        if (Array.isArray(orderItemTableInfo) && orderItemTableInfo.length > 0) {
          const cols = new Set(orderItemTableInfo.map((c) => c.name))
          if (!cols.has('discountCents')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;`)
          }
          if (!cols.has('tokenAmountB')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN "tokenAmountB" INTEGER;`)
          }
          if (!cols.has('inviteCode')) {
            await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN "inviteCode" TEXT;`)
          }
        }

        // Check BuffFulfillment table
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "BuffFulfillment" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "orderItemId" TEXT NOT NULL UNIQUE,
            "orderId" TEXT NOT NULL,
            "inviteCode" TEXT NOT NULL,
            "tokenAmountB" INTEGER NOT NULL,
            "completedB" INTEGER,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "usedMethod" TEXT,
            "providerOrderCode" TEXT,
            "partnerRef" TEXT,
            "lastCheckedAt" DATETIME,
            "errorMessage" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BuffFulfillment_status_idx" ON "BuffFulfillment"("status");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BuffFulfillment_orderId_idx" ON "BuffFulfillment"("orderId");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BuffFulfillment_providerOrderCode_idx" ON "BuffFulfillment"("providerOrderCode");`)

        // Update Muse AI Buff products & variants quantity limit to max 5
        try {
          await prisma.$executeRawUnsafe(`
            UPDATE "Product" SET "quantityMode" = 'flexible' WHERE "fulfillmentType" = 'buff' OR "name" LIKE '%Buff Token%';
          `)
          await prisma.$executeRawUnsafe(`
            UPDATE "Variant" SET "maxQuantity" = 5 WHERE "tokenAmountB" IS NOT NULL OR "name" LIKE '%Buff Token%';
          `)
          // Consolidate Muse AI Buff 5B into Muse Buff product
          await prisma.$executeRawUnsafe(`
            UPDATE "Product" 
            SET "name" = 'MUSE AI - Buff Token Chính Chủ (1B - 5B - 10B - 20B - 30B)' 
            WHERE "slug" = 'muse-ai---buff-token-chinh-chu-10b-20b-30b' OR "name" LIKE 'MUSE AI - Buff Token Chính Chủ%';
          `)
          // Delete any standalone Muse 5B product variants & product
          await prisma.$executeRawUnsafe(`
            DELETE FROM "Variant" WHERE "productId" IN (
              SELECT "id" FROM "Product" WHERE "slug" = 'muse---buff-5-ty' OR "name" = 'MUSE - BUFF 5 TỶ' OR "name" = 'MUSE Buff 5 tỷ'
            );
          `)
          await prisma.$executeRawUnsafe(`
            DELETE FROM "Product" WHERE "slug" = 'muse---buff-5-ty' OR "name" = 'MUSE - BUFF 5 TỶ' OR "name" = 'MUSE Buff 5 tỷ';
          `)
        } catch {}

        globalForPrisma.schemaEnsured = true
      } catch (err) {
        console.error('[AutoMigration] Failed to verify/migrate schema:', err)
      } finally {
        migrationPromise = null
      }
    })()
  }
  return migrationPromise
}

// Auto-run check on server process startup
if (typeof window === 'undefined') {
  ensureDatabaseSchema().catch(() => {})
}

