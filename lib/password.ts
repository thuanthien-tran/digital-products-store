import crypto from "crypto"

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(":")) return false
  const [salt, key] = storedHash.split(":")
  if (!salt || !key) return false
  const keyBuffer = Buffer.from(key, "hex")
  const derivedKey = crypto.scryptSync(password, salt, 64)
  if (keyBuffer.length !== derivedKey.length) return false
  return crypto.timingSafeEqual(keyBuffer, derivedKey)
}
