import { getVietnamDateKey } from "./buff-stats"

export const CTV_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export type CtvNoteStatus = "pending" | "settled"

export interface CtvOrderNoteDto {
  id: string
  noteDate: string
  customerName: string
  content: string
  amount: number
  note: string | null
  status: CtvNoteStatus
  settledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ValidatedCtvNoteInput {
  noteDate: string
  customerName: string
  content: string
  amount: number
  note: string | null
}

export function getTodayCtvDateKey(): string {
  return getVietnamDateKey()
}

export function parseVndAmount(raw: unknown): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.round(raw) : NaN
  }
  if (typeof raw === "string") {
    const digits = raw.trim().replace(/[.,\sđ₫]/gi, "")
    if (!/^\d+$/.test(digits)) return NaN
    return parseInt(digits, 10)
  }
  return NaN
}

export function validateCtvNoteInput(
  body: unknown,
  options?: { requireExplicitDate?: boolean }
): { ok: true; data: ValidatedCtvNoteInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Dữ liệu gửi lên không hợp lệ" }
  }

  const record = body as Record<string, unknown>
  const rawDate = typeof record.noteDate === "string" ? record.noteDate.trim() : ""

  let noteDate: string
  if (rawDate) {
    if (!CTV_DATE_REGEX.test(rawDate)) {
      return { ok: false, error: "Ngày ghi nhận không hợp lệ (định dạng YYYY-MM-DD)" }
    }
    noteDate = rawDate
  } else if (options?.requireExplicitDate) {
    return { ok: false, error: "Vui lòng chọn ngày ghi nhận" }
  } else {
    noteDate = getTodayCtvDateKey()
  }

  const customerName = typeof record.customerName === "string" ? record.customerName.trim() : ""
  if (!customerName) {
    return { ok: false, error: "Vui lòng nhập Tên khách hàng" }
  }
  if (customerName.length > 150) {
    return { ok: false, error: "Tên khách hàng quá dài (tối đa 150 ký tự)" }
  }

  const content = typeof record.content === "string" ? record.content.trim() : ""
  if (!content) {
    return { ok: false, error: "Vui lòng nhập Nội dung đơn hàng" }
  }
  if (content.length > 500) {
    return { ok: false, error: "Nội dung đơn hàng quá dài (tối đa 500 ký tự)" }
  }

  const amount = parseVndAmount(record.amount)
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000_000) {
    return { ok: false, error: "Số tiền phải là số nguyên lớn hơn 0đ (tối đa 1.000.000.000đ)" }
  }

  const rawNote = typeof record.note === "string" ? record.note.trim() : ""
  if (rawNote.length > 500) {
    return { ok: false, error: "Ghi chú thêm quá dài (tối đa 500 ký tự)" }
  }

  return {
    ok: true,
    data: {
      noteDate,
      customerName,
      content,
      amount,
      note: rawNote || null,
    },
  }
}

export function serializeCtvNote(row: {
  id: string
  noteDate: string
  customerName: string
  content: string
  amount: number
  note: string | null
  status: string
  settledAt: Date | null
  createdAt: Date
  updatedAt: Date
}): CtvOrderNoteDto {
  return {
    id: row.id,
    noteDate: row.noteDate,
    customerName: row.customerName,
    content: row.content,
    amount: row.amount,
    note: row.note,
    status: row.status === "settled" ? "settled" : "pending",
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
