# Bảng Đối Chiếu Chức Năng — Thiết Kế Lại CAPYGO (Công nghệ tối giản · Editorial)

> **Quy ước trạng thái:** `Chưa kiểm tra` · `Đã đạt` · `Lỗi tồn tại trước` · `Lỗi hồi quy` · `Chưa xác minh do môi trường`
> **Cập nhật lần cuối:** 2026-11-25

## 1. Storefront & Các Trang Công Khai

| Chức năng | Route / Component | Điều kiện xuất hiện | Vị trí / Cơ chế trong giao diện mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Logo & tên cửa hàng từ `SiteSettings` | `Header.tsx`, `Footer.tsx`, `/api/site-settings` | Luôn hiển thị | Header trái & Footer trái (giữ nguyên fallback `SiteSettings`) | Playwright 360–1440px | Đã đạt |
| Điều hướng chính (Sản phẩm, Tra cứu đơn, Hỗ trợ, Zalo) | `Header.tsx` | Desktop (flex inline) & Mobile (drawer) | Flex layout không còn `absolute` chồng lấn ở 768px | Playwright 768px/1024px/1440px | Đã đạt |
| Mobile Drawer (Focus trap, Scroll lock, Escape) | `Header.tsx` | `< md` (mobile) | Khóa cuộn `body`, trap `Tab`/`Shift+Tab`, đóng bằng `Escape` & trả focus | Playwright test `scroll_locked`, `scroll_restored`, `closed_on_escape` | Đã đạt |
| Trang tra cứu đơn (`/lookup`) | `app/lookup/page.tsx` | Truy cập `/lookup` | Trang hướng dẫn tra cứu an toàn qua link đơn hàng/Zalo (không công khai dữ liệu email) | Playwright mở `/lookup` (HTTP 200, 0 overflow) | Đã đạt (ghi nhận thiếu API tra cứu công khai xác thực) |
| Hero & Linh vật Pixel Capybara | `HeroSection.tsx`, `PixelCapybara.tsx` | Trang chủ `/` | Hero 2 cột gọn (giữ `SiteSettings`), Capy dừng RAF thật khi ẩn/ngoài viewport & có khung tĩnh khi `prefers-reduced-motion` | Playwright 360–1440px + kiểm tra code RAF | Đã đạt |
| Tìm kiếm tiếng Việt, lọc danh mục/giá, sắp xếp, phân trang | `StorefrontCatalog.tsx`, `EmptyState` | `/` và `/san-pham` | Đặt ngay sau Hero trên `/` (editorial flow); sidebar desktop + thu gọn mobile trên `/san-pham`; 1 cây DOM duy nhất | Playwright tìm `"chinh chu"`, empty state, reset, 360–1440px | Đã đạt |
| Gói nổi bật (`isFeatured`) & Mobile carousel | `StorefrontCatalog.tsx` | Khi có sp `isFeatured = true` (ẩn tạm khi đang lọc/tìm trên `/`) | Nằm giữa thanh tìm kiếm và danh sách chính, giữ nút Trước/Sau trên mobile | Playwright screenshot 1440px & 390px | Đã đạt |
| Đồng bộ catalog & tồn kho live (BroadcastChannel, visibility, polling) | `StorefrontCatalog.tsx`, `PurchaseForm.tsx` | Khi tab đang mở | Giữ nguyên `/api/store/catalog` & `/api/store/availability` | Đối chiếu diff & `tsc --noEmit` | Đã đạt |
| Thẻ sản phẩm (`ProductCard`, `PriceDisplay`) & Popover điều kiện | `ProductCard.tsx`, `components/ui/price-display.tsx` | Lưới sản phẩm & Gói nổi bật | Ảnh + nhãn danh mục tương phản cao → Tên → Hình thức → Thời hạn/KBH rõ trên mobile → Giá → Nút 44px; popover không bị cắt, đóng bằng `Escape`/click ngoài | Playwright test mở/đóng popover + screenshot | Đã đạt |
| Hướng dẫn mua hàng 4 bước & FAQ Accordion | `app/page.tsx`, `FaqAccordion.tsx` | Trang chủ `/` (`#how`, `#faq`) | Nội dung trung thực theo phạm vi thực tế, không cam kết quá mức | Playwright + `tsc --noEmit` | Đã đạt |
| Chi tiết sản phẩm (Thứ tự DOM tự nhiên) | `app/product/[slug]/page.tsx` | `/product/[slug]` | Thứ tự DOM tự nhiên `Summary → PurchaseForm → Details` (không dùng CSS `order-*` gây lệch focus) | Playwright screenshot 1440px & 390px | Đã đạt |
| Chọn biến thể, số lượng, Buff Token & Invite Code | `PurchaseForm.tsx` | `/product/[slug]` | Radio có viền + dấu tick; hiển thị tổng dung lượng Token (`XB × SL`), Invite Code validation, giới hạn SL | Playwright kiểm tra Canva Pro & Muse AI Buff Token | Đã đạt |
| Coupon thu gọn + Preview + Kiểm tra lại khi đổi SL + Submit đơn | `PurchaseForm.tsx` (`/api/coupons/preview`, `/api/orders`) | `/product/[slug]` | Thu gọn mặc định, tự mở khi áp dụng/lỗi; đối chiếu payload `POST /api/orders` qua Playwright mock (0 ghi DB thật) | Playwright mock test `coupon_applied`, `coupon_removed`, `order_payload_intact` | Đã đạt (kiểm thử bằng mock an toàn) |
| Thanh toán VietQR & 6 trạng thái đơn hàng | `app/order/[id]/page.tsx`, `OrderStatus.tsx` | `/order/[id]` | Bảo toàn đủ 6 trạng thái, countdown 10p, polling 3s, đối soát thủ công, nút copy, link Zalo hỗ trợ | Đối chiếu diff & `tsc --noEmit` (không tạo giao dịch thật) | Chưa xác minh do môi trường (tránh tạo đơn/giao dịch thật) |
| Widget Zalo, Footer, Thống kê truy cập & Trang chính sách/KTV | `ZaloWidget.tsx`, `Footer.tsx`, `/dieu-khoan-dich-vu`, `/chinh-sach-*`, `/ktv`, `/bang-gia`, `/ctv` | Các trang tương ứng | Bỏ mascot thứ 2 ở Footer; mọi route phụ trả HTTP 200 & 0 tràn ngang tại 390px | Playwright kiểm tra từng route tại 390px | Đã đạt |

