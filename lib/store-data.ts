import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { getSiteSettings } from "@/lib/settings"

export async function getStoreData() {
  try {
    await ensureDatabaseSchema()
    const [groups, products, settings] = await Promise.all([
      prisma.productGroup.findMany({
        where: { visibility: "public" },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.product.findMany({
        where: { 
          visibility: "public",
          editorialStatus: "published",
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        include: {
          group: true,
          variants: {
            orderBy: { sortOrder: "asc" },
            include: {
              _count: {
                select: { serials: { where: { status: "available" } } },
              },
            },
          },
        },
      }),
      getSiteSettings(),
    ])

    return {
      settings,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        badgeText: g.badgeText,
        badgeColor: g.badgeColor,
      })),
      products: products.map((p) => {
        let parsedImages: string[] = []
        try {
          parsedImages = JSON.parse(p.images || "[]")
        } catch {
          parsedImages = []
        }

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          isFeatured: p.isFeatured,
          sortOrder: p.sortOrder ?? 0,
          description: p.description,
          images: parsedImages,
          groupId: p.groupId,
          groupName: p.group?.name || "Chưa phân loại",
          deliveryType: p.deliveryType,
          statusOverride: p.statusOverride,
          warrantyTerms: p.warrantyTerms,
          noticeNotes: p.noticeNotes,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceCents: v.priceCents,
            compareAtPriceCents: v.compareAtPriceCents,
            availableStock:
              v.provider || p.deliveryType === "fatcat" || p.deliveryType === "dino"
                ? (v.providerStock ?? 0) + v._count.serials
                : v._count.serials,
            providerStock: v.providerStock,
          })),
        }
      }),
    }
  } catch (error) {
    console.error("Failed to load store data:", error)
    return {
      groups: [],
      products: [],
      settings: {
        siteName: process.env.NEXT_PUBLIC_STORE_NAME || "ACCGIARE",
        siteTitle: null,
        logoUrl: null,
        initials: "AG",
      },
    }
  }
}
