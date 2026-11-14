"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Trash2, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  FileText, 
  Lock, 
  X, 
  CheckCircle2,
  Ticket,
  PlusCircle,
  Wallet,
  Check
} from "lucide-react"

export interface ProductOptionVariant {
  id: string
  name: string
  priceCents: number
  availableSerials: number
}

export interface ProductOption {
  id: string
  name: string
  variants: ProductOptionVariant[]
}

export interface PaymentItem {
  id: string
  amount: number
  gateway: string | null
  transactionId?: string | null
  createdAt: string
  content?: string | null
}

export interface OrderItem {
  id: string
  code: string
  email: string
  subtotalCents?: number
  discountCents?: number
  couponCode?: string | null
  couponSnapshot?: string | null
  totalCents: number
  paidAmount?: number
  status: string
  createdAt: string
  paymentGateway: string | null
  note?: string | null
  inviteCode?: string | null
  payments?: PaymentItem[]
  items: Array<{
    name: string
    quantity?: number
    priceCents: number
    serials?: string[]
    serial: string | null
    connectionName?: string | null
    provider?: string | null
    inviteCode?: string | null
    tokenAmountB?: number | null
  }>
}

export function OrderManagerClient({
  orders,
  products = [],
}: {
  orders: OrderItem[]
  products?: ProductOption[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [currentOrders, setCurrentOrders] = useState<OrderItem[]>(orders)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [refreshing, setRefreshing] = useState(false)
  const [cleaningTests, setCleaningTests] = useState(false)

  // Modal State for Manual Order Creation (Bán Ngoài)
  const [createManualModal, setCreateManualModal] = useState<{
    isOpen: boolean
    customerName: string
    customerContact: string
    selectedVariantId: string
    customItemName: string
    quantity: number
    amountVnd: string
    paymentMethod: "bank" | "cash" | "momo" | "zalo"
    note: string
    deductSerial: boolean
    serialContent: string
    isSubmitting: boolean
    error?: string
  }>({
    isOpen: false,
    customerName: "",
    customerContact: "",
    selectedVariantId: "",
    customItemName: "",
    quantity: 1,
    amountVnd: "",
    paymentMethod: "bank",
    note: "",
    deductSerial: false,
    serialContent: "",
    isSubmitting: false,
  })

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

  // Modal State for Order History & Audit
  const [historyOrder, setHistoryOrder] = useState<OrderItem | null>(null)

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

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current) return

    const rawAmount = parseInt(createManualModal.amountVnd.replace(/\D/g, ""), 10)
    if (!rawAmount || rawAmount <= 0) {
      setCreateManualModal((prev) => ({ ...prev, error: "Vui lòng nhập số tiền hợp lệ (> 0đ)" }))
      return
    }

    if (!createManualModal.selectedVariantId && !createManualModal.customItemName.trim()) {
      setCreateManualModal((prev) => ({
        ...prev,
        error: "Vui lòng chọn một gói sản phẩm hoặc nhập tên dịch vụ bán ngoài",
      }))
      return
    }

    isSubmittingRef.current = true
    setCreateManualModal((prev) => ({ ...prev, isSubmitting: true, error: undefined }))

    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: createManualModal.customerName.trim(),
          customerContact: createManualModal.customerContact.trim(),
          variantId: createManualModal.selectedVariantId || null,
          customItemName: createManualModal.customItemName.trim() || null,
          quantity: createManualModal.quantity,
          amountVnd: rawAmount,
          paymentMethod: createManualModal.paymentMethod,
          note: createManualModal.note.trim(),
          deductSerial: createManualModal.deductSerial,
          serialContent: createManualModal.serialContent.trim(),
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Không thể tạo đơn bán ngoài")
      }

      toast({
        title: "Tạo đơn thành công",
        description: json.message || "Đã ghi nhận đơn hàng và cộng vào doanh thu!",
        variant: "default",
      })

      setCreateManualModal({
        isOpen: false,
        customerName: "",
        customerContact: "",
        selectedVariantId: "",
        customItemName: "",
        quantity: 1,
        amountVnd: "",
        paymentMethod: "bank",
        note: "",
        deductSerial: false,
        serialContent: "",
        isSubmitting: false,
      })

      await refreshOrders()
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã có lỗi xảy ra"
      setCreateManualModal((prev) => ({ ...prev, error: msg, isSubmitting: false }))
      toast({ title: "Lỗi tạo đơn", description: msg, variant: "destructive" })
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
            onClick={() => setCreateManualModal((prev) => ({ ...prev, isOpen: true, error: undefined }))}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            title="Ghi nhận đơn bán ngoài (Zalo, Facebook, trực tiếp) để tính vào doanh thu"
          >
            <PlusCircle className="size-3.5" />
            <span>Tạo đơn bán ngoài</span>
          </Button>

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
                  {order.couponCode && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-caramel/15 text-caramel border border-caramel/30 font-mono">
                      <Ticket className="size-3" />
                      {order.couponCode} (-{formatPrice(order.discountCents || 0)})
                    </span>
                  )}
                  <div className="text-right">
                    {order.discountCents && order.discountCents > 0 ? (
                      <span className="text-[10px] text-muted-foreground line-through block tabular-nums">
                        {formatPrice(order.subtotalCents || order.totalCents)}
                      </span>
                    ) : null}
                    <span className="text-sm font-black text-primary tabular-nums">{formatPrice(order.totalCents)}</span>
                  </div>
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
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-foreground">
                          {it.name} {it.quantity && it.quantity > 1 ? `x${it.quantity}` : ""}
                        </span>
                        {(it.connectionName || it.provider) && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Đại lý: {it.connectionName || it.provider}
                          </span>
                        )}
                        {(it.inviteCode || order.inviteCode) && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Mã mời: {it.inviteCode || order.inviteCode}
                          </span>
                        )}
                      </div>
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

                {/* Direct note preview on order card */}
                {order.note && (
                  <div className="pt-2 border-t border-border/30 text-[11px] font-mono text-muted-foreground bg-muted/20 p-2 rounded-lg flex items-start gap-1.5">
                    <span className="text-primary font-bold shrink-0">Note:</span>
                    <span className="break-all">{order.note}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                {/* Status-specific advisory note */}
                {order.status === "paid" ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    <Lock className="size-3.5 text-emerald-400 shrink-0" />
                    <span>Đã thanh toán · Khóa thao tác</span>
                  </div>
                ) : order.status === "cancelled" ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 border border-border/50 px-2.5 py-1 rounded-lg">
                    <AlertCircle className="size-3.5 text-muted-foreground shrink-0" />
                    <span>Đơn đã hủy · Lưu vết lịch sử</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    <Clock className="size-3.5 text-amber-400 shrink-0" />
                    <span>Chờ nhận thanh toán</span>
                  </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {/* Nút Xem Lịch Sử & Chi Tiết (Luôn có cho tất cả các đơn) */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-foreground border-border hover:bg-secondary cursor-pointer flex items-center gap-1.5 h-8 px-2.5"
                    onClick={() => setHistoryOrder(order)}
                    title="Xem chi tiết lịch sử giao dịch và đối soát"
                  >
                    <FileText className="size-3.5 text-primary" />
                    <span>Lịch sử đơn</span>
                  </Button>

                  {/* Nút Duyệt đã TT: CHỈ HIỂN THỊ KHI CHƯA THANH TOÁN */}
                  {(order.status === "pending" || order.status === "partially_paid") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer h-8 px-2.5 font-semibold"
                      onClick={() => openSettleModal(order)}
                    >
                      Duyệt đã TT
                    </Button>
                  )}

                  {/* Nút Hủy đơn: CHỈ HIỂN THỊ KHI CHƯA THANH TOÁN (Tuyệt đối không hủy đơn đã TT) */}
                  {(order.status === "pending" || order.status === "partially_paid") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:bg-destructive/10 cursor-pointer h-8 px-2.5"
                      onClick={() => openCancelModal(order)}
                    >
                      Hủy đơn
                    </Button>
                  )}

                  {/* Nút Xóa đơn: CHỈ CHO PHÉP XÓA ĐƠN CHƯA PAID (Đơn paid bị khóa vĩnh viễn) */}
                  {order.status !== "paid" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-2 cursor-pointer h-8 w-8"
                      title="Xóa đơn hàng này"
                      onClick={() => handleDeleteOrder(order.id, order.code)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
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

      {/* Order History & Audit Trail Modal */}
      {historyOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <span>Lịch Sử Đơn Hàng #{historyOrder.code}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        historyOrder.status === "paid"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : historyOrder.status === "pending"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {historyOrder.status === "paid"
                        ? "Đã thanh toán"
                        : historyOrder.status === "pending"
                        ? "Chờ thanh toán"
                        : "Đã hủy"}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tạo lúc: {new Date(historyOrder.createdAt).toLocaleString("vi-VN")} · Khách: {historyOrder.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOrder(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Immutability Audit Banner for Paid Orders */}
            {historyOrder.status === "paid" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-3 text-xs">
                <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-emerald-300 block">Bảo vệ tính toàn vẹn kiểm toán (Audit Trail)</span>
                  <p className="text-muted-foreground leading-relaxed text-[11.5px]">
                    Đơn hàng đã được xác nhận thanh toán đủ và tài khoản đã được bàn giao đến khách hàng. Theo tiêu chuẩn quản lý thương mại điện tử, đơn hàng này đã chốt sổ và bị <strong>vô hiệu hóa mọi thao tác chỉnh sửa hoặc hủy đơn</strong> nhằm bảo đảm an toàn kế toán và dòng tiền.
                  </p>
                </div>
              </div>
            )}

            {/* Payment Transactions History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Nhật ký thanh toán ({historyOrder.payments?.length || 0} giao dịch)</span>
                <span className="text-primary tabular-nums font-bold text-sm">
                  Tổng nhận: {formatPrice(historyOrder.paidAmount || (historyOrder.status === "paid" ? historyOrder.totalCents : 0))} / {formatPrice(historyOrder.totalCents)}
                </span>
              </h4>

              {historyOrder.payments && historyOrder.payments.length > 0 ? (
                <div className="space-y-2">
                  {historyOrder.payments.map((p, pIdx) => (
                    <div
                      key={p.id || pIdx}
                      className="p-3 rounded-xl border border-border/70 bg-background/60 text-xs space-y-1 font-mono"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-emerald-400">+{formatPrice(p.amount)}</span>
                        <span className="text-muted-foreground text-[11px] font-normal">
                          {new Date(p.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2">
                        <span>Cổng: <strong className="text-foreground">{p.gateway}</strong></span>
                        {p.transactionId && <span>Mã GD: <strong className="text-foreground">{p.transactionId}</strong></span>}
                      </div>
                      {p.content && (
                        <div className="text-[11px] text-muted-foreground/90 break-all bg-secondary/40 p-1.5 rounded">
                          Nội dung: {p.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-border/50 bg-background/40 text-xs text-muted-foreground text-center">
                  {historyOrder.status === "paid"
                    ? "Đơn đã ghi nhận thanh toán đầy đủ."
                    : "Chưa ghi nhận biến động giao dịch nào."}
                </div>
              )}
            </div>

            {/* Delivered Items & Credentials */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Sản phẩm &amp; Tài khoản bàn giao
              </h4>
              <div className="space-y-2.5">
                {historyOrder.items.map((it, idx) => {
                  const serialList =
                    it.serials && it.serials.length > 0
                      ? it.serials
                      : it.serial
                      ? it.serial.split("\n").filter(Boolean)
                      : []

                  return (
                    <div key={idx} className="p-3.5 rounded-xl border border-border/80 bg-background/50 space-y-2 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-bold text-foreground">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{it.name} {it.quantity && it.quantity > 1 ? `x${it.quantity}` : ""}</span>
                          {(it.connectionName || it.provider) && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              Đại lý: {it.connectionName || it.provider}
                            </span>
                          )}
                        </div>
                        <span className="text-primary tabular-nums font-bold">{formatPrice(it.priceCents)}</span>
                      </div>

                      {serialList.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] text-muted-foreground font-semibold block">Tài khoản / Key đã xuất:</span>
                          {serialList.map((s, sIdx) => (
                            <div
                              key={sIdx}
                              className="font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg break-all select-all flex items-center justify-between"
                            >
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-400 text-[11px] italic">Chưa bàn giao tài khoản</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Invite Code Highlight Box if present */}
            {(historyOrder.inviteCode || historyOrder.items.some((it) => it.inviteCode)) && (
              <div className="space-y-1.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Mã Mời (Invite Code Muse AI)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const code = historyOrder.inviteCode || historyOrder.items.find((it) => it.inviteCode)?.inviteCode || ""
                      if (code) {
                        navigator.clipboard.writeText(code)
                        toast({ title: "Đã sao chép mã mời!", description: code })
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Sao chép mã
                  </button>
                </div>
                <p className="font-mono text-base font-extrabold text-amber-300 tracking-wider">
                  {historyOrder.inviteCode || historyOrder.items.find((it) => it.inviteCode)?.inviteCode}
                </p>
              </div>
            )}

            {/* System Note */}
            {historyOrder.note && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ghi chú hệ thống &amp; Đại lý</h4>
                <div className="p-2.5 rounded-lg border border-border bg-secondary/30 text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
                  {historyOrder.note}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
              <a
                href={`/order/${historyOrder.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-semibold"
              >
                Mở trang khách đối soát <ExternalLink className="size-3" />
              </a>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHistoryOrder(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TẠO ĐƠN BÁN NGOÀI (THỦ CÔNG) */}
      {createManualModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-200">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Wallet className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Ghi Nhận Đơn Bán Ngoài</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Tạo đơn thành công &amp; cộng trực tiếp vào Tổng Doanh Thu Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateManualModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualOrder} className="space-y-4">
              {createManualModal.error && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{createManualModal.error}</span>
                </div>
              )}

              {/* Thông tin khách hàng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Tên khách / Người mua</label>
                  <Input
                    placeholder="VD: Anh Nam Zalo..."
                    value={createManualModal.customerName}
                    onChange={(e) => setCreateManualModal((p) => ({ ...p, customerName: e.target.value }))}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">SĐT / Zalo / Email liên hệ</label>
                  <Input
                    placeholder="VD: 0987654321 hoặc zalo"
                    value={createManualModal.customerContact}
                    onChange={(e) => setCreateManualModal((p) => ({ ...p, customerContact: e.target.value }))}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Chọn gói sản phẩm có sẵn hoặc tự nhập */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Chọn sản phẩm trong kho (Tùy chọn)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Tự điền giá bán khi chọn</span>
                </label>
                <select
                  value={createManualModal.selectedVariantId}
                  onChange={(e) => {
                    const vId = e.target.value
                    if (!vId) {
                      setCreateManualModal((p) => ({
                        ...p,
                        selectedVariantId: "",
                        deductSerial: false,
                      }))
                      return
                    }
                    let foundName = ""
                    let foundPrice = 0
                    for (const p of products) {
                      const v = p.variants.find((x) => x.id === vId)
                      if (v) {
                        foundName = `${p.name} (${v.name})`
                        foundPrice = v.priceCents
                        break
                      }
                    }
                    setCreateManualModal((p) => ({
                      ...p,
                      selectedVariantId: vId,
                      customItemName: foundName,
                      amountVnd: foundPrice > 0 ? (foundPrice * p.quantity).toLocaleString("vi-VN") : p.amountVnd,
                    }))
                  }}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Tự nhập tên &amp; giá tự do bên dưới --</option>
                  {products.map((p) => (
                    <optgroup key={p.id} label={p.name}>
                      {p.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} — {v.priceCents.toLocaleString("vi-VN")}đ {v.availableSerials > 0 ? `(Kho sẵn: ${v.availableSerials})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Tên dịch vụ hiển thị */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Tên gói / Dịch vụ bán ngoài <span className="text-rose-400">*</span>
                </label>
                <Input
                  placeholder="VD: Canva Pro 1 Năm hoặc Buff 10B Token..."
                  value={createManualModal.customItemName}
                  onChange={(e) => setCreateManualModal((p) => ({ ...p, customItemName: e.target.value }))}
                  required
                  className="text-xs"
                />
              </div>

              {/* Số lượng & Số tiền thực thu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Số lượng</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={createManualModal.quantity}
                    onChange={(e) => {
                      const q = Math.max(1, parseInt(e.target.value, 10) || 1)
                      setCreateManualModal((p) => ({ ...p, quantity: q }))
                    }}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Số tiền thực thu (VND) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="VD: 50.000"
                      value={createManualModal.amountVnd}
                      onChange={(e) => {
                        const num = e.target.value.replace(/\D/g, "")
                        setCreateManualModal((p) => ({
                          ...p,
                          amountVnd: num ? parseInt(num, 10).toLocaleString("vi-VN") : "",
                        }))
                      }}
                      required
                      className="text-xs font-bold text-emerald-400 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      đ
                    </span>
                  </div>
                </div>
              </div>

              {/* Hình thức thanh toán */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Hình thức thanh toán thực tế</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "bank", label: "Chuyển khoản" },
                    { id: "cash", label: "Tiền mặt" },
                    { id: "momo", label: "Momo / Ví" },
                    { id: "zalo", label: "ZaloPay" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCreateManualModal((p) => ({ ...p, paymentMethod: m.id as any }))}
                      className={`p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        createManualModal.paymentMethod === m.id
                          ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                          : "border-border bg-background hover:bg-secondary text-muted-foreground"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tùy chọn trừ kho serials */}
              {createManualModal.selectedVariantId && (
                <div className="p-3 rounded-xl border border-border/80 bg-secondary/20 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      checked={createManualModal.deductSerial}
                      onChange={(e) =>
                        setCreateManualModal((p) => ({ ...p, deductSerial: e.target.checked }))
                      }
                      className="size-4 rounded text-primary focus:ring-primary cursor-pointer"
                    />
                    <span>Tự động xuất &amp; trừ 1 serial có sẵn trong kho của gói này</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Nếu bạn đã gửi tài khoản cho khách ngoài chat và không muốn trừ kho trên web, hãy bỏ tick ô này.
                  </p>
                </div>
              )}

              {/* Tùy chọn lưu tài khoản đã cấp cho khách để lưu vết */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Thông tin tài khoản / Serial đã gửi cho khách (Tùy chọn)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Lưu vết để bảo hành</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="VD: user@email.com|pass123 hoặc Mã mời Muse: 0FBALX..."
                  value={createManualModal.serialContent}
                  onChange={(e) => setCreateManualModal((p) => ({ ...p, serialContent: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Ghi chú thêm */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Ghi chú đối soát</label>
                <Input
                  placeholder="VD: Bán qua Zalo cá nhân, đã nhận tiền vào Techcombank..."
                  value={createManualModal.note}
                  onChange={(e) => setCreateManualModal((p) => ({ ...p, note: e.target.value }))}
                  className="text-xs"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={createManualModal.isSubmitting}
                  onClick={() => setCreateManualModal((prev) => ({ ...prev, isOpen: false }))}
                  className="text-xs cursor-pointer"
                >
                  Hủy bỏ
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={createManualModal.isSubmitting}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {createManualModal.isSubmitting ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      <span>Xác nhận &amp; Cộng doanh thu</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
