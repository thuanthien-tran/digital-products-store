import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"
import { validateStatusTransition, fulfillOrder, releaseOrderSerials } from "@/lib/fulfillment"
import { redeemCouponReservation, releaseCouponReservation } from "@/lib/coupon-service"

export async function PATCH(req: Request) {
  try {
    // 1. Authenticate & Authorize admin privileges
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const body = await req.json()
    const { orderId, status, manualReason, manualAmountReceived, idempotencyKey, action } = body

    if (!orderId) {
      return NextResponse.json({ error: "Thiếu orderId" }, { status: 400 })
    }

    if (action === "fulfill") {
      const fulfillRes = await fulfillOrder(orderId)
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true, items: { include: { serials: true } } },
      })
      return NextResponse.json({ success: true, order, fulfillment: fulfillRes })
    }

    if (!status) {
      return NextResponse.json({ error: "Thiếu status" }, { status: 400 })
    }

    const cleanReason = manualReason ? String(manualReason).trim() : ""

    // 2. Validate request and normalize payload for recording manual payments
    const isSettlement = status === "paid" || status === "partially_paid"
    let parsedAmount: number | null = null
    let cleanKey: string | null = null

    if (isSettlement) {
      // Invariant: idempotencyKey is MANDATORY. No server-side auto-generation fallback.
      if (!idempotencyKey || typeof idempotencyKey !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey.trim())) {
        return NextResponse.json(
          { error: "Bắt buộc phải có idempotencyKey hợp lệ (8-128 ký tự chữ, số, gạch ngang, gạch dưới)" },
          { status: 400 }
        )
      }
      cleanKey = idempotencyKey.trim()

      if (manualAmountReceived === undefined || manualAmountReceived === null) {
        return NextResponse.json(
          { error: "Vui lòng nhập số tiền thực nhận (manualAmountReceived)." },
          { status: 400 }
        )
      }

      parsedAmount = Number(manualAmountReceived)
      if (!Number.isInteger(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1000000000) {
        return NextResponse.json(
          { error: "Số tiền thực nhận (manualAmountReceived) phải là số nguyên dương hợp lệ (1đ - 1.000.000.000đ)." },
          { status: 400 }
        )
      }

      if (!cleanReason || cleanReason.length < 3 || cleanReason.length > 500) {
        return NextResponse.json(
          { error: "Vui lòng nhập lý do / mã tham chiếu đối soát rõ ràng (từ 3 đến 500 ký tự)." },
          { status: 400 }
        )
      }
    } else if (status === "refunded") {
      if (!cleanReason || cleanReason.length < 3) {
        return NextResponse.json(
          { error: "Vui lòng nhập lý do hoàn tiền (manualReason) để lưu vết kiểm toán." },
          { status: 400 }
        )
      }
    }

    // 3. Execute mutation inside atomic database transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Pre-check replay by idempotencyKey BEFORE checking remaining balance or mutating state
      if (isSettlement && cleanKey && parsedAmount !== null) {
        const existingPayment = await tx.payment.findUnique({
          where: { idempotencyKey: cleanKey },
          include: { order: { include: { payments: true } } },
        })

        if (existingPayment) {
          // Check business payload matching
          if (existingPayment.orderId !== orderId || existingPayment.amount !== parsedAmount) {
            const err: any = new Error(`Xung đột Idempotency (HTTP 409): Khóa "${cleanKey}" đã được sử dụng cho giao dịch khác với thông tin không khớp`)
            err.status = 409
            throw err
          }

          // Valid idempotent replay: return current consistent order state without duplicating money or fulfillment
          return existingPayment.order
        }
      }

      // Re-read fresh order state and existing payments inside transaction
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { payments: true },
      })

      if (!currentOrder) {
        const err: any = new Error("Không tìm thấy đơn hàng")
        err.status = 404
        throw err
      }

      // Strict terminal state invariant: cancelled or refunded orders cannot be mutated by new payments
      if ((currentOrder.status === "cancelled" || currentOrder.status === "refunded") && isSettlement) {
        const err: any = new Error(`Đơn hàng đã ở trạng thái kết thúc (${currentOrder.status}) và không thể ghi nhận thêm tiền`)
        err.status = 400
        throw err
      }

      // CASE 1: Settling payment manually (status === "paid" or "partially_paid")
      if (isSettlement && cleanKey && parsedAmount !== null) {
        // Record payment atomically with idempotency key
        try {
          await tx.payment.create({
            data: {
              orderId: currentOrder.id,
              gateway: "manual_admin",
              transactionId: `manual-${currentOrder.id}-${cleanKey}`,
              idempotencyKey: cleanKey,
              amount: parsedAmount,
              content: `Admin ${auth.username || "admin"} duyệt: ${cleanReason}`,
            },
          })
        } catch (dbErr: any) {
          if (dbErr.code === "P2002" && dbErr.meta?.target?.includes("idempotencyKey")) {
            // Concurrent race condition: another concurrent worker created this payment
            const raced = await tx.payment.findUnique({ where: { idempotencyKey: cleanKey } })
            if (raced && (raced.orderId !== orderId || raced.amount !== parsedAmount)) {
              const err: any = new Error(`Xung đột Idempotency (HTTP 409): Khóa "${cleanKey}" đã được xử lý với nội dung không khớp`)
              err.status = 409
              throw err
            }
            return currentOrder
          }
          throw dbErr
        }

        const updatedPayments = await tx.payment.findMany({ where: { orderId: currentOrder.id } })
        const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0)

        if (totalPaid >= currentOrder.totalCents) {
          // Fully paid: mark processing so external provider fulfillment can run safely outside transaction
          await redeemCouponReservation(currentOrder.id, tx)
          return tx.order.update({
            where: { id: orderId },
            data: { status: "processing" },
            include: { payments: true },
          })
        } else {
          // Insufficient payment: mark as partially_paid
          return tx.order.update({
            where: { id: orderId },
            data: {
              status: "partially_paid",
              note: `[Duyệt một phần bởi Admin ${auth.username || "admin"}]: Nhận ${parsedAmount}đ. Còn thiếu ${currentOrder.totalCents - totalPaid}đ.`,
            },
            include: { payments: true },
          })
        }
      }

      // CASE 2: Cancelling an order
      if (status === "cancelled") {
        if (currentOrder.status === "paid") {
          const err: any = new Error("Đơn hàng đã thanh toán thành công và đã bàn giao tài khoản cho khách. Theo chuẩn thương mại điện tử, đơn đã hoàn tất không thể hủy.")
          err.status = 400
          throw err
        }

        if (currentOrder.status === "cancelled") {
          return currentOrder // Idempotent no-op
        }

        const transitionCheck = validateStatusTransition(currentOrder.status, "cancelled")
        if (!transitionCheck.valid) {
          const err: any = new Error(transitionCheck.error)
          err.status = 400
          throw err
        }

        // Quarantine serials if order was paid, refunded, or processing (assigned/delivered)
        await releaseOrderSerials(currentOrder.id, false, tx)
        await releaseCouponReservation(currentOrder.id, tx, "admin_cancelled")

        return tx.order.update({
          where: { id: orderId },
          data: {
            status: "cancelled",
            note: cleanReason ? `[Đã hủy bởi Admin ${auth.username || "admin"}]: ${cleanReason}` : currentOrder.note,
          },
          include: { payments: true },
        })
      }

      // CASE 3: Refunding an order
      if (status === "refunded") {
        if (currentOrder.status === "refunded") {
          return currentOrder // Idempotent no-op
        }

        const transitionCheck = validateStatusTransition(currentOrder.status, "refunded")
        if (!transitionCheck.valid) {
          const err: any = new Error(transitionCheck.error)
          err.status = 400
          throw err
        }

        // Force revoke any disclosed serials
        await releaseOrderSerials(currentOrder.id, true, tx)

        return tx.order.update({
          where: { id: orderId },
          data: {
            status: "refunded",
            note: `[Hoàn tiền bởi Admin ${auth.username || "admin"}]: ${cleanReason}`,
          },
          include: { payments: true },
        })
      }

      // Other lifecycle status transitions
      const transitionCheck = validateStatusTransition(currentOrder.status, status)
      if (!transitionCheck.valid) {
        const err: any = new Error(transitionCheck.error)
        err.status = 400
        throw err
      }

      return tx.order.update({
        where: { id: orderId },
        data: { status },
        include: { payments: true },
      })
    })

    // Run fulfillment outside the DB transaction so network delays to Dino/FatCat cannot cause transaction timeout
    if (updated.status === "processing" && isSettlement) {
      try {
        await fulfillOrder(orderId)
      } catch (fErr) {
        console.error("[Manual Settle Fulfillment Error]:", fErr)
      }
      const finalOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true, items: { include: { serials: true } } },
      })
      return NextResponse.json({ success: true, order: finalOrder || updated })
    }

    return NextResponse.json({ success: true, order: updated })
  } catch (err: unknown) {
    const status = (err as any)?.status || 500
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 })
  }
}

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const whereClause: any = {}
    if (status && status !== "all") {
      whereClause.status = status
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            variant: { select: { name: true } },
            serials: { select: { content: true } },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    const formatted = orders.map((o) => {
      const paidAmount = o.payments.reduce((sum, p) => sum + p.amount, 0)
      return {
        id: o.id,
        code: o.code,
        email: o.email,
        subtotalCents: o.subtotalCents ?? o.totalCents,
        discountCents: o.discountCents ?? 0,
        couponCode: o.couponCode || null,
        couponSnapshot: o.couponSnapshot || null,
        totalCents: o.totalCents,
        paidAmount,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        paymentGateway: o.payments[0]?.gateway || null,
        note: o.note,
        payments: o.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          gateway: p.gateway,
          transactionId: p.transactionId,
          createdAt: p.createdAt.toISOString(),
          content: p.content,
        })),
        items: o.items.map((i) => {
          const serialList = i.serials.map((s) => s.content)
          return {
            name: `${i.product.name} (${i.variant.name})`,
            quantity: i.quantity,
            priceCents: i.priceCents,
            serials: serialList,
            serial: serialList.length > 0 ? serialList.join("\n") : null,
          }
        }),
      }
    })

    return NextResponse.json({ success: true, orders: formatted })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching orders"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { orderId, action } = body

    if (action === "clean_test_orders") {
      const testCodes = [
        "CAN584092", "PAR584099", "AMB584133", "SEC599506", "CAN599559",
        "PAR599568", "RSA599584", "RSB599589", "RET599593", "AMB599606"
      ]

      const deleteRes = await prisma.order.deleteMany({
        where: {
          OR: [
            { code: { in: testCodes } },
            { code: { startsWith: "CAN" } },
            { code: { startsWith: "PAR" } },
            { code: { startsWith: "AMB" } },
            { code: { startsWith: "SEC" } },
            { code: { startsWith: "RSA" } },
            { code: { startsWith: "RSB" } },
            { code: { startsWith: "RET" } },
            { email: { contains: "example.com" } },
            { email: { contains: "audit" } },
            { email: { contains: "test@" } },
            { email: { contains: "tester@" } },
          ],
        },
      })

      return NextResponse.json({
        success: true,
        deletedCount: deleteRes.count,
        message: `Đã xóa ${deleteRes.count} đơn hàng test.`,
      })
    }

    if (!orderId) {
      return NextResponse.json({ error: "Thiếu orderId" }, { status: 400 })
    }

    const orderToDelete = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!orderToDelete) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng cần xóa" }, { status: 404 })
    }

    if (orderToDelete.status === "paid") {
      return NextResponse.json(
        { error: "Đơn hàng đã thanh toán thành công được bảo vệ vĩnh viễn cho mục đích kế toán và kiểm toán, không thể xóa." },
        { status: 400 }
      )
    }

    await prisma.order.delete({
      where: { id: orderId },
    })

    return NextResponse.json({ success: true, message: "Đã xóa đơn hàng thành công" })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error deleting order"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
