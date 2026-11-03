import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const [products, groups] = await Promise.all([
      prisma.product.findMany({
        where: {
          visibility: 'public',
          editorialStatus: 'published',
        },
        orderBy: { sortOrder: 'asc' },
        include: {
          group: true,
          variants: {
            orderBy: { sortOrder: 'asc' },
            include: {
              _count: {
                select: { serials: { where: { status: 'available' } } },
              },
            },
          },
        },
      }),
      prisma.productGroup.findMany({
        where: { visibility: 'public' },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, badgeText: true, badgeColor: true },
      }),
    ])

    const mappedProducts = products.map((p) => {
      let parsedImages: string[] = []
      try {
        parsedImages = JSON.parse(p.images || '[]')
      } catch {
        parsedImages = []
      }

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        images: parsedImages,
        groupId: p.groupId,
        groupName: p.group?.name || 'Chưa phân loại',
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
            v.provider || p.deliveryType === 'fatcat' || p.deliveryType === 'dino'
              ? (v.providerStock ?? 0) + v._count.serials
              : v._count.serials,
          providerStock: v.providerStock,
        })),
      }
    })

    return NextResponse.json(
      {
        success: true,
        products: mappedProducts,
        groups: groups.map((g) => ({
          id: g.id,
          name: g.name,
          badgeText: g.badgeText,
          badgeColor: g.badgeColor,
        })),
        timestamp: Date.now(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
