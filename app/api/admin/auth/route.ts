import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import crypto from "crypto"
import { createAdminToken, checkLoginRateLimit } from "@/lib/auth"

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // Constant time dummy operation
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

export async function POST(req: Request) {
  try {
    // 1. Origin / Referer validation to prevent cross-site form/fetch CSRF
    const origin = req.headers.get("origin")
    const host = req.headers.get("host")
    if (origin && host) {
      try {
        const originUrl = new URL(origin)
        if (originUrl.host !== host) {
          return NextResponse.json({ error: "Yêu cầu bị từ chối do nguồn gốc không hợp lệ (Cross-Origin Request Blocked)" }, { status: 403 })
        }
      } catch {
        return NextResponse.json({ error: "Origin header không hợp lệ" }, { status: 400 })
      }
    }

    // 2. Extract first valid client IP from x-forwarded-for
    const xForwardedFor = req.headers.get("x-forwarded-for")
    const clientIp = xForwardedFor ? xForwardedFor.split(",")[0].trim() : "local_admin"

    if (!checkLoginRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút." },
        { status: 429 }
      )
    }

    const { username, password } = await req.json()

    const expectedUser = process.env.ADMIN_USERNAME || "admin"
    const expectedPass = process.env.ADMIN_PASSWORD

    if (!expectedPass) {
      if (process.env.NODE_ENV === "production") {
        console.error("FATAL: ADMIN_PASSWORD environment variable is not set. Refusing admin login in production.")
        return NextResponse.json({ error: "Lỗi cấu hình hệ thống: ADMIN_PASSWORD chưa được thiết lập" }, { status: 500 })
      }
    }

    const isUserValid = timingSafeEqualStr(String(username || ""), expectedUser)
    const isPassValid = expectedPass ? timingSafeEqualStr(String(password || ""), expectedPass) : false

    if (!expectedPass || !isUserValid || !isPassValid) {
      return NextResponse.json({ error: "Sai tên đăng nhập hoặc mật khẩu" }, { status: 401 })
    }

    const token = await createAdminToken(username)
    const cookieStore = await cookies()
    cookieStore.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete("admin_token")
  return NextResponse.json({ success: true })
}
