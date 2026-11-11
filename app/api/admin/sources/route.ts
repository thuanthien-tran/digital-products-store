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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limitParam = searchParams.get('limit') || '50'
    const isShowAll = limitParam === 'all'
    const limit = isShowAll
      ? 1000
      : Math.min(1000, Math.max(1, parseInt(limitParam, 10) || 50))
    const skip = isShowAll ? 0 : (page - 1) * limit

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

    const connectionFilter = connectionId ? { connectionId } : {}

    const [sources, total, connections, allCount, newCount, unaddedCount, addedCount, reviewCount, ignoredCount] =
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
            { sourceName: 'asc' },
            { id: 'asc' },
          ],
          ...(isShowAll ? {} : { skip, take: limit }),
        }),
        prisma.sourceProduct.count({ where }),
        prisma.providerConnection.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, provider: true, isEnabled: true },
        }),
        prisma.sourceProduct.count({ where: connectionFilter }),
        prisma.sourceProduct.count({ where: { isAddedToStore: false, editorialStatus: 'new', ...connectionFilter } }),
        prisma.sourceProduct.count({ where: { isAddedToStore: false, editorialStatus: { not: 'ignored' }, ...connectionFilter } }),
        prisma.sourceProduct.count({ where: { isAddedToStore: true, ...connectionFilter } }),
        prisma.sourceProduct.count({ where: { hasChangeAlert: true, ...connectionFilter } }),
        prisma.sourceProduct.count({ where: { editorialStatus: 'ignored', ...connectionFilter } }),
      ])

    const effectivePage = isShowAll ? 1 : page
    const totalPages = isShowAll ? 1 : Math.max(1, Math.ceil(total / limit))

    return NextResponse.json({
      success: true,
      sources,
      connections,
      pagination: {
        page: effectivePage,
        limit: isShowAll ? total : limit,
        total,
        totalPages,
      },
      counts: {
        all: allCount,
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
