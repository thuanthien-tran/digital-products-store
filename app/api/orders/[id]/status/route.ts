import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyOrderAccess } from "@/lib/order-auth"
import { cancelIfExpired, ORDER_EXPIRY_MS } from "@/lib/order-expiry"
import { reconcileOrderWithSepay } from "@/lib/sepay"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        payments: true,
        items: {
          include: {
            product: { select: { name: true, serviceInstructions: true } },
            variant: { select: { name: true } },
            buffFulfillment: true,
            serials: { select: { content: true } },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 })
    }

    let totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0)
    let remainingCents = Math.max(0, order.totalCents - totalPaid)

    // 10-minute payment timeout check: auto-cancel unpaid pending order
    let currentStatus = order.status
    let isExpired = false
    if (order.status === "pending" && totalPaid === 0) {
      isExpired = await cancelIfExpired(order.id, order.createdAt, order.status, totalPaid)
      if (isExpired) {
        currentStatus = "cancelled"
      }
    }

    // Active Proactive SePay Reconciliation:
    // If order is still pending or partially_paid, query SePay API directly to auto-confirm payment
    let currentItems = order.items
    if (!isExpired && (currentStatus === "pending" || currentStatus === "partially_paid")) {
      try {
        const reconcileRes = await reconcileOrderWithSepay(order.id)
        if (reconcileRes.matched) {
          currentStatus = reconcileRes.orderStatus
          // Refresh order and items from DB
          const refreshed = await prisma.order.findUnique({
            where: { id: order.id },
            include: {
              payments: true,
              items: {
                include: {
                  product: { select: { name: true, serviceInstructions: true } },
                  variant: { select: { name: true } },
                  buffFulfillment: true,
                  serials: { select: { content: true } },
                },
              },
            },
          })
          if (refreshed) {
            currentItems = refreshed.items
            totalPaid = refreshed.payments.reduce((sum, p) => sum + p.amount, 0)
            remainingCents = Math.max(0, refreshed.totalCents - totalPaid)
          }
        }
      } catch (recErr) {
        // Fallback silently if SePay API is momentarily unreachable
      }
    }

    // Determine if requester has verified authorization to read serial credentials
    const authResult = await verifyOrderAccess(req, {
      orderId: order.id,
      accessToken: order.accessToken,
    })
    const hasOrderAccess = authResult.authorized

    // Self-healing: if order is fully paid but fulfillment is pending or interrupted, auto-fulfill
    if (!isExpired && (currentStatus === "pending" || currentStatus === "processing") && totalPaid >= order.totalCents) {
      try {
        const { fulfillOrder, syncBuffFulfillmentsForOrder } = await import("@/lib/fulfillment")
        const fRes = await fulfillOrder(order.id)
        await syncBuffFulfillmentsForOrder(order.id)
        if (fRes.status) {
          currentStatus = fRes.status
          // Re-fetch fresh serials & buff fulfillment
          const refreshed = await prisma.order.findUnique({
            where: { id: order.id },
            include: {
              items: {
                include: {
                  product: { select: { name: true, serviceInstructions: true } },
                  variant: { select: { name: true } },
                  buffFulfillment: true,
                  serials: { select: { content: true } },
                },
              },
            },
          })
          if (refreshed) {
            currentItems = refreshed.items
          }
        }
      } catch (fErr) {
        console.error("[Auto-Fulfillment on Status Poll Error]:", fErr)
      }
    } else if (currentStatus === "paid") {
      try {
        const { syncBuffFulfillmentsForOrder } = await import("@/lib/fulfillment")
        await syncBuffFulfillmentsForOrder(order.id)
      } catch {}
    }

    const expiresAt = new Date(new Date(order.createdAt).getTime() + ORDER_EXPIRY_MS).toISOString()

    const response = NextResponse.json({
      id: order.id,
      code: order.code,
      status: currentStatus,
      createdAt: order.createdAt.toISOString(),
      expiresAt,
      isExpired,
      totalCents: order.totalCents,
      totalPaid,
      remainingCents,
      items: currentItems.map((item) => {
        const serialContents = item.serials.map((s) => s.content)
        // INVARIANT: Reveal serials only if order is paid AND requester is verified owner or admin
        const isPaid = currentStatus === "paid"
        const buff = (item as any).buffFulfillment
        return {
          productName: item.product.name,
          variantName: item.variant.name,
          priceCents: item.priceCents,
          quantity: item.quantity,
          tokenAmountB: (item as any).tokenAmountB ?? null,
          inviteCode: hasOrderAccess ? (item as any).inviteCode : ((item as any).inviteCode ? `${(item as any).inviteCode.slice(0, 2)}***` : null),
          buffFulfillment: buff ? {
            status: buff.status,
            tokenAmountB: buff.tokenAmountB,
            completedB: buff.completedB,
            providerOrderCode: buff.providerOrderCode,
            inviteCode: hasOrderAccess ? buff.inviteCode : `${buff.inviteCode.slice(0, 2)}***`,
            errorMessage: buff.errorMessage,
          } : null,
          serials: isPaid && hasOrderAccess ? serialContents : [],
          serial: isPaid && hasOrderAccess ? serialContents.join("\n") || null : null,
          serviceInstructions: item.product.serviceInstructions,
        }
      }),
    })

    // Never cache order status responses
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate")
    return response
  } catch (err) {
    console.error("Order status check error:", err)
    return NextResponse.json({ error: "Lỗi hệ thống khi kiểm tra trạng thái" }, { status: 500 })
  }
}
