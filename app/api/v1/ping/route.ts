import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * Health check & status ping endpoint
 * GET /api/v1/ping
 */
export async function GET() {
  try {
    const start = Date.now()
    const productCount = await prisma.product.count()
    const availableStock = await prisma.serial.count({ where: { status: "available" } })
    const latency = Date.now() - start

    return NextResponse.json({
      status: "online",
      message: "ACCGIARE API Gateway is active",
      timestamp: new Date().toISOString(),
      latency: `${latency}ms`,
      stats: {
        activeProducts: productCount,
        availableSerials: availableStock,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    )
  }
}
