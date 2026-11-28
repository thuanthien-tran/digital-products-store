import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyCtvRequest } from "@/lib/auth"
import {
  CTV_DATE_REGEX,
  serializeCtvNote,
  validateCtvNoteInput,
} from "@/lib/ctv-notes"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    if (!(await verifyCtvRequest(req))) {
      return NextResponse.json({ error: "Vui lòng nhập mã PIN CTV để truy cập" }, { status: 401 })
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
    console.error("[GET /api/ctv/notes]", err)
    return NextResponse.json({ error: "Không thể tải sổ ghi đơn CTV" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!(await verifyCtvRequest(req))) {
      return NextResponse.json({ error: "Vui lòng nhập mã PIN CTV để truy cập" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const body = await req.json().catch(() => null)
    const validated = validateCtvNoteInput(body)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const created = await prisma.ctvOrderNote.create({
      data: {
        ...validated.data,
        status: "pending",
      },
    })

    // Surface new CTV order in Admin notification bell across all /admin pages
    try {
      await prisma.adminNotification.create({
        data: {
          type: "ctv_note_created",
          title: `📝 Đơn CTV mới: ${created.customerName} (${created.amount.toLocaleString("vi-VN")}đ)`,
          message: `${created.content} · Ngày ${created.noteDate.split("-").reverse().join("/")}`,
          link: "/admin/ctv-notes",
          metadata: JSON.stringify({ ctvNoteId: created.id }),
        },
      })
    } catch {}

    return NextResponse.json({
      success: true,
      item: serializeCtvNote(created),
    })
  } catch (err) {
    console.error("[POST /api/ctv/notes]", err)
    return NextResponse.json({ error: "Không thể lưu đơn ghi chú" }, { status: 500 })
  }
}
