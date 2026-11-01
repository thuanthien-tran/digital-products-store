import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const { variantId, serialsText } = await req.json()

    if (!variantId || !serialsText) {
      return NextResponse.json({ error: "Thiếu variantId hoặc nội dung serials" }, { status: 400 })
    }

    // Split text by new lines, filter empty lines
    const lines = serialsText
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0)

    if (lines.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy dòng hợp lệ" }, { status: 400 })
    }

    // Verify variant exists
    const variant = await prisma.variant.findUnique({ where: { id: variantId } })
    if (!variant) {
      return NextResponse.json({ error: "Gói sản phẩm không tồn tại" }, { status: 404 })
    }

    // Insert serials
    await prisma.serial.createMany({
      data: lines.map((content: string) => ({
        variantId,
        content,
        status: "available",
      })),
    })

    return NextResponse.json({ success: true, count: lines.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi nạp serials"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const { serialId } = await req.json()
    if (!serialId) {
      return NextResponse.json({ error: "Thiếu serialId" }, { status: 400 })
    }

    await prisma.serial.delete({ where: { id: serialId } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
