import { NextRequest, NextResponse } from "next/server"
import { verifyAdminRequest } from "@/lib/auth"
import { validateImageBuffer, saveProductImage } from "@/lib/image-upload"

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Không tìm thấy tệp tải lên." }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Dung lượng ảnh vượt quá 5MB." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const validation = validateImageBuffer(buffer)
    if (!validation.valid || !validation.extension) {
      return NextResponse.json(
        { error: validation.error || "Ảnh không hợp lệ." },
        { status: 400 }
      )
    }

    const publicUrl = await saveProductImage(buffer, validation.extension)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      format: validation.format,
      width: validation.width,
      height: validation.height,
    })
  } catch (error: any) {
    console.error("[POST /api/admin/products/upload] Error:", error)
    return NextResponse.json(
      { error: "Lỗi tải ảnh lên: " + (error.message || "Không xác định") },
      { status: 500 }
    )
  }
}
