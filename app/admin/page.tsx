import { prisma } from "@/lib/db"
import { getVisitorStats } from "@/lib/analytics"
import { AdminDashboardClient, DashboardOrder, DashboardProvider, DashboardVariantAlert } from "./AdminDashboardClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminDashboardPage() {
  const [orders, providers, totalSerials, availableSerials, lowStockVariants, visitorStats] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          select: {
            id: true,
            productName: true,
            variantName: true,
            priceCents: true,
            discountCents: true,
            providerCost: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.providerConnection.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        provider: true,
        balanceVnd: true,
        balanceUsdt: true,
        isEnabled: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
      },
    }),
    prisma.serial.count(),
    prisma.serial.count({ where: { status: "available" } }),
    prisma.variant.findMany({
      include: {
        product: { select: { name: true } },
        _count: {
          select: { serials: { where: { status: "available" } } },
        },
      },
      take: 20,
    }),
    getVisitorStats(),
  ])

  const serializedOrders: DashboardOrder[] = orders.map((o) => ({
    id: o.id,
    code: o.code,
    email: o.email,
    totalCents: o.totalCents,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((it) => ({
      id: it.id,
      productName: it.productName,
      variantName: it.variantName,
      priceCents: it.priceCents,
      discountCents: it.discountCents,
      providerCost: it.providerCost,
      quantity: it.quantity,
    })),
  }))

  const serializedProviders: DashboardProvider[] = providers.map((p) => ({
    id: p.id,
    name: p.name,
    provider: p.provider,
    balanceVnd: p.balanceVnd ?? 0,
    balanceUsdt: p.balanceUsdt ?? 0,
    isEnabled: p.isEnabled,
    lastSyncedAt: p.lastSyncedAt ? p.lastSyncedAt.toISOString() : null,
    lastSyncStatus: p.lastSyncStatus,
  }))

  const serializedVariants: DashboardVariantAlert[] = lowStockVariants
    .filter((v) => v._count.serials < 3)
    .map((v) => ({
      id: v.id,
      name: v.name,
      product: { name: v.product.name },
      availableStock: v._count.serials,
    }))

  return (
    <AdminDashboardClient
      initialOrders={serializedOrders}
      initialProviders={serializedProviders}
      totalSerials={totalSerials}
      availableSerials={availableSerials}
      lowStockVariants={serializedVariants}
      visitorStats={visitorStats}
    />
  )
}
