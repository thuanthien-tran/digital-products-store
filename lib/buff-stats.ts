import { prisma } from "./db"
import { appendOrderNote } from "./fulfillment"

export interface BuffDayOrderItem {
  orderCode: string
  inviteCode: string
  tokensB: number
  totalCents: number
  note: string | null
}

export interface BuffSummaryStats {
  dateKey: string // YYYY-MM-DD in Asia/Ho_Chi_Minh
  dayCompletedOrders: number
  dayPendingOrders: number
  dayTokensBuffedB: number
  dayRevenueCents: number
  dayCompletedList: BuffDayOrderItem[]
  allCompletedOrders: number
  allPendingOrders: number
  allTokensBuffedB: number
  allRevenueCents: number
}

export function getVietnamDateKey(input?: Date | string): string {
  const d = input ? (typeof input === "string" ? new Date(input) : input) : new Date()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value || "2026"
  const m = parts.find((p) => p.type === "month")?.value || "01"
  const day = parts.find((p) => p.type === "day")?.value || "01"
  return `${y}-${m}-${day}`
}

export function formatVnDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-")
  if (!y || !m || !d) return dateKey
  return `${d}/${m}/${y}`
}

export function extractBuffDoneNote(note: string | null | undefined): string | null {
  if (!note) return null
  const match = note.match(/\[BUFF_DONE_NOTE\]:\s*([^|]+)/)
  return match?.[1]?.trim() || null
}

/**
 * Computes Buff Token Muse statistics for a given Vietnam date (YYYY-MM-DD) and all-time totals.
 */
