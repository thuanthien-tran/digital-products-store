import { NextResponse } from "next/server"
import { getVisitorStats } from "@/lib/analytics"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const stats = await getVisitorStats()
    const payload = stats.showVisitorStats
      ? stats
      : {
          onlineCount: 0,
          totalVisits: 0,
          todayVisits: 0,
          showVisitorStats: false,
        }

    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.error("[GET /api/analytics/stats] Error:", error)
    return NextResponse.json(
      { onlineCount: 0, totalVisits: 0, todayVisits: 0, showVisitorStats: false },
      { status: 200 }
    )
  }
}
