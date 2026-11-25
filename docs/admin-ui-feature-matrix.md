# Bảng Đối Chiếu Chức Năng — CAPYGO Admin UI

> **Quy ước trạng thái:** `Chưa kiểm tra` · `Đã đạt` · `Lỗi tồn tại trước` · `Lỗi hồi quy` · `Chưa xác minh do môi trường`
> **Cập nhật lần cuối:** 2026-11-25

## 1. Khung Admin, Xác Thực & Điều Hướng

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Đăng nhập Admin & thông báo hết phiên (`?reason=timeout`) | `app/admin/login/page.tsx`, `/api/admin/auth` | Chưa đăng nhập | Trang đăng nhập độc lập chuẩn token, label `htmlFor`/`id`, nút 44px | Playwright 390px + `tsc`/`next build` | Đã đạt |
| Sidebar điều hướng phân nhóm (Kinh doanh / Nguồn hàng / Nội dung) | `app/admin/layout.tsx` | Đã đăng nhập Admin | Desktop: Sidebar 240px phân 3 nhóm, đánh dấu active cả route con (`/admin/products/*`, `/admin/fatcat/*`) | `tsc --noEmit`, `next build`, kiểm tra code | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |
| Mobile Sidebar Drawer (Focus trap, Escape, Scroll lock) | `app/admin/layout.tsx` | Đã đăng nhập Admin (`< md`) | Nút menu trên topbar mobile mở drawer phủ sạch, không đẩy nội dung xuống dưới; đóng bằng `Escape` & trả focus | `tsc --noEmit`, `next build`, kiểm tra code | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |
| Chuông thông báo, số chưa đọc, đánh dấu 1/tất cả đã đọc | `components/admin/NotificationBell.tsx`, `/api/admin/notifications*` | Đã đăng nhập Admin | Góc phải topbar (giữ nguyên toàn bộ hành vi) | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |
| Đổi mật khẩu, Về cửa hàng, Đăng xuất, Tự đăng xuất 10p | `app/admin/layout.tsx`, `ChangePasswordModal.tsx`, `AdminAutoLogoutListener.tsx` | Đã đăng nhập Admin | Nút đổi mật khẩu ở topbar + mục chân sidebar (Về cửa hàng, Đăng xuất); giữ nguyên modal & auto-logout | `tsc --noEmit`, `next build` | Chưa xác minh do môi trường (cần phiên đăng nhập admin) |

## 2. Tổng Quan (`/admin`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Bộ lọc thời gian (Hôm nay, Hôm qua, 7 ngày, 30 ngày, Tháng này, Tháng trước, Toàn thời gian) & Làm mới | `app/admin/page.tsx`, `AdminDashboardClient.tsx` | Admin | Thanh công cụ đầu trang, giữ nguyên công thức lọc & `router.refresh()` | `tsc --noEmit`, `next build` | Chưa kiểm tra |
| 4 thẻ KPI (Doanh thu, Chênh lệch bán – vốn đại lý, Đơn hàng, Tồn kho serial) | `AdminDashboardClient.tsx` | Admin | Giữ nguyên công thức (trừ nhập hàng ngày ở `today`/`yesterday`, tổng doanh thu giữ nguyên); sửa nhãn trung thực `"Chênh lệch sau vốn đại lý"` thay cho `"Lãi ròng"` | `tsc --noEmit`, `next build` | Chưa kiểm tra |
| Ví & Số dư đại lý + Làm mới tất cả ví | `AdminDashboardClient.tsx`, `/api/admin/providers/[id]/test` | Admin | Giữ nguyên danh sách ví, phân biệt số dư/trạng thái đồng bộ/thời điểm cập nhật | `tsc --noEmit`, `next build` | Chưa kiểm tra |
| Biểu đồ xu hướng Doanh thu & Chênh lệch | `AdminDashboardClient.tsx` | Admin | Sửa lỗi cột cao 0px (`h-full` cho bar pair), không hiển thị cột giả cho giá trị 0, sửa ngưỡng `maxVal <= 0`, hỗ trợ focus/click/touch cho tooltip, khớp mô tả legend | `tsc --noEmit`, `next build`, kiểm tra DOM | Chưa kiểm tra |
| Top sản phẩm hiệu quả, Đơn gần đây, Lưu lượng truy cập & Tồn kho thấp | `AdminDashboardClient.tsx` | Admin | Bố cục 2 cột `items-start` (không ép bằng chiều cao gây khoảng trống lớn ở panel lưu lượng) | `tsc --noEmit`, `next build` | Chưa kiểm tra |

