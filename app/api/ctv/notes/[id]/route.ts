import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyCtvRequest } from "@/lib/auth"
import { serializeCtvNote, validateCtvNoteInput } from "@/lib/ctv-notes"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyCtvRequest(req))) {
      return NextResponse.json({ error: "Vui lòng nhập mã PIN CTV để truy cập" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã ghi chú" }, { status: 400 })
    }

    const existing = await prisma.ctvOrderNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy dòng ghi chú này" }, { status: 404 })
    }

    if (existing.status === "settled") {
      return NextResponse.json(
        { error: "Đơn này đã được Admin đối soát nhận tiền, không thể chỉnh sửa" },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => null)
    const validated = validateCtvNoteInput(body, { requireExplicitDate: true })
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const updated = await prisma.ctvOrderNote.update({
      where: { id },
      data: validated.data,
    })

    return NextResponse.json({
      success: true,
      item: serializeCtvNote(updated),
    })
  } catch (err) {
    console.error("[PATCH /api/ctv/notes/[id]]", err)
    return NextResponse.json({ error: "Không thể cập nhật dòng ghi chú" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyCtvRequest(req))) {
      return NextResponse.json({ error: "Vui lòng nhập mã PIN CTV để truy cập" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã ghi chú" }, { status: 400 })
    }

    const existing = await prisma.ctvOrderNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy dòng ghi chú này" }, { status: 404 })
    }

    if (existing.status === "settled") {
      return NextResponse.json(
        { error: "Đơn này đã được Admin đối soát nhận tiền, không thể xóa" },
        { status: 403 }
      )
    }

    await prisma.ctvOrderNote.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/ctv/notes/[id]]", err)
    return NextResponse.json({ error: "Không thể xóa dòng ghi chú" }, { status: 500 })
  }
}
