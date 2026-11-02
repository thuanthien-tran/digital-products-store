# Rà soát dung lượng, mã không dùng và tối ưu — 02/11/2026

## Phạm vi và kết luận

Rà soát cấu trúc toàn repository, dung lượng file, package manifest, import TypeScript/JavaScript (bao gồm import động literal và require literal), tham chiếu asset, cấu hình, luồng danh mục/tồn kho, animation và truy vấn admin. Đây không phải nghiệm thu toàn bộ nghiệp vụ hoặc đo Lighthouse/production bundle. Không gọi API đại lý, không tạo giao dịch, không sửa database. Chưa xóa file hay sửa code ứng dụng; báo cáo là danh sách hành động cụ thể sau khảo sát.

Có thể tinh gọn dự án, nhưng xóa file không dùng chủ yếu giảm dung lượng lưu trữ/cài đặt, không đồng nghĩa khách tải trang nhanh hơn. Ưu tiên runtime: animation, payload danh mục, phân trang admin và cập nhật tồn kho đủ biến thể.

## Dung lượng đo được

Đơn vị MB/GB thập phân, là tổng kích thước file logic, không phải dung lượng vật lý thực tế trên ổ đĩa (pnpm có thể dùng hardlink). Không theo symlink/junction. Cache có thể thay đổi khi dev server hoạt động.

| Vị trí | Dung lượng xấp xỉ | Ý nghĩa |
|---|---:|---|
| node_modules | 2.125 MB | Dependency và công cụ build; không tải nguyên thư mục xuống trình duyệt |
| .next | 746,6 MB | Output build/dev và cache |
| .next/dev | 608,7 MB | Output development |
| .next/cache | 122,3 MB | Cache dùng lại khi build |
| .audit | 1,82 MB | Bằng chứng kiểm thử, script và test database |
| prisma | 1,28 MB | Schema, seed, database đang dùng và backup |
| app | 0,392 MB | Mã route, API và giao diện |
| components | 0,200 MB | Component |
| lib | 0,165 MB | Nghiệp vụ và helper |
| public | 3.314 byte | 5 SVG template |

.next/dev + .next/cache chiếm khoảng 731 MB và có thể tái tạo. Chỉ dọn sau khi dừng tiến trình tương ứng và xác nhận đúng đường dẫn. Xóa cache có thể khiến lần chạy/build sau chậm hơn; không phải tối ưu tải trang production. Không xóa .next trong lúc next start/dev đang dùng. Không xóa node_modules trong môi trường đang chạy.

## File không thấy sử dụng trong ứng dụng

| File | Bằng chứng | Hướng xử lý |
|---|---|---|
| public/file.svg | Không có tham chiếu trong mã ứng dụng | Có thể bỏ template |
| public/globe.svg | Không có tham chiếu trong mã ứng dụng | Có thể bỏ template |
| public/next.svg | Không có tham chiếu trong mã ứng dụng | Có thể bỏ template |
| public/vercel.svg | Không có tham chiếu trong mã ứng dụng | Có thể bỏ template |
| public/window.svg | Không có tham chiếu trong mã ứng dụng | Có thể bỏ template |
| components/ui/badge.tsx | Không có import tĩnh/động literal; Badge chỉ được định nghĩa tại file này | Có thể bỏ; chữ Badge trong comment khác không phải sử dụng component |
| lib/fatcat-sync.ts | Không có import/caller syncFatcatCatalog trong ứng dụng | Module đồng bộ cũ; có thể bỏ sau khi xác nhận không có tác vụ ngoài repository gọi trực tiếp |
| lib/provider-api.ts | Không có import/caller trong ứng dụng; báo cáo cũ ghi helper chưa kích hoạt | Mã dự phòng chưa nối nghiệp vụ; có thể bỏ khỏi ứng dụng, giữ lịch sử trong Git |

Tổng 8 file khoảng 12.994 byte (~13 KB). Đây không phải nguồn gây nặng chính. Kết luận không có caller chỉ áp dụng repository được kiểm tra, không khẳng định không tồn tại người dùng URL SVG hoặc tác vụ bên ngoài.

Không xóa lib/fatcat.ts, lib/fatcat-sync-service.ts, lib/fatcat-adapter.ts hoặc cả app/admin/fatcat chỉ vì tên trông cũ: route/module vẫn được tham chiếu; lib/fatcat.ts còn được fulfillment dùng. Routes Next.js là entrypoint dù không có import từ file khác. Muốn hợp nhất luồng legacy cần kiểm tra tương thích riêng.

