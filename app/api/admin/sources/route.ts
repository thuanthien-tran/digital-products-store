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
    const connectionId = searchParams.get('connectionId') || ''
    const tab = searchParams.get('tab') || 'all'
    const status = searchParams.get('status') || ''
    const search = (searchParams.get('search') || '').trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)))
    const skip = (page - 1) * limit

    const where: Prisma.SourceProductWhereInput = {}

    if (connectionId) {
      where.connectionId = connectionId
    }

    if (status) {
      where.sourceStatus = status
    }

    if (search) {
      where.OR = [
        { sourceName: { contains: search } },
        { externalId: { contains: search } },
        { customName: { contains: search } },
      ]
    }

    if (tab === 'new') {
      where.isAddedToStore = false
      where.editorialStatus = 'new'
    } else if (tab === 'added') {
      where.isAddedToStore = true
    } else if (tab === 'unadded') {
      where.isAddedToStore = false
      where.editorialStatus = { not: 'ignored' }
    } else if (tab === 'review') {
      where.hasChangeAlert = true
    } else if (tab === 'ignored') {
      where.editorialStatus = 'ignored'
    }

    const [sources, total, connections, newCount, unaddedCount, addedCount, reviewCount, ignoredCount] =
      await Promise.all([
        prisma.sourceProduct.findMany({
          where,
          include: {
            connection: {
              select: { id: true, name: true, provider: true },
            },
            product: {
              select: { id: true, name: true, slug: true, visibility: true, editorialStatus: true },
            },
          },
          orderBy: [
            { hasChangeAlert: 'desc' },
            { lastSyncedAt: 'desc' },
          ],
          skip,
          take: limit,
        }),
        prisma.sourceProduct.count({ where }),
        prisma.providerConnection.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, provider: true, isEnabled: true },
        }),
        prisma.sourceProduct.count({ where: { isAddedToStore: false, editorialStatus: 'new', ...(connectionId ? { connectionId } : {}) } }),
        prisma.sourceProduct.count({ where: { isAddedToStore: false, editorialStatus: { not: 'ignored' }, ...(connectionId ? { connectionId } : {}) } }),
        prisma.sourceProduct.count({ where: { isAddedToStore: true, ...(connectionId ? { connectionId } : {}) } }),
        prisma.sourceProduct.count({ where: { hasChangeAlert: true, ...(connectionId ? { connectionId } : {}) } }),
        prisma.sourceProduct.count({ where: { editorialStatus: 'ignored', ...(connectionId ? { connectionId } : {}) } }),
      ])

    return NextResponse.json({
      success: true,
      sources,
      connections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        all: total,
        new: newCount,
        unadded: unaddedCount,
        added: addedCount,
        review: reviewCount,
        ignored: ignoredCount,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi lấy danh mục nguồn'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
