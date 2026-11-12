import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { createCtvToken } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    await ensureDatabaseSchema()
    const body = await req.json().catch(() => ({}))
    const pin = (body.pin || "").toString().trim()

    if (!pin) {
      return NextResponse.json({ error: "Vui lòng nhập mã PIN truy cập" }, { status: 400 })
    }

    const settings = await prisma.siteSettings.findFirst()
    const ctvAccessEnabled = (settings as any)?.ctvAccessEnabled !== false
    const expectedPin = (settings as any)?.ctvPin || "888888"

    if (!ctvAccessEnabled) {
      return NextResponse.json(
        { error: "Cổng xem bảng giá CTV hiện đang tạm đóng bởi Quản trị viên." },
        { status: 403 }
      )
    }

    if (pin !== expectedPin) {
      return NextResponse.json({ error: "Mã PIN không chính xác. Vui lòng thử lại!" }, { status: 401 })
    }

    // Generate 30-day token
    const token = await createCtvToken()

    const res = NextResponse.json({
      success: true,
      message: "Xác thực mã PIN thành công!",
      token,
    })

    // Set secure HttpOnly cookie
    res.cookies.set("ctv_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    })

    return res
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: "Đã đăng xuất khỏi cổng CTV" })
  res.cookies.set("ctv_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
  return res
}
