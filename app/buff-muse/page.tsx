import { Metadata } from "next"
import Link from "next/link"
import { getSiteSettings } from "@/lib/settings"
import { findTargetBuffMuseProduct } from "@/lib/buff-config"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { BuffMuseClient, type BuffMuseVariant } from "@/components/storefront/BuffMuseClient"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const siteName = settings?.siteName || "CAPYGO"
  return {
    title: `Buff Token Muse AI | ${siteName}`,
    description: `Nhập mã mời Muse AI, chọn số lượng Token (5B - 10B - 30B hoặc tùy chọn) và thanh toán nhanh qua VietQR tại ${siteName}.`,
  }
}

export default async function BuffMusePage() {
  const [settings, activeProduct] = await Promise.all([
    getSiteSettings(),
    findTargetBuffMuseProduct(),
  ])

  const variants: BuffMuseVariant[] = (activeProduct?.variants || [])
    .filter((v) => v.isActive)
    .map((v) => {
      const parsedB =
        v.tokenAmountB ??
        (() => {
          const m = v.name.match(/(\d+)\s*b\b/i)
          return m ? parseInt(m[1], 10) : 1
        })()
      return {
        id: v.id,
        name: v.name,
        priceCents: v.priceCents,
        compareAtPriceCents: v.compareAtPriceCents,
        tokenAmountB: parsedB,
      }
    })
    .filter((v) => v.tokenAmountB > 0 && v.tokenAmountB <= 30)
    .sort((a, b) => a.tokenAmountB - b.tokenAmountB)

  const isOutOfStock = Boolean(
    !activeProduct ||
      activeProduct.visibility !== "public" ||
      activeProduct.editorialStatus !== "published" ||
      activeProduct.statusOverride === "out_of_stock" ||
      variants.length === 0
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header initialSettings={settings} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 pt-3.5 pb-10 sm:py-8 space-y-3.5 sm:space-y-5">
        <div className="space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3 sm:size-3.5" />
            <span>Trang chủ</span>
          </Link>
          <h1 className="font-heading font-bold text-xl sm:text-3xl tracking-tight text-foreground">
            Buff Token Muse AI
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Nhập mã mời, chọn số lượng buff (5B – 10B – 30B hoặc tùy chọn) rồi quét VietQR thanh toán để shop tiến hành buff ngay.
          </p>
        </div>

        <BuffMuseClient
          productId={activeProduct?.id || null}
          productName={activeProduct?.name || "Buff Token Muse AI Chính Chủ"}
          isProductOutOfStock={isOutOfStock}
          variants={variants}
        />
      </main>

      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
