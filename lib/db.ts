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
          const hasIsFeatured = tableInfo.some((col) => col.name === 'isFeatured')
          if (!hasIsFeatured) {
            console.log('[AutoMigration] Adding missing isFeatured column to Product table...')
            await prisma.$executeRawUnsafe(
              `ALTER TABLE "Product" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT 0;`
            )
            console.log('[AutoMigration] Successfully added isFeatured column to Product table')
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
        }
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

