import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"
import { serializeCtvNote, validateCtvNoteInput } from "@/lib/ctv-notes"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã ghi chú" }, { status: 400 })
    }

    const existing = await prisma.ctvOrderNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy ghi chú này" }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))

    // Quick status toggle from Admin table
    if (body?.action === "set_status" && (body.status === "settled" || body.status === "pending")) {
      const nextStatus = body.status as "settled" | "pending"
      const updated = await prisma.ctvOrderNote.update({
        where: { id },
        data: {
          status: nextStatus,
          settledAt: nextStatus === "settled" ? new Date() : null,
        },
      })

      try {
        revalidatePath("/admin/ctv-notes")
      } catch {}

      return NextResponse.json({
        success: true,
        item: serializeCtvNote(updated),
      })
    }

    const validated = validateCtvNoteInput(body, { requireExplicitDate: true })
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const nextStatus =
      body?.status === "settled" || body?.status === "pending"
        ? (body.status as "settled" | "pending")
        : (existing.status as "settled" | "pending")

    const updated = await prisma.ctvOrderNote.update({
      where: { id },
      data: {
        ...validated.data,
        status: nextStatus,
        settledAt:
          nextStatus === "settled"
            ? existing.settledAt || new Date()
            : null,
      },
    })

    try {
      revalidatePath("/admin/ctv-notes")
    } catch {}

    return NextResponse.json({
      success: true,
      item: serializeCtvNote(updated),
    })
  } catch (err) {
    console.error("[PATCH /api/admin/ctv-notes/[id]]", err)
    return NextResponse.json({ error: "Không thể cập nhật ghi chú CTV" }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Thiếu mã ghi chú" }, { status: 400 })
    }

    const existing = await prisma.ctvOrderNote.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy ghi chú cần xóa" }, { status: 404 })
    }

    await prisma.ctvOrderNote.delete({ where: { id } })

    try {
      revalidatePath("/admin/ctv-notes")
    } catch {}

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/admin/ctv-notes/[id]]", err)
    return NextResponse.json({ error: "Không thể xóa ghi chú CTV" }, { status: 500 })
  }
}
