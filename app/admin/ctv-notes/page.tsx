import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { serializeCtvNote } from "@/lib/ctv-notes"
import { CtvNotesAdminClient } from "./CtvNotesAdminClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminCtvNotesPage() {
  await ensureDatabaseSchema()
  const rows = await prisma.ctvOrderNote.findMany({
    orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
  })

  return <CtvNotesAdminClient initialItems={rows.map(serializeCtvNote)} />
}
