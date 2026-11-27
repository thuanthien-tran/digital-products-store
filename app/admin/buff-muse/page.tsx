import { ensureDatabaseSchema } from "@/lib/db"
import { getBuffMuseAdminConfig } from "@/lib/buff-config"
import { BuffMuseAdminClient } from "./BuffMuseAdminClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminBuffMusePage() {
  await ensureDatabaseSchema()
  const config = await getBuffMuseAdminConfig()

  return <BuffMuseAdminClient initialConfig={config} />
}