## 3. Sản Phẩm (`/admin/products` & Preview)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Tab trạng thái (Đang bán, Bản nháp, Tạm ẩn, Đã chỉnh sửa, Tất cả), tìm kiếm, lọc nổi bật, xóa hàng loạt, đồng bộ, thêm thủ công | `ProductManagerClient.tsx`, `/api/admin/products*` | Admin | Giữ đủ toàn bộ tab, đếm, checkbox chọn hàng loạt tách bạch với checkbox nổi bật, STT giữ nguyên | `tsc --noEmit`, `next build` | Chưa kiểm tra |
| Bảng sản phẩm & cảnh báo biến động nguồn | `ProductManagerClient.tsx` | Admin | Căn phải giá vốn/bán/lợi nhuận với `tabular-nums`, tách bạch 4 trạng thái (Xuất bản / Tồn kho / Đã sửa / Biến động nguồn) | `tsc --noEmit`, `next build` | Chưa kiểm tra |
| Modal biên tập 4 tab (Thông tin, Gói & giá, Giao hàng, Nội dung) + Preview bật/tắt + Xác nhận giá dưới vốn + Upload ảnh | `ProductManagerClient.tsx`, `app/admin/products/preview/[id]/page.tsx` | Admin | Giữ đủ 4 tab không mất state chưa lưu, bật/tắt Live Preview, giữ nguyên route preview toàn trang | `tsc --noEmit`, `next build` | Chưa kiểm tra |

## 4. Danh Mục Nguồn, FatCat & Đại Lý (`/admin/sources`, `/admin/fatcat`, `/admin/providers`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Danh mục nguồn (Tab Chưa thêm/Đã thêm/Cần kiểm tra/Bỏ qua/Tất cả, lọc kết nối, phân trang, chọn nhiều, thêm vào cửa hàng, bỏ qua/khôi phục, xem chi tiết) | `SourcesClient.tsx`, `/api/admin/sources*` | Admin | Đồng bộ surface/token, giữ nguyên toàn bộ thao tác & phân biệt rõ "Sản phẩm nguồn" vs "Sản phẩm web" | `tsc --noEmit`, `next build` | Chưa kiểm tra |
| Route phụ FatCat & Preview FatCat | `app/admin/fatcat/page.tsx`, `app/admin/fatcat/preview/[id]/page.tsx` | Admin | Giữ nguyên hoạt động, đánh dấu active nhóm Nguồn hàng | `tsc --noEmit`, `next build` | Chưa kiểm tra |
| Đại lý & Kết nối (CRUD, preset, test trước khi lưu, đồng bộ, số dư) + Trung tâm Dino | `ProvidersClient.tsx`, `DinoHubModal.tsx`, `/api/admin/providers*` | Admin | Sửa badge `"Sẵn sàng (Chưa kiểm tra)"` xanh thành xám trung tính `"Chưa kiểm tra"`; bảo toàn toàn bộ Dino Hub | `tsc --noEmit`, `next build` | Chưa kiểm tra |

