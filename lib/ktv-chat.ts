import { NextResponse } from "next/server"
import { validateImageBuffer, saveChatImage } from "./image-upload"
import { getTelegramConfig } from "./telegram-config"
import { escapeHtml } from "./buff-notify"

export type ChatSender = "admin" | "ktv"

export interface KtvChatMessageDto {
  id: string
  sender: ChatSender
  senderLabel: string | null
  message: string | null
  imageUrl: string | null
  isReadByAdmin: boolean
  isReadByKtv: boolean
  createdAt: string
}

const SAFE_CHAT_IMAGE_URL_REGEX = /^\/api\/uploads\/chat\/chat-[a-f0-9-]+\.(png|jpg|jpeg|webp)$/i

export function serializeChatMessage(row: {
  id: string
  sender: string
  senderLabel: string | null
  message: string | null
  imageUrl: string | null
  isReadByAdmin: boolean
  isReadByKtv: boolean
  createdAt: Date
}): KtvChatMessageDto {
  return {
    id: row.id,
    sender: row.sender === "admin" ? "admin" : "ktv",
    senderLabel: row.senderLabel,
    message: row.message,
    imageUrl: row.imageUrl,
    isReadByAdmin: row.isReadByAdmin,
    isReadByKtv: row.isReadByKtv,
    createdAt: row.createdAt.toISOString(),
  }
}

export function validateChatMessagePayload(body: unknown):
  | {
      ok: true
      data: {
        message: string | null
        imageUrl: string | null
        senderLabel: string | null
      }
    }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Dữ liệu tin nhắn không hợp lệ" }
  }

  const rec = body as Record<string, unknown>
  const rawMessage = typeof rec.message === "string" ? rec.message.trim() : ""
  const rawImageUrl = typeof rec.imageUrl === "string" ? rec.imageUrl.trim() : ""
  const rawLabel = typeof rec.senderLabel === "string" ? rec.senderLabel.trim() : ""

  if (rawMessage.length > 2000) {
    return { ok: false, error: "Tin nhắn quá dài (tối đa 2.000 ký tự)" }
  }
  if (rawImageUrl && !SAFE_CHAT_IMAGE_URL_REGEX.test(rawImageUrl)) {
    return { ok: false, error: "Đường dẫn ảnh đính kèm không hợp lệ" }
  }
  if (rawLabel.length > 60) {
    return { ok: false, error: "Tên hiển thị quá dài (tối đa 60 ký tự)" }
  }

  if (!rawMessage && !rawImageUrl) {
    return { ok: false, error: "Vui lòng nhập nội dung hoặc chọn ảnh để gửi" }
  }

  return {
    ok: true,
    data: {
      message: rawMessage || null,
      imageUrl: rawImageUrl || null,
      senderLabel: rawLabel || null,
    },
  }
}

/**
 * Shared multipart image upload processor used by both KTV and Admin chat upload endpoints.
 */
export async function handleChatImageUpload(req: Request): Promise<NextResponse> {
  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Không tìm thấy tệp ảnh tải lên" }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Dung lượng ảnh vượt quá giới hạn 5MB" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const validation = validateImageBuffer(buffer)
    if (!validation.valid || !validation.extension) {
      return NextResponse.json(
        { error: validation.error || "Ảnh không hợp lệ (chỉ nhận PNG, JPG, WebP)" },
        { status: 400 }
      )
    }

    const url = await saveChatImage(buffer, validation.extension)
    return NextResponse.json({
      success: true,
      url,
      format: validation.format,
    })
  } catch (err) {
    console.error("[Chat Image Upload Error]:", err)
    return NextResponse.json({ error: "Lỗi tải ảnh lên máy chủ" }, { status: 500 })
  }
}

/**
 * Sends a concise Telegram alert when KTV sends a message on web chat.
 */
export async function notifyTelegramNewKtvChatMessage(params: {
  senderLabel?: string | null
  message?: string | null
  hasImage: boolean
}): Promise<void> {
  try {
    const cfg = await getTelegramConfig()
    if (!cfg.botToken || !cfg.chatId) return

    const who = params.senderLabel ? ` (${escapeHtml(params.senderLabel)})` : ""
    const preview = params.message
      ? escapeHtml(params.message.length > 300 ? `${params.message.slice(0, 300)}...` : params.message)
      : ""
    const lines = [
      `💬 <b>TIN NHẮN MỚI TỪ KTV${who}</b>`,
      preview ? `\n${preview}` : "",
      params.hasImage ? "\n🖼️ <i>[Có đính kèm hình ảnh]</i>" : "",
      `\n\n👉 Vào trang <b>Admin → Chat KTV</b> trên web để trả lời ngay.`,
    ]
      .filter(Boolean)
      .join("")

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4500)
    try {
      await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: cfg.chatId,
          text: lines,
          parse_mode: "HTML",
        }),
      })
    } finally {
      clearTimeout(timer)
    }
  } catch {
    // Non-blocking fallback
  }
}
