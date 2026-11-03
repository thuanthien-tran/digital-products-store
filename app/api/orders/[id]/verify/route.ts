import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { reconcileOrderWithSepay } from "@/lib/sepay"

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    })

    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 })
    }

    if (order.status === "paid") {
      return NextResponse.json({
        success: true,
        paid: true,
        status: "paid",
        message: "Đơn hàng đã thanh toán thành công!",
      })
    }

    if (order.status === "refunded") {
      return NextResponse.json({
        success: false,
        paid: false,
        status: order.status,
        message: `Đơn hàng đã được xử lý hoàn tiền`,
      }, { status: 400 })
    }

    // Trigger proactive reconciliation with SePay API
    const reconcileRes = await reconcileOrderWithSepay(order.id)

    if (reconcileRes.matched && (reconcileRes.orderStatus === "paid" || reconcileRes.orderStatus === "processing")) {
      return NextResponse.json({
        success: true,
        paid: true,
        status: "paid",
        message: "Hệ thống đã tự động xác nhận nhận tiền thành công! Đang bàn giao tài khoản.",
      })
    }

    if (reconcileRes.matched && reconcileRes.orderStatus === "partially_paid") {
      return NextResponse.json({
        success: true,
        paid: false,
        status: "partially_paid",
        message: `Hệ thống đã nhận một phần tiền (${reconcileRes.amountReceived?.toLocaleString("vi-VN")}đ). Vui lòng chuyển tiếp phần còn lại.`,
      })
    }

    return NextResponse.json({
      success: true,
      paid: false,
      status: order.status,
      message: "Hệ thống đang tiếp tục kiểm tra với ngân hàng. Nếu bạn vừa chuyển khoản, vui lòng đợi 5-10 giây để ngân hàng hoàn tất ghi nhận.",
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi kiểm tra thanh toán"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
