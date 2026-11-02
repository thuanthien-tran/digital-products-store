import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import {
  createAdminToken,
  checkLoginRateLimit,
} from "@/lib/auth"
import {
  verifyPassword,
  hashPassword,
  timingSafeEqualStr,
} from "@/lib/password"

export async function POST(req: Request) {
  try {
    // 1. Origin / Referer validation to prevent cross-site form/fetch CSRF
    const origin = req.headers.get("origin")
    const host = req.headers.get("host")
    if (origin && host) {
      try {
        const originUrl = new URL(origin)
        if (originUrl.host !== host) {
          return NextResponse.json(
            { error: "Yêu cầu bị từ chối do nguồn gốc không hợp lệ (Cross-Origin Request Blocked)" },
            { status: 403 }
          )
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
    const userStr = String(username || "").trim()
    const passStr = String(password || "")

    let isAuthenticated = false
    let authenticatedUser = userStr

    // 3. Priority check against database (prisma.admin)
    const dbAdmin = await prisma.admin.findUnique({
      where: { username: userStr },
    })

    if (dbAdmin) {
      if (verifyPassword(passStr, dbAdmin.passwordHash)) {
        isAuthenticated = true
        authenticatedUser = dbAdmin.username
      }
    } else {
      // 4. Fallback check against process.env credentials
      const expectedUser = process.env.ADMIN_USERNAME || "thunthin"
      const expectedPass = process.env.ADMIN_PASSWORD

      if (expectedPass) {
        const isUserValid = timingSafeEqualStr(userStr, expectedUser)
        const isPassValid = timingSafeEqualStr(passStr, expectedPass)
        if (isUserValid && isPassValid) {
          isAuthenticated = true
          authenticatedUser = expectedUser
          // Auto-persist into DB
          try {
            await prisma.admin.upsert({
              where: { username: expectedUser },
              update: { passwordHash: hashPassword(expectedPass) },
              create: { username: expectedUser, passwordHash: hashPassword(expectedPass) },
            })
          } catch {
            // Non-blocking
          }
        }
      } else if (process.env.NODE_ENV === "production") {
        console.error("FATAL: ADMIN_PASSWORD environment variable is not set. Refusing admin login in production.")
        return NextResponse.json(
          { error: "Lỗi cấu hình hệ thống: ADMIN_PASSWORD chưa được thiết lập" },
          { status: 500 }
        )
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json({ error: "Sai tên đăng nhập hoặc mật khẩu" }, { status: 401 })
    }

    const token = await createAdminToken(authenticatedUser)
    const cookieStore = await cookies()
    cookieStore.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    })

    return NextResponse.json({ success: true, username: authenticatedUser })
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
