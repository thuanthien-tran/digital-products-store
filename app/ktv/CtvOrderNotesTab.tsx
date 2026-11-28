"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Pencil,
  Trash2,
  Lock,
  CheckCircle2,
  Clock,
  RotateCw,
  AlertCircle,
  X,
  Check,
  FileText,
} from "lucide-react"
import type { ThemeConfig } from "@/lib/ktv"
import type { CtvOrderNoteDto } from "@/lib/ctv-notes"
import { ensureAudioUnlocked, playNotificationSound } from "@/lib/sound-notify"

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

function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`
}

function formatTimeHmS(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return ""
  }
}

function formatTimeAndDay(iso: string): string {
  try {
    const d = new Date(iso)
    const t = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    const day = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
    return `${t} · ${day}`
  } catch {
    return ""
  }
}

interface CtvOrderNotesTabProps {
  activeTheme: ThemeConfig
  onSessionExpired: () => void
}

export function CtvOrderNotesTab({ activeTheme, onSessionExpired }: CtvOrderNotesTabProps) {
  const todayKey = getLocalDateKey()
  const yesterdayKey = shiftDateKey(todayKey, -1)

  const [items, setItems] = useState<CtvOrderNoteDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(todayKey)
  const [showAllDates, setShowAllDates] = useState<boolean>(false)

  // Create form state
  const [noteDate, setNoteDate] = useState<string>(todayKey)
  const [customerName, setCustomerName] = useState("")
  const [content, setContent] = useState("")
  const [amountInput, setAmountInput] = useState("")
  const [extraNote, setExtraNote] = useState("")
  const [submittingCreate, setSubmittingCreate] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  const changeSelectedDate = (nextDate: string) => {
    setSelectedDate(nextDate)
    setNoteDate(nextDate)
  }

  // Edit modal state
  const [editingItem, setEditingItem] = useState<CtvOrderNoteDto | null>(null)
  const [editDate, setEditDate] = useState("")
  const [editCustomer, setEditCustomer] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editNote, setEditNote] = useState("")
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete confirmation modal state
  const [deletingTarget, setDeletingTarget] = useState<CtvOrderNoteDto | null>(null)
  const [submittingDelete, setSubmittingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const statusMapRef = useRef<Map<string, string> | null>(null)

  const syncNotesSnapshot = useCallback((nextItems: CtvOrderNoteDto[]) => {
    const prevMap = statusMapRef.current
    if (prevMap) {
      let newlySettledCustomer: string | null = null
      for (const item of nextItems) {
        if (prevMap.get(item.id) === "pending" && item.status === "settled") {
          newlySettledCustomer = item.customerName
          break
        }
      }
      if (newlySettledCustomer) {
        playNotificationSound("ktv_chat")
        setSuccessBanner(`Admin vừa xác nhận đã nhận tiền đơn "${newlySettledCustomer}"`)
        setTimeout(() => setSuccessBanner(null), 5000)
      }
    }
    const nextMap = new Map<string, string>()
    for (const it of nextItems) {
      nextMap.set(it.id, it.status)
    }
    statusMapRef.current = nextMap
    setItems(nextItems)
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/ctv/notes?t=${Date.now()}`, { cache: "no-store" })
      if (res.status === 401) {
        onSessionExpired()
        return
      }
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        syncNotesSnapshot(json.items || [])
      }
    } catch {
      // Ignore transient network glitches
    } finally {
      setRefreshing(false)
    }
  }, [onSessionExpired, syncNotesSnapshot])

  useEffect(() => {
    ensureAudioUnlocked()
    let cancelled = false
    const runFetch = async () => {
      try {
        const res = await fetch(`/api/ctv/notes?t=${Date.now()}`, { cache: "no-store" })
        if (cancelled) return
        if (res.status === 401) {
          onSessionExpired()
          return
        }
        const json = await res.json().catch(() => ({}))
        if (!cancelled && res.ok && json.success) {
          syncNotesSnapshot(json.items || [])
        }
      } catch {
        // Ignore transient network glitches
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void runFetch()
    const timer = setInterval(() => {
      void runFetch()
    }, 10000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [onSessionExpired, syncNotesSnapshot])

  const summary = useMemo(() => {
    const dayItems = items.filter((i) => i.noteDate === selectedDate)
    const dayTotal = dayItems.reduce((s, i) => s + i.amount, 0)
    const dayPending = dayItems
      .filter((i) => i.status === "pending")
      .reduce((s, i) => s + i.amount, 0)
    const daySettled = dayItems
      .filter((i) => i.status === "settled")
      .reduce((s, i) => s + i.amount, 0)
    const otherDaysPending = items
      .filter((i) => i.noteDate !== selectedDate && i.status === "pending")
      .reduce((s, i) => s + i.amount, 0)

    return {
      dayCount: dayItems.length,
      dayTotal,
      dayPending,
      daySettled,
      otherDaysPending,
    }
  }, [items, selectedDate])

  const displayedItems = useMemo(() => {
    if (showAllDates) return items
    return items.filter((i) => i.noteDate === selectedDate)
  }, [items, selectedDate, showAllDates])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingCreate) return

    const rawNum = parseInt(amountInput.replace(/\D/g, ""), 10)
    if (!customerName.trim()) {
      setFormError("Vui lòng nhập Tên khách hàng")
      return
    }
    if (!content.trim()) {
      setFormError("Vui lòng nhập Nội dung đơn hàng")
      return
    }
    if (!rawNum || rawNum <= 0) {
      setFormError("Vui lòng nhập Số tiền hợp lệ (> 0đ)")
      return
    }

    setSubmittingCreate(true)
    setFormError(null)
    setSuccessBanner(null)

    try {
      const res = await fetch("/api/ctv/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteDate,
          customerName: customerName.trim(),
          content: content.trim(),
          amount: rawNum,
          note: extraNote.trim() || null,
        }),
      })

      if (res.status === 401) {
        onSessionExpired()
        return
      }

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setFormError(json.error || "Không thể lưu đơn ghi chú")
        return
      }

      setItems((prev) => {
        const next = [json.item, ...prev]
        const nextMap = new Map<string, string>()
        for (const it of next) nextMap.set(it.id, it.status)
        statusMapRef.current = nextMap
        return next
      })
      playNotificationSound("ktv_chat")
      changeSelectedDate(json.item.noteDate)
      setCustomerName("")
      setContent("")
      setAmountInput("")
      setExtraNote("")
      setSuccessBanner(
        `Đã ghi nhận đơn khách "${json.item.customerName}" (${formatVnd(json.item.amount)}) vào ngày ${formatDateVi(json.item.noteDate)}`
      )
      setTimeout(() => setSuccessBanner(null), 4000)
    } catch {
      setFormError("Lỗi kết nối máy chủ, vui lòng thử lại")
    } finally {
      setSubmittingCreate(false)
    }
  }

  const openEdit = (item: CtvOrderNoteDto) => {
    setEditingItem(item)
    setEditDate(item.noteDate)
    setEditCustomer(item.customerName)
    setEditContent(item.content)
    setEditAmount(item.amount.toLocaleString("vi-VN"))
    setEditNote(item.note || "")
    setEditError(null)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem || submittingEdit) return

    const rawNum = parseInt(editAmount.replace(/\D/g, ""), 10)
    if (!editCustomer.trim() || !editContent.trim() || !rawNum || rawNum <= 0) {
      setEditError("Vui lòng điền đầy đủ Tên khách, Nội dung và Số tiền (> 0đ)")
      return
    }

    setSubmittingEdit(true)
    setEditError(null)

    try {
      const res = await fetch(`/api/ctv/notes/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteDate: editDate,
          customerName: editCustomer.trim(),
          content: editContent.trim(),
          amount: rawNum,
          note: editNote.trim() || null,
        }),
      })

      if (res.status === 401) {
        onSessionExpired()
        return
      }

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setEditError(json.error || "Cập nhật thất bại")
        return
      }

      setItems((prev) => prev.map((x) => (x.id === editingItem.id ? json.item : x)))
      setEditingItem(null)
    } catch {
      setEditError("Lỗi kết nối máy chủ")
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingTarget || submittingDelete) return
    setSubmittingDelete(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/ctv/notes/${deletingTarget.id}`, {
        method: "DELETE",
      })
      if (res.status === 401) {
        onSessionExpired()
        return
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setDeleteError(json.error || "Không thể xóa dòng ghi chú")
        return
      }
      setItems((prev) => prev.filter((x) => x.id !== deletingTarget.id))
      setDeletingTarget(null)
    } catch {
      setDeleteError("Lỗi kết nối máy chủ")
    } finally {
      setSubmittingDelete(false)
    }
  }

  const accent = activeTheme.accentColor || "#E6A66F"

  return (
    <div className="space-y-4">
      {/* Date Navigation & Daily Reconciliation Summary */}
      <div
        className="rounded-2xl border backdrop-blur-xl p-4 sm:p-5 shadow-xl space-y-3.5"
        style={{
          backgroundColor: `${activeTheme.containerBg}ea`,
          borderColor: `${accent}33`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <Calendar className="size-4 shrink-0" style={{ color: accent }} />
            <span className="text-xs font-bold mr-0.5">Sổ ngày:</span>

            <button
              type="button"
              onClick={() => changeSelectedDate(shiftDateKey(selectedDate, -1))}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Lùi về ngày trước"
            >
              <ChevronLeft className="size-4" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => changeSelectedDate(e.target.value || todayKey)}
              className="h-8 px-2.5 rounded-lg border border-white/15 bg-black/40 text-xs font-semibold text-white focus:outline-none"
            />

            <button
              type="button"
              onClick={() => changeSelectedDate(shiftDateKey(selectedDate, 1))}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Tiến tới ngày sau"
            >
              <ChevronRight className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => changeSelectedDate(yesterdayKey)}
              className={`h-8 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedDate === yesterdayKey
                  ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
                  : "border-white/15 bg-white/5 hover:bg-white/10 text-white/75"
              }`}
            >
              Hôm qua
            </button>

            <button
              type="button"
              onClick={() => changeSelectedDate(todayKey)}
              className={`h-8 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedDate === todayKey
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                  : "border-white/15 bg-white/5 hover:bg-white/10 text-white/75"
              }`}
            >
              Hôm nay
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="h-8 px-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} style={{ color: accent }} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* 3 Summary Stat Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-xl border border-white/10 bg-black/30">
            <span className="text-white/65 block text-[11px]">
              Tổng thu ngày {formatDateVi(selectedDate)} ({summary.dayCount} đơn)
            </span>
            <strong className="text-base font-black tabular-nums mt-0.5 block text-white">
              {formatVnd(summary.dayTotal)}
            </strong>
          </div>

          <div className="p-3 rounded-xl border border-amber-500/35 bg-amber-500/10">
            <span className="text-amber-200/90 block text-[11px]">
              Cần chuyển Admin (Chờ đối soát)
            </span>
            <strong className="text-base font-black tabular-nums mt-0.5 block text-amber-300">
              {formatVnd(summary.dayPending)}
            </strong>
          </div>

          <div className="p-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10">
            <span className="text-emerald-200/90 block text-[11px]">
              Admin đã nhận (Đã đối soát)
            </span>
            <strong className="text-base font-black tabular-nums mt-0.5 block text-emerald-300">
              {formatVnd(summary.daySettled)}
            </strong>
          </div>
        </div>

        {summary.otherDaysPending > 0 && (
          <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-200 flex items-center justify-between gap-2">
            <span>
              💡 Còn <strong>{formatVnd(summary.otherDaysPending)}</strong> ở các ngày khác chưa đối soát.
            </span>
            <button
              type="button"
              onClick={() => setShowAllDates(true)}
              className="underline font-bold text-amber-300 cursor-pointer shrink-0"
            >
              Xem tất cả ngày
            </button>
          </div>
        )}
      </div>

      {/* Create New Order Note Form */}
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border backdrop-blur-xl p-4 sm:p-5 shadow-xl space-y-3"
        style={{
          backgroundColor: `${activeTheme.containerBg}ea`,
          borderColor: `${accent}33`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: accent }}>
            <PlusCircle className="size-4" />
            <span>Ghi nhận đơn mới</span>
          </h3>
          <span className="text-[11px] text-white/60">
            Đang ghi vào ngày <strong className="text-white">{formatDateVi(noteDate)}</strong>
          </span>
        </div>

        {formError && (
          <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        {successBanner && (
          <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <span>{successBanner}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
          <div className="sm:col-span-4 space-y-1">
            <label className="text-[11px] font-semibold text-white/80 block">
              Tên khách *
            </label>
            <input
              type="text"
              placeholder="VD: Anh Nam Zalo..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black/40 text-white placeholder:text-white/35 focus:outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="sm:col-span-5 space-y-1">
            <label className="text-[11px] font-semibold text-white/80 block">
              Nội dung đơn *
            </label>
            <input
              type="text"
              placeholder="VD: Buff 10B Muse / Canva 1 năm..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black/40 text-white placeholder:text-white/35 focus:outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="sm:col-span-3 space-y-1">
            <label className="text-[11px] font-semibold text-white/80 block">
              Số tiền (VNĐ) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="VD: 35.000"
              value={amountInput}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "")
                setAmountInput(digits ? parseInt(digits, 10).toLocaleString("vi-VN") : "")
              }}
              required
              className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black/40 text-emerald-300 font-bold tabular-nums placeholder:text-white/35 placeholder:font-normal focus:outline-none focus:border-emerald-400/60"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs">
          <div className="sm:col-span-4 space-y-1">
            <label className="text-[11px] font-semibold text-white/80 block">
              Ngày ghi nhận
            </label>
            <input
              type="date"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value || todayKey)}
              required
              className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black/40 text-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-5 space-y-1">
            <label className="text-[11px] font-semibold text-white/80 block">
              Ghi chú thêm (Tùy chọn)
            </label>
            <input
              type="text"
              placeholder="VD: Khách CK Techcombank / Tên CTV..."
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black/40 text-white placeholder:text-white/35 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={submittingCreate}
              style={{ backgroundColor: accent, color: "#090A0C" }}
              className="w-full h-9 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              <Check className="size-4 stroke-[2.5]" />
              <span>{submittingCreate ? "Đang lưu..." : "Lưu đơn"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Orders List */}
      <div
        className="rounded-2xl border backdrop-blur-xl p-4 sm:p-5 shadow-xl space-y-3"
        style={{
          backgroundColor: `${activeTheme.containerBg}ea`,
          borderColor: `${accent}33`,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: accent }}>
            <FileText className="size-4" />
            <span>
              Danh sách đơn {showAllDates ? `(Tất cả: ${items.length})` : `ngày ${formatDateVi(selectedDate)} (${displayedItems.length})`}
            </span>
          </h3>

          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setShowAllDates(false)}
              className={`px-2.5 py-1 rounded-lg border font-semibold cursor-pointer ${
                !showAllDates
                  ? "bg-white/15 text-white border-white/30"
                  : "border-white/10 text-white/60 hover:text-white"
              }`}
            >
              Ngày {formatDateVi(selectedDate)}
            </button>
            <button
              type="button"
              onClick={() => setShowAllDates(true)}
              className={`px-2.5 py-1 rounded-lg border font-semibold cursor-pointer ${
                showAllDates
                  ? "bg-white/15 text-white border-white/30"
                  : "border-white/10 text-white/60 hover:text-white"
              }`}
            >
              Tất cả ({items.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-white/60">Đang tải sổ đơn CTV...</div>
        ) : displayedItems.length === 0 ? (
          <div className="py-10 text-center text-xs text-white/55">
            Chưa có đơn nào được ghi trong {showAllDates ? "sổ" : `ngày ${formatDateVi(selectedDate)}`}.
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedItems.map((item) => {
              const isSettled = item.status === "settled"
              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-white/10 bg-black/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-white">
                        {item.customerName}
                      </span>
                      <span
                        className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/75"
                        title={`Nhập lúc ${new Date(item.createdAt).toLocaleString("vi-VN")}`}
                      >
                        {formatTimeHmS(item.createdAt)} · {formatDateVi(item.noteDate)}
                      </span>
                      {isSettled ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="size-3" />
                          <span>
                            Admin đã nhận
                            {item.settledAt ? ` (${formatTimeAndDay(item.settledAt)})` : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <Clock className="size-3" />
                          Chờ đối soát
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-white/90 font-medium break-words">
                      {item.content}
                    </p>

                    {item.note && (
                      <p className="text-[11px] text-white/55 italic break-words">
                        Ghi chú: {item.note}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                    <span className="text-sm sm:text-base font-black tabular-nums text-emerald-300">
                      {formatVnd(item.amount)}
                    </span>

                    {isSettled ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-white/45 px-2 py-1 rounded-lg bg-white/5 border border-white/10"
                        title="Đơn đã được Admin đối soát nhận tiền nên được khóa chỉnh sửa"
                      >
                        <Lock className="size-3" />
                        <span>Đã khóa</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-[11px] font-semibold text-white cursor-pointer"
                          title="Sửa đơn này"
                        >
                          <Pencil className="size-3" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingTarget(item)
                            setDeleteError(null)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/20 text-[11px] font-semibold text-rose-300 cursor-pointer"
                          title="Xóa đơn này"
                        >
                          <Trash2 className="size-3" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Sửa đơn CTV */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-zinc-950 p-5 shadow-2xl space-y-4 text-xs text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Pencil className="size-4 text-amber-400" />
                <span>Chỉnh sửa đơn CTV</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-white/60 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-white/80 block">Ngày ghi nhận *</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value || todayKey)}
                  className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-white/80 block">Tên khách *</label>
                <input
                  type="text"
                  required
                  value={editCustomer}
                  onChange={(e) => setEditCustomer(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-white/80 block">Nội dung đơn *</label>
                <input
                  type="text"
                  required
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-white/80 block">Số tiền (VNĐ) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={editAmount}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "")
                    setEditAmount(digits ? parseInt(digits, 10).toLocaleString("vi-VN") : "")
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black text-emerald-300 font-bold tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-white/80 block">Ghi chú thêm</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-white/15 bg-black text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={submittingEdit}
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-2 rounded-xl border border-white/15 text-white/80 hover:bg-white/10 font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  style={{ backgroundColor: accent, color: "#090A0C" }}
                  className="px-4 py-2 rounded-xl font-black cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa đơn CTV */}
      {deletingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-zinc-950 p-5 shadow-2xl space-y-4 text-xs text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <Trash2 className="size-4 text-rose-400" />
                <span>Xác nhận xóa đơn ghi chú</span>
              </h3>
              <button
                type="button"
                onClick={() => setDeletingTarget(null)}
                className="p-1 rounded-lg text-white/60 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200">
                {deleteError}
              </div>
            )}

            <div className="p-3.5 rounded-xl border border-white/10 bg-white/5 space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-white/60">Khách hàng:</span>
                <strong>{deletingTarget.customerName}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white/60">Nội dung:</span>
                <span className="text-right">{deletingTarget.content}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white/60">Ngày ghi:</span>
                <span className="font-mono">{formatDateVi(deletingTarget.noteDate)}</span>
              </div>
              <div className="flex justify-between gap-2 pt-1 border-t border-white/10">
                <span className="text-white/60">Số tiền:</span>
                <strong className="text-rose-400 font-bold">{formatVnd(deletingTarget.amount)}</strong>
              </div>
            </div>

            <p className="text-[11px] text-white/65">
              Bạn chắc chắn muốn xóa dòng ghi chú này khỏi sổ CTV?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={submittingDelete}
                onClick={() => setDeletingTarget(null)}
                className="px-3.5 py-2 rounded-xl border border-white/15 text-white/80 hover:bg-white/10 font-semibold cursor-pointer"
              >
                Giữ lại
              </button>
              <button
                type="button"
                disabled={submittingDelete}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {submittingDelete ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
