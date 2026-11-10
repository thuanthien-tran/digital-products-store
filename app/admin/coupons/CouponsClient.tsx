"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { formatPrice } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Ticket,
  Plus,
  Search,
  RefreshCw,
  Copy,
  Check,
  Edit,
  Archive,
  PauseCircle,
  PlayCircle,
  History,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
  Calendar,
  Layers,
  Percent,
  DollarSign,
  HelpCircle,
  FileText,
  User,
  ShieldAlert,
} from "lucide-react"

interface CatalogVariant {
  id: string
  name: string
  priceCents: number
  providerPrice?: number | null
}

interface CatalogProduct {
  id: string
  name: string
  variants: CatalogVariant[]
}

interface CouponRedemption {
  id: string
  status: string
  discountCents: number
  email: string
  reservedAt: string
  redeemedAt: string | null
  releasedAt: string | null
  orderCode: string
  orderId: string
  orderStatus: string
}

interface CouponItem {
  id: string
  code: string
  name: string
  description: string | null
  discountType: "fixed" | "percentage"
  discountValue: number
  maxDiscountCents: number | null
  minOrderCents: number
  scope: "all" | "products" | "variants"
  status: "draft" | "active" | "paused" | "archived"
  usageLimit: number | null
  perEmailLimit: number | null
  startsAt: string | null
  endsAt: string | null
  version: number
  createdAt: string
  updatedAt: string
  stats: {
    redeemedCount: number
    reservedCount: number
    totalRedemptions: number
    remainingQuota: number | null
  }
  products: Array<{ id: string; name: string }>
  variants: Array<{ id: string; name: string; productId: string }>
  excludedProducts: Array<{ id: string; name: string }>
  excludedVariants: Array<{ id: string; name: string; productId: string }>
  recentRedemptions: CouponRedemption[]
}

