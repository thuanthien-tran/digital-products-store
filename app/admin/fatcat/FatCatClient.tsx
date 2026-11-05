"use client"

import { useState, useEffect } from "react"
import { 
  RefreshCw, 
  Wallet, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp,
  Package,
  Eye,
  Edit3,
  X,
  Search,
  Sparkles,
  AlertTriangle,
  Archive,
  RotateCcw,
  Tag
} from "lucide-react"

interface ProductGroupOption {
  id: string
  name: string
}

interface SourceProductItem {
  id: string
  provider: string
  externalId: number
  sourceName: string
  sourceDescription: string | null
  sourcePrice: number
  sourceRegularPrice: number | null
  saleQty: number | null
  sourceStock: number
  maxQuantity: number | null
  sourceStatus: "available" | "out_of_stock" | "unavailable" | "unknown"
  contentHash: string | null
  firstDetectedAt: string
  lastSeenAt: string
  lastSyncedAt: string
  editorialStatus: "new" | "draft" | "published" | "ignored"
  hasChangeAlert: boolean
  changeAlertDetails: string | null
  customName: string | null
  customPrice: number | null
  customDescription: string | null
  customGroupId: string | null
  customDeliveryType: string | null
  customWarrantyInfo: string | null
  customPurchaseLimit: number | null
  customImages: string | null
  version: number
  productId: string | null
  variantId: string | null
  publishedAt: string | null
  publishedBy: string | null
  product?: {
    id: string
    name: string
    slug: string
    visibility: string
    statusOverride: string
    group?: { id: string; name: string } | null
  } | null
}

interface FatCatClientProps {
  groups: ProductGroupOption[]
  initialBalance?: {
    balance_vnd: number
    balance_usdt: number
    usdt_rate: number
  } | null
}

