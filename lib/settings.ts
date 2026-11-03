import { unstable_cache, revalidateTag, revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"

export interface SiteSettingsData {
  siteName: string
  siteTitle: string | null
  logoUrl: string | null
  initials: string
  updatedAt?: Date | string
  version?: number
}

/**
 * Derives a clean 2-character uppercase monogram/initials badge from a website name.
 * Examples:
 * - "ACCGIARE" -> "AG"
 * - "CapyGo" -> "CG"
 * - "Digital Product" -> "DP"
 * - "Cửa Hàng Số" -> "CH"
 */
export function getInitials(name: string): string {
  const clean = (name || "").trim()
  if (!clean) return "AG"

  if (clean.toUpperCase() === "ACCGIARE") return "AG"

  // Multiple words
  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    const first = Array.from(words[0])[0] || ""
    const second = Array.from(words[1])[0] || ""
    return (first + second).toUpperCase()
  }

  // Single word: check for CamelCase boundaries e.g. CapyGo -> CG
  const single = words[0]
  const upperMatches = single.match(/[A-ZÀ-Ỹ]/g)
  if (upperMatches && upperMatches.length >= 2) {
    return (upperMatches[0] + upperMatches[1]).toUpperCase()
  }

  // Single word fallback: take first 2 chars
  return Array.from(single).slice(0, 2).join("").toUpperCase()
}

async function fetchSettingsFromDb(): Promise<SiteSettingsData> {
  try {
    const row = await prisma.siteSettings.findUnique({
      where: { shopId: "main" },
    })

    const fallbackName = process.env.NEXT_PUBLIC_STORE_NAME || "ACCGIARE"
    const siteName = row?.siteName?.trim() || fallbackName
    const siteTitle = (row as any)?.siteTitle?.trim() || null
    const logoUrl = row?.logoUrl?.trim() || null

    return {
      siteName,
      siteTitle,
      logoUrl,
      initials: getInitials(siteName),
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : undefined,
      version: row?.version || 1,
    }
  } catch (err) {
    console.error("[getSiteSettings] Failed to fetch settings, using fallback:", err)
    const fallbackName = process.env.NEXT_PUBLIC_STORE_NAME || "ACCGIARE"
    return {
      siteName: fallbackName,
      siteTitle: null,
      logoUrl: null,
      initials: getInitials(fallbackName),
      version: 1,
    }
  }
}

const cachedGetSiteSettings = unstable_cache(
  fetchSettingsFromDb,
  ["site-settings-cache"],
  { tags: ["site-settings"], revalidate: 3600 }
)

export async function getSiteSettings(): Promise<SiteSettingsData> {
  try {
    return await cachedGetSiteSettings()
  } catch (err) {
    // If run outside Next.js server context (e.g. tsx scripts) or cache error, query DB directly
    return await fetchSettingsFromDb()
  }
}

export async function updateSiteSettings(data: {
  siteName: string
  siteTitle?: string | null
  logoUrl?: string | null
  expectedVersion?: number
}): Promise<SiteSettingsData> {
  const cleanName = data.siteName.trim()
  const cleanTitle = data.siteTitle !== undefined ? (data.siteTitle ? data.siteTitle.trim() : null) : undefined
  const cleanLogo = data.logoUrl !== undefined ? (data.logoUrl ? data.logoUrl.trim() : null) : undefined

  // Upsert settings in database
  const current = await prisma.siteSettings.findUnique({
    where: { shopId: "main" },
  })

  let updated: any
  if (current) {
    if (data.expectedVersion !== undefined && data.expectedVersion !== current.version) {
      throw new Error("VERSION_CONFLICT: Cấu hình đã bị thay đổi bởi người khác. Vui lòng tải lại trang.")
    }

    updated = await prisma.siteSettings.update({
      where: { shopId: "main" },
      data: {
        siteName: cleanName,
        ...(cleanTitle !== undefined ? { siteTitle: cleanTitle } : {}),
        ...(cleanLogo !== undefined ? { logoUrl: cleanLogo } : {}),
        version: { increment: 1 },
      },
    })
  } else {
    updated = await prisma.siteSettings.create({
      data: {
        shopId: "main",
        siteName: cleanName,
        siteTitle: cleanTitle ?? null,
        logoUrl: cleanLogo ?? null,
        version: 1,
      },
    })
  }

  // Invalidate Next.js cache tag & purge layout routes
  try {
    // Next.js 16+ accepts "max" as second argument for revalidateTag
    // @ts-ignore
    revalidateTag("site-settings", "max")
    revalidatePath("/", "layout")
    revalidatePath("/")
  } catch (e) {
    // ignore outside request context
  }

  return {
    siteName: updated.siteName,
    siteTitle: updated.siteTitle || null,
    logoUrl: updated.logoUrl,
    initials: getInitials(updated.siteName),
    updatedAt: updated.updatedAt.toISOString(),
    version: updated.version,
  }
}
