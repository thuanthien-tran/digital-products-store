import { SignJWT, jwtVerify } from 'jose'

function getJwtSecret(): Uint8Array {
  const secretStr = process.env.JWT_SECRET
  if (!secretStr) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable must be set in production.')
    }
    return new TextEncoder().encode('dev_insecure_fallback_secret_only_for_local_development')
  }
  return new TextEncoder().encode(secretStr)
}

export async function createAdminToken(username: string): Promise<string> {
  return new SignJWT({ username, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecret())
}

export const signAdminToken = createAdminToken

export async function verifyAdminToken(token: string): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    if (payload.role !== 'admin' || typeof payload.username !== 'string') {
      return null
    }
    return { username: payload.username }
  } catch {
    return null
  }
}

/**
 * Universal admin request verifier.
 * Checks HTTP Authorization Header (Bearer token) or HttpOnly cookie 'admin_token'.
 */
export async function verifyAdminRequest(req: Request): Promise<{ authenticated: boolean; username?: string }> {
  // 1. Check Authorization Header: Bearer <token>
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    const verified = await verifyAdminToken(token)
    if (verified) return { authenticated: true, username: verified.username }
  }

  // 2. Check Cookie Header
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(/admin_token=([^;]+)/)
  if (match) {
    const token = decodeURIComponent(match[1])
    const verified = await verifyAdminToken(token)
    if (verified) return { authenticated: true, username: verified.username }
  }

  return { authenticated: false }
}

export async function createCtvToken(): Promise<string> {
  return new SignJWT({ role: 'ctv' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret())
}

export async function verifyCtvToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload.role === 'ctv' || payload.role === 'admin'
  } catch {
    return false
  }
}

export async function verifyCtvRequest(req: Request): Promise<boolean> {
  // Admin always has access
  const adminAuth = await verifyAdminRequest(req)
  if (adminAuth.authenticated) return true

  // Check Authorization Header
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (await verifyCtvToken(token)) return true
  }

  // Check Cookie
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(/ctv_token=([^;]+)/)
  if (match) {
    const token = decodeURIComponent(match[1])
    if (await verifyCtvToken(token)) return true
  }

  return false
}

// In-memory brute force protection for admin login
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

export function checkLoginRateLimit(identifier: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const record = loginAttempts.get(identifier)

  if (!record || now > record.resetAt) {
    loginAttempts.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= maxAttempts) {
    return false // Rate limited
  }

  record.count += 1
  return true
}
