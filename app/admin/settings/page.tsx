import { prisma } from "@/lib/db"
import { SettingsClient } from "./SettingsClient"

export const dynamic = "force-dynamic"

export default async function AdminSettingsPage() {
  const settings = await prisma.siteSettings.findUnique({
    where: { shopId: "main" },
  })

  const fallbackName = process.env.NEXT_PUBLIC_STORE_NAME || "ACCGIARE"

  const initialData = {
    siteName: settings?.siteName || fallbackName,
    siteTitle: (settings as any)?.siteTitle || null,
    logoUrl: settings?.logoUrl || null,
    heroTitle: (settings as any)?.heroTitle || null,
    heroSubtitle: (settings as any)?.heroSubtitle || null,
    heroTitleColor: (settings as any)?.heroTitleColor || "#FAF4ED",
    heroHighlightColor: (settings as any)?.heroHighlightColor || "#E6A66F",
    version: settings?.version || 1,
    updatedAt: settings?.updatedAt ? settings.updatedAt.toISOString() : null,
  }

  return (
    <div className="space-y-6">
      <SettingsClient initialData={initialData} />
    </div>
  )
}
