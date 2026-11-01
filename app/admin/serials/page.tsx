import { prisma } from "@/lib/db"
import { SerialManagerClient } from "./SerialManagerClient"


export default async function SerialsAdminPage() {
  const [variants, serials] = await Promise.all([
    prisma.variant.findMany({
      include: {
        product: { select: { name: true } },
        _count: { select: { serials: { where: { status: "available" } } } },
      },
      orderBy: { productId: "asc" },
    }),
    prisma.serial.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        variant: {
          include: { product: { select: { name: true } } },
        },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Quản Lý Kho Serials / Key</h1>
        <p className="text-xs text-muted-foreground">Nạp hàng loạt tài khoản dạng TK|MK, link bản quyền hoặc serials vào kho</p>
      </div>

      <SerialManagerClient
        variants={variants.map(v => ({
          id: v.id,
          name: `${v.product.name} - ${v.name} (Còn: ${v._count.serials})`,
        }))}
        recentSerials={serials.map(s => ({
          id: s.id,
          content: s.content,
          status: s.status,
          productVariant: `${s.variant.product.name} (${s.variant.name})`,
          createdAt: s.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
