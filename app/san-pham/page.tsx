import { Metadata } from "next"
import Link from "next/link"
import { getStoreData } from "@/lib/store-data"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { StorefrontCatalog } from "@/components/storefront/StorefrontCatalog"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { ChevronRight, Home, ShoppingBag, Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getStoreData()
  const siteName = settings?.siteName || "CapyGo"

  return {
    title: `Sản phẩm & Gói Dịch vụ | ${siteName}`,
    description: `Khám phá toàn bộ danh mục tài khoản bản quyền, phần mềm làm việc, học tập và giải trí tự động 24/7 tại ${siteName}.`,
    openGraph: {
      title: `Sản phẩm & Gói Dịch vụ | ${siteName}`,
      description: `Khám phá toàn bộ danh mục tài khoản bản quyền, phần mềm làm việc, học tập và giải trí tại ${siteName}.`,
    },
  }
}

export default async function SanPhamPage() {
  const { groups, products, settings } = await getStoreData()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Header initialSettings={settings} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 pt-4 sm:pt-6 pb-12 sm:pb-16 space-y-6 sm:space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link
            href="/"
            className="hover:text-foreground transition-colors flex items-center gap-1.5 py-1"
          >
            <Home className="size-3.5 text-caramel" />
            <span>Trang chủ</span>
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/60" />
          <span className="text-foreground font-semibold py-1">Sản phẩm & Gói</span>
        </nav>

        {/* Dedicated Page Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-caramel/25 bg-gradient-to-br from-caramel/[0.08] via-card to-card/60 p-6 sm:p-9 shadow-xl shadow-black/25">
          {/* Subtle warm glow background */}
          <div
            className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-caramel/15 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-caramel/15 text-caramel border border-caramel/30 backdrop-blur">
              <Sparkles className="size-3.5 text-caramel animate-pulse" />
              <span>Kho sản phẩm & gói số</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-extrabold tracking-tight text-oat-cream">
              Tất cả Sản phẩm & Gói Dịch vụ
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-normal">
              Khám phá toàn bộ danh mục tài khoản công nghệ, tiện ích làm việc, học tập và giải trí được giao hàng tự động 24/7 cùng chính sách bảo hành uy tín.
            </p>
          </div>
        </div>

        {/* Catalog with 3x3 Grid & Navigation Tabs */}
        <StorefrontCatalog
          groups={groups}
          products={products}
          showFeatured={false}
          title=""
        />
      </main>

      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
