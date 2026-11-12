import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { isValidVisitorId, recordVisitorPing } from "@/lib/analytics"

const VISITOR_COOKIE_NAME = "capygo_vid"
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function POST(req: NextRequest) {
  try {
    const cookieId = req.cookies.get(VISITOR_COOKIE_NAME)?.value
    const visitorId = isValidVisitorId(cookieId) ? cookieId : crypto.randomUUID()
    const userAgent = req.headers.get("user-agent")

    const stats = await recordVisitorPing(visitorId, userAgent)

    const payload = stats.showVisitorStats
      ? stats
      : {
          onlineCount: 0,
          totalVisits: 0,
          todayVisits: 0,
          showVisitorStats: false,
        }

    const res = NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    })

    if (cookieId !== visitorId) {
      res.cookies.set(VISITOR_COOKIE_NAME, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: ONE_YEAR_SECONDS,
        secure: process.env.NODE_ENV === "production",
      })
    }

    return res
  } catch (error) {
    console.error("[POST /api/analytics/ping] Error:", error)
    return NextResponse.json(
      { onlineCount: 0, totalVisits: 0, todayVisits: 0, showVisitorStats: false },
      { status: 200 }
    )
  }
}
