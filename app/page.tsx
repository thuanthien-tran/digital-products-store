import { prisma } from "@/lib/db"
import { getSiteSettings } from "@/lib/settings"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { HeroSection } from "@/components/storefront/HeroSection"
import { StorefrontCatalog } from "@/components/storefront/StorefrontCatalog"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { ScrollReveal } from "@/components/ui/ScrollReveal"
import { FaqAccordion } from "@/components/storefront/FaqAccordion"

export const dynamic = "force-dynamic"
export const revalidate = 0

async function getStoreData() {
  try {
    const [groups, products, settings] = await Promise.all([
      prisma.productGroup.findMany({
        where: { visibility: "public" },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.product.findMany({
        where: { 
          visibility: "public",
          editorialStatus: "published",
        },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        include: {
          group: true,
          variants: {
            orderBy: { sortOrder: "asc" },
            include: {
              _count: {
                select: { serials: { where: { status: "available" } } },
              },
            },
          },
        },
      }),
      getSiteSettings(),
    ])

    return {
      settings,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        badgeText: g.badgeText,
        badgeColor: g.badgeColor,
      })),
      products: products.map((p) => {
        let parsedImages: string[] = []
        try {
          parsedImages = JSON.parse(p.images || "[]")
        } catch {
          parsedImages = []
        }

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          isFeatured: p.isFeatured,
          sortOrder: p.sortOrder ?? 0,
          description: p.description,
          images: parsedImages,
          groupId: p.groupId,
          groupName: p.group?.name || "Chưa phân loại",
          deliveryType: p.deliveryType,
          statusOverride: p.statusOverride,
          warrantyTerms: p.warrantyTerms,
          noticeNotes: p.noticeNotes,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceCents: v.priceCents,
            compareAtPriceCents: v.compareAtPriceCents,
            availableStock:
              v.provider || p.deliveryType === "fatcat" || p.deliveryType === "dino"
                ? (v.providerStock ?? 0) + v._count.serials
                : v._count.serials,
            providerStock: v.providerStock,
          })),
        }
      }),
    }
  } catch {
    return { groups: [], products: [] }
  }
}

export default async function HomePage() {
  const { groups, products, settings } = await getStoreData()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Header initialSettings={settings} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 pt-3 sm:pt-5 pb-10 sm:pb-14 space-y-7 sm:space-y-9">
        {/* Top Minimalist Hero Section */}
        <HeroSection />

        {/* Dynamic Storefront with Search, Price Filter, Category Pills & Products */}
        <StorefrontCatalog groups={groups} products={products} />

        {/* How it works 4-steps with Staggered Scroll Reveal */}
        <section id="how" className="space-y-6 sm:space-y-8 pt-6 sm:pt-8 border-t border-border/70 scroll-mt-24">
          <ScrollReveal>
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">Quy trình đơn giản</span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-oat-cream">
                Mua Hàng Trong 4 Bước
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Hệ thống vận hành khép kín tự động 100%, không cần chờ đợi nhân viên kích hoạt
              </p>
            </div>
          </ScrollReveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
            {[
              {
                step: "01",
                title: "Chọn gói tài khoản",
                desc: "Duyệt qua danh mục và chọn gói thời hạn phù hợp với nhu cầu công việc của bạn.",
                color: "text-caramel",
                borderHover: "hover:border-caramel/40 hover:shadow-black/30",
              },
              {
                step: "02",
                title: "Nhập Email nhận key",
                desc: "Điền địa chỉ email của bạn để hệ thống tự động lưu biên lai và gửi thông tin dự phòng.",
                color: "text-caramel-light",
                borderHover: "hover:border-caramel-light/40 hover:shadow-black/30",
              },
              {
                step: "03",
                title: "Quét mã VietQR",
                desc: "Mở app ngân hàng quét mã QR, chuyển đúng nội dung định sẵn trong 3 giây.",
                color: "text-sage",
                borderHover: "hover:border-sage/40 hover:shadow-black/30",
              },
              {
                step: "04",
                title: "Nhận tài khoản ngay",
                desc: "Màn hình tự động hiển thị tài khoản/key ngay lập tức kèm hướng dẫn kích hoạt chi tiết.",
                color: "text-caramel",
                borderHover: "hover:border-caramel/40 hover:shadow-black/30",
              },
            ].map(({ step, title, desc, color, borderHover }, idx) => (
              <ScrollReveal key={step} delayMs={idx * 90}>
                <div
                  className={`group relative h-full rounded-2xl border border-border/80 bg-card/60 p-6 space-y-3 backdrop-blur shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:bg-card/90 overflow-hidden ${borderHover}`}
                >
                  <span
                    className={`text-4xl font-black ${color} opacity-25 transition-all duration-300 group-hover:opacity-75 group-hover:scale-110 inline-block`}
                  >
                    {step}
                  </span>
                  <h3 className="font-extrabold text-sm text-foreground transition-colors duration-200 group-hover:text-caramel-light">
                    {title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed group-hover:text-slate-200 transition-colors duration-200">
                    {desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* FAQ Section with Staggered Scroll Reveal */}
        <section id="faq" className="space-y-6 sm:space-y-8 scroll-mt-24 pt-6 sm:pt-8 border-t border-border/70">
          <ScrollReveal>
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">Giải đáp thắc mắc</span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-oat-cream">
                Câu Hỏi Thường Gặp
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Thông tin chi tiết về quy trình thanh toán, nhận tài khoản và chính sách bảo hành
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={100}>
            <FaqAccordion
              items={[
                {
                  q: "Sau khi thanh toán xong tôi nhận tài khoản ở đâu?",
                  a: "Hệ thống hoạt động hoàn toàn tự động 24/7. Ngay sau khi chuyển khoản thành công, thông tin tài khoản / key bản quyền sẽ hiển thị trực tiếp trên màn hình đơn hàng và được tự động gửi kèm về email của bạn.",
                },
                {
                  q: "Có hỗ trợ thanh toán qua VietQR không?",
                  a: "Có. Hệ thống hỗ trợ quét mã VietQR tự động qua tất cả ngân hàng tại Việt Nam (MBBank, Vietcombank, Techcombank, ACB...). Bạn chỉ cần quét mã QR là hệ thống tự xác nhận trong vòng 3 – 5 giây.",
                },
                {
                  q: "Nếu tôi nhập sai email thì có lấy lại được tài khoản không?",
                  a: "Thông tin tài khoản vẫn hiển thị trực tiếp trên trang đơn hàng của bạn ngay khi thanh toán. Ngoài ra, bạn có thể vào mục Kiểm Tra Đơn Hàng trên thanh menu hoặc liên hệ Zalo để được hỗ trợ kiểm tra lại ngay.",
                },
                {
                  q: "Chính sách bảo hành như thế nào?",
                  a: "Mọi tài khoản và mã bản quyền trong hệ thống đều được kiểm tra trước khi nạp kho. Các gói có chính sách bảo hành 1 đổi 1 trong suốt thời hạn gói nếu phát sinh sự cố từ phía tài khoản.",
                },
              ]}
            />
          </ScrollReveal>
        </section>
      </main>
      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
