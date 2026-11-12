import { prisma } from "@/lib/db"
import { OrderManagerClient } from "./OrderManagerClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminOrdersPage() {
  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            variant: { select: { name: true } },
            serials: { select: { content: true } },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.product.findMany({
      where: { visibility: "public" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            priceCents: true,
            _count: { select: { serials: { where: { status: "available" } } } },
          },
        },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Quản Lý Đơn Hàng</h1>
        <p className="text-xs text-muted-foreground">Theo dõi và xử lý tất cả đơn hàng phát sinh trong hệ thống</p>
      </div>

      <OrderManagerClient
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceCents: v.priceCents,
            availableSerials: v._count.serials,
          })),
        }))}
        orders={orders.map((o) => {
          const paidAmount = o.payments.reduce((sum, p) => sum + p.amount, 0)
          return {
            id: o.id,
            code: o.code,
            email: o.email,
            totalCents: o.totalCents,
            paidAmount,
            status: o.status,
            createdAt: o.createdAt.toISOString(),
            paymentGateway: o.payments[0]?.gateway || null,
            note: o.note,
            payments: o.payments.map((p) => ({
              id: p.id,
              amount: p.amount,
              gateway: p.gateway,
              transactionId: p.transactionId,
              createdAt: p.createdAt.toISOString(),
              content: p.content,
            })),
            items: o.items.map((i) => {
              const serialList = i.serials.map((s) => s.content)
              return {
                name: `${i.product.name} (${i.variant.name})`,
                quantity: i.quantity,
                priceCents: i.priceCents,
                serials: serialList,
                serial: serialList.length > 0 ? serialList.join("\n") : null,
              }
            }),
          }
        })}
      />
    </div>
  )
}
