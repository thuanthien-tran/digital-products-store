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
import { ChevronLeft } from "lucide-react"

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
        <strong key={index} className="text-foreground font-medium">
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

    // Respect product level status override and contact mode
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

  // Parse images
  let parsedImages: string[] = []
  try {
    parsedImages = JSON.parse(product.images || "[]")
  } catch {
    parsedImages = []
  }
  const primaryImage = parsedImages[0] || null

  // Split description cleanly
  const rawDesc = product.description || ""
  const descParagraphs = rawDesc.split("\n").filter((p) => p.trim().length > 0)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header initialSettings={settings} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-8 space-y-6">
        {/* Breadcrumb */}
        <nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ChevronLeft className="size-3.5" /> Trang chủ
          </Link>
          <span>/</span>
          {product.group && (
            <>
              <Link href="/#products" className="hover:text-foreground transition-colors">
                {product.group.name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-foreground font-medium truncate max-w-[220px]">{product.name}</span>
        </nav>

        {/* 2-column layout */}
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Left Column: Product Information (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Title & Metadata Container */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              {/* 16:9 Image Frame spanning the full width of the container */}
              <ProductDetailImage
                imageUrl={primaryImage}
                name={product.name}
                groupName={product.group?.name}
              />

              <div className="p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="size-11 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                    <BrandIcon name={product.name} className="size-5" />
                  </div>
                  <div className="space-y-1">
                    {product.group && (
                      <span className="text-xs font-semibold text-accent block">
                        {product.group.name}
                      </span>
                    )}
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
                      {product.name}
                    </h1>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          product.statusOverride === "out_of_stock"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : product.statusOverride === "in_stock" || product.deliveryType === "contact"
                            ? product.deliveryType === "contact"
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : variantsWithStock.every((v) => v.availableStock <= 0)
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            product.statusOverride === "out_of_stock"
                              ? "bg-rose-400"
                              : product.statusOverride === "in_stock" || product.deliveryType === "contact"
                              ? product.deliveryType === "contact"
                                ? "bg-sky-400"
                                : "bg-emerald-400 animate-pulse"
                              : variantsWithStock.every((v) => v.availableStock <= 0)
                              ? "bg-rose-400"
                              : "bg-emerald-400 animate-pulse"
                          }`}
                        />
                        <span>
                          {product.statusOverride === "out_of_stock"
                            ? "Hết hàng"
                            : product.statusOverride === "in_stock"
                            ? "Còn hàng"
                            : product.deliveryType === "contact"
                            ? "Tư vấn & Sẵn sàng cấp"
                            : variantsWithStock.every((v) => v.availableStock <= 0)
                            ? "Hết hàng"
                            : "Còn hàng"}
                        </span>
                      </span>

                      <p className="text-xs text-muted-foreground">
                        • Hình thức bàn giao:{" "}
                        <span className="text-foreground font-medium">
                          {product.deliveryType === "contact"
                            ? "Liên hệ Zalo đặt mua & Bàn giao trực tiếp"
                            : product.deliveryType === "serials"
                            ? "Mã tự động hiển thị ngay sau thanh toán"
                            : "Hỗ trợ kích hoạt trực tiếp"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Structured Details: Mô tả, Hướng dẫn & Chính sách */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              {/* Mô tả */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  Mô tả &amp; Quyền lợi
                </h2>
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  {descParagraphs.map((para, i) => (
                    <p key={i}>
                      {renderFormattedText(para)}
                    </p>
                  ))}
                </div>
              </div>

              {/* Hướng dẫn nhận tài khoản */}
              {product.serviceInstructions && (
                <div className="pt-6 border-t border-border/60 space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Hướng dẫn sau khi nhận mã
                  </h2>
                  <div className="p-4 rounded-lg border border-border/80 bg-secondary/30 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                    {product.serviceInstructions}
                  </div>
                </div>
              )}

              {/* Chính sách bảo hành */}
              <div className="pt-6 border-t border-border/60 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  Chính sách bảo hành
                </h2>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="size-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                    <span>Hỗ trợ đổi mã mới 1-1 nếu tài khoản phát sinh sự cố trong thời gian bảo hành.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="size-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                    <span>Thông tin đơn hàng được bảo mật và lưu trữ trong lịch sử tra cứu.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Checkout Frame (5 cols) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20">
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
        </div>
      </main>
      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
