import Link from "next/link"
import { Layers, Mail, QrCode, CheckCircle2, ArrowRight, MessageCircle, Search } from "lucide-react"
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

        {/* 3. How It Works (Connected Editorial Stepper — 4 clear steps) */}
        <section id="how" className="space-y-5 pt-8 border-t border-border scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
                Hướng dẫn mua hàng
              </h2>
              <p className="text-sm text-muted-foreground">
                Quy trình đặt hàng và nhận thông tin sản phẩm tại CAPYGO.
              </p>
            </div>
            <Link
              href="/lookup"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-primary transition-colors w-fit"
            >
              <span>Tra cứu đơn đã mua</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
            <ol className="relative grid gap-6 lg:grid-cols-4 lg:gap-0">
              {/* Desktop horizontal connector rail aligned with step icon centers */}
              <div
                aria-hidden="true"
                className="hidden lg:block absolute top-5 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-primary/40 via-border to-primary/40"
              />

              {[
                {
                  step: "01",
                  icon: Layers,
                  title: "Chọn gói phù hợp",
                  desc: "Xem rõ hình thức sử dụng (chính chủ, slot, cấp sẵn), thời hạn và điều kiện bảo hành.",
                },
                {
                  step: "02",
                  icon: Mail,
                  title: "Nhập thông tin nhận đơn",
                  desc: "Điền email nhận đơn hàng (kèm mã mời nếu mua gói nạp token).",
                },
                {
                  step: "03",
                  icon: QrCode,
                  title: "Chuyển khoản VietQR",
                  desc: "Quét mã VietQR hoặc chuyển khoản đúng số tiền và nội dung mã đơn.",
                },
                {
                  step: "04",
                  icon: CheckCircle2,
                  title: "Nhận trong đơn hàng",
                  desc: "Thông tin bàn giao hiển thị trực tiếp trên trang đơn hàng sau khi đối soát.",
                },
              ].map(({ step, icon: Icon, title, desc }, idx) => (
                <li
                  key={step}
                  className={`relative flex lg:flex-col items-start gap-4 lg:gap-4 ${
                    idx > 0 ? "lg:pl-6" : ""
                  } ${idx < 3 ? "lg:pr-6" : ""}`}
                >
                  {/* Mobile vertical connector between steps */}
                  {idx < 3 && (
                    <span
                      aria-hidden="true"
                      className="lg:hidden absolute left-5 top-11 -bottom-5 w-px bg-border"
                    />
                  )}

                  {/* Step Node: Crisp Icon + Mono Index */}
                  <div className="relative z-10 flex items-center gap-2.5 shrink-0 bg-card lg:pr-3">
                    <div className="size-10 rounded-xl bg-background border border-primary/35 flex items-center justify-center text-primary">
                      <Icon className="size-4" strokeWidth={2} />
                    </div>
                    <span className="font-mono text-xs font-semibold text-primary/90 tracking-wider lg:hidden">
                      {step}
                    </span>
                  </div>

                  {/* Step Copy */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="hidden lg:inline-block font-mono text-[11px] font-semibold text-primary/85 tracking-wider">
                        {step}
                      </span>
                      <h3 className="font-semibold text-[15px] text-foreground leading-snug">
                        {title}
                      </h3>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4. FAQ Section (2-Column Editorial Split aligned with page grid) */}
        <section id="faq" className="pt-8 border-t border-border scroll-mt-20">
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Left: Heading + Borderless Support Actions */}
            <div className="lg:col-span-4 space-y-5">
              <div className="space-y-1.5">
                <h2 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
                  Câu hỏi thường gặp
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Giải đáp nhanh về cách nhận hàng, thời gian xử lý và chính sách bảo hành theo từng gói.
                </p>
              </div>

              <div className="pt-4 border-t border-border/70 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Chưa thấy câu trả lời bạn cần? Nhắn Zalo hoặc kiểm tra nhanh tình trạng đơn hàng.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://zalo.me/${(process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356970964").replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-caramel-light text-xs font-semibold transition-btn"
                  >
                    <MessageCircle className="size-3.5" />
                    <span>Nhắn Zalo hỗ trợ</span>
                  </a>
                  <Link
                    href="/lookup"
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl border border-border bg-transparent hover:bg-secondary text-foreground text-xs font-medium transition-btn"
                  >
                    <Search className="size-3.5 text-muted-foreground" />
                    <span>Tra cứu đơn</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: Full-width Structured Accordion */}
            <div className="lg:col-span-8">
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
