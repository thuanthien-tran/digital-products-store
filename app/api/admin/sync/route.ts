import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { verifyAdminRequest } from '@/lib/auth'
import { runScheduledBackgroundSync } from '@/lib/scheduler'
import { cancelAllExpiredPendingOrders } from '@/lib/order-expiry'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    // Force background sync across all enabled provider connections
    const summary = await runScheduledBackgroundSync({
      force: true,
      minCooldownSeconds: 0,
    })

    // Auto-clean expired pending orders older than 10 minutes
    const expiredCount = await cancelAllExpiredPendingOrders()

    try {
      revalidatePath('/')
      revalidatePath('/admin/products')
      revalidatePath('/admin/sources')
      revalidatePath('/api/store/availability')
    } catch {}

    const totalUpdated = summary.results.reduce((acc, r) => acc + (r.updatedCount || 0), 0)
    const totalNew = summary.results.reduce((acc, r) => acc + (r.newCount || 0), 0)
    const totalDiscontinued = summary.results.reduce((acc, r) => acc + (r.discontinuedCount || 0), 0)

    const extraMsg = expiredCount > 0 ? ` Đồng thời đã tự động dọn dẹp ${expiredCount} đơn hàng hết hạn 10 phút.` : ''

    return NextResponse.json({
      success: true,
      message: `Đồng bộ hoàn tất: Cập nhật ${totalUpdated} sản phẩm, phát hiện ${totalNew} sản phẩm mới, tạm ngưng ${totalDiscontinued} sản phẩm hết nguồn.${extraMsg}`,
      summary,
      expiredOrdersCancelled: expiredCount,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi đồng bộ đại lý'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
