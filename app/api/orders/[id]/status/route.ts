import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyOrderAccess } from "@/lib/order-auth"

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
            serials: { select: { content: true } },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 })
    }

    // Determine if requester has verified authorization to read serial credentials
    const authResult = await verifyOrderAccess(req, {
      orderId: order.id,
      accessToken: order.accessToken,
    })
    const hasOrderAccess = authResult.authorized

    const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0)
    const remainingCents = Math.max(0, order.totalCents - totalPaid)

    const response = NextResponse.json({
      id: order.id,
      code: order.code,
      status: order.status,
      totalCents: order.totalCents,
      totalPaid,
      remainingCents,
      items: order.items.map((item) => {
        const serialContents = item.serials.map((s) => s.content)
        // INVARIANT: Reveal serials only if order is paid AND requester is verified owner or admin
        const isPaid = order.status === "paid"
        return {
          productName: item.product.name,
          variantName: item.variant.name,
          priceCents: item.priceCents,
          quantity: item.quantity,
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
