import { prisma } from "@/lib/db"
import { ProductManagerClient } from "./ProductManagerClient"

export default async function AdminProductsPage() {
  const groups = await prisma.productGroup.findMany({
    orderBy: { sortOrder: "asc" },
  })

  return (
    <div className="space-y-6">
      <ProductManagerClient
        groups={groups.map(g => ({ id: g.id, name: g.name }))}
      />
    </div>
  )
}