## 2. Khu Vực Quản Trị (`/admin`)

| Chức năng | Route / Component | Điều kiện xuất hiện | Vị trí / Cơ chế trong giao diện mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Đăng nhập Admin (`/admin/login`) | `app/admin/login/page.tsx` | Chưa đăng nhập admin | Đồng bộ token, `htmlFor`/`id` đầy đủ, nút & input cao 44px | Playwright HTTP 200, 0 overflow 390px | Đã đạt |
| Layout Admin, Sidebar, Đổi mật khẩu, Thông báo, Auto-logout | `app/admin/layout.tsx`, `components/admin/*` | Đã đăng nhập admin | Đồng bộ `CAPYGO Admin` & design tokens | `tsc --noEmit` & `next build` | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |
| Quản lý sản phẩm & Modal sửa 4 tab + Bật/tắt Live Preview | `app/admin/products/ProductManagerClient.tsx` | `/admin/products` | 4 tab (`Thông tin`, `Gói & giá`, `Giao hàng`, `Nội dung`) giữ nguyên state chưa lưu + nút bật/tắt Preview; giữ nguyên giá vốn & đồng bộ | `tsc --noEmit`, `next build`, đối chiếu diff | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |
| Tổng quan, Đơn hàng, Nguồn, Đại lý, Serials, Coupon, Bảng giá, Cài đặt, FatCat | `app/admin/*` | `/admin/*` | Thừa hưởng design tokens mới, giữ nguyên nghiệp vụ & API | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường (biên dịch đạt, chưa test runtime auth) |
