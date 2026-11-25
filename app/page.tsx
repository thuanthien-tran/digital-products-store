import Link from "next/link"
import { MessageCircle, Search } from "lucide-react"
import { getStoreData } from "@/lib/store-data"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { HeroSection } from "@/components/storefront/HeroSection"
import { StorefrontCatalog } from "@/components/storefront/StorefrontCatalog"
import { HowItWorksSection } from "@/components/storefront/HowItWorksSection"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { FaqAccordion } from "@/components/storefront/FaqAccordion"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function HomePage() {
  const { groups, products, settings } = await getStoreData()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Header initialSettings={settings} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 pt-5 sm:pt-7 pb-12 space-y-10 sm:space-y-12">
        {/* 1. Compact Hero & Pixel Capybara */}
        <HeroSection settings={settings} />

        {/* 2. Featured Packages + Search, Category Filter & Product List */}
        <StorefrontCatalog groups={groups} products={products} />

        {/* 3. How It Works (Interactive 4-Step Pipeline with Travelling Light) */}
        <HowItWorksSection />

        {/* 4. FAQ Section (2-Column Editorial Split from md+ screens) */}
        <section id="faq" className="pt-8 border-t border-border scroll-mt-20">
          <div className="grid gap-6 md:grid-cols-12 items-start">
            {/* Left: Heading + Clean Support Actions */}
            <div className="md:col-span-4 space-y-4 md:sticky md:top-24">
              <div className="space-y-1.5">
                <h2 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
                  Câu hỏi thường gặp
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Giải đáp nhanh về cách nhận hàng, thời gian xử lý và chính sách bảo hành theo từng gói.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <p className="text-xs text-muted-foreground/85 leading-relaxed">
                  Cần hỗ trợ trực tiếp hoặc kiểm tra nhanh tình trạng đơn hàng?
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://zalo.me/${(process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964").replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground hover:bg-caramel-light active:scale-[0.97] text-xs font-semibold transition-btn"
                  >
                    <MessageCircle className="size-3.5" />
                    <span>Nhắn Zalo hỗ trợ</span>
                  </a>
                  <Link
                    href="/lookup"
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card/70 hover:bg-secondary hover:border-primary/40 active:scale-[0.97] text-foreground text-xs font-medium transition-btn"
                  >
                    <Search className="size-3.5 text-muted-foreground" />
                    <span>Tra cứu đơn</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: Luminous Editorial Accordion */}
            <div className="md:col-span-8">
              <FaqAccordion
                items={[
                  {
                    q: "Sau khi thanh toán xong tôi nhận sản phẩm ở đâu?",
                    a: "Thông tin bàn giao (tài khoản, mã kích hoạt hoặc tiến trình nạp dịch vụ) được hiển thị trực tiếp trên trang chi tiết đơn hàng của bạn. Bạn nên lưu lại đường dẫn đơn hàng để tiện xem lại khi cần.",
                  },
                  {
                    q: "Thời gian xử lý đơn hàng mất bao lâu?",
                    a: "Hệ thống nhận đơn và đối soát chuyển khoản VietQR hoạt động tự động. Với sản phẩm có sẵn trong kho tự động, thông tin sẽ hiển thị sau khi đối soát thành công; với sản phẩm nạp dịch vụ hoặc liên hệ thủ công, thời gian xử lý tùy thuộc vào từng gói và khung giờ hỗ trợ của nhân viên.",
                  },
                  {
                    q: "Chính sách bảo hành áp dụng như thế nào?",
                    a: "Chính sách bảo hành áp dụng theo từng gói sản phẩm và được ghi rõ trên thẻ sản phẩm cũng như trang chi tiết trước khi mua (bao gồm các gói có bảo hành theo thời hạn, bảo hành giới hạn ngày, hoặc không bảo hành KBH).",
                  },
                  {
                    q: "Tôi cần hỗ trợ hoặc lỡ đóng trang đơn hàng thì làm sao?",
                    a: "Bạn có thể xem hướng dẫn tại mục Tra cứu đơn hoặc nhắn trực tiếp qua Zalo hỗ trợ kèm mã đơn hàng và ảnh biên lai chuyển khoản để nhân viên kiểm tra trong giờ làm việc.",
                  },
                ]}
              />
            </div>
          </div>
        </section>
      </main>
      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
