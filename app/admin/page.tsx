import { prisma } from "@/lib/db"
import { formatPrice } from "@/lib/utils"
import { DollarSign, ShoppingCart, KeyRound, AlertTriangle, ArrowUpRight } from "lucide-react"
import Link from "next/link"


export default async function AdminDashboardPage() {
  const [totalOrders, paidOrders, totalSerials, availableSerials, recentOrders, lowStockVariants] = await Promise.all([
    prisma.order.count(),
    prisma.order.findMany({
      where: { status: "paid" },
      select: { totalCents: true },
    }),
    prisma.serial.count(),
    prisma.serial.count({ where: { status: "available" } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
      },
    }),
    prisma.variant.findMany({
      include: {
        product: { select: { name: true } },
        _count: {
          select: { serials: { where: { status: "available" } } },
        },
      },
      take: 10,
    }),
  ])

  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.totalCents, 0)
  const alertVariants = lowStockVariants.filter(v => v._count.serials < 3)

  const stats = [
    {
      title: "Tổng Doanh Thu",
      value: formatPrice(totalRevenue),
      desc: `${paidOrders.length} đơn hoàn tất`,
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "Tổng Đơn Hàng",
      value: totalOrders.toString(),
      desc: "Tất cả trạng thái",
      icon: ShoppingCart,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
    },
    {
      title: "Tồn Kho Khả Dụng",
      value: availableSerials.toString(),
      desc: `Tổng ${totalSerials} serials`,
      icon: KeyRound,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "Cảnh Báo Hết Hàng",
      value: alertVariants.length.toString(),
      desc: "Gói cần nạp thêm serials",
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Bảng Điều Khiển</h1>
        <p className="text-xs text-muted-foreground">Theo dõi dòng tiền, đơn hàng và tình trạng tồn kho tự động</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-3 backdrop-blur shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{s.title}</span>
                <div className={`p-2 rounded-xl border ${s.bg} ${s.color}`}>
                  <Icon className="size-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Low stock alerts & Recent orders */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alert */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400" />
              <span>Gói Sắp Hết Hàng</span>
            </h2>
            <Link href="/admin/serials" className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5">
              Nạp kho <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {alertVariants.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Tất cả các gói đều đang có đủ hàng tồn kho.</p>
            ) : (
              alertVariants.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 text-xs">
                  <div>
                    <p className="font-bold text-foreground">{v.product.name}</p>
                    <p className="text-[11px] text-muted-foreground">{v.name}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full font-bold ${
                    v._count.serials === 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    Còn {v._count.serials}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="size-4 text-primary" />
              <span>Đơn Hàng Gần Đây</span>
            </h2>
            <Link href="/admin/orders" className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5">
              Xem tất cả <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {recentOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Chưa có đơn hàng nào.</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{order.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        order.status === "paid" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {order.status === "paid" ? "Đã thanh toán" : "Chờ thanh toán"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{order.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatPrice(order.totalCents)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
