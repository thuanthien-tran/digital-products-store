"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  KeyRound,
  AlertTriangle,
  ArrowUpRight,
  Users,
  Eye,
  Activity,
  Globe,
  RefreshCw,
  Wallet,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Award,
  ChevronRight,
  Percent,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

export interface DashboardOrderItem {
  id: string
  productName: string | null
  variantName: string | null
  priceCents: number
  discountCents: number
  providerCost: number | null
  quantity: number
}

export interface DashboardOrder {
  id: string
  code: string
  email: string
  totalCents: number
  subtotalCents: number
  discountCents: number
  status: string
  createdAt: string
  items: DashboardOrderItem[]
}

export interface DashboardProvider {
  id: string
  name: string
  provider: string
  balanceVnd: number
  balanceUsdt: number
  isEnabled: boolean
  lastSyncedAt: string | null
  lastSyncStatus: string | null
}

export interface DashboardVariantAlert {
  id: string
  name: string
  product: { name: string }
  availableStock: number
}

export interface DashboardVisitorStats {
  onlineCount: number
  todayVisits: number
  totalVisits: number
  showVisitorStats: boolean
}

interface AdminDashboardClientProps {
  initialOrders: DashboardOrder[]
  initialProviders: DashboardProvider[]
  totalSerials: number
  availableSerials: number
  lowStockVariants: DashboardVariantAlert[]
  visitorStats: DashboardVisitorStats
}

type TimeRange = "today" | "yesterday" | "7days" | "30days" | "this_month" | "last_month" | "all"

