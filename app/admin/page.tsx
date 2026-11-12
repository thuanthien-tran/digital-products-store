import { prisma } from "@/lib/db"
import { formatPrice } from "@/lib/utils"
import { getVisitorStats } from "@/lib/analytics"
import { DollarSign, ShoppingCart, KeyRound, AlertTriangle, ArrowUpRight, Users, Eye, Activity } from "lucide-react"
import Link from "next/link"
import { AdminRefreshButton } from "./AdminRefreshButton"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminDashboardPage() {
  const [totalOrders, paidOrders, totalSerials, availableSerials, recentOrders, lowStockVariants, visitorStats] = await Promise.all([
    prisma.order.count(),
    prisma.order.findMany({
      where: {
        status: { in: ["paid", "processing"] },
      },
      select: { totalCents: true, discountCents: true, status: true },
    }),
    prisma.serial.count(),
    prisma.serial.count({ where: { status: "available" } }),
    prisma.order.findMany({
      take: 6,
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
    getVisitorStats(),
  ])

  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.totalCents, 0)
  const totalDiscount = paidOrders.reduce((sum, order) => sum + (order.discountCents || 0), 0)
  const alertVariants = lowStockVariants.filter(v => v._count.serials < 3)

  const stats = [
    {
      title: "Tổng Doanh Thu",
      value: formatPrice(totalRevenue),
      desc: totalDiscount > 0
        ? `${paidOrders.length} đơn hoàn tất (Ưu đãi: -${formatPrice(totalDiscount)})`
        : `${paidOrders.length} đơn hoàn tất / đã thanh toán`,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Bảng Điều Khiển</h1>
          <p className="text-xs text-muted-foreground">Theo dõi dòng tiền, đơn hàng và tình trạng tồn kho tự động (Dữ liệu thời gian thực)</p>
        </div>
        <AdminRefreshButton />
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

      {/* Traffic & Online Stats */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-foreground">Lưu Lượng Truy Cập Website</h2>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                visitorStats.showVisitorStats
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              {visitorStats.showVisitorStats ? "Đang hiện ở Footer" : "Đang ẩn ở Footer"}
            </span>
          </div>
          <Link href="/admin/settings" className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5">
            Cài đặt hiển thị <ArrowUpRight className="size-3" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background/50 p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Đang truy cập (5 phút qua)</p>
              <p className="text-xl font-black text-emerald-400 tabular-nums mt-0.5">
                {visitorStats.onlineCount.toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Users className="size-4" />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Lượt truy cập hôm nay</p>
              <p className="text-xl font-black text-foreground tabular-nums mt-0.5">
                {visitorStats.todayVisits.toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Activity className="size-4" />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">Tổng lượt truy cập</p>
              <p className="text-xl font-black text-foreground tabular-nums mt-0.5">
                {visitorStats.totalVisits.toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Eye className="size-4" />
            </div>
          </div>
        </div>
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
              recentOrders.map((order) => {
                const isPaid = order.status === "paid" || order.status === "processing"
                const isCancelled = order.status === "cancelled" || order.status === "refunded"
                
                return (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{order.code}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isPaid
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : isCancelled
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {order.status === "paid"
                            ? "Đã thanh toán"
                            : order.status === "processing"
                            ? "Đang xử lý"
                            : isCancelled
                            ? "Đã hủy"
                            : "Chờ thanh toán"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{order.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary tabular-nums">{formatPrice(order.totalCents)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
