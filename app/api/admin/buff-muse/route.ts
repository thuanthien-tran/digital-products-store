import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyAdminRequest } from "@/lib/auth"
import {
  BUFF_MUSE_TIERS,
  getBuffMuseAdminConfig,
  saveBuffMuseAdminConfig,
} from "@/lib/buff-config"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
  }

  try {
    const config = await getBuffMuseAdminConfig()
    return NextResponse.json({ success: true, config })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi đọc cấu hình Buff Muse"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const productName = typeof body.productName === "string" ? body.productName.trim() : ""
    const isEnabled = Boolean(body.isEnabled)
    const rawTiers = Array.isArray(body.tiers) ? body.tiers : []

    if (!productName) {
      return NextResponse.json({ error: "Vui lòng nhập tên hiển thị gói Buff" }, { status: 400 })
    }

    const normalizedTiers: Array<{
      tokenAmountB: number
      priceCents: number
      compareAtPriceCents: number | null
      isActive: boolean
    }> = []

    for (const expectedB of BUFF_MUSE_TIERS) {
      const found = rawTiers.find(
        (t: { tokenAmountB?: unknown }) => Number(t?.tokenAmountB) === expectedB
      )
      if (!found) {
        return NextResponse.json({ error: `Thiếu cấu hình mức ${expectedB}B` }, { status: 400 })
      }
      const priceCents = Math.round(Number(found.priceCents))
      if (!Number.isFinite(priceCents) || priceCents < 1000 || priceCents > 100000000) {
        return NextResponse.json(
          { error: `Giá bán mức ${expectedB}B phải từ 1.000đ trở lên` },
          { status: 400 }
        )
      }

      const rawCompare =
        found.compareAtPriceCents === null ||
        found.compareAtPriceCents === undefined ||
        found.compareAtPriceCents === ""
          ? null
          : Math.round(Number(found.compareAtPriceCents))
      const compareAtPriceCents =
        rawCompare !== null && Number.isFinite(rawCompare) && rawCompare > priceCents
          ? rawCompare
          : null

      normalizedTiers.push({
        tokenAmountB: expectedB,
        priceCents,
        compareAtPriceCents,
        isActive: found.isActive !== false,
      })
    }

    if (!normalizedTiers.some((t) => t.isActive)) {
      return NextResponse.json(
        { error: "Phải bật ít nhất 1 mức gói Token hoạt động" },
        { status: 400 }
      )
    }

    const updated = await saveBuffMuseAdminConfig({
      productName,
      isEnabled,
      tiers: normalizedTiers,
    })

    try {
      revalidatePath("/buff-muse")
      revalidatePath("/")
      revalidatePath("/san-pham")
      if (updated.productSlug) {
        revalidatePath(`/product/${updated.productSlug}`)
      }
    } catch {}

    return NextResponse.json({
      success: true,
      config: updated,
      message: "Đã lưu cấu hình giá Buff Token Muse AI thành công!",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi cập nhật cấu hình Buff Muse"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