## Dependency

Không thấy import trực tiếp 6 package sau trong source/config/script đã quét:

- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-label
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-tabs

Có thể bỏ khỏi dependency trực tiếp bằng pnpm, cập nhật đồng thời package.json và pnpm-lock.yaml, sau đó typecheck/lint/build. Một phần dependency chuyển tiếp có thể vẫn được package khác dùng, nên không ước lượng tiết kiệm bằng cách cộng kích thước package hoặc xóa tay node_modules. Package không được import thường không nằm trong bundle client.

Giữ @radix-ui/react-slot và @radix-ui/react-toast vì đang dùng. Giữ react-dom dù không có import trực tiếp vì framework cần. prisma dùng trong build/db scripts; tsx dùng chạy worker/seed/scripts. Không chuyển hai package này sang devDependencies trước khi xác định mô hình build và chạy worker production.

## Tối ưu thực sự ảnh hưởng vận hành

### 1. Cập nhật tồn kho thiếu biến thể — ưu tiên cao

components/storefront/StorefrontCatalog.tsx:61 chỉ dùng allVariantIds.slice(0, 50), polling mỗi 25 giây ở dòng 84. Nếu có hơn 50 biến thể, phần sau không được cập nhật bởi vòng polling này. API chủ động giới hạn tối đa 50 ID mỗi request.

Đề xuất: chia batch tối đa 50, giới hạn concurrency, hoặc cập nhật biến thể đang hiển thị và cập nhật ngay khi đổi bộ lọc/trang. Thêm chống request chồng lấn, hủy request khi unmount và backoff khi lỗi. Không giảm độ chính xác tồn kho để làm web nhẹ. API hiện đọc database; polling trình duyệt không đồng nghĩa tự gọi đại lý mỗi 25 giây.

### 2. Mascot ngoài viewport vẫn lên lịch requestAnimationFrame

PixelCapybara.tsx:397 và OfficeCapybara.tsx:360 đều requestAnimationFrame tiếp ngay trong nhánh ngoài viewport/tab ẩn. Đã tránh phần vẽ nặng, nhưng ngoài viewport khi tab còn hoạt động callback vẫn chạy. Comment “TRUE 0% CPU consumption” không được code bảo đảm; browser có thể tự throttle tab nền.

Đề xuất: cancel loop khi không cần; chỉ khởi động lại khi IntersectionObserver/visibilitychange cho phép; reset timestamp khi resume. Dùng ResizeObserver để xử lý thay đổi kích thước thay vì đọc clientWidth/clientHeight mỗi frame. Có thể tải component footer theo nhu cầu; dynamic import đơn thuần chưa chắc trì hoãn đến viewport, cần đo và thiết kế trigger phù hợp. Kiểm tra reduced motion, pause/resume và không tạo nhiều loop.

### 3. Danh mục tải toàn bộ sản phẩm và mô tả

app/page.tsx lấy toàn bộ sản phẩm đã công khai, include variants/group và truyền description, warrantyTerms, noticeNotes vào client; StorefrontCatalog render tất cả kết quả. Với danh mục nhỏ đây là lựa chọn đơn giản; khi tăng quy mô, payload và DOM tăng theo.

Đề xuất: đo số sản phẩm và payload thực tế; dùng select để giới hạn cột, chuẩn bị tóm tắt card ở server, phân trang/load-more khi cần. Không bỏ mô tả trước khi thay logic tìm kiếm và trích nội dung card đang phụ thuộc nó. Không thêm cache dài cho trạng thái tồn kho hoặc giá mà thiếu invalidation.

### 4. Trang admin đơn hàng chưa phân trang

app/admin/orders/page.tsx gọi findMany với include mà không take/cursor. Nên phân trang phía server, chọn đúng cột cần và tải chi tiết theo nhu cầu. Dashboard nên aggregate tổng doanh thu ở DB thay vì tải toàn bộ lịch sử nếu code hiện cần cộng các đơn. Không lấy kích thước source của ProductManagerClient (~61 KB) làm kích thước JS tải xuống; phải đo bundle route riêng.

### 5. Hình ảnh và font

