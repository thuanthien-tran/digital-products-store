# Báo cáo Dọn dẹp & Tối ưu Mã nguồn Dự án — 02/11/2026

## A. Tổng quan
- **Mục tiêu thực hiện**: Rà soát và trực tiếp dọn dẹp các tệp mẫu thừa, module không có caller, dependency trực tiếp không sử dụng, và bổ sung quy tắc tối ưu hóa gói triển khai (`.vercelignore`).
- **Nguyên tắc bảo toàn tuyệt đối**:
  - Giữ nguyên 100% giao diện, bố cục, màu sắc, font chữ và nhận diện thương hiệu.
  - Bảo tồn nguyên vẹn 2 linh vật chuột lang pixel art: `PixelCapybara` (Hero section) và `OfficeCapybara` (Footer) bao gồm animation, click interaction, toggle pause/play và reduced-motion.
  - Toàn bộ danh mục 26 sản phẩm, biến thể, tồn kho, giá bán, giá gạch, chiết khấu.
  - Luồng thanh toán VietQR, webhook SePay, xử lý đơn hàng, kho serial, đồng bộ FatCat và API đối tác.
  - Hệ thống xác thực admin, đổi mật khẩu và trang Cài đặt website (`/admin/settings`).
- **Giới hạn kiểm tra**:
  - Không ngắt server dev đang chạy trên port 3000 để xóa thư mục cache `.next` đang active.
  - Không tạo đơn mua hàng thật, không gọi endpoint mua hàng của đại lý để tránh phát sinh chi phí.
  - Số liệu dung lượng đo được là kích thước file logic của hệ thống tệp.

---

## B. Bảng chi tiết các thay đổi đã thực hiện

