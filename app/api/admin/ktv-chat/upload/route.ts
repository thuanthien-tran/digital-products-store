import { NextResponse } from "next/server"
import { verifyAdminRequest } from "@/lib/auth"
import { handleChatImageUpload } from "@/lib/ktv-chat"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
  }
  return handleChatImageUpload(req)
}
