import { Metadata } from "next"
import Link from "next/link"
import { getSiteSettings } from "@/lib/settings"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { OrderLookupCard } from "@/components/storefront/OrderLookupCard"
import { ArrowLeft, Lock } from "lucide-react"

export const dynamic = "force-dynamic"

const ZALO_PHONE = (process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964").replace(/\D/g, "")

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const siteName = settings?.siteName || "CAPYGO"
  return {
    title: `Tra cứu đơn hàng | ${siteName}`,
    description: `Hướng dẫn xem lại thông tin đơn hàng an toàn tại ${siteName}.`,
  }
}

export default async function OrderLookupPage() {
  const settings = await getSiteSettings()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header initialSettings={settings} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6 pt-3.5 pb-8 sm:py-10 space-y-3.5 sm:space-y-5">
        <div className="space-y-1.5 sm:space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3 sm:size-3.5" />
            <span>Quay lại trang chủ</span>
          </Link>

          <div className="flex items-center justify-between gap-2">
            <h1 className="font-heading font-bold text-xl sm:text-3xl tracking-tight text-foreground">
              Tra cứu đơn hàng
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] sm:text-xs font-medium bg-secondary border border-border text-muted-foreground shrink-0">
              <Lock className="size-3 text-primary" />
              <span>Bảo mật</span>
            </span>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Để bảo vệ tài khoản &amp; mã kích hoạt, CAPYGO không hiển thị công khai đơn hàng chỉ dựa vào email.
          </p>
        </div>

        <OrderLookupCard zaloPhone={ZALO_PHONE} />
      </main>

      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
