import { Metadata } from "next"
import Link from "next/link"
import { getStoreData } from "@/lib/store-data"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { StorefrontCatalog } from "@/components/storefront/StorefrontCatalog"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { ChevronRight } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getStoreData()
  const siteName = settings?.siteName || "CAPYGO"

  return {
    title: `Sản phẩm & Gói Dịch vụ | ${siteName}`,
    description: `Danh mục tài khoản, phần mềm, dịch vụ nâng cấp và API tại ${siteName}.`,
    openGraph: {
      title: `Sản phẩm & Gói Dịch vụ | ${siteName}`,
      description: `Danh mục tài khoản, phần mềm, dịch vụ nâng cấp và API tại ${siteName}.`,
    },
  }
}

export default async function SanPhamPage() {
  const { groups, products, settings } = await getStoreData()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Header initialSettings={settings} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 pt-5 sm:pt-7 pb-12 space-y-6">
        {/* Breadcrumb */}
        <nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors py-1">
            Trang chủ
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <span className="text-foreground font-medium py-1">Sản phẩm</span>
        </nav>

        {/* Clean Page Header */}
        <div className="space-y-1.5 pb-4 border-b border-border">
          <h1 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
            Tất cả sản phẩm
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Lọc theo danh mục, mức giá hoặc tìm kiếm trực tiếp theo tên phần mềm, thời hạn và gói dịch vụ.
          </p>
        </div>

        {/* Catalog with Sidebar Filters on Desktop */}
        <StorefrontCatalog
          groups={groups}
          products={products}
          showFeatured={false}
          title=""
          sidebarLayout={true}
        />
      </main>

      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