export async function getBuffStatsForDate(dateKey?: string): Promise<BuffSummaryStats> {
  const targetDate = dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : getVietnamDateKey()

  const records = await prisma.buffFulfillment.findMany({
    select: {
      id: true,
      orderId: true,
      inviteCode: true,
      status: true,
      tokenAmountB: true,
      completedB: true,
      createdAt: true,
      updatedAt: true,
      orderItem: {
        select: {
          order: {
            select: {
              id: true,
              code: true,
              status: true,
              totalCents: true,
              note: true,
              createdAt: true,
              payments: { select: { amount: true } },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  let dayCompletedOrders = 0
  let dayPendingOrders = 0
  let dayTokensBuffedB = 0
  let dayRevenueCents = 0
  let allCompletedOrders = 0
  let allPendingOrders = 0
  let allTokensBuffedB = 0
  let allRevenueCents = 0
  const dayCompletedList: BuffDayOrderItem[] = []

  const seenCompletedOrderIdsDay = new Set<string>()
  const seenCompletedOrderIdsAll = new Set<string>()
  const seenPendingOrderIdsDay = new Set<string>()
  const seenPendingOrderIdsAll = new Set<string>()

  for (const rec of records) {
    const order = rec.orderItem?.order
    if (!order) continue
    if (order.status === "cancelled" || order.status === "refunded") continue

    const paidTotal = order.payments.reduce((sum, p) => sum + p.amount, 0)
    const isPaidOrder = (order.status === "paid" || order.status === "processing") && paidTotal > 0
    if (!isPaidOrder) continue

    const recCreatedKey = getVietnamDateKey(order.createdAt)
    const recDoneKey = getVietnamDateKey(rec.updatedAt || rec.createdAt)

    if (rec.status === "succeeded") {
      const doneTokens = rec.completedB && rec.completedB > 0 ? rec.completedB : rec.tokenAmountB
      allTokensBuffedB += doneTokens
      if (!seenCompletedOrderIdsAll.has(order.id)) {
        seenCompletedOrderIdsAll.add(order.id)
        allCompletedOrders += 1
        allRevenueCents += order.totalCents
      }

      if (recDoneKey === targetDate) {
        dayTokensBuffedB += doneTokens
        if (!seenCompletedOrderIdsDay.has(order.id)) {
          seenCompletedOrderIdsDay.add(order.id)
          dayCompletedOrders += 1
          dayRevenueCents += order.totalCents
          dayCompletedList.push({
            orderCode: order.code,
            inviteCode: rec.inviteCode,
            tokensB: doneTokens,
            totalCents: order.totalCents,
            note: extractBuffDoneNote(order.note),
          })
        }
      }
    } else if (["pending", "submitting", "processing", "needs_review"].includes(rec.status)) {
      if (!seenPendingOrderIdsAll.has(order.id)) {
        seenPendingOrderIdsAll.add(order.id)
        allPendingOrders += 1
      }
      if (recCreatedKey === targetDate && !seenPendingOrderIdsDay.has(order.id)) {
        seenPendingOrderIdsDay.add(order.id)
        dayPendingOrders += 1
      }
    }
  }

  return {
    dateKey: targetDate,
    dayCompletedOrders,
    dayPendingOrders,
    dayTokensBuffedB,
    dayRevenueCents,
    dayCompletedList,
    allCompletedOrders,
    allPendingOrders,
    allTokensBuffedB,
    allRevenueCents,
  }
}

export async function completeBuffOrder(params: {
  orderIdOrCode: string
  completedB?: number | null
  note?: string | null
  actor?: string
}): Promise<{
  ok: boolean
  error?: string
  orderId?: string
  orderCode?: string
  inviteCode?: string
  tokenAmountB?: number
  completedB?: number
  totalCents?: number
  note?: string | null
}> {
  const key = params.orderIdOrCode.trim()
  if (!key) return { ok: false, error: "Thiếu mã đơn hàng" }

  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: key }, { code: key.toUpperCase() }],
    },
    include: {
      payments: true,
      items: {
        include: {
          product: { select: { fulfillmentType: true } },
          buffFulfillment: true,
        },
      },
    },
  })

  if (!order) {
    return { ok: false, error: `Không tìm thấy đơn hàng "${key}"` }
  }

  if (order.status === "cancelled" || order.status === "refunded") {
    return { ok: false, error: `Đơn #${order.code} đã bị hủy/hoàn tiền.` }
  }

  const totalPaid = order.payments.reduce((s, p) => s + p.amount, 0)
  if (order.status === "pending" || totalPaid <= 0) {
    return { ok: false, error: `Đơn #${order.code} chưa nhận thanh toán.` }
  }

  const buffItems = order.items.filter(
    (it) => it.buffFulfillment || it.product.fulfillmentType === "buff" || it.tokenAmountB != null
  )
  if (buffItems.length === 0) {
    return { ok: false, error: `Đơn #${order.code} không phải đơn Buff Token.` }
  }

  const firstItem = buffItems[0]
  const targetTokenB =
    firstItem.buffFulfillment?.tokenAmountB ||
    firstItem.tokenAmountB ||
    1
  const inviteCode =
    firstItem.buffFulfillment?.inviteCode ||
    firstItem.inviteCode ||
    order.inviteCode ||
    "N/A"
  const finalCompletedB =
    params.completedB && params.completedB > 0
      ? Math.min(31, Math.floor(params.completedB))
      : targetTokenB

  for (const it of buffItems) {
    if (it.buffFulfillment) {
      await prisma.buffFulfillment.update({
        where: { id: it.buffFulfillment.id },
        data: {
          status: "succeeded",
          completedB: finalCompletedB,
          lastCheckedAt: new Date(),
        },
      })
    } else {
      await prisma.buffFulfillment.create({
        data: {
          orderItemId: it.id,
          orderId: order.id,
          inviteCode,
          tokenAmountB: targetTokenB,
          completedB: finalCompletedB,
          status: "succeeded",
          usedMethod: "manual_queue",
          partnerRef: `${order.code}-${it.id}`,
          lastCheckedAt: new Date(),
        },
      })
    }
  }

  const cleanNote = params.note ? params.note.replace(/\|/g, " - ").trim() : ""
  const actor = params.actor || "Admin"
  let nextOrderNote = order.note || ""
  if (cleanNote) {
    nextOrderNote = nextOrderNote.replace(/\s*\|\s*\[BUFF_DONE_NOTE\]:[^|]*/g, "")
    nextOrderNote = nextOrderNote.replace(/^\[BUFF_DONE_NOTE\]:[^|]*\s*\|\s*/g, "")
    nextOrderNote = appendOrderNote(nextOrderNote, `[BUFF_DONE_NOTE]: ${cleanNote}`)
  }
  const auditTag = `[Đã hoàn tất Buff ${finalCompletedB}/${targetTokenB}B bởi ${actor}${cleanNote ? `: ${cleanNote}` : ""}]`
  nextOrderNote = appendOrderNote(nextOrderNote, auditTag)

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "paid",
      note: nextOrderNote,
    },
  })

  return {
    ok: true,
    orderId: order.id,
    orderCode: order.code,
    inviteCode,
    tokenAmountB: targetTokenB,
    completedB: finalCompletedB,
    totalCents: order.totalCents,
    note: cleanNote || null,
  }
}

export async function addBuffNoteToOrder(params: {
  orderIdOrCode: string
  note: string
  actor?: string
}): Promise<{ ok: boolean; error?: string; orderCode?: string }> {
  const key = params.orderIdOrCode.trim()
  const cleanNote = params.note.replace(/\|/g, " - ").trim()
  if (!key || !cleanNote) return { ok: false, error: "Thiếu mã đơn hoặc nội dung ghi chú" }

  const order = await prisma.order.findFirst({
    where: { OR: [{ id: key }, { code: key.toUpperCase() }] },
    select: { id: true, code: true, note: true },
  })
  if (!order) return { ok: false, error: `Không tìm thấy đơn #${key}` }

  let nextNote = (order.note || "")
    .replace(/\s*\|\s*\[BUFF_DONE_NOTE\]:[^|]*/g, "")
    .replace(/^\[BUFF_DONE_NOTE\]:[^|]*\s*\|\s*/g, "")
  nextNote = appendOrderNote(nextNote, `[BUFF_DONE_NOTE]: ${cleanNote}`)
  nextNote = appendOrderNote(nextNote, `[Ghi chú (${params.actor || "Admin"}): ${cleanNote}]`)

  await prisma.order.update({
    where: { id: order.id },
    data: { note: nextNote },
  })

  return { ok: true, orderCode: order.code }
}
