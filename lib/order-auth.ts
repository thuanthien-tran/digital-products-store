import { verifyAdminRequest } from './auth'

export interface OrderAuthContext {
  orderId: string
  accessToken?: string | null
}

/**
 * Universal authorization check for viewing sensitive order details (serials, credentials).
 * Protects against IDOR, serial harvesting, and unauthenticated server-side HTML rendering.
 */
export async function verifyOrderAccess(
  req: Request | { headers: Headers },
  order: OrderAuthContext
): Promise<{ authorized: boolean; reason?: string }> {
  // 1. Admin session has universal authorized access
  if (req instanceof Request) {
    const adminCheck = await verifyAdminRequest(req)
    if (adminCheck.authenticated) {
      return { authorized: true, reason: 'admin' }
    }
  }

  // If order does not have an accessToken set, deny unauthenticated access
  if (!order.accessToken) {
    return { authorized: false, reason: 'order_has_no_token' }
  }

  const headers = req.headers

  // 2. Check x-order-token header
  const tokenHeader = headers.get('x-order-token')
  if (tokenHeader && tokenHeader === order.accessToken) {
    return { authorized: true, reason: 'token_header' }
  }

  // 3. Check query parameter ?token=... if Request
  if (req instanceof Request) {
    try {
      const url = new URL(req.url)
      const tokenQuery = url.searchParams.get('token')
      if (tokenQuery && tokenQuery === order.accessToken) {
        return { authorized: true, reason: 'token_query' }
      }
    } catch {
      // Ignore invalid URL parse
    }
  }

  // 4. Check specific cookie order_access_${order.id}
  const cookieHeader = headers.get('cookie') || ''
  if (cookieHeader) {
    const targetCookieName = `order_access_${order.orderId}`
    // Parse cookies strictly: name=value pairs separated by semicolon
    const cookies = cookieHeader.split(';').map((c) => c.trim())
    for (const c of cookies) {
      const eqIdx = c.indexOf('=')
      if (eqIdx !== -1) {
        const name = c.slice(0, eqIdx).trim()
        const value = decodeURIComponent(c.slice(eqIdx + 1).trim())
        if (name === targetCookieName && value === order.accessToken) {
          return { authorized: true, reason: 'cookie' }
        }
      }
    }
  }

  return { authorized: false, reason: 'unauthorized' }
}
