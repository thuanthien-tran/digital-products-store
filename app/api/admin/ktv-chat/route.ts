import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"
import { serializeChatMessage, validateChatMessagePayload } from "@/lib/ktv-chat"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const { searchParams } = new URL(req.url)
    const summaryOnly = searchParams.get("summaryOnly") === "1"
    const markRead = searchParams.get("markRead") === "1"

    if (markRead) {
      await prisma.ktvChatMessage.updateMany({
        where: { sender: "ktv", isReadByAdmin: false },
        data: { isReadByAdmin: true },
      })
    }

    const unreadCount = await prisma.ktvChatMessage.count({
      where: { sender: "ktv", isReadByAdmin: false },
    })

    if (summaryOnly) {
      return NextResponse.json({ success: true, unreadCount })
    }

    const recent = await prisma.ktvChatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
    })

    return NextResponse.json({
      success: true,
      unreadCount,
      messages: recent.reverse().map(serializeChatMessage),
    })
  } catch (err) {
    console.error("[GET /api/admin/ktv-chat]", err)
    return NextResponse.json({ error: "Không thể tải đoạn chat KTV" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    await ensureDatabaseSchema()
    const body = await req.json().catch(() => null)
    const validated = validateChatMessagePayload(body)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const created = await prisma.ktvChatMessage.create({
      data: {
        sender: "admin",
        senderLabel: auth.username ? `Admin (${auth.username})` : "Admin",
        message: validated.data.message,
        imageUrl: validated.data.imageUrl,
        isReadByAdmin: true,
        isReadByKtv: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: serializeChatMessage(created),
    })
  } catch (err) {
    console.error("[POST /api/admin/ktv-chat]", err)
    return NextResponse.json({ error: "Không thể gửi tin nhắn" }, { status: 500 })
  }
}
