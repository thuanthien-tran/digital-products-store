import { NextResponse } from "next/server"
import { getSiteSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const settings = await getSiteSettings()
    return NextResponse.json(settings, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    })
  } catch (error) {
    console.error("[GET /api/site-settings] Error:", error)
    return NextResponse.json(
      {
        siteName: process.env.NEXT_PUBLIC_STORE_NAME || "ACCGIARE",
        logoUrl: null,
        initials: "AG",
        version: 1,
      },
      { status: 200 }
    )
  }
}
