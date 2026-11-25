# Bảng Đối Chiếu Chức Năng — CAPYGO Admin UI

> **Quy ước trạng thái:** `Chưa kiểm tra` · `Đã đạt` · `Lỗi tồn tại trước` · `Lỗi hồi quy` · `Chưa xác minh do môi trường`
> **Cập nhật lần cuối:** 2026-11-25

## 1. Khung Admin, Xác Thực & Điều Hướng

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Đăng nhập Admin & thông báo hết phiên (`?reason=timeout`) | `app/admin/login/page.tsx`, `/api/admin/auth` | Chưa đăng nhập | Trang đăng nhập độc lập chuẩn token, label `htmlFor`/`id`, nút 44px | `tsc --noEmit`, `next build`, kiểm tra DOM | Đã đạt |
| Sidebar điều hướng phân nhóm (Kinh doanh / Nguồn hàng / Nội dung) | `app/admin/layout.tsx` | Đã đăng nhập Admin | Desktop: Sidebar 240px phân 3 nhóm, đánh dấu active cả route con (`/admin/products/*`, `/admin/fatcat/*`) | `tsc --noEmit`, `next build`, rà soát mã nguồn | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |
| Mobile Sidebar Drawer (Focus trap, Escape, Scroll lock) | `app/admin/layout.tsx` | Đã đăng nhập Admin (`< md`) | Nút menu trên topbar mobile mở drawer phủ sạch, không đẩy nội dung xuống dưới; đóng bằng `Escape` & trả focus | `tsc --noEmit`, `next build`, rà soát mã nguồn | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |
| Chuông thông báo, số chưa đọc, đánh dấu 1/tất cả đã đọc | `components/admin/NotificationBell.tsx`, `/api/admin/notifications*` | Đã đăng nhập Admin | Góc phải topbar (giữ nguyên toàn bộ hành vi) | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |
| Đổi mật khẩu, Về cửa hàng, Đăng xuất, Tự đăng xuất 10p | `app/admin/layout.tsx`, `ChangePasswordModal.tsx`, `AdminAutoLogoutListener.tsx` | Đã đăng nhập Admin | Loại bỏ nút Đổi mật khẩu trùng lặp; giữ 1 nút tại topbar + chân sidebar (Về cửa hàng, Đăng xuất); giữ nguyên modal & auto-logout | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |

## 2. Tổng Quan (`/admin`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Bộ lọc thời gian (Hôm nay, Hôm qua, 7 ngày, 30 ngày, Tháng này, Tháng trước, Toàn thời gian) & Làm mới | `app/admin/page.tsx`, `AdminDashboardClient.tsx` | Admin | Thanh công cụ đầu trang, giữ nguyên công thức lọc & `router.refresh()` | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |
| 4 thẻ KPI (Doanh Thu Bán Ra, Thực Nhận / Tiền Lời, Đơn hàng, Tồn kho serial) | `AdminDashboardClient.tsx` | Admin | Sửa công thức nhất quán: `Doanh Thu Bán Ra = grossRevenue` (không trừ nhập hàng), `Thực Nhận (Tiền Lời) = grossRevenue - providerCost - rangeImportTotal`; giữ nhãn trung thực & số liệu `tabular-nums` | `tsc --noEmit`, `next build`, rà soát công thức | Chưa xác minh do môi trường |
| Ví & Số dư đại lý + Làm mới tất cả ví | `AdminDashboardClient.tsx`, `/api/admin/providers/[id]/test` | Admin | Hiển thị rõ số dư, trạng thái đồng bộ và thời điểm cập nhật gần nhất (`lastSyncedAt`) | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |
| Biểu đồ xu hướng Doanh thu & Thực nhận | `AdminDashboardClient.tsx` | Admin | Sửa lỗi cột cao 0px (`h-full` cho bar pair), bỏ cột giả 4% cho ngày 0đ, sửa ngưỡng `maxVal <= 0`, hỗ trợ focus/click/touch cho tooltip, khớp mô tả legend | `tsc --noEmit`, `next build`, rà soát DOM | Chưa xác minh do môi trường |
| Top sản phẩm hiệu quả, Đơn gần đây, Lưu lượng truy cập & Tồn kho thấp | `AdminDashboardClient.tsx` | Admin | Bố cục 2 cột dưới dùng `items-start` để panel Lưu lượng không bị kéo giãn khoảng trống | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |

## 3. Sản Phẩm (`/admin/products` & Preview)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Tab trạng thái (Đang bán, Bản nháp, Tạm ẩn, Đã chỉnh sửa, Tất cả), tìm kiếm, lọc nổi bật, xóa hàng loạt, đồng bộ, thêm thủ công | `ProductManagerClient.tsx`, `/api/admin/products*` | Admin | Giữ đủ toàn bộ tab, đếm, checkbox chọn hàng loạt tách bạch với checkbox nổi bật, bộ đếm đổi rõ thành `Nổi bật: X/6`, STT giữ nguyên | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |
| Bảng sản phẩm & cảnh báo biến động nguồn | `ProductManagerClient.tsx` | Admin | Trung tính hóa nền hàng (bỏ tô nền tím/vàng toàn hàng, giữ viền trái `border-l-amber-400` cho cảnh báo biến động và badge `"Đã chỉnh sửa"`), căn phải giá đại lý & giá bán với `tabular-nums` | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |
| Modal biên tập 4 tab (Thông tin, Gói & giá, Giao hàng, Nội dung) + Preview bật/tắt + Xác nhận giá dưới vốn + Upload ảnh | `ProductManagerClient.tsx`, `app/admin/products/preview/[id]/page.tsx` | Admin | Giữ đủ 4 tab không mất state chưa lưu, bật/tắt Live Preview, giữ nguyên route preview toàn trang | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |

