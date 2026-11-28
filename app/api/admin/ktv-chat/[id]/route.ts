import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"

export const dynamic = "force-dynamic"

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
      return NextResponse.json({ error: "Thiếu mã tin nhắn" }, { status: 400 })
    }

    const existing = await prisma.ktvChatMessage.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy tin nhắn cần xóa" }, { status: 404 })
    }

    await prisma.ktvChatMessage.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/admin/ktv-chat/[id]]", err)
    return NextResponse.json({ error: "Không thể xóa tin nhắn" }, { status: 500 })
  }
}