ProductCard sử dụng img native loading=lazy và khung aspect-video: đã có tối ưu cơ bản. Chưa có pipeline resize/srcset/WebP/AVIF thể hiện trong component. Nên kiểm soát nguồn ảnh, kích thước upload và tạo thumbnail trước; ảnh CDN có thể là phần nặng không nằm trong public. Không tải thử tùy tiện mọi URL trong database.

RootLayout nạp Space Grotesk, Plus Jakarta Sans, Space Mono. Cả font-mono cũng có nơi dùng, không phải font thừa được xác nhận. Cân nhắc giảm font/weight hoặc preload sau khi đo, giữ khả năng hiển thị tiếng Việt và thiết kế đã duyệt.

app/layout.tsx:28 khai báo /logo.png nhưng public không có file này; dự án có app/favicon.ico. Nên trỏ metadata về asset thực hoặc dùng favicon convention để tránh request không tồn tại.

### 6. Nhiều tiến trình đồng bộ

lib/scheduler.ts dùng Map trong bộ nhớ cho khóa; không phải distributed lock giữa worker/process/instance dù comment gọi như vậy. Nếu triển khai nhiều instance hoặc cả cron và worker, cần bảo đảm chỉ một nguồn lịch chạy, hoặc khóa dùng chung có TTL/quyền sở hữu. Không cần triển khai thêm Redis chỉ để tối ưu khi hệ thống thực sự chỉ chạy một worker.

## File cần giữ và vệ sinh quy trình

- Giữ prisma/dev.db và backup cho đến khi có retention/phục hồi đã xác minh.
- Giữ .audit và reports: tổng dung lượng nhỏ, có giá trị kiểm chứng. Có thể lưu trữ ngoài gói triển khai; Git ignore không tự bảo đảm công cụ deploy bỏ file.
- Giữ pnpm-lock.yaml để cài đặt tái lập.
- Giữ worker, migration và test scripts dù không được app import.
- Không xóa CSS chỉ bằng tìm tên class: Tailwind có class động và convention.
- README còn hướng dẫn mật khẩu demo/admin mặc định; cần cập nhật vận hành và xác thực thực tế, tránh dùng tài liệu cũ làm hướng dẫn production.
- Khi đóng gói production, chỉ đưa runtime/build output cần thiết; giữ DB trên volume phù hợp. Có thể đánh giá standalone sau khi kiểm thử Prisma và worker; chưa cấu hình tự động trong lần rà soát này.

## Kiểm tra đã thực hiện

- git status trước rà soát: sạch.
- Kiểm kê file và kích thước: hoàn tất.
- Phân tích import bằng TypeScript AST và dò tên helper/asset/dependency: hoàn tất; không bảo đảm phát hiện import tạo từ chuỗi động hoặc caller ngoài repository.
- pnpm exec tsc --noEmit --incremental false: PASS (exit 0).
- pnpm run lint: FAIL — 17 lỗi, 2 cảnh báo.
  - OrderManagerClient: 2 lỗi purity tại Date.now/Math.random; cần kiểm tra call site vì đoạn được đặt trong callback mở modal, không tự kết luận lỗi runtime từ diagnostic.
  - ProductManagerClient: 1 lỗi setState trong effect.
  - app/api/admin/orders/route.ts: 9 lỗi explicit any.
  - OfficeCapybara: 1 lỗi setState trong effect, 1 cảnh báo GRID_H không dùng.
  - lib/crypto.ts: 1 cảnh báo biến catch không dùng.
  - lib/providers/registry.ts: 4 lỗi explicit any.
- Chưa chạy production build mới, browser profiling, Lighthouse hoặc kiểm thử tải; không có số đo trước/sau và không khẳng định tăng tốc theo phần trăm.

## Trình tự đề xuất

1. Bỏ 5 SVG template và badge sau khi review diff; xử lý 2 helper cũ theo danh sách caller.
2. Gỡ 6 dependency trực tiếp bằng package manager, kiểm tra lockfile.
3. Sửa lint hiện có, favicon; chạy typecheck/lint/build.
4. Sửa polling đủ biến thể và vòng animation; kiểm tra browser pause/resume, bộ lọc và tồn kho.
5. Phân trang admin, đo payload danh mục/ảnh/font trước khi tối ưu sâu.
6. Dọn dev/cache lúc server dừng nếu mục tiêu là giải phóng ổ đĩa; không xóa database/backup để lấy vài MB.

Không cần viết lại dự án, đổi framework hay xóa các chức năng đang hoạt động để đạt mục tiêu này.