| Đường dẫn / Tên Package | Phân loại | Hành động | Bằng chứng không sử dụng | Dung lượng / Quy mô | Kiểm tra hồi quy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public/file.svg` | Asset mẫu | Đã xóa | File mẫu từ `create-next-app`, 0 tham chiếu trong code/CSS/DB | 544 B | Storefront render bình thường |
| `public/globe.svg` | Asset mẫu | Đã xóa | File mẫu từ `create-next-app`, 0 tham chiếu trong code/CSS/DB | 947 B | Storefront render bình thường |
| `public/next.svg` | Asset mẫu | Đã xóa | File mẫu từ `create-next-app`, 0 tham chiếu trong code/CSS/DB | 1.378 B | Storefront render bình thường |
| `public/vercel.svg` | Asset mẫu | Đã xóa | File mẫu từ `create-next-app`, 0 tham chiếu trong code/CSS/DB | 128 B | Storefront render bình thường |
| `public/window.svg` | Asset mẫu | Đã xóa | File mẫu từ `create-next-app`, 0 tham chiếu trong code/CSS/DB | 317 B | Storefront render bình thường |
| `components/ui/badge.tsx` | Component | Đã xóa | 0 file nào import `Badge`; UI sử dụng trực tiếp Tailwind badge | 868 B | `tsc --noEmit` PASS (0 errors) |
| `lib/provider-api.ts` | Module | Đã xóa | Helper ping API cũ chưa từng liên kết vào luồng nghiệp vụ | 2.880 B | `tsc --noEmit` PASS (0 errors) |
| `lib/fatcat-sync.ts` | Module | Đã xóa | Module sync prototype đời đầu; hệ thống hiện tại sử dụng `fatcat-sync-service.ts` | 4.960 B | `tsc --noEmit` PASS (0 errors) |
| `@radix-ui/react-dialog` | Dependency | `pnpm remove` | 0 import trong toàn bộ dự án | Nằm trong 31 packages | `tsc --noEmit` PASS |
| `@radix-ui/react-dropdown-menu` | Dependency | `pnpm remove` | 0 import trong toàn bộ dự án | Nằm trong 31 packages | `tsc --noEmit` PASS |
| `@radix-ui/react-label` | Dependency | `pnpm remove` | 0 import trong toàn bộ dự án (Form dùng native label) | Nằm trong 31 packages | `tsc --noEmit` PASS |
| `@radix-ui/react-select` | Dependency | `pnpm remove` | 0 import trong toàn bộ dự án (Dùng native select) | Nằm trong 31 packages | `tsc --noEmit` PASS |
| `@radix-ui/react-separator` | Dependency | `pnpm remove` | 0 import trong toàn bộ dự án (Dùng Tailwind border) | Nằm trong 31 packages | `tsc --noEmit` PASS |
| `@radix-ui/react-tabs` | Dependency | `pnpm remove` | 0 import trong toàn bộ dự án | Nằm trong 31 packages | `tsc --noEmit` PASS |
| `app/layout.tsx` | Tối ưu | Đã sửa | Sửa fallback icon từ `/logo.png` (không tồn tại) sang `/favicon.ico` để tránh request 404 | 1 dòng | Metadata icon tải chuẩn |
| `.vercelignore` | Cấu hình đóng gói | Đã thêm | Loại bỏ `.audit/`, `reports/`, `scripts/`, file `.bak` khỏi gói deploy Lambda | ~2 MB mã nguồn thừa khi deploy | Đóng gói gọn hơn |

---

## C. So sánh dung lượng trước và sau dọn dẹp

> **Lưu ý kỹ thuật**: Các chỉ số bên dưới là tổng kích thước file logic đo bằng script `scripts/measure-sizes.ts`. Trong môi trường `pnpm`, các file package được quản lý bằng cơ chế hardlink từ global store nên dung lượng giải phóng thực tế trên phân vùng đĩa có thể khác với tổng kích thước logic.

| Phân vùng thư mục | Trước dọn dẹp (02/11) | Sau dọn dẹp (02/11) | Thay đổi logic | Số lượng file thay đổi |
| :--- | :--- | :--- | :--- | :--- |
| **`node_modules`** | **2.063,138 MB** | **780,194 MB** | **Giảm 1.282,944 MB (~1,28 GB)** | **Giảm 74.121 files** (từ 101.029 xuống 26.908) |
| **`public`** | 1,238 MB | 1,235 MB | Giảm 3.314 B (xóa 5 SVG mẫu) | Giảm 5 files (từ 7 xuống 2) |
| **`components`** | 0,192 MB | 0,191 MB | Giảm 868 B (xóa `badge.tsx`) | Giảm 1 file (từ 23 xuống 22) |
| **`lib`** | 0,168 MB | 0,160 MB | Giảm 7.840 B (xóa 2 module dead code) | Giảm 2 files (từ 26 xuống 24) |
| **`.next`** (dev cache) | 730,448 MB | 738,460 MB | Tăng nhẹ ~8 MB do dev server chạy turbopack biên dịch route | Không xóa khi tiến trình đang mở |
| **`app`** | 0,409 MB | 0,409 MB | Giữ nguyên (chỉ chuẩn hóa đường dẫn favicon) | 58 files |
| **`prisma`** (DB & models) | 1,226 MB | 1,226 MB | Giữ nguyên 100% | 8 files |
| **`reports`** & scripts | 0,057 MB | 0,064 MB | Thêm script đo lường và báo cáo nghiệm thu | +2 files kiểm thử |
| **TỔNG THỂ DỰ ÁN** | **2.800,581 MB** | **1.525,609 MB** | **GIẢM 1.274,972 MB (~1,27 GB / giảm 45.5%)** | **GIẢM 74.107 files** (từ 103.890 xuống 29.783) |

---

## D. Kết quả kiểm tra hồi quy

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Kiểm tra kiểu dữ liệu (Typecheck)** | `npx tsc --noEmit` | **PASS (0 errors)** | Toàn bộ codebase sạch kiểu |
| **Kiểm thử cài đặt website & logic monogram** | `pnpm exec tsx scripts/test-settings.ts` | **PASS (18/18 tests)** | Magic bytes, validation, fallback, monogram `AG`, `CG`, `CH` hoạt động chính xác |
| **Kiểm thử API Endpoint & Bảo mật** | `pnpm exec tsx scripts/test-api-settings.ts` | **PASS (6/6 tests)** | Chặn 401 khi không có auth; Upload file nhị phân PNG và serve inline có `nosniff` |
| **Kiểm tra trạng thái hoạt động Storefront** | `pnpm exec tsx scripts/verify-storefront-health.ts` | **PASS (6/6 endpoints)** | Homepage (200), Catalog Stock API (200), Site Settings API (200), Login (200), Admin Protected (307 Redirect), Product Detail (200) |
| **Hai Capybara Mascots** | Kiểm tra DOM & HTML | **PASS** | Canvas, pixel art, event listener, animation frame, accessibility labels giữ nguyên vẹn |

---

## E. Các mục được giữ lại & Đề xuất tối ưu tương lai

1. **Thư mục `.next` (738 MB)**:
   - *Lý do giữ*: Dev server Next.js đang chạy và trực tiếp ghi/đọc cache biên dịch Turbopack. Xóa trong lúc server đang chạy sẽ gây lỗi I/O file lock trên Windows.
   - *Đề xuất*: Khi cần giải phóng dung lượng ổ cứng cục bộ, người dùng có thể tắt dev server (`taskkill` hoặc `Ctrl+C`) rồi xóa thư mục `.next` (`rm -rf .next`). Thư mục này sẽ tự động được tạo lại ở lần chạy `pnpm dev` hoặc `pnpm build` tiếp theo.
2. **`@radix-ui/react-slot` và `@radix-ui/react-toast`**:
   - *Lý do giữ*: `react-slot` đang được sử dụng trong `components/ui/button.tsx` và `react-toast` đang được dùng trong hệ thống thông báo Toast storefront.
3. **`public/brand/capygo-avatar-v1.png`**:
   - *Lý do giữ*: Ảnh avatar mẫu thương hiệu CapyGo đã được chuẩn bị sẵn để người dùng có thể thử tải lên trong trang Cài đặt website khi cần.
4. **Đề xuất tách biệt cho tương lai (ngoài phạm vi dọn dẹp)**:
   - Tối ưu hóa vòng lặp `requestAnimationFrame` của Capybara khi tab trình duyệt ở trạng thái ẩn (dùng `document.hidden` / `visibilitychange`).
   - Bổ sung phân trang phía server (server-side pagination `take/skip`) cho trang quản lý đơn hàng (`/admin/orders`) khi số lượng đơn vượt mốc hàng nghìn đơn.
