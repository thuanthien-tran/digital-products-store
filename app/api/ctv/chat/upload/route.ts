import { NextResponse } from "next/server"
import { verifyCtvRequest } from "@/lib/auth"
import { handleChatImageUpload } from "@/lib/ktv-chat"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (!(await verifyCtvRequest(req))) {
    return NextResponse.json({ error: "Vui lòng nhập mã PIN KTV để truy cập" }, { status: 401 })
  }
  return handleChatImageUpload(req)
}
