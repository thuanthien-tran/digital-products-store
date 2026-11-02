import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { slugify } from "@/lib/utils"
import { verifyAdminRequest } from "@/lib/auth"
import { Prisma } from "@prisma/client"

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const tab = searchParams.get("tab") || "all"
    const search = (searchParams.get("search") || "").trim()

    const where: Prisma.ProductWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ]
    }

    if (tab === "draft") {
      where.editorialStatus = "draft"
    } else if (tab === "published") {
      where.editorialStatus = "published"
      where.visibility = "public"
    } else if (tab === "hidden") {
      where.OR = [
        { editorialStatus: "hidden" },
        { visibility: "hidden", editorialStatus: { not: "draft" } },
      ]
    }

    const [products, total, draftCount, publishedCount, hiddenCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          group: true,
          variants: {
            include: {
              connection: {
                select: { id: true, name: true, provider: true },
              },
              sourceProduct: {
                select: { id: true, sourceName: true, sourcePrice: true, sourceStock: true, sourceStatus: true },
              },
              _count: {
                select: { serials: { where: { status: "available" } } },
              },
            },
          },
          sourceProduct: {
            select: { id: true, externalId: true, hasChangeAlert: true },
          },
        },
      }),
      prisma.product.count({ where }),
      prisma.product.count({ where: { editorialStatus: "draft" } }),
      prisma.product.count({ where: { editorialStatus: "published", visibility: "public" } }),
      prisma.product.count({ where: { OR: [{ editorialStatus: "hidden" }, { visibility: "hidden", editorialStatus: { not: "draft" } }] } }),
    ])

    return NextResponse.json({
      success: true,
      products,
      total,
      counts: {
        all: draftCount + publishedCount + hiddenCount,
        draft: draftCount,
        published: publishedCount,
        hidden: hiddenCount,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const {
      name,
      groupId,
      description,
      priceCents,
      variantName,
      deliveryType,
      serviceInstructions,
      warrantyTerms,
      noticeNotes,
    } = await req.json()

    if (!name || priceCents === undefined || priceCents === null) {
      return NextResponse.json({ error: "Tên và giá sản phẩm là bắt buộc" }, { status: 400 })
    }

    const parsedPrice = parseInt(String(priceCents), 10)
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json({ error: "Giá sản phẩm phải là số nguyên dương" }, { status: 400 })
    }

    let slug = slugify(name)
    const existing = await prisma.product.findUnique({ where: { slug } })
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`
    }

    // Every newly created product defaults to DRAFT (hidden, not buyable)
    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        slug,
        groupId: groupId || null,
        description: description || name,
        deliveryType: deliveryType || "serials",
        serviceInstructions: serviceInstructions || null,
        warrantyTerms: warrantyTerms || "Bảo hành 1 đổi 1 trong thời gian sử dụng.",
        noticeNotes: noticeNotes || null,
        visibility: "hidden", // Mặc định là bản nháp ẩn
        editorialStatus: "draft",
        variants: {
          create: {
            name: variantName || "Mặc định",
            priceCents: parsedPrice,
          },
        },
      },
      include: { variants: true },
    })

    return NextResponse.json({ success: true, product })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await verifyAdminRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 })
    }

    const { productId } = await req.json()
    if (!productId) {
      return NextResponse.json({ error: "Thiếu productId" }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    })

    if (!product) {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm cần xóa" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // 1. Reset liên kết sourceProduct nếu có
      await tx.sourceProduct.updateMany({
        where: { productId },
        data: { productId: null, variantId: null, isAddedToStore: false, editorialStatus: "draft" },
      })

      // 2. Xóa các serial thuộc các biến thể của sản phẩm
      await tx.serial.deleteMany({
        where: { variant: { productId } },
      })

      // 3. Xóa các mục orderItem liên kết với sản phẩm này
      await tx.orderItem.deleteMany({
        where: { productId },
      })

      // 4. Xóa các biến thể của sản phẩm
      await tx.variant.deleteMany({
        where: { productId },
      })

      // 5. Xóa sản phẩm
      await tx.product.delete({
        where: { id: productId },
      })
    })

    return NextResponse.json({ success: true, message: "Đã xóa vĩnh viễn sản phẩm thành công" })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
