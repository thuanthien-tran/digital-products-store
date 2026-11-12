import { NextResponse } from "next/server"
import { verifyCtvRequest } from "@/lib/auth"
import { getKtvPriceListData } from "@/lib/ktv"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const isAuth = await verifyCtvRequest(req)
    if (!isAuth) {
      return NextResponse.json(
        {
          authenticated: false,
          requiresPin: true,
          message: "Vui lòng nhập mã PIN bảo mật để truy cập bảng giá",
        },
        { status: 401 }
      )
    }

    const data = await getKtvPriceListData()

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        ...data,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
