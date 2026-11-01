import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * Public Products & Stock API
 * GET /api/v1/products
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")

    const groups = await prisma.productGroup.findMany({
      where: category ? { name: { contains: category } } : undefined,
      include: {
        products: {
          where: {
            visibility: "public",
            editorialStatus: "published",
          },
          include: {
            variants: {
              include: {
                _count: {
                  select: { serials: { where: { status: "available" } } },
                },
              },
            },
          },
        },
      },
    })

    const formatted = groups.flatMap((group) =>
      group.products
        .filter((p) => p.statusOverride !== "out_of_stock")
        .map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          category: group.name,
          deliveryType: product.deliveryType,
          variants: product.variants.map((variant) => ({
            id: variant.id,
            name: variant.name,
            price: variant.priceCents,
            stock: variant._count.serials,
            inStock: variant._count.serials > 0,
          })),
        }))
    )

    return NextResponse.json(
      {
        success: true,
        total: formatted.length,
        data: formatted,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
