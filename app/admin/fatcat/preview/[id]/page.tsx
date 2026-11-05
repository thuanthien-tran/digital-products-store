import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { cookies } from "next/headers"
import { verifyAdminToken } from "@/lib/auth"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { BrandIcon } from "@/components/storefront/BrandIcons"
import { formatPrice } from "@/lib/utils"
import { ArrowLeft, ShieldAlert, ShoppingCart } from "lucide-react"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminPreviewPage({ params }: Props) {
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
  const sourceProduct = await prisma.sourceProduct.findUnique({
    where: { id },
  })

  if (!sourceProduct) {
    notFound()
  }

  const displayName = sourceProduct.customName || sourceProduct.sourceName
  const displayPrice = sourceProduct.customPrice || sourceProduct.sourcePrice
  const displayDescription = sourceProduct.customDescription || sourceProduct.sourceDescription || "Chưa có mô tả chi tiết."
  const isAvailable = sourceProduct.sourceStock > 0 && sourceProduct.sourceStatus === "available"

  const descParagraphs = displayDescription
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Admin Preview Floating Header */}
      <div className="sticky top-0 z-50 bg-amber-950/90 text-amber-200 border-b border-amber-500/40 px-4 py-2.5 backdrop-blur text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-400 shrink-0" />
          <span className="font-semibold">
            CHẾ ĐỘ XEM TRƯỚC (CHỈ ADMIN THẤY) — TRẠNG THÁI:{" "}
            <span className="uppercase underline font-mono">{sourceProduct.editorialStatus}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/fatcat"
            className="inline-flex items-center gap-1 px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors font-medium"
          >
            <ArrowLeft className="size-3" />
            <span>Quay lại Admin</span>
          </Link>
        </div>
      </div>

      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link
            href="/admin/fatcat"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Về danh sách nguồn FatCat</span>
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Main Info */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-muted-foreground border border-border">
                  Nguồn FatCat #{sourceProduct.externalId}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                    isAvailable
                      ? "text-emerald-400 bg-emerald-950/30 border-emerald-500/25"
                      : "text-rose-400 bg-rose-950/30 border-rose-500/25"
                  }`}
                >
                  {isAvailable ? `Còn hàng (Kho: ${sourceProduct.sourceStock})` : "Tạm hết hàng"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-sans font-bold tracking-tight text-foreground">
                {displayName}
              </h1>

              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-3xl font-sans font-extrabold text-foreground tabular-nums">
                  {formatPrice(displayPrice)}
                </span>
                {sourceProduct.sourceRegularPrice && (
                  <span className="text-sm text-muted-foreground line-through tabular-nums">
                    {formatPrice(Math.round(sourceProduct.sourceRegularPrice * 1.35))}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mô tả &amp; Chi tiết sản phẩm
              </h2>
              <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                {descParagraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              {sourceProduct.customWarrantyInfo && (
                <div className="pt-4 border-t border-border/60 space-y-2">
                  <h3 className="text-xs font-semibold text-foreground">Chính sách bảo hành &amp; giao hàng</h3>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">
                    {sourceProduct.customWarrantyInfo}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Checkout preview card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-secondary border border-border">
                  <BrandIcon name={displayName} className="size-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">{displayName}</h3>
                  <span className="text-xs text-muted-foreground">Xem trước giao diện đặt hàng</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/80 text-xs text-muted-foreground space-y-2">
                <div className="flex justify-between">
                  <span>Giá bán niêm yết:</span>
                  <span className="font-bold text-foreground">{formatPrice(displayPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Giá sỉ đại lý (chỉ admin thấy):</span>
                  <span className="tabular-nums font-medium">{formatPrice(sourceProduct.sourcePrice)}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-semibold pt-1 border-t border-border">
                  <span>Lợi nhuận gộp ước tính:</span>
                  <span>+{formatPrice(displayPrice - sourceProduct.sourcePrice)}</span>
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
                Khách hàng chỉ có thể mua sau khi bạn nhấn &ldquo;Đăng bán&rdquo; trong Admin.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