export function CouponsClient() {
  const { toast } = useToast()
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Drawer / History state
  const [detailCoupon, setDetailCoupon] = useState<CouponItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)

  // Form Fields
  const [formCode, setFormCode] = useState("")
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formDiscountType, setFormDiscountType] = useState<"fixed" | "percentage">("fixed")
  const [formDiscountValue, setFormDiscountValue] = useState<number | "">("")
  const [formMaxDiscount, setFormMaxDiscount] = useState<number | "">("")
  const [formMinOrder, setFormMinOrder] = useState<number | "">("")
  const [formScope, setFormScope] = useState<"all" | "products" | "variants">("all")
  const [formStatus, setFormStatus] = useState<"draft" | "active" | "paused">("active")
  const [formUsageLimit, setFormUsageLimit] = useState<number | "">("")
  const [formPerEmailLimit, setFormPerEmailLimit] = useState<number | "">("")
  const [formStartsAt, setFormStartsAt] = useState("")
  const [formEndsAt, setFormEndsAt] = useState("")
  const [formSelectedProducts, setFormSelectedProducts] = useState<string[]>([])
  const [formSelectedVariants, setFormSelectedVariants] = useState<string[]>([])
  const [formExcludedProducts, setFormExcludedProducts] = useState<string[]>([])
  const [formExcludedVariants, setFormExcludedVariants] = useState<string[]>([])

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (search) sp.set("search", search)
      if (statusFilter !== "all") sp.set("status", statusFilter)

      const res = await fetch(`/api/admin/coupons?${sp.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setCoupons(data.coupons || [])
        if (data.catalog?.products) {
          setCatalogProducts(data.catalog.products)
        }
      } else {
        toast({ title: "Lỗi tải mã giảm giá", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Lỗi kết nối", description: "Không thể lấy danh sách mã giảm giá", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, toast])

  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  const copyText = (val: string, key: string) => {
    navigator.clipboard.writeText(val)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
    toast({ title: "Đã sao chép mã", description: val })
  }

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCoupon(null)
    setFormCode("")
    setFormName("")
    setFormDescription("")
    setFormDiscountType("fixed")
    setFormDiscountValue("")
    setFormMaxDiscount("")
    setFormMinOrder(0)
    setFormScope("all")
    setFormStatus("active")
    setFormUsageLimit("")
    setFormPerEmailLimit(1)
    setFormStartsAt("")
    setFormEndsAt("")
    setFormSelectedProducts([])
    setFormSelectedVariants([])
    setFormExcludedProducts([])
    setFormExcludedVariants([])
    setFormError(null)
    setIsFormOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (coupon: CouponItem) => {
    setEditingCoupon(coupon)
    setFormCode(coupon.code)
    setFormName(coupon.name)
    setFormDescription(coupon.description || "")
    setFormDiscountType(coupon.discountType)
    setFormDiscountValue(coupon.discountValue)
    setFormMaxDiscount(coupon.maxDiscountCents || "")
    setFormMinOrder(coupon.minOrderCents || 0)
    setFormScope(coupon.scope)
    setFormStatus(coupon.status === "archived" ? "draft" : coupon.status)
    setFormUsageLimit(coupon.usageLimit || "")
    setFormPerEmailLimit(coupon.perEmailLimit || "")
    setFormStartsAt(coupon.startsAt ? new Date(coupon.startsAt).toISOString().slice(0, 16) : "")
    setFormEndsAt(coupon.endsAt ? new Date(coupon.endsAt).toISOString().slice(0, 16) : "")
    setFormSelectedProducts(coupon.products.map((p) => p.id))
    setFormSelectedVariants(coupon.variants.map((v) => v.id))
    setFormExcludedProducts(coupon.excludedProducts.map((p) => p.id))
    setFormExcludedVariants(coupon.excludedVariants.map((v) => v.id))
    setFormError(null)
    setIsFormOpen(true)
  }

  // Open Details / History Modal
  const handleOpenDetails = async (coupon: CouponItem) => {
    setDetailCoupon(coupon)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`)
      const data = await res.json()
      if (res.ok) {
        setDetailData(data.coupon)
      } else {
        toast({ title: "Lỗi tải chi tiết", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Lỗi kết nối", description: "Không thể lấy chi tiết mã", variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }

  // Toggle Pause/Active
  const handleToggleStatus = async (coupon: CouponItem) => {
    const newStatus = coupon.status === "active" ? "paused" : "active"
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          version: coupon.version,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({
          title: newStatus === "active" ? "Đã kích hoạt mã" : "Đã tạm dừng mã",
          description: `Mã ${coupon.code} hiện ở trạng thái ${newStatus}`,
        })
        fetchCoupons()
      } else {
        toast({ title: "Thao tác thất bại", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Lỗi kết nối", description: "Không thể thay đổi trạng thái", variant: "destructive" })
    }
  }

  // Archive Coupon
  const handleArchive = async (coupon: CouponItem) => {
    if (!confirm(`Bạn có chắc muốn lưu trữ mã "${coupon.code}"? Mã lưu trữ sẽ ngừng áp dụng và không thể xóa vĩnh viễn để bảo toàn lịch sử đối soát.`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: "Đã lưu trữ mã", description: data.message })
        fetchCoupons()
      } else {
        toast({ title: "Lỗi lưu trữ", description: data.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Lỗi kết nối", description: "Không thể lưu trữ mã", variant: "destructive" })
    }
  }

  // Handle Form Submit (Create or Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!editingCoupon && (!formCode.trim() || formCode.trim().length < 3)) {
      setFormError("Mã giảm giá phải có ít nhất 3 ký tự")
      return
    }

    if (!formName.trim()) {
      setFormError("Vui lòng nhập tên chương trình giảm giá")
      return
    }

    if (!formDiscountValue || Number(formDiscountValue) <= 0) {
      setFormError("Vui lòng nhập giá trị giảm giá hợp lệ")
      return
    }

    if (formDiscountType === "percentage") {
      if (Number(formDiscountValue) > 100) {
        setFormError("Mức giảm phần trăm không được vượt quá 100%")
        return
      }
      if (!formMaxDiscount || Number(formMaxDiscount) <= 0) {
        setFormError("Mã giảm phần trăm bắt buộc phải có mức giảm tối đa (VNĐ) để giới hạn rủi ro")
        return
      }
    }

    setFormSubmitting(true)
    try {
      const payload: any = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        discountType: formDiscountType,
        discountValue: Number(formDiscountValue),
        maxDiscountCents: formMaxDiscount ? Number(formMaxDiscount) : null,
        minOrderCents: formMinOrder ? Number(formMinOrder) : 0,
        scope: formScope,
        status: formStatus,
        usageLimit: formUsageLimit ? Number(formUsageLimit) : null,
        perEmailLimit: formPerEmailLimit ? Number(formPerEmailLimit) : null,
        startsAt: formStartsAt ? new Date(formStartsAt).toISOString() : null,
        endsAt: formEndsAt ? new Date(formEndsAt).toISOString() : null,
        productIds: formScope === "products" ? formSelectedProducts : [],
        variantIds: formScope === "variants" ? formSelectedVariants : [],
        excludedProductIds: formExcludedProducts,
        excludedVariantIds: formExcludedVariants,
      }

      let res: Response
      if (editingCoupon) {
        payload.version = editingCoupon.version
        res = await fetch(`/api/admin/coupons/${editingCoupon.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        payload.code = formCode.trim().toUpperCase()
        res = await fetch("/api/admin/coupons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (res.ok) {
        toast({
          title: editingCoupon ? "Cập nhật thành công" : "Tạo mã thành công",
          description: `Mã ${editingCoupon ? editingCoupon.code : formCode.toUpperCase()} đã sẵn sàng.`,
        })
        setIsFormOpen(false)
        fetchCoupons()
      } else {
        setFormError(data.error || "Thao tác không thành công")
      }
    } catch {
      setFormError("Lỗi kết nối khi gửi dữ liệu")
    } finally {
      setFormSubmitting(false)
    }
  }

  // Summary counts
  const totalActive = useMemo(() => coupons.filter((c) => c.status === "active").length, [coupons])
  const totalRedeemed = useMemo(() => coupons.reduce((sum, c) => sum + c.stats.redeemedCount, 0), [coupons])
  const totalDiscountGiven = useMemo(
    () =>
      coupons.reduce(
        (sum, c) =>
          sum +
          c.recentRedemptions
            .filter((r) => r.status === "redeemed")
            .reduce((rSum, r) => rSum + r.discountCents, 0),
        0
      ),
    [coupons]
  )

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Ticket className="size-6 text-caramel" />
            <h1 className="text-xl font-bold text-foreground">Quản Lý Mã Giảm Giá</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Thiết lập voucher, kiểm soát hạn mức, phân bổ giảm giá và theo dõi doanh số khuyến mãi
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-caramel hover:bg-caramel-light text-espresso font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          <span>Tạo mã giảm giá mới</span>
        </button>
      </div>

      {/* 2. Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">Mã đang hoạt động</span>
          <span className="text-2xl font-extrabold text-foreground mt-1 block tabular-nums">
            {totalActive}
          </span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">Lượt đã áp dụng thành công</span>
          <span className="text-2xl font-extrabold text-emerald-400 mt-1 block tabular-nums">
            {totalRedeemed}
          </span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs text-muted-foreground block">Tổng tiền đã chiết khấu cho khách</span>
          <span className="text-2xl font-extrabold text-caramel mt-1 block tabular-nums">
            {formatPrice(totalDiscountGiven)}
          </span>
        </div>
      </div>

      {/* 3. Search and Status Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã hoặc tên chương trình..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-secondary/50 text-xs text-foreground placeholder:text-muted-foreground focus:border-caramel focus:ring-1 focus:ring-caramel outline-none"
            />
          </div>
          <button
            type="button"
            onClick={fetchCoupons}
            className="p-2 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { key: "all", label: "Tất cả" },
            { key: "active", label: "Hoạt động" },
            { key: "paused", label: "Tạm dừng" },
            { key: "draft", label: "Nháp" },
            { key: "archived", label: "Lưu trữ" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
                statusFilter === tab.key
                  ? "bg-caramel text-espresso font-bold shadow-xs"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Coupons Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-semibold">Mã ưu đãi</th>
                <th className="py-3 px-4 font-semibold">Mức giảm</th>
                <th className="py-3 px-4 font-semibold">Điều kiện &amp; Phạm vi</th>
                <th className="py-3 px-4 font-semibold">Lượt dùng</th>
                <th className="py-3 px-4 font-semibold">Thời hạn</th>
                <th className="py-3 px-4 font-semibold">Trạng thái</th>
                <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-caramel" />
                    <span>Đang tải danh sách mã...</span>
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    Không tìm thấy mã giảm giá nào phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => {
                  const isExpired = coupon.endsAt && new Date(coupon.endsAt) < new Date()
                  const isNotStarted = coupon.startsAt && new Date(coupon.startsAt) > new Date()

                  return (
                    <tr key={coupon.id} className="hover:bg-secondary/20 transition-colors">
                      {/* Mã + Tên */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-caramel text-sm tracking-wide bg-caramel/10 border border-caramel/25 px-2 py-0.5 rounded">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyText(coupon.code, coupon.id)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            title="Sao chép mã"
                          >
                            {copiedKey === coupon.id ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                        <div className="font-medium text-foreground text-xs mt-1">
                          {coupon.name}
                        </div>
                        {coupon.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {coupon.description}
                          </p>
                        )}
                      </td>

                      {/* Mức giảm */}
                      <td className="py-3.5 px-4">
                        {coupon.discountType === "percentage" ? (
                          <div>
                            <span className="font-bold text-foreground">
                              −{coupon.discountValue}%
                            </span>
                            {coupon.maxDiscountCents && (
                              <span className="text-[11px] text-muted-foreground block">
                                Tối đa {formatPrice(coupon.maxDiscountCents)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-foreground">
                              −{formatPrice(coupon.discountValue)}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Điều kiện & Phạm vi */}
                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="text-muted-foreground">
                          Đơn tối thiểu:{" "}
                          <span className="text-foreground font-medium">
                            {coupon.minOrderCents > 0 ? formatPrice(coupon.minOrderCents) : "0đ"}
                          </span>
                        </div>
                        <div className="text-[11px]">
                          {coupon.scope === "all" ? (
                            <span className="text-sky-400">Toàn bộ sản phẩm</span>
                          ) : coupon.scope === "products" ? (
                            <span className="text-indigo-400">
                              {coupon.products.length} sản phẩm chỉ định
                            </span>
                          ) : (
                            <span className="text-purple-400">
                              {coupon.variants.length} biến thể chỉ định
                            </span>
                          )}
                          {(coupon.excludedProducts.length > 0 || coupon.excludedVariants.length > 0) && (
                            <span className="text-amber-400/90 ml-1">
                              (có loại trừ)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Lượt dùng */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-bold text-foreground tabular-nums">
                            {coupon.stats.redeemedCount}
                          </span>
                          <span className="text-muted-foreground">
                            {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : " (Không giới hạn)"}
                          </span>
                        </div>
                        {coupon.perEmailLimit && (
                          <span className="text-[11px] text-muted-foreground block">
                            Tối đa {coupon.perEmailLimit} lần/email
                          </span>
                        )}
                        {coupon.stats.reservedCount > 0 && (
                          <span className="text-[10px] text-amber-400 block">
                            Đang giữ: {coupon.stats.reservedCount} đơn
                          </span>
                        )}
                      </td>

                      {/* Thời hạn */}
                      <td className="py-3.5 px-4 text-[11px]">
                        {coupon.startsAt || coupon.endsAt ? (
                          <div>
                            {coupon.startsAt && (
                              <div className="text-muted-foreground">
                                Từ: {new Date(coupon.startsAt).toLocaleDateString("vi-VN")}
                              </div>
                            )}
                            {coupon.endsAt && (
                              <div className={isExpired ? "text-rose-400 font-semibold" : "text-muted-foreground"}>
                                Đến: {new Date(coupon.endsAt).toLocaleDateString("vi-VN")}
                                {isExpired && " (Hết hạn)"}
                              </div>
                            )}
                            {isNotStarted && (
                              <span className="text-amber-400 font-semibold block">Chưa đến ngày</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Không giới hạn</span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3.5 px-4">
                        {coupon.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="size-1.5 rounded-full bg-emerald-400" />
                            Hoạt động
                          </span>
                        ) : coupon.status === "paused" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <span className="size-1.5 rounded-full bg-amber-400" />
                            Tạm dừng
                          </span>
                        ) : coupon.status === "draft" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
                            Bản nháp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Lưu trữ
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Details / History */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(coupon)}
                            className="p-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Xem lịch sử sử dụng & nhật ký"
                          >
                            <History className="size-3.5" />
                          </button>

                          {/* Toggle status */}
                          {coupon.status !== "archived" && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(coupon)}
                              className="p-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title={coupon.status === "active" ? "Tạm dừng mã" : "Kích hoạt mã"}
                            >
                              {coupon.status === "active" ? (
                                <PauseCircle className="size-3.5 text-amber-400" />
                              ) : (
                                <PlayCircle className="size-3.5 text-emerald-400" />
                              )}
                            </button>
                          )}

                          {/* Edit */}
                          {coupon.status !== "archived" && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(coupon)}
                              className="p-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Chỉnh sửa mã"
                            >
                              <Edit className="size-3.5" />
                            </button>
                          )}

                          {/* Archive */}
                          {coupon.status !== "archived" && (
                            <button
                              type="button"
                              onClick={() => handleArchive(coupon)}
                              className="p-1.5 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors cursor-pointer"
                              title="Lưu trữ mã"
                            >
                              <Archive className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal: Create / Edit Coupon */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl text-foreground space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Ticket className="size-5 text-caramel" />
                <h2 className="text-base font-bold text-foreground">
                  {editingCoupon ? `Chỉnh sửa mã: ${editingCoupon.code}` : "Tạo mã giảm giá mới"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-xs font-medium flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              {/* Row 1: Code & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold block mb-1">
                    Mã coupon <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingCoupon)}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                    placeholder="VD: CAPYGO10K, CHAOBANMOI"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 font-mono text-xs uppercase placeholder:normal-case placeholder:font-sans focus:border-caramel focus:ring-1 focus:ring-caramel outline-none disabled:opacity-50"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Chữ hoa, số, gạch nối (-), gạch dưới (_). Không thể đổi sau khi tạo.
                  </p>
                </div>

                <div>
                  <label className="font-semibold block mb-1">
                    Tên chương trình / Ghi chú <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Tri ân khách hàng tháng 11"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold block mb-1">Loại giảm giá</label>
                  <select
                    value={formDiscountType}
                    onChange={(e) => setFormDiscountType(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none"
                  >
                    <option value="fixed">Số tiền cố định (VNĐ)</option>
                    <option value="percentage">Phần trăm (%)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">
                    Mức giảm {formDiscountType === "percentage" ? "(%)" : "(VNĐ)"} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formDiscountType === "percentage" ? "100" : undefined}
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(e.target.value ? Number(e.target.value) : "")}
                    placeholder={formDiscountType === "percentage" ? "VD: 20" : "VD: 15000"}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">
                    Giảm tối đa (VNĐ) {formDiscountType === "percentage" && <span className="text-destructive">*</span>}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(e.target.value ? Number(e.target.value) : "")}
                    placeholder="VD: 50000"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none tabular-nums"
                    required={formDiscountType === "percentage"}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formDiscountType === "percentage" ? "Bắt buộc đối với giảm % để chặn tràn lỗ" : "Không bắt buộc"}
                  </p>
                </div>
              </div>

              {/* Row 3: Minimum Order & Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold block mb-1">Đơn tối thiểu (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    value={formMinOrder}
                    onChange={(e) => setFormMinOrder(e.target.value ? Number(e.target.value) : 0)}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Tổng lượt dùng tối đa</label>
                  <input
                    type="number"
                    min="1"
                    value={formUsageLimit}
                    onChange={(e) => setFormUsageLimit(e.target.value ? Number(e.target.value) : "")}
                    placeholder="Để trống = Không giới hạn"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Giới hạn mỗi email</label>
                  <input
                    type="number"
                    min="1"
                    value={formPerEmailLimit}
                    onChange={(e) => setFormPerEmailLimit(e.target.value ? Number(e.target.value) : "")}
                    placeholder="Để trống = Không giới hạn"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none tabular-nums"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Giới hạn theo địa chỉ email người mua
                  </p>
                </div>
              </div>

              {/* Row 4: StartsAt & EndsAt */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold block mb-1">Thời gian bắt đầu</label>
                  <input
                    type="datetime-local"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Thời gian kết thúc</label>
                  <input
                    type="datetime-local"
                    value={formEndsAt}
                    onChange={(e) => setFormEndsAt(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none"
                  />
                </div>
              </div>

              {/* Row 5: Scope & Exclusions */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <label className="font-semibold">Phạm vi áp dụng</label>
                  <div className="flex items-center gap-2">
                    {[
                      { key: "all", label: "Toàn bộ shop" },
                      { key: "products", label: "Theo sản phẩm" },
                      { key: "variants", label: "Theo biến thể" },
                    ].map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setFormScope(s.key as any)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          formScope === s.key
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specific Products Selector */}
                {formScope === "products" && (
                  <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2 max-h-40 overflow-y-auto">
                    <span className="text-[11px] font-medium text-muted-foreground block">
                      Chọn sản phẩm áp dụng:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {catalogProducts.map((p) => {
                        const checked = formSelectedProducts.includes(p.id)
                        return (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-secondary/40">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormSelectedProducts([...formSelectedProducts, p.id])
                                } else {
                                  setFormSelectedProducts(formSelectedProducts.filter((id) => id !== p.id))
                                }
                              }}
                              className="size-3.5 rounded border-border accent-caramel"
                            />
                            <span className="truncate">{p.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Specific Variants Selector */}
                {formScope === "variants" && (
                  <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2 max-h-40 overflow-y-auto">
                    <span className="text-[11px] font-medium text-muted-foreground block">
                      Chọn biến thể áp dụng:
                    </span>
                    <div className="space-y-2">
                      {catalogProducts.map((p) => (
                        <div key={p.id} className="border-b border-border/40 pb-2 last:border-0">
                          <span className="font-semibold text-muted-foreground block text-[11px]">{p.name}</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                            {p.variants.map((v) => {
                              const checked = formSelectedVariants.includes(v.id)
                              return (
                                <label key={v.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-secondary/40">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormSelectedVariants([...formSelectedVariants, v.id])
                                      } else {
                                        setFormSelectedVariants(formSelectedVariants.filter((id) => id !== v.id))
                                      }
                                    }}
                                    className="size-3.5 rounded border-border accent-caramel"
                                  />
                                  <span className="truncate">{v.name} ({formatPrice(v.priceCents)})</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exclusions Section */}
                <div>
                  <details className="group">
                    <summary className="text-[11px] font-semibold text-caramel hover:underline cursor-pointer select-none">
                      + Thiết lập danh sách sản phẩm/biến thể LOẠI TRỪ (Ngoại lệ ưu tiên)
                    </summary>
                    <div className="mt-2 p-3 rounded-xl border border-border/80 bg-secondary/30 space-y-3">
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Loại trừ sản phẩm (không bao giờ được giảm):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                          {catalogProducts.map((p) => {
                            const checked = formExcludedProducts.includes(p.id)
                            return (
                              <label key={p.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-secondary/40">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormExcludedProducts([...formExcludedProducts, p.id])
                                    } else {
                                      setFormExcludedProducts(formExcludedProducts.filter((id) => id !== p.id))
                                    }
                                  }}
                                  className="size-3.5 rounded border-border accent-caramel"
                                />
                                <span className="truncate text-rose-300">{p.name}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              {/* Row 6: Status & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                <div>
                  <label className="font-semibold block mb-1">Trạng thái phát hành</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none"
                  >
                    <option value="active">Đang hoạt động (Áp dụng ngay)</option>
                    <option value="paused">Tạm dừng (Khách không thể nhập)</option>
                    <option value="draft">Bản nháp</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Ghi chú điều kiện / Hướng dẫn</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="VD: Không áp dụng kèm mã khác"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-secondary/50 text-xs focus:border-caramel focus:ring-1 focus:ring-caramel outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-caramel hover:bg-caramel-light text-espresso font-bold text-xs shadow-sm transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2"
                >
                  {formSubmitting && <RefreshCw className="size-3.5 animate-spin" />}
                  <span>{editingCoupon ? "Lưu thay đổi" : "Tạo mã ngay"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Coupon Details, Redemptions & Audit Log */}
      {detailCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl text-foreground space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-caramel text-base bg-caramel/10 border border-caramel/25 px-2.5 py-0.5 rounded">
                    {detailCoupon.code}
                  </span>
                  <span className="font-semibold text-sm text-foreground">{detailCoupon.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lịch sử sử dụng và nhật ký kiểm toán quản trị
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailCoupon(null)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-muted-foreground">
                <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-caramel" />
                <span>Đang tải lịch sử chi tiết...</span>
              </div>
            ) : detailData ? (
              <div className="space-y-6 text-xs">
                {/* Coupon snapshot info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-border bg-secondary/30">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Loại giảm:</span>
                    <span className="font-bold text-foreground">
                      {detailData.discountType === "percentage" ? `−${detailData.discountValue}%` : `−${formatPrice(detailData.discountValue)}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Đơn tối thiểu:</span>
                    <span className="font-bold text-foreground">{formatPrice(detailData.minOrderCents)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Lượt dùng / Giới hạn:</span>
                    <span className="font-bold text-foreground">
                      {detailData.redemptions.filter((r: any) => r.status === "redeemed").length} / {detailData.usageLimit || "∞"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Trạng thái:</span>
                    <span className="font-bold text-caramel uppercase">{detailData.status}</span>
                  </div>
                </div>

                {/* Section A: Redemptions History */}
                <div>
                  <h3 className="font-bold text-sm text-foreground mb-2 flex items-center gap-1.5">
                    <User className="size-4 text-caramel" />
                    <span>Lịch sử các đơn đã sử dụng ({detailData.redemptions.length})</span>
                  </h3>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Mã đơn</th>
                          <th className="py-2.5 px-3 font-semibold">Email</th>
                          <th className="py-2.5 px-3 font-semibold">Giảm giá</th>
                          <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                          <th className="py-2.5 px-3 font-semibold">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {detailData.redemptions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-muted-foreground">
                              Chưa có đơn hàng nào sử dụng mã này.
                            </td>
                          </tr>
                        ) : (
                          detailData.redemptions.map((r: any) => (
                            <tr key={r.id} className="hover:bg-secondary/20">
                              <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                                #{r.order?.code || "N/A"}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">{r.email}</td>
                              <td className="py-2.5 px-3 font-bold text-emerald-400 tabular-nums">
                                −{formatPrice(r.discountCents)}
                              </td>
                              <td className="py-2.5 px-3">
                                {r.status === "redeemed" ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    Đã dùng
                                  </span>
                                ) : r.status === "reserved" ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    Đang giữ chỗ
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">
                                    Đã nhả lượt
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-muted-foreground">
                                {new Date(r.reservedAt).toLocaleString("vi-VN")}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section B: Audit Logs */}
                <div>
                  <h3 className="font-bold text-sm text-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="size-4 text-caramel" />
                    <span>Nhật ký chỉnh sửa kiểm toán (Audit Logs)</span>
                  </h3>
                  <div className="rounded-xl border border-border bg-secondary/20 divide-y divide-border/60 max-h-48 overflow-y-auto">
                    {detailData.auditLogs?.length === 0 ? (
                      <div className="py-4 text-center text-muted-foreground">
                        Không có nhật ký nào.
                      </div>
                    ) : (
                      detailData.auditLogs?.map((log: any) => (
                        <div key={log.id} className="p-3 flex items-start justify-between gap-3">
                          <div>
                            <span className="font-semibold text-foreground">
                              {log.actor} • Hành động: <span className="text-caramel uppercase">{log.action}</span>
                            </span>
                            {log.details && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono break-all">
                                {log.details}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {new Date(log.createdAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setDetailCoupon(null)}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