## 5. Kho Serials (`/admin/serials`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Nạp kho nhiều dòng theo biến thể, đếm dòng, xóa serial sẵn sàng | `SerialManagerClient.tsx`, `/api/admin/serials` | Admin | Sửa `items-start` để form không bị kéo cao; sửa lỗi hiển thị `&#10;` ở placeholder; thêm chú thích phân biệt "Nạp kho serial" vs "Nhập hàng theo ngày"; thêm nút ẩn/hiện nội dung serial nhạy cảm + nút sao chép | `tsc --noEmit`, `next build` | Chưa kiểm tra |

## 6. Đơn Hàng & Nhập Hàng Theo Ngày (`/admin/orders`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Quản lý đơn (tìm kiếm, lọc trạng thái, tạo đơn ngoài, đồng bộ, xóa đơn test, đối soát thủ công, hủy, xuất kho, lịch sử, trang khách) | `OrderManagerClient.tsx`, `/api/admin/orders` | Admin | Giữ đầy đủ mọi modal & trạng thái, không đồng nhất `paid` và `fulfilled` | `tsc --noEmit`, `next build` | Chưa kiểm tra |
| Sổ nhập hàng theo ngày (chọn ngày, xem tất cả, tạo phiếu, xóa, trừ doanh thu ngày, giữ tổng doanh thu) | `OrderManagerClient.tsx`, `/api/admin/stock-imports*` | Admin | Ghi chú rõ phiếu chi phí nhập hàng không tự cộng kho serial; giữ nguyên công thức doanh thu ngày | `tsc --noEmit`, `next build` | Chưa kiểm tra |

## 7. Mã Giảm Giá (`/admin/coupons`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Thống kê, tìm kiếm, làm mới, lọc trạng thái, tạo/sửa (cố định/%, trần giảm, đơn tối thiểu, phạm vi & loại trừ, giới hạn tổng/email, thời hạn), sao chép, tạm dừng/kích hoạt/lưu trữ, lịch sử sử dụng | `CouponsClient.tsx`, `/api/admin/coupons*` | Admin | Phân biệt trạng thái cấu hình (`Đang bật`) và tình trạng hiệu lực theo thời gian (`Chưa đến ngày` / `Đã hết hạn` / `Hết lượt`) mà không đổi quy tắc backend | `tsc --noEmit`, `next build` | Chưa kiểm tra |

## 8. Bảng Giá & Menu & Cổng KTV (`/admin/price-list`, `/ktv`, `/ctv`, `/bang-gia`)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 3 tab (Sản phẩm & Giá, Giao diện & Cột, Cổng KTV & Mã PIN), ghim/đổi ghim/gỡ ghim, đồng bộ giá/kho, khôi phục, lưu, Copy Text, Copy Ảnh, tải PNG, Live Preview | `PriceListClient.tsx`, `KtvPriceListClient.tsx`, `/api/admin/price-list`, `/api/ctv/*` | Admin & KTV | Bảo toàn 100% 3 tab, ghim, đồng bộ và export PNG/Ảnh/Text; đảm bảo không lộ PIN trong log/báo cáo | `tsc --noEmit`, `next build`, Playwright `/ktv` | Chưa kiểm tra |

## 9. Cài Đặt Website (`/admin/settings` & đồng bộ Storefront)

| Chức năng | Route / Component | Điều kiện / Quyền | Vị trí UI mới | Cách kiểm tra | Kết quả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Tên thương hiệu, SEO title, upload/thay/gỡ logo, Hero title (`**highlight**`), màu chính/nổi bật, CTA, bật/tắt thống kê truy cập, Preview Desktop/Mobile, Lưu/Hoàn tác | `SettingsClient.tsx`, `components/storefront/HeroSection.tsx`, `/api/admin/settings*` | Admin & Storefront | Sửa `HeroSection.tsx` để render đúng cú pháp `**chữ nổi bật**`, `heroTitleColor` và `heroHighlightColor` giống hệt bản xem trước trong Cài đặt | `tsc --noEmit`, `next build`, Playwright `/` | Chưa kiểm tra |
