import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import fs from "fs"
import path from "path"
import { prisma } from "@/lib/db"
import {
  verifyAdminRequest,
  createAdminToken,
} from "@/lib/auth"
import {
  verifyPassword,
  hashPassword,
  timingSafeEqualStr,
} from "@/lib/password"

export async function POST(req: Request) {
  try {
    // 1. Verify admin session
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated || !auth.username) {
      return NextResponse.json(
        { error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại." },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await req.json()
    const currentPassword = String(body.currentPassword || "")
    const newPassword = String(body.newPassword || "")
    const confirmPassword = String(body.confirmPassword || "")

    // 3. Validation checks
    if (!currentPassword) {
      return NextResponse.json({ error: "Vui lòng nhập mật khẩu hiện tại" }, { status: 400 })
    }

    if (!newPassword) {
      return NextResponse.json({ error: "Vui lòng nhập mật khẩu mới" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Mật khẩu mới phải có tối thiểu 6 ký tự" }, { status: 400 })
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Mật khẩu xác nhận không khớp với mật khẩu mới" }, { status: 400 })
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "Mật khẩu mới không được trùng với mật khẩu hiện tại" }, { status: 400 })
    }

    // 4. Verify current password
    const username = auth.username
    const dbAdmin = await prisma.admin.findUnique({
      where: { username },
    })

    let isCurrentPassValid = false

    if (dbAdmin) {
      isCurrentPassValid = verifyPassword(currentPassword, dbAdmin.passwordHash)
    } else {
      // Fallback against env
      const expectedPass = process.env.ADMIN_PASSWORD
      if (expectedPass) {
        isCurrentPassValid = timingSafeEqualStr(currentPassword, expectedPass)
      }
    }

    if (!isCurrentPassValid) {
      return NextResponse.json({ error: "Mật khẩu hiện tại không chính xác" }, { status: 400 })
    }

    // 5. Hash new password and save to database
    const newHash = hashPassword(newPassword)
    await prisma.admin.upsert({
      where: { username },
      update: { passwordHash: newHash },
      create: { username, passwordHash: newHash },
    })

    // 6. Update .env file if running in local environment
    try {
      const envPath = path.resolve(process.cwd(), ".env")
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf-8")
        if (envContent.includes("ADMIN_PASSWORD=")) {
          envContent = envContent
            .replace(/ADMIN_PASSWORD="[^"]*"/, `ADMIN_PASSWORD="${newPassword}"`)
            .replace(/ADMIN_PASSWORD=[^\r\n]*/, `ADMIN_PASSWORD="${newPassword}"`)
          fs.writeFileSync(envPath, envContent, "utf-8")
        }
      }
    } catch {
      // Non-critical if filesystem is read-only
    }

    // 7. Re-issue fresh token to keep user seamlessly logged in
    const newToken = await createAdminToken(username)
    const cookieStore = await cookies()
    cookieStore.set("admin_token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    })

    return NextResponse.json({
      success: true,
      message: "Đổi mật khẩu thành công! Mật khẩu mới đã có hiệu lực ngay lập tức.",
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
