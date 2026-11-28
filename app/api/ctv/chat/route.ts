import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyCtvRequest } from "@/lib/auth"
import {
  notifyTelegramNewKtvChatMessage,
  serializeChatMessage,
  validateChatMessagePayload,
} from "@/lib/ktv-chat"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    if (!(await verifyCtvRequest(req))) {
      return NextResponse.json({ error: "Vui lòng nhập mã PIN KTV để truy cập" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const { searchParams } = new URL(req.url)
    const summaryOnly = searchParams.get("summaryOnly") === "1"
    const markRead = searchParams.get("markRead") === "1"

    if (markRead) {
      await prisma.ktvChatMessage.updateMany({
        where: { sender: "admin", isReadByKtv: false },
        data: { isReadByKtv: true },
      })
    }

    const unreadCount = await prisma.ktvChatMessage.count({
      where: { sender: "admin", isReadByKtv: false },
    })

    if (summaryOnly) {
      return NextResponse.json({ success: true, unreadCount })
    }

    const recent = await prisma.ktvChatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
    })

    return NextResponse.json({
      success: true,
      unreadCount,
      messages: recent.reverse().map(serializeChatMessage),
    })
  } catch (err) {
    console.error("[GET /api/ctv/chat]", err)
    return NextResponse.json({ error: "Không thể tải tin nhắn" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!(await verifyCtvRequest(req))) {
      return NextResponse.json({ error: "Vui lòng nhập mã PIN KTV để truy cập" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const body = await req.json().catch(() => null)
    const validated = validateChatMessagePayload(body)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const created = await prisma.ktvChatMessage.create({
      data: {
        sender: "ktv",
        senderLabel: validated.data.senderLabel || "KTV",
        message: validated.data.message,
        imageUrl: validated.data.imageUrl,
        isReadByAdmin: false,
        isReadByKtv: true,
      },
    })

    // Alert Admin via Telegram Bot cleanly in the background / quick timeout
    await notifyTelegramNewKtvChatMessage({
      senderLabel: created.senderLabel,
      message: created.message,
      hasImage: Boolean(created.imageUrl),
    })

    return NextResponse.json({
      success: true,
      message: serializeChatMessage(created),
    })
  } catch (err) {
    console.error("[POST /api/ctv/chat]", err)
    return NextResponse.json({ error: "Không thể gửi tin nhắn" }, { status: 500 })
  }
}
