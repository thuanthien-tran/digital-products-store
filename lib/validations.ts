import crypto from "node:crypto"

/**
 * Validates email format according to RFC 5322 standard
 */
export function validateEmail(email: unknown): { valid: boolean; normalized?: string; error?: string } {
  if (typeof email !== "string") {
    return { valid: false, error: "Email phải là chuỗi ký tự" }
  }

  const trimmed = email.trim().toLowerCase()
  if (!trimmed) {
    return { valid: false, error: "Email không được để trống" }
  }

  if (trimmed.length > 254) {
    return { valid: false, error: "Email quá dài (tối đa 254 ký tự)" }
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: "Định dạng email không hợp lệ (Ví dụ: ban@gmail.com)" }
  }

  return { valid: true, normalized: trimmed }
}

/**
 * Validates purchase quantity strictly
 */
export function validateQuantity(
  qty: unknown,
  maxAllowed = 50,
  currentStock?: number
): { valid: boolean; value: number; error?: string } {
  if (qty === undefined || qty === null || qty === "") {
    return { valid: false, value: 0, error: "Số lượng không được để trống" }
  }

  const num = Number(qty)
  if (!Number.isInteger(num)) {
    return { valid: false, value: 0, error: "Số lượng phải là số nguyên" }
  }

  if (num <= 0) {
    return { valid: false, value: 0, error: "Số lượng mua tối thiểu là 1" }
  }

  if (num > maxAllowed) {
    return { valid: false, value: 0, error: `Số lượng mua tối đa là ${maxAllowed}` }
  }

  if (currentStock !== undefined && num > currentStock) {
    return {
      valid: false,
      value: num,
      error: `Kho không đủ hàng (Hiện chỉ còn ${currentStock} sản phẩm)`,
    }
  }

  return { valid: true, value: num }
}

/**
 * Generates an unguessable 32-character hexadecimal token for order access
 */
export function generateAccessToken(): string {
  return crypto.randomBytes(24).toString("hex")
}
