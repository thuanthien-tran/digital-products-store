import { NextResponse } from "next/server"
import crypto from "crypto"
import { runScheduledBackgroundSync } from "@/lib/scheduler"
import { verifyAdminRequest } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verifies caller authorization for Cron synchronization.
 * Requires a valid CRON_SECRET configured on the server.
 * Never trusts client-supplied headers like 'x-vercel-cron' without secret proof.
 */
function verifyCronAccess(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.length < 8) {
    // Fail-closed if server secret is missing or insufficiently long
    return false
  }

  const authHeader = req.headers.get("authorization") || ""
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim()
    if (timingSafeCompare(token, cronSecret)) {
      return true
    }
  }

  const xCronKey = req.headers.get("x-cron-key") || req.headers.get("x-cron-secret")
  if (xCronKey && timingSafeCompare(xCronKey, cronSecret)) {
    return true
  }

  return false
}

export async function GET(req: Request) {
  return handleSync(req, "GET")
}

export async function POST(req: Request) {
  return handleSync(req, "POST")
}

async function handleSync(req: Request, method: "GET" | "POST") {
  try {
    const isCronAuthorized = verifyCronAccess(req)
    let isAdmin = false

    if (!isCronAuthorized) {
      // If method is GET, do NOT allow cookie-based admin execution to prevent CSRF
      if (method === "GET") {
        const authHeader = req.headers.get("authorization")
        if (authHeader?.startsWith("Bearer ")) {
          const adminAuth = await verifyAdminRequest(req)
          isAdmin = adminAuth.authenticated
        }
      } else {
        const adminAuth = await verifyAdminRequest(req)
        isAdmin = adminAuth.authenticated
      }
    }

    if (!isCronAuthorized && !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Yêu cầu CRON_SECRET hợp lệ hoặc phiên quản trị viên xác thực" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)

    // Only verified administrators can bypass cooldown using force=true
    const rawForce = searchParams.get("force") === "true"
    const force = isAdmin ? rawForce : false

    // Validate cooldown parameter: strictly bounded between 10s and 3600s
    let cooldown = 60
    const rawCooldown = searchParams.get("cooldown")
    if (rawCooldown !== null && rawCooldown !== "") {
      const parsed = parseInt(rawCooldown, 10)
      if (isNaN(parsed) || parsed < 10 || parsed > 3600) {
        return NextResponse.json(
          { error: "Tham số cooldown không hợp lệ (cho phép từ 10 đến 3600 giây)" },
          { status: 400 }
        )
      }
      cooldown = parsed
    }

    const summary = await runScheduledBackgroundSync({
      force,
      minCooldownSeconds: cooldown,
    })

    return NextResponse.json(summary)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Cron execution failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
