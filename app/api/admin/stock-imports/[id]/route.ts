import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: "Thiếu mã phiếu nhập" }, { status: 400 })
    }

    const existing = await prisma.stockImport.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy phiếu nhập hàng" }, { status: 404 })
    }

    await prisma.stockImport.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/admin/stock-imports/[id]]", err)
    return NextResponse.json({ error: "Không thể xóa phiếu nhập hàng" }, { status: 500 })
  }
}