## 4. Danh Mục Nguồn, FatCat & Đại Lý (`/admin/sources`, `/admin/fatcat`, `/admin/providers`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Danh mục nguồn (Tab Chưa thêm/Đã thêm/Cần kiểm tra/Bỏ qua/Tất cả, lọc kết nối, phân trang, chọn nhiều, thêm vào cửa hàng, bỏ qua/khôi phục, xem chi tiết) | `SourcesClient.tsx`, `/api/admin/sources*` | Admin | Giữ nguyên toàn bộ thao tác & phân biệt rõ "Sản phẩm nguồn" vs "Sản phẩm web" | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |
| Route phụ FatCat & Preview FatCat | `app/admin/fatcat/page.tsx`, `app/admin/fatcat/preview/[id]/page.tsx` | Admin | Giữ nguyên hoạt động, đánh dấu active nhóm Nguồn hàng trong sidebar | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |
| Đại lý & Kết nối (CRUD, preset, test trước khi lưu, đồng bộ, số dư) + Trung tâm Dino | `ProvidersClient.tsx`, `DinoHubModal.tsx`, `/api/admin/providers*` | Admin | Sửa badge `"Sẵn sàng (Chưa kiểm tra)"` xanh thành xám trung tính `"Chưa kiểm tra"`; bảo toàn toàn bộ Dino Hub | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |

## 5. Kho Serials (`/admin/serials`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Nạp kho nhiều dòng theo biến thể, đếm dòng, xóa serial sẵn sàng | `SerialManagerClient.tsx`, `/api/admin/serials` | Admin | Sửa `items-start` để form không bị kéo cao; sửa lỗi hiển thị `&#10;` ở placeholder; thêm chú thích phân biệt "Nạp kho serial" vs "Nhập hàng theo ngày"; mặc định ẩn nội dung serial nhạy cảm kèm nút Hiện/Ẩn từng dòng, Hiện/Ẩn tất cả và Sao chép | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |

## 6. Đơn Hàng & Nhập Hàng Theo Ngày (`/admin/orders`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Quản lý đơn (tìm kiếm, lọc trạng thái, tạo đơn ngoài, đồng bộ, xóa đơn test, đối soát thủ công, hủy, xuất kho, lịch sử, trang khách) | `OrderManagerClient.tsx`, `/api/admin/orders` | Admin | Giữ đầy đủ mọi modal & trạng thái, không đồng nhất `paid` và `fulfilled` | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |
| Sổ nhập hàng theo ngày (chọn ngày, xem tất cả, tạo phiếu, xóa, trừ doanh thu ngày, giữ tổng doanh thu) | `OrderManagerClient.tsx`, `/api/admin/stock-imports*` | Admin | Ghi chú rõ phiếu chi phí nhập hàng không tự cộng kho serial; giữ nguyên công thức nhập hàng theo ngày | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |

## 7. Mã Giảm Giá (`/admin/coupons`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Thống kê, tìm kiếm, làm mới, lọc trạng thái, tạo/sửa (cố định/%, trần giảm, đơn tối thiểu, phạm vi & loại trừ, giới hạn tổng/email, thời hạn), sao chép, tạm dừng/kích hoạt/lưu trữ, lịch sử sử dụng | `CouponsClient.tsx`, `/api/admin/coupons*` | Admin | Phân biệt trạng thái cấu hình và hiệu lực thực tế (`Đang hiệu lực` / `Đã bật · Hết hạn` / `Đã bật · Chưa đến ngày` / `Đã bật · Hết lượt`) mà không đổi quy tắc backend | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |

## 8. Bảng Giá & Menu & Cổng KTV (`/admin/price-list`, `/ktv`, `/ctv`, `/bang-gia`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 3 tab (Sản phẩm & Giá, Giao diện & Cột, Cổng KTV & Mã PIN), ghim/đổi ghim/gỡ ghim, đồng bộ giá/kho, khôi phục, lưu, Copy Text, Copy Ảnh, tải PNG, Live Preview | `PriceListClient.tsx`, `KtvPriceListClient.tsx`, `/api/admin/price-list`, `/api/ctv/*` | Admin & KTV | Phân cụm thanh công cụ toàn cục thành 3 nhóm rõ ràng (`Lưu` · `Dữ liệu` · `Xuất menu`); thêm thu gọn/mở rộng từng nhóm (tự mở khi đang tìm kiếm); thêm hàng tiêu đề cột (`Tên hiển thị`, `Ghi chú`, `Giá bán`, `Kho`); bảo toàn 100% 3 tab, ghim, đồng bộ, Cổng KTV & export PNG/Ảnh/Text | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |

## 9. Cài Đặt Website (`/admin/settings` & đồng bộ Storefront)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Tên thương hiệu, SEO title, upload/thay/gỡ logo, Hero title (`**highlight**`), màu chính/nổi bật, CTA, bật/tắt thống kê truy cập, Preview Desktop/Mobile, Lưu/Hoàn tác | `SettingsClient.tsx`, `components/storefront/HeroSection.tsx`, `/api/admin/settings*` | Admin & Storefront | Sửa `HeroSection.tsx` để render đúng cú pháp `**chữ nổi bật**`, `heroTitleColor` và `heroHighlightColor` giống hệt bản xem trước; thêm thanh **SaveBar dính đáy** khi có thay đổi chưa lưu (`isDirty`) kèm nút Hoàn tác & Lưu cài đặt | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường |
