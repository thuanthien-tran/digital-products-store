import { NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { verifyAdminRequest, verifyCtvRequest } from "@/lib/auth"

export const dynamic = "force-dynamic"

const MAX_SOUND_BYTES = 2 * 1024 * 1024 // 2 MB

export function detectAudioExtension(
  buffer: Buffer,
  fileName: string
): "mp3" | "wav" | "ogg" | "m4a" | "webm" | null {
  if (!buffer || buffer.length < 12) return null

  // Reject HTML / PHP / scripts
  const headText = buffer.subarray(0, Math.min(buffer.length, 128)).toString("utf-8").trim().toLowerCase()
  if (
    headText.startsWith("<!doctype") ||
    headText.startsWith("<html") ||
    headText.startsWith("<script") ||
    headText.startsWith("<?php")
  ) {
    return null
  }

  // WAV: RIFF....WAVE
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return "wav"
  }

  // OGG: OggS
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return "ogg"
  }

  // WebM (EBML header: 1A 45 DF A3)
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm"
  }

  // M4A / MP4 audio: ....ftyp
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return "m4a"
  }

  // MP3: ID3 tag or MPEG audio frame sync (FF Ex)
  if (
    buffer.subarray(0, 3).toString("ascii") === "ID3" ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return "mp3"
  }

  // Fallback check if filename ends with .mp3/.wav/.ogg/.m4a/.webm when metadata frame is offset
  const ext = path.extname(fileName || "").toLowerCase().replace(".", "")
  if (ext === "mp3" || ext === "wav" || ext === "ogg" || ext === "m4a" || ext === "webm") {
    return ext
  }

  return null
}

export async function POST(req: Request) {
  try {
    const adminAuth = await verifyAdminRequest(req)
    const ctvAuth = adminAuth.authenticated ? true : await verifyCtvRequest(req)

    if (!adminAuth.authenticated && !ctvAuth) {
      return NextResponse.json({ error: "Vui lòng đăng nhập Admin hoặc KTV" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Vui lòng chọn tệp âm thanh" }, { status: 400 })
    }

    if (file.size > MAX_SOUND_BYTES) {
      return NextResponse.json({ error: "File âm thanh quá lớn (tối đa 2MB)" }, { status: 400 })
    }

    const fileName = "name" in file && typeof file.name === "string" ? file.name : "sound.mp3"
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ext = detectAudioExtension(buffer, fileName)
    if (!ext) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ định dạng âm thanh MP3, WAV, OGG, M4A hoặc WebM" },
        { status: 400 }
      )
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "sounds")
    await fs.mkdir(uploadDir, { recursive: true })

    const safeFile = `sound-${crypto.randomUUID()}.${ext}`
    await fs.writeFile(path.join(uploadDir, safeFile), buffer)

    return NextResponse.json({
      success: true,
      url: `/api/uploads/sounds/${safeFile}`,
      name: fileName,
    })
  } catch (err) {
    console.error("[POST /api/uploads/sounds]", err)
    return NextResponse.json({ error: "Không thể tải file âm thanh lên" }, { status: 500 })
  }
}
