import { getStoreData } from "@/lib/store-data"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { HeroSection } from "@/components/storefront/HeroSection"
import { StorefrontCatalog } from "@/components/storefront/StorefrontCatalog"
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

        {/* 3. How It Works (4 clear, honest steps) */}
        <section id="how" className="space-y-5 pt-8 border-t border-border scroll-mt-20">
          <div className="space-y-1">
            <h2 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
              Hướng dẫn mua hàng
            </h2>
            <p className="text-sm text-muted-foreground">
              Quy trình đặt hàng và nhận thông tin sản phẩm tại CAPYGO.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
            {[
              {
                step: "01",
                title: "Chọn gói phù hợp",
                desc: "Xem kỹ hình thức sử dụng (slot, tài khoản cấp sẵn, nâng cấp chính chủ), thời hạn và điều kiện bảo hành.",
              },
              {
                step: "02",
                title: "Nhập thông tin nhận đơn",
                desc: "Điền email nhận thông tin đơn hàng (và mã mời nếu là gói nạp token).",
              },
              {
                step: "03",
                title: "Chuyển khoản qua VietQR",
                desc: "Quét mã VietQR hoặc chuyển khoản đúng số tiền và nội dung mã đơn hiển thị trên trang thanh toán.",
              },
              {
                step: "04",
                title: "Nhận thông tin trong đơn hàng",
                desc: "Thông tin bàn giao được hiển thị trực tiếp trên trang đơn hàng. Thời gian xử lý tùy loại sản phẩm.",
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="rounded-2xl border border-border bg-card p-5 space-y-2.5"
              >
                <span className="inline-block font-mono text-xs font-semibold text-primary bg-primary/10 border border-primary/25 px-2.5 py-0.5 rounded-lg">
                  Bước {step}
                </span>
                <h3 className="font-semibold text-[15px] text-foreground leading-snug">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 4. FAQ Section */}
        <section id="faq" className="space-y-5 pt-8 border-t border-border scroll-mt-20">
          <div className="space-y-1 text-center max-w-2xl mx-auto">
            <h2 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
              Câu hỏi thường gặp
            </h2>
            <p className="text-sm text-muted-foreground">
              Giải đáp nhanh về cách nhận hàng, thanh toán và chính sách bảo hành.
            </p>
          </div>

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
        </section>
      </main>
      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
