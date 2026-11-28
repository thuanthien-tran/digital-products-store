import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"
import {
  CTV_DATE_REGEX,
  serializeCtvNote,
  validateCtvNoteInput,
} from "@/lib/ctv-notes"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const { searchParams } = new URL(req.url)
    const dateFilter = searchParams.get("date")?.trim()
    const where = dateFilter && CTV_DATE_REGEX.test(dateFilter) ? { noteDate: dateFilter } : undefined

    const rows = await prisma.ctvOrderNote.findMany({
      where,
      orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({
      success: true,
      items: rows.map(serializeCtvNote),
    })
  } catch (err) {
    console.error("[GET /api/admin/ctv-notes]", err)
    return NextResponse.json({ error: "Không thể tải danh sách sổ CTV" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const body = await req.json().catch(() => null)
    const validated = validateCtvNoteInput(body)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const isSettled = Boolean(body && typeof body === "object" && (body as { status?: unknown }).status === "settled")
    const created = await prisma.ctvOrderNote.create({
      data: {
        ...validated.data,
        status: isSettled ? "settled" : "pending",
        settledAt: isSettled ? new Date() : null,
      },
    })

    try {
      revalidatePath("/admin/ctv-notes")
    } catch {}

    return NextResponse.json({
      success: true,
      item: serializeCtvNote(created),
    })
  } catch (err) {
    console.error("[POST /api/admin/ctv-notes]", err)
    return NextResponse.json({ error: "Không thể tạo ghi chú CTV" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const body = await req.json().catch(() => ({}))
    const action = typeof body?.action === "string" ? body.action : ""
    const noteDate = typeof body?.noteDate === "string" ? body.noteDate.trim() : ""

    if ((action === "settle_date" || action === "unsettle_date") && CTV_DATE_REGEX.test(noteDate)) {
      const targetStatus = action === "settle_date" ? "settled" : "pending"
      const fromStatus = action === "settle_date" ? "pending" : "settled"
      const now = new Date()

      const res = await prisma.ctvOrderNote.updateMany({
        where: { noteDate, status: fromStatus },
        data: {
          status: targetStatus,
          settledAt: targetStatus === "settled" ? now : null,
          updatedAt: now,
        },
      })

      try {
        revalidatePath("/admin/ctv-notes")
      } catch {}

      const dateLabel = noteDate.split("-").reverse().join("/")
      return NextResponse.json({
        success: true,
        updatedCount: res.count,
        settledAt: targetStatus === "settled" ? now.toISOString() : null,
        message:
          targetStatus === "settled"
            ? `Đã chốt đối soát ${res.count} đơn ngày ${dateLabel}`
            : `Đã hoàn tác trạng thái chờ đối soát cho ${res.count} đơn ngày ${dateLabel}`,
      })
    }

    return NextResponse.json({ error: "Thao tác hoặc ngày không hợp lệ" }, { status: 400 })
  } catch (err) {
    console.error("[PATCH /api/admin/ctv-notes]", err)
    return NextResponse.json({ error: "Không thể cập nhật đối soát theo ngày" }, { status: 500 })
  }
}
