import { NextResponse } from "next/server"
import { verifyAdminRequest } from "@/lib/auth"
import { getFatcatBalance, getFatcatConfig } from "@/lib/fatcat"
import { runFatcatCatalogSync } from "@/lib/fatcat-sync-service"
import { prisma } from "@/lib/db"

/**
 * GET /api/admin/fatcat
 * Tra cứu số dư ví đại lý và trạng thái đồng bộ từ FatCat
 */
export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const config = getFatcatConfig()
    const balanceRes = await getFatcatBalance()

    const [syncedCount, sourceCount, lastSync] = await Promise.all([
      prisma.variant.count({
        where: { provider: "fatcat" },
      }),
      prisma.sourceProduct.count({
        where: { provider: "fatcat" },
      }),
      prisma.syncLog.findFirst({
        where: { provider: "fatcat" },
        orderBy: { startedAt: "desc" },
      }),
    ])

    return NextResponse.json({
      config: {
        apiUrl: config.apiUrl,
        isEnabled: config.isEnabled,
        hasKey: Boolean(config.apiKey),
      },
      balance: balanceRes.data || { balance_vnd: 0, balance_usdt: 0, usdt_rate: 0 },
      syncedCount,
      sourceCount,
      lastSync,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/fatcat
 * Thực hiện đồng bộ toàn bộ bảng giá và tồn kho từ FatCat vào SourceProduct
 */
export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const result = await runFatcatCatalogSync({ actorUsername: auth.username })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
