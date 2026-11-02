import { prisma } from "@/lib/db"
import { OrderManagerClient } from "./OrderManagerClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
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
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Quản Lý Đơn Hàng</h1>
        <p className="text-xs text-muted-foreground">Theo dõi và xử lý tất cả đơn hàng phát sinh trong hệ thống</p>
      </div>

      <OrderManagerClient
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
