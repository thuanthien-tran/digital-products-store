import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get('tab') || 'all'
    const search = (searchParams.get('search') || '').trim()
    const sourceStatus = searchParams.get('sourceStatus') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    // Base filter
    const where: Prisma.SourceProductWhereInput = {
      provider: 'fatcat',
    }

    if (search) {
      where.OR = [
        { sourceName: { contains: search } },
        { customName: { contains: search } },
        { externalId: { contains: search } },
      ]
    }

    if (sourceStatus) {
      where.sourceStatus = sourceStatus
    }

    // Tab filter
    if (tab === 'new') {
      where.editorialStatus = 'new'
    } else if (tab === 'draft') {
      where.editorialStatus = 'draft'
    } else if (tab === 'published') {
      where.editorialStatus = 'published'
    } else if (tab === 'review') {
      where.hasChangeAlert = true
    } else if (tab === 'ignored') {
      where.editorialStatus = 'ignored'
    }

    const [products, total, newCount, draftCount, publishedCount, reviewCount, ignoredCount, lastSyncLog] =
      await Promise.all([
        prisma.sourceProduct.findMany({
          where,
          include: {
            product: {
              include: {
                group: true,
                variants: {
                  include: {
                    _count: { select: { serials: { where: { status: 'available' } } } },
                  },
                },
              },
            },
          },
          orderBy: [
            { hasChangeAlert: 'desc' },
            { lastSyncedAt: 'desc' },
            { id: 'desc' },
          ],
          skip,
          take: limit,
        }),
        prisma.sourceProduct.count({ where }),
        prisma.sourceProduct.count({ where: { provider: 'fatcat', editorialStatus: 'new' } }),
        prisma.sourceProduct.count({ where: { provider: 'fatcat', editorialStatus: 'draft' } }),
        prisma.sourceProduct.count({ where: { provider: 'fatcat', editorialStatus: 'published' } }),
        prisma.sourceProduct.count({ where: { provider: 'fatcat', hasChangeAlert: true } }),
        prisma.sourceProduct.count({ where: { provider: 'fatcat', editorialStatus: 'ignored' } }),
        prisma.syncLog.findFirst({
          where: { provider: 'fatcat' },
          orderBy: { startedAt: 'desc' },
        }),
      ])

    return NextResponse.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        new: newCount,
        draft: draftCount,
        published: publishedCount,
        review: reviewCount,
        ignored: ignoredCount,
        total: newCount + draftCount + publishedCount + ignoredCount,
      },
      lastSync: lastSyncLog,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy danh sách sản phẩm nguồn'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
