import { NextResponse } from "next/server"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { verifyAdminRequest } from "@/lib/auth"

export const dynamic = "force-dynamic"

export interface StoreCatalogOption {
  id: string
  productId: string
  variantId?: string
  productName: string
  variantName: string
  fullName: string
  groupName: string
  price: number
  stock: number
}

export interface PriceMenuItem {
  id: string
  productId?: string
  variantId?: string
  name: string
  note?: string
  price: number
  stock: number
  isEnabled: boolean
  sortOrder: number
  linkedProductId?: string
  linkedVariantId?: string
  linkedName?: string
  autoSync?: boolean
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

    // Build flat catalog for linking / binding picker
    const catalog: StoreCatalogOption[] = []

    // Group products into organized sections
    const groupMap = new Map<string, { id: string; name: string; sortOrder: number; items: PriceMenuItem[] }>()

    for (const g of groups) {
      groupMap.set(g.id, {
        id: g.id,
        name: g.name.toUpperCase(),
        sortOrder: g.sortOrder || 0,
        items: [],
      })
    }

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
      const groupName = product.group?.name || "Khác"

      if (product.variants && product.variants.length > 1) {
        for (const v of product.variants) {
          const totalStock = (v.providerStock ?? 0) + (v._count?.serials ?? 0)
          let displayName = `${product.name} — ${v.name}`
          if (v.name.toLowerCase().startsWith(product.name.toLowerCase())) {
            displayName = v.name
          }

          catalog.push({
            id: `${product.id}:${v.id}`,
            productId: product.id,
            variantId: v.id,
            productName: product.name,
            variantName: v.name,
            fullName: displayName,
            groupName,
            price: v.priceCents || 0,
            stock: totalStock,
          })

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
            linkedProductId: product.id,
            linkedVariantId: v.id,
            linkedName: displayName,
            autoSync: true,
          })
        }
      } else {
        const mainV = product.variants[0]
        const totalStock = mainV ? (mainV.providerStock ?? 0) + (mainV._count?.serials ?? 0) : 0
        const vName = mainV && mainV.name !== "Mặc định" && mainV.name !== "Gói Mặc Định" ? mainV.name : ""
        const fullName = vName ? `${product.name} (${vName})` : product.name

        catalog.push({
          id: mainV ? `${product.id}:${mainV.id}` : product.id,
          productId: product.id,
          variantId: mainV?.id,
          productName: product.name,
          variantName: vName || "Mặc định",
          fullName,
          groupName,
          price: mainV?.priceCents || 0,
          stock: totalStock,
        })

        targetGroup.items.push({
          id: `p-${product.id}`,
          productId: product.id,
          variantId: mainV?.id,
          name: product.name,
          note: vName || undefined,
          price: mainV?.priceCents || 0,
          stock: totalStock,
          isEnabled: true,
          sortOrder: globalItemIdx++,
          linkedProductId: product.id,
          linkedVariantId: mainV?.id,
          linkedName: fullName,
          autoSync: true,
        })
      }
    }

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
      catalog,
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
