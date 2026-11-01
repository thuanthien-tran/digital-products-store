import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminRequest } from '@/lib/auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'ignore'

    const source = await prisma.sourceProduct.findUnique({ where: { id } })
    if (!source) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm nguồn' }, { status: 404 })
    }

    const updated = await prisma.sourceProduct.update({
      where: { id },
      data: {
        editorialStatus: action === 'restore' ? (source.isAddedToStore ? 'draft' : 'new') : 'ignored',
        hasChangeAlert: action === 'restore' ? false : source.hasChangeAlert,
      },
    })

    return NextResponse.json({ success: true, source: updated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi thao tác bỏ qua sản phẩm'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
