"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Search, ExternalLink, RefreshCw, Trash2 } from "lucide-react"

interface OrderItem {
  id: string
  code: string
  email: string
  totalCents: number
  paidAmount?: number
  status: string
  createdAt: string
  paymentGateway: string | null
  note?: string | null
  items: Array<{
    name: string
    quantity?: number
    priceCents: number
    serials?: string[]
    serial: string | null
  }>
}

export function OrderManagerClient({ orders }: { orders: OrderItem[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [currentOrders, setCurrentOrders] = useState<OrderItem[]>(orders)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [refreshing, setRefreshing] = useState(false)
  const [cleaningTests, setCleaningTests] = useState(false)

  // Modal State for Manual Settlement
  const [settleModal, setSettleModal] = useState<{
    isOpen: boolean
    order: OrderItem | null
    amount: string
    reason: string
    idempotencyKey: string
    isSubmitting: boolean
    error?: string
  }>({
    isOpen: false,
    order: null,
    amount: "",
    reason: "",
    idempotencyKey: "",
    isSubmitting: false,
  })

  // Modal State for Order Cancellation
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean
    order: OrderItem | null
    reason: string
    isSubmitting: boolean
    error?: string
  }>({
    isOpen: false,
    order: null,
    reason: "",
    isSubmitting: false,
  })

  const isSubmittingRef = useRef(false)

  const [fulfillingId, setFulfillingId] = useState<string | null>(null)

  const refreshOrders = async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/admin/orders")
      const json = await res.json()
      if (res.ok && json.success) {
        setCurrentOrders(json.orders || [])
        toast({ title: "Đã đồng bộ", description: `Đã cập nhật danh sách (${json.orders?.length || 0} đơn hàng).` })
      } else {
        toast({ title: "Lỗi", description: json.error || "Không thể đồng bộ đơn hàng", variant: "destructive" })
      }
    } catch (err: unknown) {
      toast({ title: "Lỗi mạng", description: err instanceof Error ? err.message : "Lỗi mạng", variant: "destructive" })
    } finally {
      setRefreshing(false)
    }
  }

  const handleCleanTestOrders = async () => {
    const confirmed = window.confirm("Xác nhận xóa tất cả các đơn hàng test / đơn mẫu trong hệ thống?")
    if (!confirmed) return

    setCleaningTests(true)
    try {
      const res = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clean_test_orders" }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast({ title: "Thành công", description: json.message || "Đã xóa các đơn hàng test!" })
        await refreshOrders()
      } else {
        toast({ title: "Lỗi", description: json.error || "Thao tác thất bại", variant: "destructive" })
      }
    } catch (err: unknown) {
      toast({ title: "Lỗi", description: err instanceof Error ? err.message : "Lỗi mạng", variant: "destructive" })
    } finally {
      setCleaningTests(false)
    }
  }

  const handleDeleteOrder = async (orderId: string, orderCode: string) => {
    const confirmed = window.confirm(`Xác nhận xóa vĩnh viễn đơn hàng #${orderCode}?`)
    if (!confirmed) return

    try {
      const res = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast({ title: "Đã xóa", description: `Đã xóa đơn hàng #${orderCode}` })
        setCurrentOrders((prev) => prev.filter((o) => o.id !== orderId))
      } else {
        toast({ title: "Lỗi", description: json.error || "Không thể xóa đơn", variant: "destructive" })
      }
    } catch (err: unknown) {
      toast({ title: "Lỗi", description: err instanceof Error ? err.message : "Lỗi mạng", variant: "destructive" })
    }
  }

  const openSettleModal = (order: OrderItem) => {
    const key = `adm-pay-${order.id.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setSettleModal({
      isOpen: true,
      order,
      amount: String(order.totalCents),
      reason: "Đã nhận chuyển khoản ngân hàng",
      idempotencyKey: key,
      isSubmitting: false,
    })
  }

  const handleTriggerFulfill = async (orderId: string) => {
    setFulfillingId(orderId)
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "fulfill" }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast({ title: "Thành công", description: "Đã giao hàng qua đại lý thành công!" })
        window.location.reload()
      } else {
        toast({ title: "Lỗi giao hàng", description: json.error || "Giao hàng thất bại", variant: "destructive" })
      }
    } catch (err: unknown) {
      toast({ title: "Lỗi", description: err instanceof Error ? err.message : "Lỗi mạng", variant: "destructive" })
    } finally {
      setFulfillingId(null)
    }
  }

  const openCancelModal = (order: OrderItem) => {
    setCancelModal({
      isOpen: true,
      order,
      reason: "",
      isSubmitting: false,
    })
  }

  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current || !settleModal.order) return

    const parsed = Number(settleModal.amount)
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1000000000) {
      toast({ title: "Lỗi", description: "Vui lòng nhập số tiền thực nhận hợp lệ (> 0 VNĐ)", variant: "destructive" })
      return
    }

    if (!settleModal.reason.trim() || settleModal.reason.trim().length < 3) {
      toast({ title: "Lỗi", description: "Vui lòng nhập lý do / mã tham chiếu đối soát (từ 3 ký tự)", variant: "destructive" })
      return
    }

    isSubmittingRef.current = true
    setSettleModal((prev) => ({ ...prev, isSubmitting: true, error: undefined }))

    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: settleModal.order.id,
          status: "paid",
          manualAmountReceived: parsed,
          manualReason: settleModal.reason.trim(),
          idempotencyKey: settleModal.idempotencyKey,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Ghi nhận thanh toán thất bại")
      }

      toast({ title: "Ghi nhận thành công", description: `Đã cập nhật đơn #${settleModal.order.code}`, variant: "default" })
      setSettleModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }))
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã có lỗi xảy ra"
      setSettleModal((prev) => ({ ...prev, error: msg, isSubmitting: false }))
      toast({ title: "Lỗi ghi nhận", description: msg, variant: "destructive" })
    } finally {
      isSubmittingRef.current = false
    }
  }

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current || !cancelModal.order) return

    isSubmittingRef.current = true
    setCancelModal((prev) => ({ ...prev, isSubmitting: true, error: undefined }))

    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: cancelModal.order.id,
          status: "cancelled",
          manualReason: cancelModal.reason.trim() || "Admin hủy đơn trên giao diện quản trị",
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Hủy đơn thất bại")
      }

      toast({ title: "Đã hủy đơn hàng", description: `Đơn #${cancelModal.order.code} đã chuyển trạng thái đã hủy`, variant: "default" })
      setCancelModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }))
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã có lỗi xảy ra"
      setCancelModal((prev) => ({ ...prev, error: msg, isSubmitting: false }))
      toast({ title: "Lỗi hủy đơn", description: msg, variant: "destructive" })
    } finally {
      isSubmittingRef.current = false
    }
  }

  const filteredOrders = currentOrders.filter((o) => {
    const matchSearch =
      o.code.toLowerCase().includes(search.toLowerCase()) ||
      o.email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === "all" || o.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã đơn hoặc email..."
              className="pl-10 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={refreshOrders}
            className="text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Đồng bộ đơn hàng mới nhất từ database"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Đang đồng bộ..." : "Đồng bộ"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={cleaningTests}
            onClick={handleCleanTestOrders}
            className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Xóa tất cả các đơn hàng test mẫu"
          >
            <Trash2 className="size-3.5" />
            <span>{cleaningTests ? "Đang xóa..." : "Xóa đơn test"}</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {["all", "pending", "paid", "cancelled"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                filterStatus === st
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground border border-border/60"
              }`}
            >
              {st === "all" ? "Tất cả" : st === "pending" ? "Chờ TT" : st === "paid" ? "Đã TT" : "Đã hủy"}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground rounded-2xl border border-border/80 bg-card/60">
            Không tìm thấy đơn hàng nào phù hợp.
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="p-5 rounded-2xl border border-border/80 bg-card/60 backdrop-blur shadow-sm space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-base text-foreground">#{order.code}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      order.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : order.status === "pending"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {order.status === "paid" ? "Đã thanh toán" : order.status === "pending" ? "Chờ thanh toán" : "Đã hủy"}
                  </span>
                  {order.paymentGateway && (
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
                      {order.paymentGateway}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-primary">{formatPrice(order.totalCents)}</span>
                  <a
                    href={`/order/${order.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold"
                  >
                    Trang khách <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-semibold text-foreground">{order.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Thời gian: </span>
                  <span className="font-semibold text-foreground">
                    {new Date(order.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>

              {/* Items & Serial preview */}
              <div className="rounded-xl border border-border/50 bg-background/50 p-3 space-y-2 text-xs">
                {order.items.map((it, idx) => {
                  const serialList =
                    it.serials && it.serials.length > 0
                      ? it.serials
                      : it.serial
                      ? it.serial.split("\n").filter(Boolean)
                      : []

                  return (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="font-bold text-foreground">
                        {it.name} {it.quantity && it.quantity > 1 ? `x${it.quantity}` : ""}
                      </span>
                      {serialList.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {serialList.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded truncate"
                            >
                              Key: {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-400 font-medium">Chưa có serial</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                {order.status !== "paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                    onClick={() => openSettleModal(order)}
                  >
                    Duyệt đã TT
                  </Button>
                )}
                {order.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={fulfillingId === order.id}
                    className="text-xs text-blue-400 border-blue-500/30 hover:bg-blue-500/10 cursor-pointer"
                    onClick={() => handleTriggerFulfill(order.id)}
                  >
                    {fulfillingId === order.id ? "Đang giao..." : "Giao lại qua đại lý"}
                  </Button>
                )}
                {order.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => openCancelModal(order)}
                  >
                    Hủy đơn
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-2 cursor-pointer"
                  title="Xóa đơn hàng này"
                  onClick={() => handleDeleteOrder(order.id, order.code)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Settlement Modal */}
      {settleModal.isOpen && settleModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-sm text-foreground">Ghi Nhận Thanh Toán Thủ Công</h3>
                <p className="text-[11px] text-muted-foreground">Đơn #{settleModal.order.code} · {settleModal.order.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSettleModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Financial Overview (For info only - never prefilled as proof of payment) */}
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-background/50 p-3 text-center text-xs">
              <div>
                <span className="text-muted-foreground text-[10px] block">Tổng đơn</span>
                <span className="font-bold text-foreground">{formatPrice(settleModal.order.totalCents)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] block">Đã ghi nhận</span>
                <span className="font-bold text-emerald-400">{formatPrice(settleModal.order.paidAmount || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] block">Còn thiếu</span>
                <span className="font-bold text-amber-400">
                  {formatPrice(Math.max(0, settleModal.order.totalCents - (settleModal.order.paidAmount || 0)))}
                </span>
              </div>
            </div>

            {settleModal.error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {settleModal.error}
              </div>
            )}

            <form onSubmit={handleConfirmSettlement} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Số tiền thực nhận (VNĐ) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  placeholder="Ví dụ: 50000"
                  required
                  min={1000}
                  max={1000000000}
                  value={settleModal.amount}
                  onChange={(e) => setSettleModal((prev) => ({ ...prev, amount: e.target.value }))}
                  className="text-xs font-mono"
                  disabled={settleModal.isSubmitting}
                />
                <span className="text-[10px] text-muted-foreground">
                  Nhập chính xác số tiền khách đã chuyển khoản thực tế.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Lý do / Mã tham chiếu đối soát <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Nhập mã giao dịch ngân hàng hoặc lý do đối soát..."
                  required
                  value={settleModal.reason}
                  onChange={(e) => setSettleModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="text-xs"
                  disabled={settleModal.isSubmitting}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={settleModal.isSubmitting}
                  onClick={() => setSettleModal((prev) => ({ ...prev, isOpen: false }))}
                >
                  Hủy bỏ
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={settleModal.isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {settleModal.isSubmitting ? "Đang xử lý..." : "Xác nhận ghi nhận"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModal.isOpen && cancelModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-sm text-foreground">Xác Nhận Hủy Đơn Hàng</h3>
                <p className="text-[11px] text-muted-foreground">Đơn #{cancelModal.order.code} · {cancelModal.order.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setCancelModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {cancelModal.error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {cancelModal.error}
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Lý do hủy đơn</label>
                <Input
                  type="text"
                  placeholder="Nhập lý do hủy (khách yêu cầu, hết hạn chuyển khoản...)"
                  value={cancelModal.reason}
                  onChange={(e) => setCancelModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="text-xs"
                  disabled={cancelModal.isSubmitting}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={cancelModal.isSubmitting}
                  onClick={() => setCancelModal((prev) => ({ ...prev, isOpen: false }))}
                >
                  Quay lại
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="destructive"
                  disabled={cancelModal.isSubmitting}
                >
                  {cancelModal.isSubmitting ? "Đang xử lý..." : "Xác nhận hủy đơn"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
