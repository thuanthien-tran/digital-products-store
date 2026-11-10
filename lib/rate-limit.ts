const rateLimits = new Map<string, { count: number; resetAt: number }>()

/**
 * In-memory sliding-window-style rate limiter:
 * Clean, lightweight, zero-dependency.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now()
  const record = rateLimits.get(key)

  if (!record || now > record.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs })
    // Occasional cleanup of stale entries
    if (rateLimits.size > 2000) {
      for (const [k, v] of rateLimits.entries()) {
        if (now > v.resetAt) rateLimits.delete(k)
      }
    }
    return { allowed: true, remaining: maxRequests - 1, resetInMs: windowMs }
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetInMs: Math.max(0, record.resetAt - now) }
  }

  record.count += 1
  return { allowed: true, remaining: maxRequests - record.count, resetInMs: Math.max(0, record.resetAt - now) }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "127.0.0.1"
}
