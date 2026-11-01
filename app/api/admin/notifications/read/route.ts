import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { id, all } = body

    if (all) {
      await prisma.adminNotification.updateMany({
        where: { isRead: false },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })
    } else if (id) {
      await prisma.adminNotification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })
    } else {
      return NextResponse.json({ error: 'Thiếu id hoặc all: true' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái thông báo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