export function FatCatClient({ groups, initialBalance }: FatCatClientProps) {
  const [activeTab, setActiveTab] = useState<"new" | "draft" | "published" | "review" | "ignored">("new")
  const [products, setProducts] = useState<SourceProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [balance, setBalance] = useState(initialBalance)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [counts, setCounts] = useState({ new: 0, draft: 0, published: 0, review: 0, ignored: 0, total: 0 })
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  // Editor Modal State
  const [editingItem, setEditingItem] = useState<SourceProductItem | null>(null)
  const [formData, setFormData] = useState({
    customName: "",
    customPrice: 0,
    customDescription: "",
    customGroupId: "",
    customWarrantyInfo: "",
  })
  const [saving, setSaving] = useState(false)
  const [confirmBelowCost, setConfirmBelowCost] = useState(false)

  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const fetchProducts = () => setRefreshTrigger((prev) => prev + 1)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      try {
        const params = new URLSearchParams()
        params.set("tab", activeTab)
        if (search) params.set("search", search)
        if (statusFilter) params.set("sourceStatus", statusFilter)

        const res = await fetch(`/api/admin/fatcat/products?${params.toString()}`)
        if (res.ok && !ignore) {
          const data = await res.json()
          setProducts(data.products || [])
          if (data.counts) setCounts(data.counts)
        }
      } catch {
        // silent
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [activeTab, search, statusFilter, refreshTrigger])

  const handleSync = async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/fatcat/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok && data.success) {
        setMessage({
          text: `Đồng bộ thành công! Tìm thấy ${data.newCount} sản phẩm mới, cập nhật ${data.updatedCount} sản phẩm, ${data.discontinuedCount} sản phẩm ngừng bán.`,
          type: "success",
        })
        fetchProducts()
        // Refresh balance
        const balRes = await fetch("/api/admin/fatcat")
        const balData = await balRes.json()
        if (balData.balance) setBalance(balData.balance)
      } else {
        setMessage({
          text: data.error || "Đồng bộ thất bại. Vui lòng kiểm tra lại cấu hình API.",
          type: "error",
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi mạng"
      setMessage({ text: msg, type: "error" })
    } finally {
      setSyncing(false)
    }
  }

  // Open Edit Modal
  const openEditor = (item: SourceProductItem) => {
    setEditingItem(item)
    setFormData({
      customName: item.customName || item.sourceName,
      customPrice: item.customPrice || Math.round(item.sourcePrice * 1.35 / 1000) * 1000,
      customDescription: item.customDescription || item.sourceDescription || "",
      customGroupId: item.customGroupId || item.product?.group?.id || groups[0]?.id || "",
      customWarrantyInfo: item.customWarrantyInfo || "Bảo hành 1 đổi 1 trong thời gian sử dụng nếu phát sinh lỗi.",
    })
    setConfirmBelowCost(false)
  }

  const copyFromSource = () => {
    if (!editingItem) return
    setFormData((prev) => ({
      ...prev,
      customName: editingItem.sourceName,
      customDescription: editingItem.sourceDescription || "",
    }))
  }

  const handleSaveDraft = async () => {
    if (!editingItem) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/fatcat/products/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          expectedVersion: editingItem.version,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ text: "Đã lưu bản nháp thành công!", type: "success" })
        setEditingItem(null)
        fetchProducts()
      } else {
        alert(data.error || "Lỗi lưu bản nháp")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi"
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (itemId?: string) => {
    const targetId = itemId || editingItem?.id
    if (!targetId) return

    setSaving(true)
    try {
      // If saving from editor, first update draft values
      if (editingItem) {
        await fetch(`/api/admin/fatcat/products/${targetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
      }

      const res = await fetch(`/api/admin/fatcat/products/${targetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          confirmBelowCost,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ text: "Đã đăng bán sản phẩm lên cửa hàng thành công!", type: "success" })
        setEditingItem(null)
        fetchProducts()
      } else {
        if (data.error && data.error.includes("thấp hơn giá sỉ")) {
          setConfirmBelowCost(true)
        }
        alert(data.error || "Lỗi đăng bán")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi"
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleAction = async (id: string, action: "unpublish" | "ignore" | "restore") => {
    const labelMap = {
      unpublish: "Ẩn khỏi cửa hàng",
      ignore: "Bỏ qua sản phẩm",
      restore: "Khôi phục về bản nháp",
    }
    if (!confirm(`Bạn có chắc chắn muốn ${labelMap[action]}?`)) return

    try {
      const res = await fetch(`/api/admin/fatcat/products/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setMessage({ text: `Đã thực hiện: ${labelMap[action]}!`, type: "success" })
        fetchProducts()
      } else {
        const data = await res.json()
        alert(data.error || "Thao tác thất bại")
      }
    } catch {
      alert("Lỗi kết nối")
    }
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Top Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Wallet Balance Card */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Ví đại lý FatCat
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Wallet className="size-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground">
            {balance ? formatMoney(balance.balance_vnd) : "0 ₫"}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
            <AlertTriangle className="size-3 shrink-0" />
            <span>Chưa kích hoạt kênh mua tự động (ngoài phạm vi đợt này)</span>
          </div>
        </div>

        {/* Catalog Stats Card */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Tổng sản phẩm nguồn
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="size-3.5" />
            </div>
          </div>
          <div className="text-xl font-black text-foreground">
            {counts.total} <span className="text-xs font-normal text-muted-foreground">sản phẩm</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {counts.published} đang bán · {counts.new} mới về · {counts.review} cần xem lại
          </p>
        </div>

        {/* Sync Action Card */}
        <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between space-y-2">
          <div>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Đồng bộ dữ liệu
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Quét danh mục API, phát hiện sản phẩm mới và biến động giá/kho.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full py-2 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Đang đồng bộ..." : "Đồng bộ FatCat ngay"}
          </button>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveTab("new")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === "new"
                  ? "bg-secondary text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3.5 text-emerald-400" />
              <span>Mới về</span>
              {counts.new > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                  {counts.new}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("draft")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === "draft"
                  ? "bg-secondary text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Edit3 className="size-3.5 text-blue-400" />
              <span>Bản nháp</span>
              {counts.draft > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
                  {counts.draft}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("published")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === "published"
                  ? "bg-secondary text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span>Đang bán</span>
              {counts.published > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground text-[10px]">
                  {counts.published}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("review")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === "review"
                  ? "bg-secondary text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle className="size-3.5 text-amber-400" />
              <span>Cần xem lại</span>
              {counts.review > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                  {counts.review}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("ignored")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === "ignored"
                  ? "bg-secondary text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Archive className="size-3.5 text-muted-foreground" />
              <span>Đã bỏ qua</span>
              {counts.ignored > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground text-[10px]">
                  {counts.ignored}
                </span>
              )}
            </button>
          </div>

          {/* Search & Status Filter */}
          <div className="flex items-center gap-2 text-xs">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm mã hoặc tên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-52"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border border-border bg-card text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tất cả nguồn</option>
              <option value="available">Còn hàng</option>
              <option value="out_of_stock">Tạm hết hàng</option>
              <option value="unavailable">Ngừng cung cấp</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Products Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-3 px-4">Sản phẩm nguồn</th>
                <th className="py-3 px-4 text-right">Giá sỉ API</th>
                <th className="py-3 px-4 text-center">Tồn kho</th>
                <th className="py-3 px-4 text-right">Giá bán đặt</th>
                <th className="py-3 px-4 text-right">Lãi dự kiến</th>
                <th className="py-3 px-4 text-center">Tình trạng nguồn</th>
                <th className="py-3 px-4 text-center">Trạng thái bán</th>
                <th className="py-3 px-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Đang tải danh sách sản phẩm nguồn...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    <Package className="size-8 mx-auto mb-2 opacity-30" />
                    Không có sản phẩm nào trong mục này
                  </td>
                </tr>
              ) : (
                products.map((item) => {
                  const retailPrice = item.customPrice || 0
                  const wholesale = item.sourcePrice
                  const margin = retailPrice > 0 ? retailPrice - wholesale : 0
                  const isMarginPositive = margin > 0

                  return (
                    <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                      {/* Name & ID */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-1 py-0.5 rounded border border-border">
                            #{item.externalId}
                          </span>
                          <span className="font-semibold text-foreground truncate">
                            {item.customName || item.sourceName}
                          </span>
                        </div>
                        {item.customName && item.customName !== item.sourceName && (
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            Gốc: {item.sourceName}
                          </div>
                        )}
                        {/* Change Alert Flags */}
                        {item.hasChangeAlert && item.changeAlertDetails && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 w-fit">
                            <AlertTriangle className="size-2.5" />
                            <span>Cần xem lại biến động</span>
                          </div>
                        )}
                      </td>

                      {/* Source Price */}
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {formatMoney(wholesale)}
                        {item.sourceRegularPrice && (
                          <div className="text-[10px] line-through opacity-70">
                            {formatMoney(item.sourceRegularPrice)}
                          </div>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded tabular-nums text-[11px] font-bold ${
                            item.sourceStock > 0
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.sourceStock}
                        </span>
                      </td>

                      {/* Retail Price */}
                      <td className="py-3 px-4 text-right font-bold text-foreground tabular-nums">
                        {retailPrice > 0 ? formatMoney(retailPrice) : <span className="text-muted-foreground font-normal">Chưa đặt</span>}
                      </td>

                      {/* Profit Margin */}
                      <td className="py-3 px-4 text-right">
                        {retailPrice > 0 ? (
                          <span
                            className={`inline-flex items-center gap-0.5 font-semibold text-[11px] tabular-nums ${
                              isMarginPositive ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            <TrendingUp className="size-3" />
                            {isMarginPositive ? "+" : ""}
                            {formatMoney(margin)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Source Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            item.sourceStatus === "available"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : item.sourceStatus === "out_of_stock"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              item.sourceStatus === "available"
                                ? "bg-emerald-400"
                                : item.sourceStatus === "out_of_stock"
                                ? "bg-rose-400"
                                : "bg-muted-foreground"
                            }`}
                          />
                          {item.sourceStatus === "available"
                            ? "Còn hàng"
                            : item.sourceStatus === "out_of_stock"
                            ? "Tạm hết"
                            : "Ngừng bán"}
                        </span>
                      </td>

                      {/* Editorial Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.editorialStatus === "published"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : item.editorialStatus === "draft"
                              ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                              : item.editorialStatus === "new"
                              ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {item.editorialStatus === "published"
                            ? "Đang bán"
                            : item.editorialStatus === "draft"
                            ? "Bản nháp"
                            : item.editorialStatus === "new"
                            ? "Mới về"
                            : "Bỏ qua"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditor(item)}
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-colors"
                            title="Chỉnh sửa sản phẩm"
                          >
                            <Edit3 className="size-3.5" />
                          </button>

                          <a
                            href={`/admin/fatcat/preview/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-colors"
                            title="Xem trước giao diện khách"
                          >
                            <Eye className="size-3.5" />
                          </a>

                          {item.editorialStatus !== "published" && item.editorialStatus !== "ignored" && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem(item)
                                setFormData({
                                  customName: item.customName || item.sourceName,
                                  customPrice: item.customPrice || Math.round(item.sourcePrice * 1.35 / 1000) * 1000,
                                  customDescription: item.customDescription || item.sourceDescription || "",
                                  customGroupId: item.customGroupId || item.product?.group?.id || groups[0]?.id || "",
                                  customWarrantyInfo: item.customWarrantyInfo || "Bảo hành 1 đổi 1.",
                                })
                              }}
                              className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                            >
                              Duyệt đăng
                            </button>
                          )}

                          {item.editorialStatus === "published" && (
                            <button
                              type="button"
                              onClick={() => handleAction(item.id, "unpublish")}
                              className="px-2 py-1 rounded-lg border border-border hover:bg-secondary text-[11px] font-medium transition-colors"
                            >
                              Ẩn bán
                            </button>
                          )}

                          {item.editorialStatus !== "ignored" ? (
                            <button
                              type="button"
                              onClick={() => handleAction(item.id, "ignore")}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Bỏ qua"
                            >
                              <Archive className="size-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAction(item.id, "restore")}
                              className="p-1.5 rounded-lg text-primary hover:bg-secondary transition-colors"
                              title="Khôi phục"
                            >
                              <RotateCcw className="size-3.5" />
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

      {/* Editor Modal (Two-Column Layout) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-50 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
              <div className="flex items-center gap-2">
                <Tag className="size-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">
                  Biên Tập &amp; Duyệt Đăng: #{editingItem.externalId} {editingItem.sourceName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body: Two Columns */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
              {/* Left Column: Source Info (Read-Only) */}
              <div className="md:col-span-5 space-y-4 p-4 rounded-xl bg-secondary/30 border border-border">
                <div className="flex items-center justify-between pb-2 border-b border-border/80">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
                    Thông tin từ nguồn (Chỉ đọc)
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">#{editingItem.externalId}</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Tên sản phẩm đại lý</span>
                    <span className="font-semibold text-foreground text-xs">{editingItem.sourceName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Giá sỉ đại lý</span>
                      <span className="font-bold text-foreground tabular-nums">{formatMoney(editingItem.sourcePrice)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Tồn kho nguồn</span>
                      <span className="font-bold text-blue-400 tabular-nums">{editingItem.sourceStock}</span>
                    </div>
                  </div>

                  {editingItem.sourceRegularPrice && (
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Giá gốc (Regular)</span>
                      <span className="line-through text-muted-foreground tabular-nums">
                        {formatMoney(editingItem.sourceRegularPrice)}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-muted-foreground block text-[10px]">Thời điểm đồng bộ</span>
                    <span className="text-muted-foreground">
                      {new Date(editingItem.lastSyncedAt).toLocaleString("vi-VN")}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-border/60">
                    <span className="text-muted-foreground block text-[10px] mb-1">Mô tả từ đại lý</span>
                    <div className="p-2.5 rounded bg-background/50 border border-border text-[11px] text-muted-foreground max-h-40 overflow-y-auto whitespace-pre-line leading-relaxed">
                      {editingItem.sourceDescription || "Không có mô tả nguồn."}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={copyFromSource}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-[11px] font-medium transition-colors"
                  >
                    Sao chép tên &amp; mô tả nguồn sang bên phải
                  </button>
                </div>
              </div>

              {/* Right Column: Storefront Info (Admin Editable) */}
              <div className="md:col-span-7 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/80">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-primary">
                    Thông tin hiển thị trên cửa hàng (Admin chỉnh)
                  </span>
                  <span className="text-[10px] text-muted-foreground">Phiên bản v{editingItem.version}</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1 font-medium">
                      Tên sản phẩm trên cửa hàng *
                    </label>
                    <input
                      type="text"
                      value={formData.customName}
                      onChange={(e) => setFormData({ ...formData, customName: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                      placeholder="Nhập tên sản phẩm hiển thị..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-muted-foreground text-[11px] mb-1 font-medium">
                        Giá bán niêm yết (VNĐ) *
                      </label>
                      <input
                        type="number"
                        value={formData.customPrice}
                        onChange={(e) => setFormData({ ...formData, customPrice: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono font-bold"
                        step={1000}
                        min={0}
                      />
                      <div className="mt-1 flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Lợi nhuận gộp:</span>
                        <span
                          className={`font-semibold ${
                            formData.customPrice >= editingItem.sourcePrice ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {formData.customPrice >= editingItem.sourcePrice ? "+" : ""}
                          {formatMoney(formData.customPrice - editingItem.sourcePrice)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-muted-foreground text-[11px] mb-1 font-medium">
                        Danh mục nhóm sản phẩm
                      </label>
                      <select
                        value={formData.customGroupId}
                        onChange={(e) => setFormData({ ...formData, customGroupId: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                      >
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {confirmBelowCost && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span>Cảnh báo bán dưới giá sỉ!</span>
                      </div>
                      <p className="text-[11px]">
                        Giá bán ({formatMoney(formData.customPrice)}) thấp hơn giá sỉ đại lý ({formatMoney(editingItem.sourcePrice)}). Nếu bạn chắc chắn muốn bán chịu lỗ, hãy bấm &ldquo;Xác nhận đăng bán&rdquo; lần nữa.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1 font-medium">
                      Hướng dẫn nhận hàng &amp; Chính sách bảo hành
                    </label>
                    <textarea
                      rows={2}
                      value={formData.customWarrantyInfo}
                      onChange={(e) => setFormData({ ...formData, customWarrantyInfo: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                      placeholder="Ví dụ: Bảo hành 1 đổi 1 trong 30 ngày..."
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1 font-medium">
                      Mô tả chi tiết sản phẩm
                    </label>
                    <textarea
                      rows={4}
                      value={formData.customDescription}
                      onChange={(e) => setFormData({ ...formData, customDescription: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                      placeholder="Mô tả các tính năng nổi bật..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-secondary/30">
              <a
                href={`/admin/fatcat/preview/${editingItem.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Eye className="size-3.5" />
                <span>Xem trước giao diện</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground text-xs"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu bản nháp"}
                </button>
                <button
                  type="button"
                  onClick={() => handlePublish()}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {saving ? "Đang xử lý..." : editingItem.editorialStatus === "published" ? "Cập nhật lên web" : "Đăng bán ngay"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