export function AdminDashboardClient({
  initialOrders,
  initialProviders,
  totalSerials,
  availableSerials,
  lowStockVariants,
  visitorStats,
}: AdminDashboardClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedRange, setSelectedRange] = useState<TimeRange>("all")
  const [providers, setProviders] = useState<DashboardProvider[]>(initialProviders)
  const [isRefreshingAllProviders, setIsRefreshingAllProviders] = useState(false)
  const [hoveredBucketIndex, setHoveredBucketIndex] = useState<number | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() =>
    new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  )

  // Refresh all providers balances simultaneously
  const handleRefreshAllProviders = async () => {
    if (isRefreshingAllProviders || providers.length === 0) return
    setIsRefreshingAllProviders(true)
    try {
      const results = await Promise.allSettled(
        providers.map(async (p) => {
          const res = await fetch(`/api/admin/providers/${p.id}/test`, { method: "POST" })
          if (!res.ok) throw new Error("Failed")
          const data = await res.json()
          return { id: p.id, balanceVnd: data.balanceVnd, balanceUsdt: data.balanceUsdt }
        })
      )

      setProviders((prev) =>
        prev.map((p) => {
          const found = results.find(
            (r): r is PromiseFulfilledResult<{ id: string; balanceVnd: number; balanceUsdt: number }> =>
              r.status === "fulfilled" && r.value.id === p.id
          )
          if (found) {
            return {
              ...p,
              balanceVnd: found.value.balanceVnd ?? p.balanceVnd,
              balanceUsdt: found.value.balanceUsdt ?? p.balanceUsdt,
              lastSyncedAt: new Date().toISOString(),
              lastSyncStatus: "success",
            }
          }
          return p
        })
      )
    } catch (err) {
      console.error("Failed to refresh all providers", err)
    } finally {
      setIsRefreshingAllProviders(false)
    }
  }

  // Quick refresh data (refreshes page stats + all provider wallets)
  const handleRefreshAll = () => {
    startTransition(() => {
      router.refresh()
      setLastRefreshedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    })
    void handleRefreshAllProviders()
  }

  // Date range calculation helpers
  const rangeBounds = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    switch (selectedRange) {
      case "today":
        return { start: startOfToday, end: endOfToday, label: "Hôm nay" }
      case "yesterday": {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999)
        return { start: startOfYesterday, end: endOfYesterday, label: "Hôm qua" }
      }
      case "7days": {
        const start7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return { start: start7Days, end: endOfToday, label: "7 ngày qua" }
      }
      case "30days": {
        const start30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return { start: start30Days, end: endOfToday, label: "30 ngày qua" }
      }
      case "this_month": {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        return { start: startOfMonth, end: endOfToday, label: `Tháng ${now.getMonth() + 1}` }
      }
      case "last_month": {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        const lastMonthNum = startOfLastMonth.getMonth() + 1
        return { start: startOfLastMonth, end: endOfLastMonth, label: `Tháng ${lastMonthNum}` }
      }
      case "all":
      default:
        return { start: new Date(0), end: new Date(8640000000000000), label: "Toàn thời gian" }
    }
  }, [selectedRange])

  // Filter orders by range
  const filteredOrders = useMemo(() => {
    return initialOrders.filter((order) => {
      const orderDate = new Date(order.createdAt)
      return orderDate >= rangeBounds.start && orderDate <= rangeBounds.end
    })
  }, [initialOrders, rangeBounds])

  // Compute metrics for the active range
  const metrics = useMemo(() => {
    const paidOrders = filteredOrders.filter(
      (o) => o.status === "paid" || o.status === "processing"
    )

    let totalRevenue = 0
    let totalDiscount = 0
    let totalCost = 0

    paidOrders.forEach((order) => {
      totalRevenue += order.totalCents
      totalDiscount += order.discountCents || 0

      order.items.forEach((item) => {
        const costPerUnit = item.providerCost ?? 0
        totalCost += costPerUnit * item.quantity
      })
    })

    const totalProfit = Math.max(0, totalRevenue - totalCost)
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    const totalOrderCount = filteredOrders.length
    const paidCount = paidOrders.length
    const successRate = totalOrderCount > 0 ? (paidCount / totalOrderCount) * 100 : 0
    const aov = paidCount > 0 ? Math.round(totalRevenue / paidCount) : 0

    return {
      revenue: totalRevenue,
      discount: totalDiscount,
      cost: totalCost,
      profit: totalProfit,
      margin,
      totalOrders: totalOrderCount,
      paidCount,
      successRate,
      aov,
      paidOrders,
    }
  }, [filteredOrders])

  // Group data into chart buckets
  const chartData = useMemo(() => {
    const now = new Date()
    interface Bucket {
      label: string
      fullDateLabel: string
      revenue: number
      profit: number
      cost: number
      ordersCount: number
    }

    const buckets: Bucket[] = []

    if (selectedRange === "today" || selectedRange === "yesterday") {
      // 12 buckets: every 2 hours (00h-02h, 02h-04h, ...)
      const baseDate = selectedRange === "today" ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000)
      for (let h = 0; h < 24; h += 2) {
        const bucketStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h, 0, 0)
        const bucketEnd = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h + 1, 59, 59, 999)
        const label = `${String(h).padStart(2, "0")}:00`

        let rev = 0
        let cst = 0
        let count = 0

        metrics.paidOrders.forEach((o) => {
          const d = new Date(o.createdAt)
          if (d >= bucketStart && d <= bucketEnd) {
            rev += o.totalCents
            count += 1
            o.items.forEach((item) => {
              cst += (item.providerCost ?? 0) * item.quantity
            })
          }
        })

        buckets.push({
          label,
          fullDateLabel: `${label} - ${String(h + 2).padStart(2, "0")}:00`,
          revenue: rev,
          profit: Math.max(0, rev - cst),
          cost: cst,
          ordersCount: count,
        })
      }
    } else if (selectedRange === "7days") {
      // 7 daily buckets
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
        const label = `${d.getDate()}/${d.getMonth() + 1}`

        let rev = 0
        let cst = 0
        let count = 0

        metrics.paidOrders.forEach((o) => {
          const od = new Date(o.createdAt)
          if (od >= dayStart && od <= dayEnd) {
            rev += o.totalCents
            count += 1
            o.items.forEach((item) => {
              cst += (item.providerCost ?? 0) * item.quantity
            })
          }
        })

        buckets.push({
          label,
          fullDateLabel: d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }),
          revenue: rev,
          profit: Math.max(0, rev - cst),
          cost: cst,
          ordersCount: count,
        })
      }
    } else if (selectedRange === "30days" || selectedRange === "this_month" || selectedRange === "last_month") {
      // Daily buckets or weekly
      const dayDiff = Math.max(
        1,
        Math.round((rangeBounds.end.getTime() - rangeBounds.start.getTime()) / (24 * 60 * 60 * 1000))
      )
      const step = dayDiff > 20 ? 2 : 1 // if many days, sample or step

      for (let d = new Date(rangeBounds.start); d <= rangeBounds.end; d.setDate(d.getDate() + step)) {
        const bStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
        const bEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (step - 1), 23, 59, 59, 999)
        const label = `${bStart.getDate()}/${bStart.getMonth() + 1}`

        let rev = 0
        let cst = 0
        let count = 0

        metrics.paidOrders.forEach((o) => {
          const od = new Date(o.createdAt)
          if (od >= bStart && od <= bEnd) {
            rev += o.totalCents
            count += 1
            o.items.forEach((item) => {
              cst += (item.providerCost ?? 0) * item.quantity
            })
          }
        })

        buckets.push({
          label,
          fullDateLabel: bStart.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
          revenue: rev,
          profit: Math.max(0, rev - cst),
          cost: cst,
          ordersCount: count,
        })
      }
    } else {
      // "all" - Group by recent months (up to 6 months)
      for (let i = 5; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mStart = new Date(m.getFullYear(), m.getMonth(), 1, 0, 0, 0)
        const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59, 999)
        const label = `T${m.getMonth() + 1}`

        let rev = 0
        let cst = 0
        let count = 0

        metrics.paidOrders.forEach((o) => {
          const od = new Date(o.createdAt)
          if (od >= mStart && od <= mEnd) {
            rev += o.totalCents
            count += 1
            o.items.forEach((item) => {
              cst += (item.providerCost ?? 0) * item.quantity
            })
          }
        })

        buckets.push({
          label,
          fullDateLabel: `Tháng ${m.getMonth() + 1}/${m.getFullYear()}`,
          revenue: rev,
          profit: Math.max(0, rev - cst),
          cost: cst,
          ordersCount: count,
        })
      }
    }

    const maxVal = Math.max(1000, ...buckets.map((b) => Math.max(b.revenue, b.profit)))
    return { buckets, maxVal }
  }, [selectedRange, rangeBounds, metrics.paidOrders])

  // Top Products by Profit
  const topProfitProducts = useMemo(() => {
    interface ProdStat {
      key: string
      name: string
      variantName: string | null
      quantity: number
      revenue: number
      cost: number
      profit: number
      margin: number
    }

    const map = new Map<string, ProdStat>()

    metrics.paidOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = `${item.productName || "Sản phẩm"}_${item.variantName || ""}`
        const existing = map.get(key) || {
          key,
          name: item.productName || "Sản phẩm",
          variantName: item.variantName || null,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          margin: 0,
        }

        const lineRev = item.priceCents * item.quantity - (item.discountCents || 0)
        const lineCost = (item.providerCost ?? 0) * item.quantity
        const lineProfit = Math.max(0, lineRev - lineCost)

        existing.quantity += item.quantity
        existing.revenue += lineRev
        existing.cost += lineCost
        existing.profit += lineProfit
        map.set(key, existing)
      })
    })

    const list = Array.from(map.values()).map((p) => ({
      ...p,
      margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0,
    }))

    list.sort((a, b) => b.profit - a.profit || b.revenue - a.revenue)
    return list.slice(0, 5)
  }, [metrics.paidOrders])

  const timeTabs: { key: TimeRange; label: string }[] = [
    { key: "today", label: "Hôm nay" },
    { key: "yesterday", label: "Hôm qua" },
    { key: "7days", label: "7 ngày qua" },
    { key: "this_month", label: "Tháng này" },
    { key: "last_month", label: "Tháng trước" },
    { key: "all", label: "Tất cả" },
  ]

  return (
    <div className="space-y-8">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Bảng Điều Khiển</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              Real-time
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi dòng tiền, doanh thu thực nhận, ví đại lý và hiệu suất kinh doanh
          </p>
        </div>

        {/* Filters & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Range Pills */}
          <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border/60 backdrop-blur">
            {timeTabs.map((tab) => {
              const isActive = selectedRange === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedRange(tab.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Refresh Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshAll}
              disabled={isPending}
              title="Làm mới số liệu tức thì"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 text-xs font-semibold text-foreground/90 transition-all active:scale-95 disabled:opacity-60 shadow-sm cursor-pointer"
            >
              <RefreshCw className={`size-3.5 text-primary ${isPending ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Financial KPIs (4 Cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: DOANH THU BÁN RA */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-3 backdrop-blur shadow-sm relative overflow-hidden group hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <span>Doanh Thu Bán Ra</span>
              <span className="text-[10px] text-muted-foreground/80 font-normal">({rangeBounds.label})</span>
            </span>
            <div className="p-2 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">
              {formatPrice(metrics.revenue)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.paidCount} đơn thành công
              {metrics.discount > 0 && ` • Giảm: -${formatPrice(metrics.discount)}`}
            </p>
          </div>
          <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-emerald-400 rounded-full w-full opacity-80" />
          </div>
        </div>

        {/* CARD 2: THỰC NHẬN (TIỀN LỜI) */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-3 backdrop-blur shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all ring-1 ring-emerald-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <span>Thực Nhận (Tiền Lời)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 font-bold">
                Lãi ròng
              </span>
            </span>
            <div className="p-2 rounded-xl border bg-emerald-500/20 border-emerald-500/30 text-emerald-300">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-400 tracking-tight tabular-nums">
              {formatPrice(metrics.profit)}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <span>Vốn đại lý: {formatPrice(metrics.cost)}</span>
              <span>•</span>
              <span className="font-semibold text-emerald-400">Biên lãi: {metrics.margin.toFixed(1)}%</span>
            </div>
          </div>
          <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, metrics.margin))}%` }}
            />
          </div>
        </div>

        {/* CARD 3: TỔNG ĐƠN HÀNG */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-3 backdrop-blur shadow-sm relative overflow-hidden group hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Đơn Hàng & Chốt Đơn</span>
            <div className="p-2 rounded-xl border bg-primary/10 border-primary/20 text-primary">
              <ShoppingCart className="size-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">
              {metrics.totalOrders} <span className="text-sm font-semibold text-muted-foreground">đơn</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tỷ lệ thanh toán:{" "}
              <span className="text-foreground font-semibold">{metrics.successRate.toFixed(1)}%</span>
              {metrics.paidCount > 0 && ` • TB: ${formatPrice(metrics.aov)}`}
            </p>
          </div>
          <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.successRate)}%` }}
            />
          </div>
        </div>

        {/* CARD 4: TỒN KHO & CẢNH BÁO */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-3 backdrop-blur shadow-sm relative overflow-hidden group hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Tồn Kho & Cảnh Báo</span>
            <div className="p-2 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-400">
              <KeyRound className="size-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">
              {availableSerials} <span className="text-sm font-semibold text-muted-foreground">serials</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tổng {totalSerials} serials •{" "}
              <span className={lowStockVariants.length > 0 ? "text-amber-400 font-semibold" : ""}>
                {lowStockVariants.length} gói sắp hết
              </span>
            </p>
          </div>
          <div className="h-1 w-full bg-secondary/50 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                lowStockVariants.length > 0 ? "bg-amber-400" : "bg-blue-400"
              }`}
              style={{
                width: `${totalSerials > 0 ? Math.round((availableSerials / totalSerials) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* PROVIDER WALLETS WIDGET (Ví tiền từng đại lý / kho nguồn) */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Wallet className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Ví &amp; Số Dư Kho Đại Lý</span>
                <span className="text-[11px] font-normal text-muted-foreground">({providers.length} kết nối)</span>
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Hạn mức số dư tài khoản đại lý API để tự động xuất và bảo đảm đơn hàng không gián đoạn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefreshAllProviders}
              disabled={isRefreshingAllProviders}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-background/60 hover:bg-background hover:border-primary/40 text-xs font-semibold text-foreground transition-all active:scale-95 disabled:opacity-60 shadow-sm cursor-pointer"
              title="Kiểm tra và cập nhật số dư cho tất cả các đại lý cùng lúc"
            >
              <RefreshCw className={`size-3.5 text-primary ${isRefreshingAllProviders ? "animate-spin" : ""}`} />
              <span>{isRefreshingAllProviders ? "Đang làm mới tất cả ví..." : "Làm mới tất cả ví"}</span>
            </button>

            <Link
              href="/admin/providers"
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 group"
            >
              <span>Quản lý đại lý &amp; nạp ví</span>
              <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Provider Cards Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {providers.map((p) => {
            const isLow = p.balanceVnd > 0 && p.balanceVnd < 50000 && p.balanceUsdt < 2
            const isCritical = p.balanceVnd <= 0 && p.balanceUsdt <= 0
            const isHealthy = !isLow && !isCritical

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                  isHealthy
                    ? "bg-background/50 border-border/60 hover:border-emerald-500/30"
                    : isLow
                    ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50"
                    : "bg-red-500/5 border-red-500/30 hover:border-red-500/50"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-xs text-foreground truncate" title={p.name}>
                      {p.name}
                    </span>
                    {isRefreshingAllProviders && (
                      <RefreshCw className="size-3 animate-spin text-primary shrink-0" />
                    )}
                  </div>

                  {/* Balance Display */}
                  <div className="space-y-0.5">
                    <p
                      className={`text-lg font-black tracking-tight tabular-nums ${
                        isHealthy ? "text-emerald-400" : isLow ? "text-amber-400" : "text-red-400"
                      }`}
                    >
                      {formatPrice(p.balanceVnd)}
                    </p>
                    {p.balanceUsdt > 0 && (
                      <p className="text-[11px] font-mono text-muted-foreground">
                        ≈ {p.balanceUsdt.toFixed(2)} USDT
                      </p>
                    )}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-[10.5px]">
                  <span className="uppercase text-[9.5px] font-bold text-muted-foreground font-mono">
                    {p.provider}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      isHealthy
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : isLow
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {isHealthy ? "Số dư an toàn" : isLow ? "Sắp hết tiền" : "Hết số dư"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* TREND CHART (Doanh thu & Tiền lời theo ngày / tuần / tháng) */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-400" />
              <span>Biểu Đồ Xu Hướng Doanh Thu &amp; Tiền Lời</span>
              <span className="text-xs text-muted-foreground font-normal">({rangeBounds.label})</span>
            </h2>
            <p className="text-[11px] text-muted-foreground">
              So sánh tương quan giữa Doanh thu bán ra (cột xám) và Tiền lời thực nhận (cột xanh)
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-primary/70" />
              <span className="text-muted-foreground">Doanh thu</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-emerald-400" />
              <span className="text-emerald-400 font-semibold">Thực nhận (Lời)</span>
            </div>
          </div>
        </div>

        {/* Visual Chart Bars Container */}
        <div className="pt-6 pb-2">
          {chartData.buckets.length === 0 || chartData.maxVal <= 1000 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Chưa có dữ liệu đơn hàng trong khoảng thời gian {rangeBounds.label.toLowerCase()}.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Bars Row */}
              <div className="h-48 w-full flex items-end gap-1.5 sm:gap-3 px-2 border-b border-border/60">
                {chartData.buckets.map((b, idx) => {
                  const revHeight = Math.max(4, Math.round((b.revenue / chartData.maxVal) * 100))
                  const profitHeight = Math.max(2, Math.round((b.profit / chartData.maxVal) * 100))
                  const isHovered = hoveredBucketIndex === idx

                  return (
                    <div
                      key={idx}
                      className="flex-1 h-full flex flex-col justify-end items-center relative group cursor-pointer"
                      onMouseEnter={() => setHoveredBucketIndex(idx)}
                      onMouseLeave={() => setHoveredBucketIndex(null)}
                    >
                      {/* Tooltip on hover */}
                      {isHovered && (
                        <div className="absolute bottom-full mb-2 z-30 pointer-events-none whitespace-nowrap rounded-xl border border-border bg-popover/95 p-2.5 text-xs shadow-xl backdrop-blur">
                          <p className="font-bold text-foreground border-b border-border/50 pb-1 mb-1">
                            {b.fullDateLabel}
                          </p>
                          <div className="space-y-0.5 text-[11px]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Doanh thu:</span>
                              <span className="font-bold text-foreground">{formatPrice(b.revenue)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Vốn đại lý:</span>
                              <span className="text-foreground">{formatPrice(b.cost)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-emerald-400 font-bold">
                              <span>Thực nhận (Lời):</span>
                              <span>+{formatPrice(b.profit)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-muted-foreground text-[10px] pt-1 border-t border-border/40">
                              <span>Số đơn:</span>
                              <span>{b.ordersCount} đơn</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Bar Pair */}
                      <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 max-w-[36px]">
                        {/* Revenue Bar */}
                        <div
                          className={`w-1/2 rounded-t-sm transition-all duration-300 ${
                            isHovered ? "bg-primary" : "bg-primary/50 group-hover:bg-primary/80"
                          }`}
                          style={{ height: `${revHeight}%` }}
                        />
                        {/* Profit Bar */}
                        <div
                          className={`w-1/2 rounded-t-sm transition-all duration-300 ${
                            isHovered ? "bg-emerald-400" : "bg-emerald-500/80 group-hover:bg-emerald-400"
                          }`}
                          style={{ height: `${profitHeight}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="flex items-center gap-1.5 sm:gap-3 px-2 text-[10px] text-muted-foreground">
                {chartData.buckets.map((b, idx) => (
                  <div key={idx} className="flex-1 text-center truncate font-mono">
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOP PROFIT PRODUCTS & RECENT ORDERS WITH PROFIT BREAKDOWN */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* TOP PROFIT GENERATORS */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Award className="size-4 text-emerald-400" />
              <span>Top Sản Phẩm Sinh Lời Cao Nhất</span>
            </h2>
            <span className="text-[11px] text-muted-foreground">Theo {rangeBounds.label.toLowerCase()}</span>
          </div>

          <div className="space-y-2">
            {topProfitProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Chưa có đơn hàng phát sinh lợi nhuận trong khoảng này.
              </p>
            ) : (
              topProfitProducts.map((p, idx) => (
                <div
                  key={p.key}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 text-xs hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`size-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                        idx === 0
                          ? "bg-amber-400/20 text-amber-400 border border-amber-400/40"
                          : idx === 1
                          ? "bg-slate-300/20 text-slate-300 border border-slate-300/40"
                          : idx === 2
                          ? "bg-amber-600/20 text-amber-500 border border-amber-600/40"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <p className="font-bold text-foreground truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {p.variantName || "Mặc định"} • Đã bán {p.quantity} lượt
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <p className="font-black text-emerald-400 tabular-nums">+{formatPrice(p.profit)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Doanh thu: {formatPrice(p.revenue)} (Lãi {p.margin.toFixed(0)}%)
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECENT ORDERS WITH COST & PROFIT BREAKDOWN */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="size-4 text-primary" />
              <span>Đơn Hàng Gần Đây &amp; Tiền Lời</span>
            </h2>
            <Link
              href="/admin/orders"
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5"
            >
              Xem tất cả <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {initialOrders.slice(0, 6).map((order) => {
              const isPaid = order.status === "paid" || order.status === "processing"
              const isCancelled = order.status === "cancelled" || order.status === "refunded"

              let orderCost = 0
              order.items.forEach((it) => {
                orderCost += (it.providerCost ?? 0) * it.quantity
              })
              const orderProfit = isPaid ? Math.max(0, order.totalCents - orderCost) : 0

              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 text-xs hover:border-border transition-all"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{order.code}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isPaid
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : isCancelled
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {order.status === "paid"
                          ? "Đã thanh toán"
                          : order.status === "processing"
                          ? "Đang xử lý"
                          : isCancelled
                          ? "Đã hủy"
                          : "Chờ thanh toán"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{order.email}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground tabular-nums">{formatPrice(order.totalCents)}</p>
                    {isPaid ? (
                      <p className="text-[10px] text-emerald-400 font-semibold tabular-nums">
                        Lời: +{formatPrice(orderProfit)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* TRAFFIC & LOW STOCK ALERTS (GIỮ NGUYÊN TÍNH NĂNG CŨ) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visitor Stats */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
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
            <Link
              href="/admin/settings"
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5"
            >
              Cài đặt hiển thị <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/50 p-3.5">
              <p className="text-[11px] font-semibold text-muted-foreground">Đang truy cập</p>
              <p className="text-xl font-black text-emerald-400 tabular-nums mt-0.5">
                {visitorStats.onlineCount.toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-3.5">
              <p className="text-[11px] font-semibold text-muted-foreground">Lượt hôm nay</p>
              <p className="text-xl font-black text-foreground tabular-nums mt-0.5">
                {visitorStats.todayVisits.toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-3.5">
              <p className="text-[11px] font-semibold text-muted-foreground">Tổng lượt</p>
              <p className="text-xl font-black text-foreground tabular-nums mt-0.5">
                {visitorStats.totalVisits.toLocaleString("vi-VN")}
              </p>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="rounded-2xl border border-border/80 bg-card/60 p-5 space-y-4 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400" />
              <span>Gói Sắp Hết Hàng Trong Kho</span>
            </h2>
            <Link
              href="/admin/serials"
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5"
            >
              Nạp kho <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {lowStockVariants.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Tất cả các gói đều đang có đủ hàng tồn kho.
              </p>
            ) : (
              lowStockVariants.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50 text-xs"
                >
                  <div className="truncate min-w-0 pr-2">
                    <p className="font-bold text-foreground truncate">{v.product.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{v.name}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold shrink-0 ${
                      v.availableStock === 0
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    Còn {v.availableStock}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
