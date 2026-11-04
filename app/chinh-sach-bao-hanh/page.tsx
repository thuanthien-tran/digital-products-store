import { Metadata } from "next"
import Link from "next/link"
import { getSiteSettings } from "@/lib/settings"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { ChevronLeft, RefreshCw, ShieldCheck, AlertCircle, HelpCircle } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  return {
    title: `Chính sách bảo hành & Hoàn tiền | ${settings.siteName}`,
    description: `Quy định bảo hành 1 đổi 1 và chính sách bồi hoàn sản phẩm số tại ${settings.siteName}.`,
  }
}

export default async function WarrantyPolicyPage() {
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
            <RefreshCw className="size-3.5" />
            <span>Cam kết quyền lợi người tiêu dùng theo Luật số 19/2023/QH15</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-oat-cream">
            Chính Sách Bảo Hành &amp; Hoàn Tiền
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
              Cam kết bảo hành 1 đổi 1
            </h2>
            <p>
              Tất cả sản phẩm tài khoản số, mã kích hoạt bản quyền và dịch vụ phần mềm cung cấp bởi <strong>{settings.siteName}</strong> đều được cam kết bảo hành chất lượng <strong>1 đổi 1 trong toàn bộ thời gian sử dụng</strong> mà quý khách đã đặt mua.
            </p>
            <p>
              Nếu tài khoản hoặc key bản quyền bị lỗi phát sinh từ phía hệ thống hoặc nhà cung cấp, chúng tôi sẽ tiến hành sửa lỗi, cấp lại tài khoản mới hoặc gửi mã key thay thế tương đương hoàn toàn miễn phí.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">2</span>
              Các trường hợp được bảo hành
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Mã key hoặc thông tin đăng nhập không hợp lệ ngay khi vừa nhận đơn.</li>
              <li>Tài khoản bị mất gói nâng cấp (mất Premium/Pro) trước thời hạn mua ban đầu.</li>
              <li>Tài khoản bị nhà cung cấp gốc quét lỗi kỹ thuật hàng loạt không do lỗi của người sử dụng.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">3</span>
              Chính sách hoàn tiền minh bạch
            </h2>
            <p>
              Chúng tôi luôn ưu tiên hỗ trợ đổi mới tài khoản hoạt động bình thường cho quý khách. Tuy nhiên, quý khách sẽ được <strong>hoàn tiền 100% hoặc hoàn tiền theo tỷ lệ</strong> trong các trường hợp sau:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Hoàn tiền 100%:</strong> Đơn hàng đã chuyển khoản thành công nhưng hệ thống hết hàng và không thể cấp tài khoản/key sau 30 phút.
              </li>
              <li>
                <strong>Hoàn tiền theo tỷ lệ thời gian chưa sử dụng:</strong> Nếu tài khoản bị lỗi giữa chừng và kho hàng không có tài khoản thay thế trong vòng 24 giờ làm việc. Số tiền hoàn lại = (Giá đơn hàng / Tổng số ngày của gói) × Số ngày còn lại chưa sử dụng.
              </li>
              <li>
                <strong>Phương thức hoàn tiền:</strong> Chuyển khoản trực tiếp về đúng số tài khoản ngân hàng mà quý khách đã thanh toán.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">4</span>
              Các trường hợp từ chối bảo hành
            </h2>
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200">
              <p className="font-semibold flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-red-400" />
                Chúng tôi không chịu trách nhiệm bảo hành trong các tình huống sau:
              </p>
              <ul className="list-disc pl-5 mt-1.5 space-y-1 text-xs">
                <li>Gói sản phẩm có ký hiệu <strong>KBH (Không Bảo Hành)</strong> đã được thông báo và ghi chú rõ ràng trước khi quý khách bấm thanh toán.</li>
                <li>Khách hàng tự ý thay đổi email, mật khẩu hoặc can thiệp thông tin tài khoản được cấp theo dạng sử dụng chung profile.</li>
                <li>Khách hàng vi phạm nghiêm trọng chính sách sử dụng của nhà cung cấp dịch vụ gốc (ví dụ: dùng tool spam API của ChatGPT, vi phạm bản quyền trên YouTube...).</li>
                <li>Khách hàng chia sẻ thông tin tài khoản cho nhiều bên khác sử dụng đồng thời vượt quá số thiết bị cho phép.</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">5</span>
              Quy trình gửi yêu cầu bảo hành
            </h2>
            <p>
              Khi gặp sự cố cần hỗ trợ bảo hành, quý khách chỉ cần thực hiện 2 bước đơn giản:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Chụp lại ảnh màn hình thông báo lỗi hiển thị trên thiết bị.</li>
              <li>
                Gửi mã đơn hàng (ví dụ: <code>ORD-ABCXYZ</code>) và ảnh lỗi qua <strong>Zalo Hotline 0356970964</strong>.
              </li>
            </ol>
            <p className="text-muted-foreground">
              Đội ngũ kỹ thuật viên của CapyGo hoạt động từ 8:00 đến 23:00 tất cả các ngày trong tuần (kể cả Thứ 7, Chủ Nhật) để xử lý mọi yêu cầu của bạn.
            </p>
          </section>

        </article>
      </main>

      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
