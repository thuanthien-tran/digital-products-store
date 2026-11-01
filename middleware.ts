import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Protect Admin API endpoints (Return 401 JSON)
  if (pathname.startsWith('/api/admin')) {
    // Exclude public admin login endpoint
    if (pathname === '/api/admin/auth') {
      return NextResponse.next()
    }

    const token =
      request.cookies.get('admin_token')?.value ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      )
    }

    const payload = await verifyAdminToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      )
    }

    return NextResponse.next()
  }

  // 2. Protect Admin UI routes (Redirect to /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const payload = await verifyAdminToken(token)
    if (!payload) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url))
      response.cookies.delete('admin_token')
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
