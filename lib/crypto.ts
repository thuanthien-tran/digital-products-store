import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

/**
 * Derives the primary 32-byte key for AES-256-GCM.
 * Fail-closed in production if no secret is configured.
 */
function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: ENCRYPTION_SECRET (hoặc JWT_SECRET) bắt buộc phải được cấu hình trong môi trường Production.')
    }
    return crypto.createHash('sha256').update('dev_insecure_fallback_secret_only_for_local_development').digest()
  }
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypts a sensitive string (API Key) using AES-256-GCM with authentication tag.
 * Returns a composite string: iv:tag:ciphertext (in hex)
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getMasterKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')
  const tag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext}`
}

/**
 * Decrypts a previously encrypted secret string.
 * Supports backward-compatible legacy key transition (e.g. when migrating from JWT_SECRET to ENCRYPTION_SECRET).
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return ''
  const parts = encryptedPayload.split(':')
  if (parts.length !== 3) {
    throw new Error('Dữ liệu khóa bí mật mã hóa không đúng định dạng')
  }

  const [ivHex, tagHex, ciphertextHex] = parts
  const hexRegex = /^[0-9a-fA-F]+$/
  if (!hexRegex.test(ivHex) || !hexRegex.test(tagHex) || !hexRegex.test(ciphertextHex)) {
    throw new Error('Dữ liệu mã hóa chứa ký tự hex không hợp lệ')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const primaryKey = getMasterKey()

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, primaryKey, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (primaryErr) {
    // Legacy migration compatibility: If ENCRYPTION_SECRET is set but payload was encrypted with JWT_SECRET
    const legacySecret = process.env.JWT_SECRET
    if (process.env.ENCRYPTION_SECRET && legacySecret && process.env.ENCRYPTION_SECRET !== legacySecret) {
      try {
        const legacyKey = crypto.createHash('sha256').update(legacySecret).digest()
        const decipherLegacy = crypto.createDecipheriv(ALGORITHM, legacyKey, iv)
        decipherLegacy.setAuthTag(tag)
        let decryptedLegacy = decipherLegacy.update(ciphertextHex, 'hex', 'utf8')
        decryptedLegacy += decipherLegacy.final('utf8')
        return decryptedLegacy
      } catch {
        // Fall through to throw
      }
    }
    throw new Error('Không thể giải mã khóa bí mật: Xác thực Auth Tag thất bại hoặc sai khóa mã hóa')
  }
}

/**
 * Masks an API key for safe UI display without exposing the secret.
 * e.g., "demo_key_example_123456" -> "demo_ke••••••••••••"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  const trimmed = apiKey.trim()
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}••••••`
  }
  const prefix = trimmed.slice(0, 7)
  const maskedLength = Math.max(12, trimmed.length - 7)
  return `${prefix}${'•'.repeat(maskedLength)}`
}
