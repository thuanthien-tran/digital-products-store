"use client"

import { useState, useEffect } from "react"
import { 
  Layers, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Archive, 
  RotateCcw, 
  ExternalLink, 
  Eye, 
  X,
  PackagePlus,
  RefreshCw
} from "lucide-react"
import Link from "next/link"

interface ConnectionOption {
  id: string
  name: string
  provider: string
  isEnabled: boolean
}

interface SourceItem {
  id: string
  connectionId: string
  provider: string
  externalId: string
  sourceName: string
  customName?: string | null
  sourceDescription: string | null
  sourcePrice: number
  sourceRegularPrice: number | null
  saleQty: number | null
  sourceStock: number
  maxQuantity: number | null
  sourceStatus: "available" | "out_of_stock" | "unavailable" | "unknown"
  isAddedToStore: boolean
  editorialStatus: "new" | "draft" | "published" | "ignored"
  hasChangeAlert: boolean
  changeAlertDetails: string | null
  lastSyncedAt: string
  connection?: {
    id: string
    name: string
    provider: string
  } | null
  product?: {
    id: string
    name: string
    slug: string
    visibility: string
    editorialStatus: string
  } | null
}

interface SourcesClientProps {
  initialConnections: ConnectionOption[]
}

export function SourcesClient({ initialConnections }: SourcesClientProps) {
  const [sources, setSources] = useState<SourceItem[]>([])
  const [connections] = useState<ConnectionOption[]>(initialConnections)
  const [selectedConnection, setSelectedConnection] = useState<string>("")
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"unadded" | "added" | "review" | "ignored" | "all">("unadded")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addingToStore, setAddingToStore] = useState(false)
  const [counts, setCounts] = useState({ all: 0, new: 0, unadded: 0, added: 0, review: 0, ignored: 0 })
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  // View Details Modal State
  const [viewingSource, setViewingSource] = useState<SourceItem | null>(null)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedConnection) params.set("connectionId", selectedConnection)
        if (selectedStatus) params.set("status", selectedStatus)
        if (search) params.set("search", search)
        params.set("tab", activeTab)

        const res = await fetch(`/api/admin/sources?${params.toString()}`)
        if (res.ok && !ignore) {
          const data = await res.json()
          setSources(data.sources || [])
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
  }, [selectedConnection, selectedStatus, activeTab, search, refreshTrigger])

  const toggleSelectAll = () => {
    if (selectedIds.length === sources.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(sources.map((s) => s.id))
    }
  }

  const toggleSelectItem = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((item) => item !== id))
    } else {
      setSelectedIds((prev) => [...prev, id])
    }
  }

  const handleAddToStore = async (idsToadd: string[]) => {
    if (idsToadd.length === 0) return
    setAddingToStore(true)
    setMessage(null)

    try {
      const res = await fetch("/api/admin/sources/add-to-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceProductIds: idsToadd }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setMessage({
          text: `Đã thêm thành công ${data.createdCount} sản phẩm vào danh mục bán (ở trạng thái Bản nháp ẩn). Bạn có thể vào mục "Sản phẩm" để chỉnh sửa giá bán và đăng lên web!`,
          type: "success",
        })
        setSelectedIds([])
        setRefreshTrigger((prev) => prev + 1)
      } else {
        setMessage({ text: data.error || "Thêm sản phẩm thất bại", type: "error" })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi"
      setMessage({ text: msg, type: "error" })
    } finally {
      setAddingToStore(false)
    }
  }

  const handleIgnore = async (id: string, action: "ignore" | "restore") => {
    try {
      const res = await fetch(`/api/admin/sources/${id}/ignore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setRefreshTrigger((prev) => prev + 1)
      }
    } catch {
      // silent
    }
  }

  const [isSyncing, setIsSyncing] = useState(false)

  const handleSyncProviders = async () => {
    setIsSyncing(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setMessage({ text: data.message || "Đã đồng bộ nguồn hàng từ đại lý thành công!", type: "success" })
        setRefreshTrigger((prev) => prev + 1)
      } else {
        setMessage({ text: data.error || "Lỗi đồng bộ đại lý", type: "error" })
      }
    } catch {
      setMessage({ text: "Lỗi kết nối khi đồng bộ đại lý", type: "error" })
    } finally {
      setIsSyncing(false)
    }
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
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

      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Danh Mục Nguồn Các Đại Lý
          </h2>
          <p className="text-xs text-muted-foreground">
            Lựa chọn sản phẩm muốn kinh doanh và thêm vào kho hàng bán của bạn
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedConnection}
            onChange={(e) => setSelectedConnection(e.target.value)}
            className="p-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
          >
            <option value="">Tất cả đại lý ({connections.length})</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="p-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-xs"
          >
            <option value="">Tất cả tình trạng</option>
            <option value="available">Còn hàng</option>
            <option value="out_of_stock">Tạm hết hàng</option>
            <option value="unavailable">Ngừng cung cấp</option>
          </select>

          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo mã hoặc tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs placeholder:text-muted-foreground w-40 sm:w-48 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            onClick={handleSyncProviders}
            disabled={isSyncing}
            className="px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold hover:border-primary/50 transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            title="Kéo danh mục và tồn kho mới nhất từ tất cả đại lý"
          >
            <RefreshCw className={`size-3.5 text-primary ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Đang đồng bộ..." : "Đồng bộ đại lý"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/80 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab("unadded")}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === "unadded"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Chưa thêm vào web</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeTab === "unadded" ? "bg-espresso/20 text-espresso" : "bg-primary/20 text-primary"
          }`}>
            {counts.unadded}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("added")}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === "added"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Đã thêm vào web</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeTab === "added" ? "bg-espresso/20 text-espresso" : "bg-secondary text-muted-foreground"
          }`}>
            {counts.added}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("review")}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === "review"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className={`size-3.5 ${activeTab === "review" ? "text-espresso" : "text-amber-400"}`} />
          <span>Cần xem lại</span>
          {counts.review > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "review" ? "bg-espresso/20 text-espresso" : "bg-amber-500/20 text-amber-300"
            }`}>
              {counts.review}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("ignored")}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === "ignored"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Đã bỏ qua</span>
          {counts.ignored > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "ignored" ? "bg-espresso/20 text-espresso" : "bg-secondary text-muted-foreground"
            }`}>
              {counts.ignored}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
            activeTab === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Tất cả</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            activeTab === "all" ? "bg-espresso/20 text-espresso" : "bg-secondary text-muted-foreground"
          }`}>
            {counts.all}
          </span>
        </button>
      </div>

      {/* Floating Batch Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between animate-in fade-in slide-in-from-top-2 text-xs">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <CheckCircle2 className="size-4" />
            <span>Đã chọn {selectedIds.length} sản phẩm nguồn</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground text-xs"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              disabled={addingToStore}
              onClick={() => handleAddToStore(selectedIds)}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            >
              <PackagePlus className="size-3.5" />
              <span>{addingToStore ? "Đang thêm..." : `Thêm ${selectedIds.length} sản phẩm vào kho bán`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Sources Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={sources.length > 0 && selectedIds.length === sources.length}
                    onChange={toggleSelectAll}
                    className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Tên &amp; Mã nguồn</th>
                <th className="py-3 px-4">Đại lý cung cấp</th>
                <th className="py-3 px-4 text-right">Giá nhập sỉ</th>
                <th className="py-3 px-4 text-center">Tồn kho</th>
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
                    Đang tải danh mục nguồn...
                  </td>
                </tr>
              ) : sources.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    <Layers className="size-8 mx-auto mb-2 opacity-30" />
                    Không tìm thấy sản phẩm nguồn nào phù hợp bộ lọc
                  </td>
                </tr>
              ) : (
                sources.map((s) => {
                  const isSelected = selectedIds.includes(s.id)

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-secondary/20 transition-colors ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(s.id)}
                          className="size-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>

                      {/* Name & ID */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-1 py-0.5 rounded border border-border">
                            #{s.externalId}
                          </span>
                          <span className="font-semibold text-foreground truncate">
                            {s.customName || s.sourceName}
                          </span>
                        </div>
                        {s.hasChangeAlert && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 w-fit">
                            <AlertTriangle className="size-2.5" />
                            <span>Cần đối soát biến động</span>
                          </div>
                        )}
                      </td>

                      {/* Provider connection */}
                      <td className="py-3 px-4 text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-secondary text-[11px] font-medium border border-border">
                          {s.connection?.name || s.provider}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        {formatMoney(s.sourcePrice)}
                        {s.sourceRegularPrice && (
                          <div className="text-[10px] line-through text-muted-foreground font-normal">
                            {formatMoney(s.sourceRegularPrice)}
                          </div>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            s.sourceStock > 0
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {s.sourceStock}
                        </span>
                      </td>

                      {/* Source status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            s.sourceStatus === "available"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : s.sourceStatus === "out_of_stock"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              s.sourceStatus === "available"
                                ? "bg-emerald-400"
                                : s.sourceStatus === "out_of_stock"
                                ? "bg-rose-400"
                                : "bg-muted-foreground"
                            }`}
                          />
                          {s.sourceStatus === "available"
                            ? "Còn hàng"
                            : s.sourceStatus === "out_of_stock"
                            ? "Tạm hết"
                            : "Ngừng bán"}
                        </span>
                      </td>

                      {/* Added to store status */}
                      <td className="py-3 px-4 text-center">
                        {s.isAddedToStore ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="size-3" />
                            Đã thêm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground border border-border">
                            Chưa thêm
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingSource(s)}
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs"
                            title="Xem mô tả nguồn"
                          >
                            <Eye className="size-3.5" />
                          </button>

                          {!s.isAddedToStore ? (
                            <button
                              type="button"
                              onClick={() => handleAddToStore([s.id])}
                              className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1"
                            >
                              <Plus className="size-3" />
                              <span>Thêm bán</span>
                            </button>
                          ) : (
                            <Link
                              href="/admin/products"
                              className="px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-[11px] font-medium flex items-center gap-1 transition-colors"
                            >
                              <ExternalLink className="size-3" />
                              <span>Xem gói bán</span>
                            </Link>
                          )}

                          {s.editorialStatus !== "ignored" ? (
                            <button
                              type="button"
                              onClick={() => handleIgnore(s.id, "ignore")}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Bỏ qua"
                            >
                              <Archive className="size-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleIgnore(s.id, "restore")}
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

      {/* Raw Description Modal */}
      {viewingSource && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
              <h3 className="font-bold text-sm text-foreground">
                Thông Tin Chi Tiết Nguồn: #{viewingSource.externalId}
              </h3>
              <button onClick={() => setViewingSource(null)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Tên sản phẩm đại lý</span>
                <span className="font-bold text-foreground text-sm">{viewingSource.sourceName}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Giá sỉ đại lý:</span>
                  <span className="font-bold text-foreground font-mono">{formatMoney(viewingSource.sourcePrice)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Tồn kho API:</span>
                  <span className="font-bold text-blue-400 font-mono">{viewingSource.sourceStock}</span>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold mb-1">Mô tả nguyên bản từ nguồn</span>
                <div className="p-3 rounded-xl bg-background border border-border text-muted-foreground leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
                  {viewingSource.sourceDescription || "Không có mô tả từ đại lý."}
                </div>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setViewingSource(null)}
                  className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
