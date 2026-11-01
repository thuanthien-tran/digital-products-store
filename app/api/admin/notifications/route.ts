import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.adminNotification.count({
        where: { isRead: false },
      }),
    ])

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy danh sách thông báo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
