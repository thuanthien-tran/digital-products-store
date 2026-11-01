import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { cookies } from "next/headers"
import { verifyAdminToken } from "@/lib/auth"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { BrandIcon } from "@/components/storefront/BrandIcons"
import { ProductCard } from "@/components/storefront/ProductCard"
import { formatPrice } from "@/lib/utils"
import { ArrowLeft, ShieldAlert, ShoppingCart, Layers, ExternalLink } from "lucide-react"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProductPreviewPage({ params }: Props) {
  // 1. Strict admin verification
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (!token) {
    redirect("/admin/login")
  }

  const payload = await verifyAdminToken(token)
  if (!payload) {
    redirect("/admin/login")
  }

  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      group: true,
      variants: {
        include: {
          connection: true,
          sourceProduct: true,
          _count: { select: { serials: { where: { status: "available" } } } },
        },
      },
    },
  })

  if (!product) {
    notFound()
  }

  // Parse images
  let displayImages: string[] = []
  try {
    displayImages = JSON.parse(product.images || "[]")
  } catch {
    displayImages = []
  }

  // If there are staged draft changes, prioritize displaying them for review
  let displayName = product.name
  let displayDescription = product.description
  let displayWarranty = product.warrantyTerms
  let displayInstructions = product.usageInstructions || product.serviceInstructions
  let displayNotes = product.noticeNotes
  let displayHighlights: string[] | undefined

  if (product.draftSnapshot) {
    try {
      const staged = JSON.parse(product.draftSnapshot)
      if (staged.name) displayName = staged.name
      if (staged.description) displayDescription = staged.description
      if (staged.warrantyTerms !== undefined) displayWarranty = staged.warrantyTerms
      if (staged.usageInstructions !== undefined) displayInstructions = staged.usageInstructions
      if (staged.noticeNotes !== undefined) displayNotes = staged.noticeNotes
      if (staged.images && Array.isArray(staged.images)) displayImages = staged.images
      if (staged.highlights && Array.isArray(staged.highlights)) displayHighlights = staged.highlights
    } catch {
      // ignore
    }
  }

  const mainVariant = product.variants[0]
  const displayPrice = mainVariant?.priceCents || 0
  const displayComparePrice = mainVariant?.compareAtPriceCents
  const availableStock = (mainVariant?.providerStock || 0) + (mainVariant?._count?.serials || 0)

  const descParagraphs = displayDescription
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const cardVariants = product.variants.map((v) => ({
    id: v.id,
    name: v.name,
    priceCents: v.priceCents,
    compareAtPriceCents: v.compareAtPriceCents,
    availableStock: (v.providerStock || 0) + (v._count?.serials || 0),
    providerStock: v.providerStock,
  }))

  const primaryImage = displayImages[0] || null

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Admin Floating Banner */}
      <div className="sticky top-0 z-50 bg-amber-950/90 text-amber-200 border-b border-amber-500/40 px-4 py-2.5 backdrop-blur text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-400 shrink-0" />
          <span className="font-semibold">
            CHẾ ĐỘ XEM TRƯỚC SẢN PHẨM (CHỈ ADMIN THẤY) — TRẠNG THÁI:{" "}
            <span className="uppercase underline font-mono font-bold">
              {product.editorialStatus === "published" && product.hasPendingChanges
                ? "Đang bán (Có bản nháp chờ cập nhật)"
                : product.editorialStatus === "published"
                ? "Đang bán công khai"
                : "Bản nháp ẩn"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors font-medium"
          >
            <ArrowLeft className="size-3" />
            <span>Quay lại Quản lý sản phẩm</span>
          </Link>
        </div>
      </div>

      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 py-8 space-y-12">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Về danh sách sản phẩm</span>
          </Link>

          <span className="text-xs font-mono text-muted-foreground">
            ID: {product.id} · Slug: {product.slug}
          </span>
        </div>

        {/* 1. Preview 16:9 Card on Storefront Catalog */}
        <section className="p-6 rounded-2xl border border-border/80 bg-card/40 backdrop-blur space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-accent" />
              <h2 className="font-bold text-sm text-foreground">
                Xem Trước Thẻ Sản Phẩm Hiển Thị Trên Trang Chủ (Storefront Card 16:9)
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Khung tỉ lệ 16:9 chuẩn
            </span>
          </div>

          <div className="max-w-xs mx-auto pt-2">
            <ProductCard
              id={product.id}
              name={displayName}
              slug={product.slug}
              description={displayDescription}
              images={displayImages}
              groupId={product.groupId}
              groupName={product.group?.name || "Chưa phân loại"}
              deliveryType={product.deliveryType}
              statusOverride={product.statusOverride}
              highlights={displayHighlights}
              warrantyTerms={displayWarranty}
              noticeNotes={displayNotes}
              variants={cardVariants}
            />
          </div>
        </section>

        {/* 2. Preview Product Detail Page View */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 border-b border-border/50 pb-3">
            <ExternalLink className="size-4 text-accent" />
            <h2 className="font-bold text-sm text-foreground">
              Xem Trước Trang Chi Tiết Sản Phẩm (Product Detail Page)
            </h2>
          </div>

          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Main Info */}
            <div className="lg:col-span-7 space-y-6">
              {/* Title & Metadata Container with 16:9 Banner Image */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="relative aspect-video w-full overflow-hidden bg-muted/20 border-b border-border/50 select-none">
                  {primaryImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={primaryImage}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-card via-muted/30 to-background">
                      <div className="size-14 rounded-2xl bg-secondary border border-border flex items-center justify-center text-primary shadow-inner">
                        <BrandIcon name={displayName} className="size-7" />
                      </div>
                      <span className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-wide">
                        {product.group?.name || "Chưa có ảnh đại diện"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="size-11 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                      <BrandIcon name={displayName} className="size-5" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        {product.group && (
                          <span className="text-xs font-semibold text-accent block">
                            {product.group.name}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${
                            availableStock > 0
                              ? "text-emerald-400 bg-emerald-950/30 border-emerald-500/25"
                              : "text-muted-foreground bg-secondary/50 border-border"
                          }`}
                        >
                          {availableStock > 0 ? "Còn hàng" : "Tạm hết"}
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
                        {displayName}
                      </h1>
                      <div className="flex items-baseline gap-2.5 pt-0.5">
                        <span className="text-2xl font-bold text-foreground tabular-nums">
                          {formatPrice(displayPrice)}
                        </span>
                        {displayComparePrice ? (
                          <span className="text-xs text-muted-foreground line-through tabular-nums">
                            {formatPrice(displayComparePrice)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground pt-1">
                        Hình thức bàn giao:{" "}
                        <span className="text-foreground font-medium">
                          {product.deliveryType === "serials"
                            ? "Mã tự động hiển thị ngay sau thanh toán"
                            : "Hỗ trợ kích hoạt trực tiếp"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Structured Description */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mô tả &amp; Chi tiết sản phẩm
                </h2>
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {descParagraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>

                {displayInstructions && (
                  <div className="pt-4 border-t border-border/60 space-y-1.5">
                    <h3 className="text-xs font-semibold text-foreground">Hướng dẫn sử dụng &amp; Nhận hàng</h3>
                    <p className="text-xs text-muted-foreground whitespace-pre-line font-mono bg-secondary/30 p-3 rounded-lg border border-border/80">
                      {displayInstructions}
                    </p>
                  </div>
                )}

                {displayWarranty && (
                  <div className="pt-4 border-t border-border/60 space-y-1.5">
                    <h3 className="text-xs font-semibold text-foreground">Chính sách bảo hành</h3>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                      {displayWarranty}
                    </p>
                  </div>
                )}

                {displayNotes && (
                  <div className="pt-4 border-t border-border/60 space-y-1.5">
                    <h3 className="text-xs font-semibold text-amber-400">Lưu ý trước khi mua</h3>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                      {displayNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Checkout Card (Locked for preview) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm sticky top-16">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-secondary border border-border">
                    <BrandIcon name={displayName} className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{displayName}</h3>
                    <span className="text-xs text-muted-foreground">Gói thanh toán chuẩn</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/80 text-xs text-muted-foreground space-y-2">
                  <div className="flex justify-between">
                    <span>Giá bán khách thấy:</span>
                    <span className="font-bold text-foreground">{formatPrice(displayPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hình thức nhận:</span>
                    <span className="text-foreground">Tự động ngay trên web</span>
                  </div>
                </div>

                {/* Disabled Buy Button in Preview */}
                <button
                  type="button"
                  disabled
                  className="w-full py-3 rounded-xl font-bold text-sm bg-muted text-muted-foreground cursor-not-allowed flex items-center justify-center gap-2 border border-border"
                >
                  <ShoppingCart className="size-4" />
                  <span>Nút mua bị khóa trong bản xem trước</span>
                </button>
                <p className="text-[11px] text-center text-muted-foreground">
                  Giao diện này phản ánh chính xác 100% những gì người mua sẽ nhìn thấy.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
