import fs from "fs/promises"
import path from "path"
import crypto from "crypto"

export interface ImageValidationResult {
  valid: boolean
  error?: string
  format?: "png" | "jpeg" | "webp"
  width?: number
  height?: number
  extension?: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_DIMENSION = 4096
const MIN_DIMENSION = 16

/**
 * Validates image buffer by verifying:
 * 1. File size <= 5MB
 * 2. Magic byte signatures (strict PNG, JPEG, WebP only)
 * 3. Extracts and validates image dimensions (16px to 4096px)
 */
export function validateImageBuffer(buffer: Buffer): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "File rỗng hoặc không có dữ liệu." }
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: "Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 5MB)." }
  }

  // Reject obvious HTML, PHP, or script files attempting to bypass extension
  const probeHeader = buffer.subarray(0, Math.min(buffer.length, 256)).toString("utf-8").toLowerCase().trim()
  if (
    probeHeader.startsWith("<!doctype") ||
    probeHeader.startsWith("<html") ||
    probeHeader.startsWith("<?php") ||
    probeHeader.startsWith("<script")
  ) {
    return { valid: false, error: "Tệp chứa mã không hợp lệ (chỉ chấp nhận định dạng ảnh PNG, JPG, WebP)." }
  }

  // Check PNG (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)

    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      return { valid: false, error: `Kích thước ảnh quá nhỏ (${width}x${height}px). Yêu cầu tối thiểu ${MIN_DIMENSION}x${MIN_DIMENSION}px.` }
    }
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      return { valid: false, error: `Kích thước ảnh quá lớn (${width}x${height}px). Yêu cầu tối đa ${MAX_DIMENSION}x${MAX_DIMENSION}px.` }
    }

    return { valid: true, format: "png", width, height, extension: "png" }
  }

  // Check JPEG (FF D8 FF)
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const dim = parseJpegDimensions(buffer)
    if (!dim) {
      return { valid: false, error: "Tệp JPEG bị lỗi cấu trúc hoặc không thể giải mã kích thước." }
    }
    if (dim.width < MIN_DIMENSION || dim.height < MIN_DIMENSION) {
      return { valid: false, error: `Kích thước ảnh quá nhỏ (${dim.width}x${dim.height}px). Yêu cầu tối thiểu ${MIN_DIMENSION}x${MIN_DIMENSION}px.` }
    }
    if (dim.width > MAX_DIMENSION || dim.height > MAX_DIMENSION) {
      return { valid: false, error: `Kích thước ảnh quá lớn (${dim.width}x${dim.height}px). Yêu cầu tối đa ${MAX_DIMENSION}x${MAX_DIMENSION}px.` }
    }

    return { valid: true, format: "jpeg", width: dim.width, height: dim.height, extension: "jpg" }
  }

  // Check WebP (RIFF .... WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    const dim = parseWebpDimensions(buffer)
    if (!dim) {
      return { valid: false, error: "Tệp WebP bị lỗi cấu trúc hoặc không thể giải mã kích thước." }
    }
    if (dim.width < MIN_DIMENSION || dim.height < MIN_DIMENSION) {
      return { valid: false, error: `Kích thước ảnh quá nhỏ (${dim.width}x${dim.height}px). Yêu cầu tối thiểu ${MIN_DIMENSION}x${MIN_DIMENSION}px.` }
    }
    if (dim.width > MAX_DIMENSION || dim.height > MAX_DIMENSION) {
      return { valid: false, error: `Kích thước ảnh quá lớn (${dim.width}x${dim.height}px). Yêu cầu tối đa ${MAX_DIMENSION}x${MAX_DIMENSION}px.` }
    }

    return { valid: true, format: "webp", width: dim.width, height: dim.height, extension: "webp" }
  }

  return {
    valid: false,
    error: "Định dạng tệp không được hỗ trợ. Chỉ chấp nhận định dạng ảnh PNG, JPEG hoặc WebP.",
  }
}

/**
 * Parses dimensions from JPEG SOF markers.
 */
function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) {
      offset++
      continue
    }

    const marker = buffer[offset + 1]
    // Baseline & progressive SOF markers
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = buffer.readUInt16BE(offset + 5)
      const width = buffer.readUInt16BE(offset + 7)
      return { width, height }
    }

    const length = buffer.readUInt16BE(offset + 2)
    offset += 2 + length
  }
  return null
}

/**
 * Parses dimensions from WebP chunks (VP8, VP8L, VP8X).
 */
function parseWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null

  const chunkHeader = buffer.subarray(12, 16).toString("ascii")

  // VP8X: Extended format
  if (chunkHeader === "VP8X") {
    // Canvas width is 24-bit int at offset 24 (+1)
    const width = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16)
    const height = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16)
    return { width, height }
  }

  // VP8L: Lossless format
  if (chunkHeader === "VP8L") {
    if (buffer[20] !== 0x2f) return null
    const b1 = buffer[21]
    const b2 = buffer[22]
    const b3 = buffer[23]
    const b4 = buffer[24]
    const width = 1 + (((b2 & 0x3f) << 8) | b1)
    const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
    return { width, height }
  }

  // VP8: Simple lossy format
  if (chunkHeader === "VP8 ") {
    // Keyframe signature at byte 23..25 is 9d 01 2a
    if (buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      const width = buffer.readUInt16LE(26) & 0x3fff
      const height = buffer.readUInt16LE(28) & 0x3fff
      return { width, height }
    }
  }

  return null
}

/**
 * Saves validated image buffer to disk under public/uploads/branding/
 * with a secure random filename.
 */
export async function saveBrandAvatar(buffer: Buffer, extension: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "branding")
  await fs.mkdir(uploadDir, { recursive: true })

  const uniqueId = crypto.randomUUID()
  const filename = `logo-${uniqueId}.${extension}`
  const filePath = path.join(uploadDir, filename)

  await fs.writeFile(filePath, buffer)

  // Returns URL for the custom serving endpoint
  return `/api/uploads/branding/${filename}`
}
