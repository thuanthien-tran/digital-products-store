import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"

export const dynamic = "force-dynamic"

export interface PriceMenuItem {
  id: string
  productId: string
  variantId?: string
  name: string
  note?: string
  price: number
  stock: number
  isEnabled: boolean
  sortOrder: number
}

export interface PriceMenuGroup {
  id: string
  name: string
  sortOrder: number
  isEnabled: boolean
  items: PriceMenuItem[]
}

export async function GET(req: Request) {
  try {
    await ensureDatabaseSchema()
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [products, groups, settings] = await Promise.all([
      prisma.product.findMany({
        where: {
          editorialStatus: "published",
          visibility: "public",
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        include: {
          group: true,
          variants: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
            include: {
              _count: {
                select: { serials: { where: { status: "available" } } },
              },
            },
          },
        },
      }),
      prisma.productGroup.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.siteSettings.findFirst(),
    ])

    // Group products into organized sections
    const groupMap = new Map<string, { id: string; name: string; sortOrder: number; items: PriceMenuItem[] }>()

    // Initialize with existing groups
    for (const g of groups) {
      groupMap.set(g.id, {
        id: g.id,
        name: g.name.toUpperCase(),
        sortOrder: g.sortOrder || 0,
        items: [],
      })
    }

    // Default "Khác" group
    const otherGroupId = "other"
    if (!groupMap.has(otherGroupId)) {
      groupMap.set(otherGroupId, {
        id: otherGroupId,
        name: "SẢN PHẨM KHÁC",
        sortOrder: 999,
        items: [],
      })
    }

    let globalItemIdx = 1

    for (const product of products) {
      const targetGroupId = product.groupId && groupMap.has(product.groupId) ? product.groupId : otherGroupId
      const targetGroup = groupMap.get(targetGroupId)!

      // If product has multiple active variants, list each variant as an item
      if (product.variants && product.variants.length > 1) {
        for (const v of product.variants) {
          const totalStock = (v.providerStock ?? 0) + (v._count?.serials ?? 0)
          let displayName = `${product.name} — ${v.name}`

          // Clean up repetitive names (e.g. "Canva Pro - Canva Pro 1 tháng" -> "Canva Pro 1 tháng")
          if (v.name.toLowerCase().startsWith(product.name.toLowerCase())) {
            displayName = v.name
          }

          targetGroup.items.push({
            id: `v-${v.id}`,
            productId: product.id,
            variantId: v.id,
            name: displayName,
            note: product.warrantyTerms ? "Bảo hành đầy đủ" : undefined,
            price: v.priceCents || 0,
            stock: totalStock,
            isEnabled: true,
            sortOrder: globalItemIdx++,
          })
        }
      } else {
        // Single variant or default
        const mainV = product.variants[0]
        const totalStock = mainV ? (mainV.providerStock ?? 0) + (mainV._count?.serials ?? 0) : 0
        targetGroup.items.push({
          id: `p-${product.id}`,
          productId: product.id,
          variantId: mainV?.id,
          name: product.name,
          note: mainV && mainV.name !== "Mặc định" && mainV.name !== "Gói Mặc Định" ? mainV.name : undefined,
          price: mainV?.priceCents || 0,
          stock: totalStock,
          isEnabled: true,
          sortOrder: globalItemIdx++,
        })
      }
    }

    // Filter out empty groups and sort
    const resultGroups: PriceMenuGroup[] = Array.from(groupMap.values())
      .filter((g) => g.items.length > 0)
      .map((g) => ({
        id: g.id,
        name: g.name,
        sortOrder: g.sortOrder,
        isEnabled: true,
        items: g.items,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)

    return NextResponse.json({
      success: true,
      groups: resultGroups,
      meta: {
        siteName: settings?.siteName || "CAPYGO STORE",
        domain: "capygo.id.vn",
        hotline: process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356.970.964",
        warrantyNote: "KBH: Không bảo hành • Giá và tình trạng có thể thay đổi theo thời điểm",
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
