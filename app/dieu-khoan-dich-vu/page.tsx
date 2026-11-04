import { Metadata } from "next"
import Link from "next/link"
import { getSiteSettings } from "@/lib/settings"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { ChevronLeft, BookOpen, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  return {
    title: `Điều khoản dịch vụ & Quy chế hoạt động | ${settings.siteName}`,
    description: `Điều khoản sử dụng và quy định giao kết giao dịch thương mại điện tử tại ${settings.siteName}.`,
  }
}

export default async function TermsOfServicePage() {
  const settings = await getSiteSettings()

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-caramel/20 selection:text-caramel-light">
      <Header initialSettings={settings} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-caramel-light transition-colors"
        >
          <ChevronLeft className="size-4" />
          <span>Quay lại trang chủ</span>
        </Link>

        {/* Title Header */}
        <div className="space-y-3 border-b border-border/70 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-caramel/10 text-caramel-light border border-caramel/25">
            <BookOpen className="size-3.5" />
            <span>Quy chế giao dịch Thương mại điện tử theo Luật TMĐT số 122/2025/QH15</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-oat-cream">
            Điều Khoản Dịch Vụ
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Phiên bản: <strong>1.1</strong> · Cập nhật lần cuối: <strong>03/11/2026</strong>
          </p>
        </div>

        {/* Content Body */}
        <article className="prose prose-invert prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground/90 prose-p:leading-relaxed prose-li:text-muted-foreground/90 max-w-none space-y-8 text-xs sm:text-sm leading-relaxed">

          {/* Section 1 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">1</span>
              Nguyên tắc chung & Phạm vi áp dụng
            </h2>
            <p>
              Chào mừng quý khách đến với website <strong>capygo.id.vn</strong> (vận hành bởi <strong>{settings.siteName}</strong>). Bằng việc truy cập, tạo đơn và hoàn tất thanh toán trên hệ thống, quý khách xác nhận đã đọc, hiểu rõ và đồng ý tuân thủ toàn bộ các điều khoản giao dịch dưới đây.
            </p>
            <p>
              Hệ thống của chúng tôi là nền tảng thương mại điện tử chuyên cung cấp các sản phẩm số, mã kích hoạt bản quyền phần mềm và tài khoản công nghệ phục vụ nhu cầu làm việc, học tập và giải trí cá nhân.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">2</span>
              Quy trình đặt hàng & Thanh toán tự động
            </h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <strong>Lựa chọn sản phẩm:</strong> Quý khách xem danh mục, đọc kỹ mô tả gói thời hạn (1 tháng, 3 tháng, 1 năm...), các điều kiện đính kèm (như lưu ý VPN nếu có).
              </li>
              <li>
                <strong>Cung cấp thông tin:</strong> Quý khách nhập địa chỉ Email chính xác để nhận biên lai và đường dẫn tra cứu thông tin dự phòng.
              </li>
              <li>
                <strong>Thanh toán qua VietQR:</strong> Hệ thống tạo mã VietQR kèm số tiền và mã đơn hàng duy nhất. Quý khách sử dụng ứng dụng ngân hàng quét mã QR để chuyển khoản chính xác. Hệ thống đối soát tự động xử lý trong vòng 3 – 10 giây.
              </li>
            </ol>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">3</span>
              Quy trình giao nhận sản phẩm số
            </h2>
            <p>
              Do đặc thù là hàng hóa điện tử / dịch vụ số, quy trình giao nhận diễn ra tự động 100%:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Hiển thị trên màn hình:</strong> Ngay sau khi hệ thống ghi nhận giao dịch thanh toán thành công, thông tin tài khoản hoặc mã key bản quyền sẽ hiển thị trực tiếp trên màn hình trạng thái đơn hàng.
              </li>
              <li>
                <strong>Lưu trữ qua Email:</strong> Thông tin đơn hàng kèm mã truy cập bảo mật được ghi nhận vào email của quý khách để có thể xem lại bất kỳ lúc nào.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">4</span>
              Trách nhiệm của khách hàng khi sử dụng
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Cung cấp chính xác thông tin email cá nhân để đảm bảo nhận được đơn hàng.</li>
              <li>Kiểm tra và kích hoạt tài khoản/mã bản quyền ngay sau khi nhận được.</li>
              <li>Tuân thủ đúng hướng dẫn sử dụng của từng loại gói (ví dụ: không tự ý đổi thông tin/mật khẩu đối với tài khoản chỉ định dùng chung slot).</li>
              <li>Không sử dụng tài khoản/dịch vụ số vào các mục đích vi phạm pháp luật Việt Nam, phát tán mã độc, hoặc chống phá an ninh mạng.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">5</span>
              Tuyên bố miễn trừ trách nhiệm về Nhãn hiệu bên thứ ba
            </h2>
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                Thông cáo về quyền sở hữu trí tuệ (Trademark Disclaimer):
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                {settings.siteName} là nền tảng bán lẻ và dịch vụ hỗ trợ kỹ thuật độc lập. Tất cả tên sản phẩm, logo, nhãn hiệu thương mại được đề cập trên website (bao gồm nhưng không giới hạn ở: Canva, YouTube, Netflix, OpenAI, ChatGPT, Google, Spotify...) thuộc quyền sở hữu trí tuệ của các tổ chức chủ quản tương ứng. Các nhãn hiệu này chỉ được chúng tôi nhắc đến nhằm mục đích chỉ dẫn và mô tả chính xác sản phẩm dịch vụ cho người tiêu dùng theo nguyên tắc sử dụng hợp lý.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">6</span>
              Cơ chế tiếp nhận và giải quyết khiếu nại
            </h2>
            <p>
              Căn cứ Điều 5 khoản 6 Luật Thương mại điện tử 122/2025/QH15 và Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15, chúng tôi cam kết quy trình tiếp nhận và giải quyết mọi khiếu nại của khách hàng một cách công bằng và nhanh chóng:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Kênh tiếp nhận chính thức:</strong> Zalo hỗ trợ khách hàng <strong>0356970964</strong> hoặc Email <strong>support@capygo.id.vn</strong>.</li>
              <li><strong>Thời hạn xử lý:</strong> Phản hồi hỗ trợ kỹ thuật trong vòng <strong>1 – 4 giờ làm việc</strong> và giải quyết dứt điểm sự cố tối đa không quá <strong>24 giờ</strong>.</li>
            </ul>
          </section>

        </article>
      </main>

      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
