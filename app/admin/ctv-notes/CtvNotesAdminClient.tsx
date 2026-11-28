"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ClipboardList,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Pencil,
  Trash2,
  ExternalLink,
  AlertCircle,
  X,
  MessageCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { formatPrice } from "@/lib/utils"
import type { CtvOrderNoteDto } from "@/lib/ctv-notes"

function getLocalDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const parts = dateKey.split("-").map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return getLocalDateKey()
  }
  return getLocalDateKey(new Date(parts[0], parts[1] - 1, parts[2] + deltaDays))
}

function formatDateVi(dateKey: string): string {
  return dateKey.split("-").reverse().join("/")
}

export function CtvNotesAdminClient({ initialItems }: { initialItems: CtvOrderNoteDto[] }) {
  const router = useRouter()
  const { toast } = useToast()

  const todayKey = getLocalDateKey()
  const yesterdayKey = shiftDateKey(todayKey, -1)

  const [items, setItems] = useState<CtvOrderNoteDto[]>(initialItems)
  const [selectedDate, setSelectedDate] = useState<string>(todayKey)
  const [showAllDates, setShowAllDates] = useState<boolean>(false)
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "settled">("all")
  const [search, setSearch] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Create / Edit Modal
  const [formModal, setFormModal] = useState<{
    isOpen: boolean
    mode: "create" | "edit"
    targetId?: string
    noteDate: string
    customerName: string
    content: string
    amountInput: string
    note: string
    status: "pending" | "settled"
    isSubmitting: boolean
    error?: string
  }>({
    isOpen: false,
    mode: "create",
    noteDate: todayKey,
    customerName: "",
    content: "",
    amountInput: "",
    note: "",
    status: "pending",
    isSubmitting: false,
  })

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<CtvOrderNoteDto | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Bulk Day Settle / Unsettle Confirmation Modal
  const [bulkModal, setBulkModal] = useState<{
    action: "settle_date" | "unsettle_date"
    dateKey: string
    count: number
    amount: number
    isSubmitting: boolean
  } | null>(null)

  const refreshItems = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/admin/ctv-notes?t=${Date.now()}`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        setItems(json.items || [])
        toast({
          title: "Đã đồng bộ sổ CTV",
          description: `Hiện có ${json.items?.length || 0} bản ghi.`,
        })
      } else {
        toast({
          title: "Lỗi đồng bộ",
          description: json.error || "Không thể tải danh sách",
          variant: "destructive",
        })
      }
    } catch {
      toast({ title: "Lỗi kết nối máy chủ", variant: "destructive" })
    } finally {
      setRefreshing(false)
    }
  }

  const stats = useMemo(() => {
    const dayItems = items.filter((i) => i.noteDate === selectedDate)
    const dayPendingItems = dayItems.filter((i) => i.status === "pending")
    const daySettledItems = dayItems.filter((i) => i.status === "settled")
    const allPendingItems = items.filter((i) => i.status === "pending")

    return {
      dayCount: dayItems.length,
      dayTotal: dayItems.reduce((s, i) => s + i.amount, 0),
      dayPendingCount: dayPendingItems.length,
      dayPendingTotal: dayPendingItems.reduce((s, i) => s + i.amount, 0),
      daySettledCount: daySettledItems.length,
      daySettledTotal: daySettledItems.reduce((s, i) => s + i.amount, 0),
      allPendingCount: allPendingItems.length,
      allPendingTotal: allPendingItems.reduce((s, i) => s + i.amount, 0),
    }
  }, [items, selectedDate])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => {
      if (!showAllDates && i.noteDate !== selectedDate) return false
      if (statusFilter !== "all" && i.status !== statusFilter) return false
      if (q) {
        const hay = `${i.customerName} ${i.content} ${i.note || ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, showAllDates, selectedDate, statusFilter, search])

  const openCreateModal = () => {
    setFormModal({
      isOpen: true,
      mode: "create",
      noteDate: selectedDate,
      customerName: "",
      content: "",
      amountInput: "",
      note: "",
      status: "pending",
      isSubmitting: false,
    })
  }

  const openEditModal = (item: CtvOrderNoteDto) => {
    setFormModal({
      isOpen: true,
      mode: "edit",
      targetId: item.id,
      noteDate: item.noteDate,
      customerName: item.customerName,
      content: item.content,
      amountInput: item.amount.toLocaleString("vi-VN"),
      note: item.note || "",
      status: item.status,
      isSubmitting: false,
    })
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formModal.isSubmitting) return

    const rawAmount = parseInt(formModal.amountInput.replace(/\D/g, ""), 10)
    if (!formModal.customerName.trim() || !formModal.content.trim() || !rawAmount || rawAmount <= 0) {
      setFormModal((p) => ({
        ...p,
        error: "Vui lòng nhập đầy đủ Tên khách, Nội dung đơn và Số tiền (> 0đ)",
      }))
      return
    }

    setFormModal((p) => ({ ...p, isSubmitting: true, error: undefined }))

    try {
      const isEdit = formModal.mode === "edit" && formModal.targetId
      const url = isEdit
        ? `/api/admin/ctv-notes/${formModal.targetId}`
        : "/api/admin/ctv-notes"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteDate: formModal.noteDate,
          customerName: formModal.customerName.trim(),
          content: formModal.content.trim(),
          amount: rawAmount,
          note: formModal.note.trim() || null,
          status: formModal.status,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setFormModal((p) => ({
          ...p,
          isSubmitting: false,
          error: json.error || "Lưu thất bại",
        }))
        return
      }

      if (isEdit) {
        setItems((prev) => prev.map((x) => (x.id === formModal.targetId ? json.item : x)))
        toast({ title: "Đã cập nhật ghi chú CTV" })
      } else {
        setItems((prev) => [json.item, ...prev])
        setSelectedDate(json.item.noteDate)
        toast({
          title: "Đã thêm ghi chú CTV",
          description: `${json.item.customerName} — ${formatPrice(json.item.amount)}`,
        })
      }

      setFormModal((p) => ({ ...p, isOpen: false, isSubmitting: false }))
      router.refresh()
    } catch {
      setFormModal((p) => ({
        ...p,
        isSubmitting: false,
        error: "Lỗi kết nối máy chủ",
      }))
    }
  }

  const handleToggleItemStatus = async (item: CtvOrderNoteDto) => {
    if (togglingId) return
    const nextStatus = item.status === "settled" ? "pending" : "settled"
    setTogglingId(item.id)

    try {
      const res = await fetch(`/api/admin/ctv-notes/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          status: nextStatus,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        setItems((prev) => prev.map((x) => (x.id === item.id ? json.item : x)))
        toast({
          title:
            nextStatus === "settled"
              ? "✓ Đã chốt đối soát đơn CTV"
              : "Đã chuyển lại Chờ đối soát",
          description: `${item.customerName} (${formatPrice(item.amount)})`,
        })
        router.refresh()
      } else {
        toast({
          title: "Lỗi cập nhật",
          description: json.error || "Không thể đổi trạng thái",
          variant: "destructive",
        })
      }
    } catch {
      toast({ title: "Lỗi kết nối máy chủ", variant: "destructive" })
    } finally {
      setTogglingId(null)
    }
  }

  const handleConfirmBulkAction = async () => {
    if (!bulkModal || bulkModal.isSubmitting) return
    setBulkModal((p) => (p ? { ...p, isSubmitting: true } : null))

    try {
      const res = await fetch("/api/admin/ctv-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkModal.action,
          noteDate: bulkModal.dateKey,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        const targetStatus = bulkModal.action === "settle_date" ? "settled" : "pending"
        setItems((prev) =>
          prev.map((x) =>
            x.noteDate === bulkModal.dateKey
              ? {
                  ...x,
                  status: targetStatus,
                  settledAt: json.settledAt ?? null,
                }
              : x
          )
        )
        toast({
          title: "Thành công",
          description: json.message,
        })
        setBulkModal(null)
        router.refresh()
      } else {
        toast({
          title: "Lỗi",
          description: json.error || "Thao tác thất bại",
          variant: "destructive",
        })
        setBulkModal((p) => (p ? { ...p, isSubmitting: false } : null))
      }
    } catch {
      toast({ title: "Lỗi kết nối máy chủ", variant: "destructive" })
      setBulkModal((p) => (p ? { ...p, isSubmitting: false } : null))
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/ctv-notes/${deleteTarget.id}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id))
        toast({
          title: "Đã xóa ghi chú CTV",
          description: `${deleteTarget.customerName} (${formatPrice(deleteTarget.amount)})`,
        })
        setDeleteTarget(null)
        router.refresh()
      } else {
        toast({
          title: "Lỗi xóa",
          description: json.error || "Không thể xóa dòng ghi chú",
          variant: "destructive",
        })
      }
    } catch {
      toast({ title: "Lỗi kết nối máy chủ", variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            <span>Sổ Đối Chiếu Đơn CTV</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi các đơn CTV ghi nhận ngoài web và đối soát tiền CTV chuyển về cuối ngày (sổ độc lập, không cộng vào doanh thu chính).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new Event("capygo-open-ktv-chat"))}
            className="h-9 px-3.5 text-xs font-semibold gap-1.5 cursor-pointer"
          >
            <MessageCircle className="size-3.5 text-primary" />
            <span>Chat với KTV</span>
          </Button>

          <Link
            href="/ktv"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-semibold text-foreground transition-btn"
          >
            <span>Mở cổng CTV (/ktv)</span>
            <ExternalLink className="size-3.5 text-primary" />
          </Link>
        </div>
      </div>

      {/* Date Strip & Daily Summary Cards */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex flex-wrap items-center gap-1.5">
            <Calendar className="size-4 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground mr-0.5">Đối soát ngày:</span>

            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDateKey(d, -1))}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-btn cursor-pointer"
              title="Lùi về ngày trước"
            >
              <ChevronLeft className="size-4" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || todayKey)}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:border-primary"
            />

            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDateKey(d, 1))}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-btn cursor-pointer"
              title="Tiến tới ngày sau"
            >
              <ChevronRight className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(yesterdayKey)}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-btn cursor-pointer ${
                selectedDate === yesterdayKey
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                  : "bg-background text-muted-foreground hover:text-foreground border-border"
              }`}
            >
              Hôm qua ({yesterdayKey.slice(8, 10)}/{yesterdayKey.slice(5, 7)})
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(todayKey)}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-btn cursor-pointer ${
                selectedDate === todayKey
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  : "bg-background text-muted-foreground hover:text-foreground border-border"
              }`}
            >
              Hôm nay
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stats.dayPendingCount > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  setBulkModal({
                    action: "settle_date",
                    dateKey: selectedDate,
                    count: stats.dayPendingCount,
                    amount: stats.dayPendingTotal,
                    isSubmitting: false,
                  })
                }
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="size-3.5" />
                <span>
                  Chốt nhận đủ ngày {formatDateVi(selectedDate)} ({formatPrice(stats.dayPendingTotal)})
                </span>
              </Button>
            )}

            {stats.daySettledCount > 0 && stats.dayPendingCount === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setBulkModal({
                    action: "unsettle_date",
                    dateKey: selectedDate,
                    count: stats.daySettledCount,
                    amount: stats.daySettledTotal,
                    isSubmitting: false,
                  })
                }
                className="h-8 text-xs gap-1.5 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Hoàn tác chốt ngày {formatDateVi(selectedDate)}</span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-border bg-background/60">
            <span className="text-muted-foreground block">
              Tổng CTV ghi ngày {formatDateVi(selectedDate)} ({stats.dayCount} đơn)
            </span>
            <strong className="text-base font-bold text-foreground tabular-nums mt-0.5 block">
              {formatPrice(stats.dayTotal)}
            </strong>
          </div>

          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <span className="text-amber-300/90 block">
              Chờ CTV chuyển ({stats.dayPendingCount} đơn)
            </span>
            <strong className="text-base font-bold text-amber-300 tabular-nums mt-0.5 block">
              {formatPrice(stats.dayPendingTotal)}
            </strong>
          </div>

          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
            <span className="text-emerald-300/90 block">
              Đã nhận từ CTV ({stats.daySettledCount} đơn)
            </span>
            <strong className="text-base font-bold text-emerald-400 tabular-nums mt-0.5 block">
              {formatPrice(stats.daySettledTotal)}
            </strong>
          </div>

          <div className="p-3 rounded-xl border border-border bg-background/60">
            <span className="text-muted-foreground block">
              Tổng tồn chưa đối soát ({stats.allPendingCount} đơn)
            </span>
            <strong className="text-base font-bold text-primary tabular-nums mt-0.5 block">
              {formatPrice(stats.allPendingTotal)}
            </strong>
          </div>
        </div>
      </div>

      {/* Filters & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên khách, nội dung đơn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 text-xs"
            />
          </div>

          <Button
            size="sm"
            onClick={openCreateModal}
            className="text-xs bg-primary hover:bg-caramel-light text-primary-foreground gap-1.5 cursor-pointer"
          >
            <PlusCircle className="size-3.5" />
            <span>Thêm dòng ghi chú</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={refreshItems}
            className="text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Đang tải..." : "Đồng bộ"}</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowAllDates((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              showAllDates
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                : "bg-card text-muted-foreground hover:text-foreground border-border"
            }`}
          >
            {showAllDates ? `Tất cả ngày (${items.length})` : `Chỉ ngày ${formatDateVi(selectedDate)}`}
          </button>

          {(
            [
              { id: "all", label: "Tất cả" },
              { id: "pending", label: "Chờ đối soát" },
              { id: "settled", label: "Đã đối soát" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === f.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card/60 text-muted-foreground hover:text-foreground border border-border/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            Chưa có dòng ghi chú CTV nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Ngày</th>
                  <th className="py-3 px-4 font-semibold">Tên khách</th>
                  <th className="py-3 px-4 font-semibold">Nội dung đơn &amp; Ghi chú</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Số tiền</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Trạng thái</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item) => {
                  const isSettled = item.status === "settled"
                  return (
                    <tr key={item.id} className="hover:bg-secondary/25">
                      <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                        {formatDateVi(item.noteDate)}
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                        {item.customerName}
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-medium text-foreground break-words">{item.content}</div>
                        {item.note && (
                          <div className="text-[11px] text-muted-foreground italic mt-0.5 break-words">
                            Note: {item.note}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-black tabular-nums text-primary whitespace-nowrap">
                        {formatPrice(item.amount)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="size-3" />
                            Đã đối soát
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Clock className="size-3" />
                            Chờ đối soát
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={togglingId === item.id}
                            onClick={() => handleToggleItemStatus(item)}
                            className={`h-8 px-2.5 text-[11px] font-semibold cursor-pointer ${
                              isSettled
                                ? "text-muted-foreground hover:text-foreground"
                                : "text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/10"
                            }`}
                          >
                            {isSettled ? "Hoàn tác" : "✓ Đã nhận tiền"}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(item)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Sửa dòng ghi chú"
                          >
                            <Pencil className="size-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(item)}
                            className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            title="Xóa dòng ghi chú"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Thêm / Sửa ghi chú CTV */}
      {formModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-foreground">
                {formModal.mode === "edit" ? "Chỉnh Sửa Ghi Chú Đơn CTV" : "Thêm Ghi Chú Đơn CTV"}
              </h2>
              <button
                type="button"
                onClick={() => setFormModal((p) => ({ ...p, isOpen: false }))}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-3.5 text-xs">
              {formModal.error && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{formModal.error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">Ngày ghi nhận *</label>
                  <Input
                    type="date"
                    required
                    value={formModal.noteDate}
                    onChange={(e) =>
                      setFormModal((p) => ({ ...p, noteDate: e.target.value || todayKey }))
                    }
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">Trạng thái đối soát</label>
                  <select
                    value={formModal.status}
                    onChange={(e) =>
                      setFormModal((p) => ({
                        ...p,
                        status: e.target.value === "settled" ? "settled" : "pending",
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none"
                  >
                    <option value="pending">Chờ đối soát</option>
                    <option value="settled">Đã đối soát (Đã nhận tiền)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground block">Tên khách *</label>
                <Input
                  placeholder="VD: Anh Nam Zalo..."
                  required
                  value={formModal.customerName}
                  onChange={(e) => setFormModal((p) => ({ ...p, customerName: e.target.value }))}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground block">Nội dung đơn *</label>
                <Input
                  placeholder="VD: Buff 10B Muse / Canva Pro 1 năm..."
                  required
                  value={formModal.content}
                  onChange={(e) => setFormModal((p) => ({ ...p, content: e.target.value }))}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground block">Số tiền (VNĐ) *</label>
                <Input
                  placeholder="VD: 35.000"
                  required
                  value={formModal.amountInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "")
                    setFormModal((p) => ({
                      ...p,
                      amountInput: digits ? parseInt(digits, 10).toLocaleString("vi-VN") : "",
                    }))
                  }}
                  className="text-xs h-9 font-bold text-emerald-400 tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground block">Ghi chú thêm</label>
                <Input
                  placeholder="VD: Đã CK Techcombank..."
                  value={formModal.note}
                  onChange={(e) => setFormModal((p) => ({ ...p, note: e.target.value }))}
                  className="text-xs h-9"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={formModal.isSubmitting}
                  onClick={() => setFormModal((p) => ({ ...p, isOpen: false }))}
                  className="text-xs cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={formModal.isSubmitting}
                  className="text-xs bg-primary text-primary-foreground hover:bg-caramel-light cursor-pointer"
                >
                  {formModal.isSubmitting ? "Đang lưu..." : "Lưu ghi chú"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận Chốt / Hoàn tác toàn bộ ngày */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-foreground">
                {bulkModal.action === "settle_date"
                  ? `Xác Nhận Đã Nhận Đủ Tiền Ngày ${formatDateVi(bulkModal.dateKey)}`
                  : `Hoàn Tác Đối Soát Ngày ${formatDateVi(bulkModal.dateKey)}`}
              </h2>
              <button
                type="button"
                onClick={() => setBulkModal(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl border border-border bg-background/60 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ngày đối soát:</span>
                  <strong className="font-mono text-foreground">{formatDateVi(bulkModal.dateKey)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Số lượng đơn:</span>
                  <strong className="text-foreground">{bulkModal.count} đơn</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Tổng số tiền:</span>
                  <strong className="text-sm font-black text-emerald-400 tabular-nums">
                    {formatPrice(bulkModal.amount)}
                  </strong>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                {bulkModal.action === "settle_date"
                  ? "Sau khi chốt, toàn bộ đơn chờ của ngày này sẽ chuyển sang Đã đối soát và khóa chỉnh sửa phía CTV."
                  : "Các đơn trong ngày này sẽ quay về trạng thái Chờ đối soát."}
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bulkModal.isSubmitting}
                  onClick={() => setBulkModal(null)}
                  className="text-xs cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={bulkModal.isSubmitting}
                  onClick={handleConfirmBulkAction}
                  className={`text-xs font-bold cursor-pointer ${
                    bulkModal.action === "settle_date"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-amber-500 hover:bg-amber-400 text-black"
                  }`}
                >
                  {bulkModal.isSubmitting ? "Đang xử lý..." : "Xác nhận"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa dòng ghi chú CTV */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-rose-500/10">
              <div className="flex items-center gap-2">
                <Trash2 className="size-4 text-rose-400" />
                <h2 className="text-sm font-bold text-rose-200">Xác Nhận Xóa Ghi Chú CTV</h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl border border-border bg-background/60 space-y-1.5">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Khách hàng:</span>
                  <strong className="text-foreground">{deleteTarget.customerName}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Nội dung:</span>
                  <span className="text-foreground text-right">{deleteTarget.content}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Ngày ghi:</span>
                  <span className="font-mono text-foreground">{formatDateVi(deleteTarget.noteDate)}</span>
                </div>
                <div className="flex justify-between gap-2 pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Số tiền:</span>
                  <strong className="text-sm font-bold text-rose-400 tabular-nums">
                    {formatPrice(deleteTarget.amount)}
                  </strong>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Thao tác này sẽ xóa vĩnh viễn dòng ghi chú khỏi Sổ đối chiếu CTV. Bạn chắc chắn muốn xóa?
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="text-xs cursor-pointer"
                >
                  Giữ lại
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="text-xs font-bold cursor-pointer"
                >
                  {isDeleting ? "Đang xóa..." : "Xác nhận xóa vĩnh viễn"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
