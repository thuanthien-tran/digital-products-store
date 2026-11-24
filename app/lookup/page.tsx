import { Metadata } from "next"
import Link from "next/link"
import { getSiteSettings } from "@/lib/settings"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { ShieldCheck, Link2, MessageCircle, ArrowLeft } from "lucide-react"

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

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Quay lại trang chủ</span>
          </Link>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight text-foreground">
            Tra cứu đơn hàng
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Để bảo vệ thông tin tài khoản và mã kích hoạt của khách hàng, CAPYGO không hiển thị công khai dữ liệu đơn hàng chỉ dựa vào địa chỉ email.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-primary shrink-0">
              <Link2 className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Cách 1: Mở lại đường dẫn đơn hàng đã lưu
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Mỗi đơn hàng sau khi tạo đều có một đường dẫn riêng (<code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">/order/...</code>) kèm phiên truy cập an toàn trên trình duyệt của bạn. Hãy mở lại tab hoặc lịch sử trình duyệt để xem thông tin bàn giao.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-5 flex items-start gap-3.5">
            <div className="size-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Cách 2: Nhờ hỗ trợ cấp lại thông tin đơn
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nếu bạn đã đóng trình duyệt, đổi thiết bị hoặc cần kiểm tra trạng thái thanh toán, vui lòng nhắn trực tiếp qua Zalo hỗ trợ kèm <strong className="text-foreground font-medium">mã đơn hàng</strong> và <strong className="text-foreground font-medium">ảnh biên lai chuyển khoản</strong>.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <a
              href={`https://zalo.me/${ZALO_PHONE}?text=${encodeURIComponent(
                "Chào shop CapyGo, mình cần hỗ trợ tra cứu đơn hàng."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-caramel-light transition-btn"
            >
              <MessageCircle className="size-4" />
              <span>Liên hệ Zalo hỗ trợ</span>
            </a>

            <Link
              href="/san-pham"
              className="inline-flex items-center justify-center h-11 px-5 rounded-xl border border-border bg-background hover:bg-secondary text-foreground font-medium text-sm transition-btn"
            >
              Xem danh sách sản phẩm
            </Link>
          </div>
        </div>
      </main>

      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
