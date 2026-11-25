import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function getTodayDateString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const { searchParams } = new URL(req.url)
    const dateFilter = searchParams.get("date")?.trim()

    const where = dateFilter && DATE_REGEX.test(dateFilter) ? { importDate: dateFilter } : undefined

    const items = await prisma.stockImport.findMany({
      where,
      orderBy: [{ importDate: "desc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({
      success: true,
      items: items.map((item) => ({
        id: item.id,
        importDate: item.importDate,
        itemInfo: item.itemInfo,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalCents: item.totalCents,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error("[GET /api/admin/stock-imports]", err)
    return NextResponse.json({ error: "Không thể tải danh sách nhập hàng" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const body = await req.json()

    const rawDate = typeof body.importDate === "string" ? body.importDate.trim() : ""
    const importDate = DATE_REGEX.test(rawDate) ? rawDate : getTodayDateString()
    const itemInfo = typeof body.itemInfo === "string" ? body.itemInfo.trim() : ""
    const quantity = Math.max(1, parseInt(String(body.quantity ?? 1), 10) || 1)
    const unitPrice = parseInt(String(body.unitPrice ?? 0), 10)
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null

    if (!itemInfo) {
      return NextResponse.json({ error: "Vui lòng nhập thông tin hàng nhập" }, { status: 400 })
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ error: "Giá nhập phải lớn hơn 0đ" }, { status: 400 })
    }

    const totalCents = quantity * unitPrice

    const created = await prisma.stockImport.create({
      data: {
        importDate,
        itemInfo,
        quantity,
        unitPrice,
        totalCents,
        note,
      },
    })

    return NextResponse.json({
      success: true,
      item: {
        id: created.id,
        importDate: created.importDate,
        itemInfo: created.itemInfo,
        quantity: created.quantity,
        unitPrice: created.unitPrice,
        totalCents: created.totalCents,
        note: created.note,
        createdAt: created.createdAt.toISOString(),
      },
    })
  } catch (err) {
    console.error("[POST /api/admin/stock-imports]", err)
    return NextResponse.json({ error: "Không thể lưu phiếu nhập hàng" }, { status: 500 })
  }
}
