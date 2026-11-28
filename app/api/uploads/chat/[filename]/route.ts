import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const SAFE_CHAT_FILENAME_REGEX = /^chat-[a-f0-9-]+\.(png|jpg|jpeg|webp)$/i

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params

  if (!filename || !SAFE_CHAT_FILENAME_REGEX.test(filename)) {
    return new NextResponse("Tên tệp không hợp lệ", { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "chat")
  const resolvedPath = path.resolve(uploadDir, filename)

  if (!resolvedPath.startsWith(uploadDir)) {
    return new NextResponse("Truy cập bị từ chối", { status: 403 })
  }

  try {
    const fileBuffer = await fs.readFile(resolvedPath)
    const ext = path.extname(filename).toLowerCase()

    let contentType = "application/octet-stream"
    if (ext === ".png") contentType = "image/png"
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg"
    else if (ext === ".webp") contentType = "image/webp"

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "ENOENT") {
      return new NextResponse("Ảnh không tồn tại", { status: 404 })
    }
    return new NextResponse("Lỗi máy chủ", { status: 500 })
  }
}
