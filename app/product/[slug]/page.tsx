import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { getSiteSettings } from "@/lib/settings"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { PurchaseForm } from "@/components/storefront/PurchaseForm"
import { BrandIcon } from "@/components/storefront/BrandIcons"
import { ProductDetailImage } from "@/components/storefront/ProductDetailImage"
import { ChevronRight, ShieldCheck, AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface Props {
  params: Promise<{ slug: string }>
}

function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="text-foreground font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

async function getProduct(slug: string) {
  await ensureDatabaseSchema()
  try {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        group: true,
        variants: {
          orderBy: { sortOrder: "asc" },
          include: {
            _count: { select: { serials: { where: { status: "available" } } } },
          },
        },
      },
    })

    if (!product || product.visibility !== "public" || product.editorialStatus !== "published") {
      return null
    }

    return product
  } catch {
    return null
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const [product, settings] = await Promise.all([
    getProduct(slug),
    getSiteSettings(),
  ])
  if (!product) notFound()

  const isBuffOrService =
    product.fulfillmentType === "buff" ||
    product.deliveryType === "service" ||
    product.deliveryType === "buff" ||
    /buff/i.test(product.name)

  const variantsWithStock = product.variants.map((v) => {
    const isBuffVariant = isBuffOrService || Boolean(v.tokenAmountB) || /buff|\d+b/i.test(v.name)

    let stock = isBuffVariant
      ? (v.providerStock || 999)
      : (v.provider || product.deliveryType === "fatcat" || product.deliveryType === "dino"
          ? (v.providerStock ?? 0) + v._count.serials
          : v._count.serials)

    if (v.isActive === false || product.statusOverride === "out_of_stock") {
      stock = 0
    } else if (product.statusOverride === "in_stock" || product.deliveryType === "contact" || isBuffVariant) {
      stock = Math.max(stock, 999)
    }

    return {
      id: v.id,
      name: v.name,
      priceCents: v.priceCents,
      compareAtPriceCents: v.compareAtPriceCents,
      availableStock: stock,
      minQuantity: v.minQuantity,
      maxQuantity: v.maxQuantity,
      tokenAmountB: v.tokenAmountB,
      isActive: v.isActive,
    }
  })

  let parsedImages: string[] = []
  try {
    parsedImages = JSON.parse(product.images || "[]")
  } catch {
    parsedImages = []
  }
  const primaryImage = parsedImages[0] || null

  const rawDesc = product.description || ""
  const descParagraphs = rawDesc.split("\n").filter((p) => p.trim().length > 0)

  const isAllOutOfStock =
    product.statusOverride === "out_of_stock" ||
    (product.statusOverride !== "in_stock" &&
      product.deliveryType !== "contact" &&
      variantsWithStock.every((v) => v.availableStock <= 0))

  const isKBH = /kbh|không bảo hành|no warranty|\(nw\)/i.test(
    `${product.name} ${product.warrantyTerms || ""} ${product.noticeNotes || ""}`
  )

  const deliverySummary =
    product.deliveryType === "contact"
      ? "Liên hệ Zalo để đặt hàng và bàn giao trực tiếp"
      : isBuffOrService
      ? "Nạp / kích hoạt trực tiếp vào tài khoản"
      : "Hiển thị thông tin bàn giao trong trang đơn hàng"

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header initialSettings={settings} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 pt-5 pb-12 space-y-5">
        {/* Breadcrumb */}
        <nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">
            Trang chủ
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <Link href="/san-pham" className="hover:text-foreground transition-colors">
            Sản phẩm
          </Link>
          {product.group && (
            <>
              <ChevronRight className="size-3.5 text-muted-foreground/60" />
              <span className="text-muted-foreground">{product.group.name}</span>
            </>
          )}
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <span className="text-foreground font-medium truncate max-w-[220px] sm:max-w-xs">
            {product.name}
          </span>
        </nav>

        {/*
          Natural DOM order (Summary -> PurchaseForm -> Detailed Description):
          - Mobile (< lg): flows naturally without CSS order-* mismatching keyboard/screen-reader order.
          - Desktop (lg): Summary (left top) + Details (left bottom) alongside sticky PurchaseForm (right).
        */}
        <div className="grid gap-6 lg:grid-cols-12 lg:grid-rows-[auto_1fr] items-start">
          {/* 1. Product Summary Header Card */}
          <div className="lg:col-start-1 lg:col-span-7 lg:row-start-1 rounded-2xl border border-border bg-card overflow-hidden">
            <ProductDetailImage
              imageUrl={primaryImage}
              name={product.name}
              groupName={product.group?.name}
            />

            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="size-11 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                  <BrandIcon name={product.name} className="size-5" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  {product.group && (
                    <span className="text-xs font-medium text-primary block">
                      {product.group.name}
                    </span>
                  )}
                  <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug break-words">
                    {product.name}
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/70 text-xs sm:text-[13px]">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium border ${
                    isAllOutOfStock
                      ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                      : product.deliveryType === "contact"
                      ? "bg-secondary text-foreground border-border"
                      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      isAllOutOfStock
                        ? "bg-rose-400"
                        : product.deliveryType === "contact"
                        ? "bg-primary"
                        : "bg-emerald-400"
                    }`}
                  />
                  <span>
                    {isAllOutOfStock
                      ? "Tạm hết hàng"
                      : product.deliveryType === "contact"
                      ? "Tư vấn & Đặt qua Zalo"
                      : "Còn hàng"}
                  </span>
                </span>

                <span className="text-muted-foreground">
                  Bàn giao: <strong className="text-foreground font-medium">{deliverySummary}</strong>
                </span>
              </div>

              {isKBH && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs sm:text-[13px] text-amber-200 leading-relaxed">
                  <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Lưu ý bảo hành:</strong> Sản phẩm thuộc diện không bảo hành (KBH) hoặc bảo hành giới hạn. Vui lòng đọc kỹ điều kiện trước khi thanh toán.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Purchase Form */}
          <div className="lg:col-start-8 lg:col-span-5 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-20">
            <PurchaseForm
              product={{
                id: product.id,
                name: product.name,
                deliveryType: product.deliveryType,
                fulfillmentType: product.fulfillmentType,
                quantityMode: product.quantityMode,
                requiresInviteCode: product.requiresInviteCode,
                statusOverride: product.statusOverride,
                noticeNotes: product.noticeNotes,
                warrantyTerms: product.warrantyTerms,
              }}
              variants={variantsWithStock}
            />
          </div>

          {/* 3. Detailed Description, Instructions & Warranty */}
          <div className="lg:col-start-1 lg:col-span-7 lg:row-start-2 rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-6">
            {descParagraphs.length > 0 && (
              <section className="space-y-2.5">
                <h2 className="text-base font-semibold text-foreground">
                  Thông tin &amp; Quyền lợi
                </h2>
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  {descParagraphs.map((para, i) => (
                    <p key={i}>{renderFormattedText(para)}</p>
                  ))}
                </div>
              </section>
            )}

            {product.serviceInstructions && (
              <section className="pt-5 border-t border-border space-y-2.5">
                <h2 className="text-base font-semibold text-foreground">
                  Hướng dẫn sử dụng / kích hoạt
                </h2>
                <div className="p-4 rounded-xl border border-border bg-background text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {product.serviceInstructions}
                </div>
              </section>
            )}

            {product.noticeNotes && (
              <section className="pt-5 border-t border-border space-y-2.5">
                <h2 className="text-base font-semibold text-foreground">
                  Lưu ý quan trọng
                </h2>
                <div className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/5 text-sm text-amber-200/90 leading-relaxed whitespace-pre-line">
                  {product.noticeNotes}
                </div>
              </section>
            )}

            <section className="pt-5 border-t border-border space-y-2.5">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <span>Chính sách bảo hành</span>
              </h2>
              {product.warrantyTerms && product.warrantyTerms.trim() ? (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {product.warrantyTerms}
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <span>Chính sách bảo hành áp dụng theo từng gói cụ thể đã ghi rõ trên tên và mô tả sản phẩm.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <span>Thông tin bàn giao và hóa đơn điện tử được lưu trực tiếp tại trang chi tiết đơn hàng.</span>
                  </li>
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
