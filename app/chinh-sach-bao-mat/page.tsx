import { Metadata } from "next"
import Link from "next/link"
import { getSiteSettings } from "@/lib/settings"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { ChevronLeft, ShieldCheck, Mail, Clock, Lock, FileText } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  return {
    title: `Chính sách bảo vệ dữ liệu cá nhân | ${settings.siteName}`,
    description: `Chính sách thu thập, lưu trữ và bảo vệ dữ liệu cá nhân theo Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 của ${settings.siteName}.`,
  }
}

export default async function PrivacyPolicyPage() {
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
            <ShieldCheck className="size-3.5" />
            <span>Tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 & NĐ 356/2025/NĐ-CP</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-oat-cream">
            Chính Sách Bảo Vệ Dữ Liệu Cá Nhân
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
              Chúng tôi là ai & Thông tin liên hệ
            </h2>
            <p>
              <strong>{settings.siteName}</strong> (sau đây gọi là &quot;chúng tôi&quot;) là bên kiểm soát và xử lý dữ liệu cá nhân thu thập thông qua website thương mại điện tử <strong>capygo.id.vn</strong>.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Tên dịch vụ:</strong> {settings.siteName} (Hệ thống cung cấp sản phẩm và tài khoản số)</li>
              <li><strong>Hotline / Zalo hỗ trợ:</strong> 0356970964</li>
              <li><strong>Email tiếp nhận yêu cầu về dữ liệu:</strong> support@capygo.id.vn</li>
              <li><strong>Địa chỉ hoạt động:</strong> Thành phố Hồ Chí Minh, Việt Nam</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">2</span>
              Dữ liệu thu thập & Mục đích xử lý
            </h2>
            <p>
              Chúng tôi chỉ thu thập các dữ liệu cá nhân tối thiểu cần thiết để phục vụ việc giao dịch và thực hiện đơn hàng số. Bảng chi tiết:
            </p>

            <div className="overflow-x-auto rounded-xl border border-border/70 my-3">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-secondary/70 text-foreground border-b border-border/70">
                    <th className="p-3 font-semibold">Loại dữ liệu</th>
                    <th className="p-3 font-semibold">Thời điểm thu thập</th>
                    <th className="p-3 font-semibold">Mục đích sử dụng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-muted-foreground">
                  <tr>
                    <td className="p-3 font-medium text-foreground">Địa chỉ Email</td>
                    <td className="p-3">Khi khách điền form đặt hàng</td>
                    <td className="p-3">Gửi biên lai xác nhận đơn, gửi mã tài khoản/key bản quyền và hỗ trợ tra cứu bảo hành.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-foreground">Mã & Số tiền giao dịch VietQR</td>
                    <td className="p-3">Khi chuyển khoản ngân hàng</td>
                    <td className="p-3">Đối soát tự động để kích hoạt đơn hàng và ghi nhận lịch sử thanh toán phục vụ bảo hành.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-foreground">Địa chỉ IP & Cookie truy cập đơn</td>
                    <td className="p-3">Khi truy cập trang đơn hàng</td>
                    <td className="p-3">Bảo vệ quyền truy cập đơn hàng (chỉ người tạo đơn mới xem được mã tài khoản).</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-emerald-400 font-medium">
              ✓ Chúng tôi tuyệt đối KHÔNG thu thập số CCCD, ngày sinh hay thông tin thẻ tín dụng cá nhân của quý khách.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">3</span>
              Bên thứ ba có thể tiếp nhận dữ liệu
            </h2>
            <p>
              Để hoàn tất quy trình thanh toán và giao key tự động, chúng tôi chia sẻ thông tin cần thiết với các đối tác kỹ thuật sau:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Cổng thanh toán & Ngân hàng MBBank / SePay:</strong> Tiếp nhận mã đơn hàng và số tiền giao dịch để đối soát lệnh chuyển khoản.</li>
              <li><strong>Nhà phân phối kho tài khoản (Dino Hub API):</strong> Nhận yêu cầu xuất mã bản quyền để gửi trả cho đơn hàng của quý khách.</li>
            </ul>
            <p className="font-semibold text-foreground">
              Cam kết: Chúng tôi KHÔNG BAO GIỜ bán, trao đổi hay cung cấp dữ liệu cá nhân của quý khách cho bất kỳ bên thứ ba nào vì mục đích quảng cáo hoặc tiếp thị trái phép.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">4</span>
              Thời gian lưu trữ dữ liệu
            </h2>
            <p>
              Dữ liệu đơn hàng và địa chỉ email được lưu trữ an toàn trong hệ thống của chúng tôi suốt thời hạn bảo hành của sản phẩm nhằm đảm bảo quyền lợi đổi mới / bảo hành cho quý khách.
            </p>
            <p>
              Sau khi hết thời hạn bảo hành hoặc khi nhận được yêu cầu hợp lệ từ khách hàng, dữ liệu sẽ được xóa bỏ an toàn hoặc làm ẩn danh khỏi hệ thống lưu trữ.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">5</span>
              Quyền của bạn đối với dữ liệu cá nhân
            </h2>
            <p>
              Căn cứ theo Điều 4 Luật số 91/2025/QH15, bạn có đầy đủ các quyền:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Quyền được biết thông tin và mục đích xử lý dữ liệu.</li>
              <li>Quyền đồng ý, không đồng ý hoặc rút lại sự đồng ý đã cấp.</li>
              <li>Quyền xem, kiểm tra hoặc yêu cầu chỉnh sửa dữ liệu đơn hàng.</li>
              <li>Quyền yêu cầu xóa bỏ hoàn toàn dữ liệu cá nhân của mình.</li>
            </ul>

            <div className="mt-3 p-3.5 rounded-xl border border-caramel/30 bg-caramel/10 text-caramel-light">
              <p className="font-bold flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-caramel" />
                Thời hạn cam kết phản hồi (Theo Điều 5 Nghị định 356/2025/NĐ-CP):
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
                <li>Tiếp nhận và phản hồi hướng dẫn: trong vòng <strong>2 ngày làm việc</strong>.</li>
                <li>Xử lý cung cấp / chỉnh sửa dữ liệu: trong vòng <strong>10 ngày làm việc</strong>.</li>
                <li>Xóa bỏ dữ liệu theo yêu cầu: trong vòng <strong>20 ngày làm việc</strong>.</li>
              </ul>
            </div>
            <p>
              Để thực hiện các quyền trên, quý khách vui lòng nhắn tin qua kênh Zalo <strong>0356970964</strong> hoặc gửi email tới <strong>support@capygo.id.vn</strong> kèm mã đơn hàng cần hỗ trợ.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 rounded-2xl border border-border/80 bg-card/60 p-5 sm:p-6 backdrop-blur">
            <h2 className="text-base sm:text-lg text-caramel font-extrabold flex items-center gap-2">
              <span className="size-6 rounded-md bg-caramel/20 text-caramel-light flex items-center justify-center text-xs">6</span>
              Bảo mật và Cookie
            </h2>
            <p>
              Website của chúng tôi được bảo vệ bằng giao thức mã hóa HTTPS/TLS. Chúng tôi chỉ sử dụng Cookie kỹ thuật thiết yếu (chẳng hạn như Cookie phiên `order_access` có thuộc tính bảo mật `HttpOnly` và `SameSite=Lax`) nhằm ngăn chặn việc rò rỉ mã đơn hàng. Website hoàn toàn không sử dụng Cookie theo dõi quảng cáo trái phép.
            </p>
          </section>

        </article>
      </main>

      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
