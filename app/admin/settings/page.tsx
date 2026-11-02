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
    logoUrl: settings?.logoUrl || null,
    version: settings?.version || 1,
    updatedAt: settings?.updatedAt ? settings.updatedAt.toISOString() : null,
  }

  return (
    <div className="space-y-6">
      <SettingsClient initialData={initialData} />
    </div>
  )
}
