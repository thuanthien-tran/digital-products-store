import { NextResponse } from "next/server"
import { getLivePurchasabilityByVariantIds } from "@/lib/purchasability"
import { getGlobalInventoryTimestamp } from "@/lib/inventory-pipeline"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Public lightweight availability endpoint.
 * Polled by active client tabs every 15-20s without reloading the page.
 * 
 * SECURITY & PRIVACY INVARIANTS:
 * 1. Only returns public purchasability and stock availability.
 * 2. NEVER exposes provider names, wholesale costs, API keys, or internal errors.
 * 3. Rejects invalid, malformed, or excessive ID counts (> 50).
 * 4. Never exposes draft or hidden products.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rawVariantIds = searchParams.get("variantIds")

    if (!rawVariantIds) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp danh sách variantIds" },
        { status: 400 }
      )
    }

    const variantIds = rawVariantIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)

    if (variantIds.length === 0 || variantIds.length > 50) {
      return NextResponse.json(
        { error: "Số lượng variantIds phải từ 1 đến 50" },
        { status: 400 }
      )
    }

    const purchasabilityMap = await getLivePurchasabilityByVariantIds(variantIds)

    const variantsData: Record<
      string,
      {
        isPurchasable: boolean
        displayStatus: string
        availableStock: number
        userMessage?: string
        unitPriceCents: number
      }
    > = {}

    for (const [vId, p] of purchasabilityMap.entries()) {
      variantsData[vId] = {
        isPurchasable: p.isPurchasable,
        displayStatus: p.displayStatus,
        availableStock: p.availableStock,
        userMessage: p.userMessage,
        unitPriceCents: p.unitPriceCents,
      }
    }

    return NextResponse.json(
      {
        timestamp: getGlobalInventoryTimestamp(),
        variants: variantsData,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
