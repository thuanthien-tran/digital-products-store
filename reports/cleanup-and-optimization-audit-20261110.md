# Báo cáo Dọn dẹp & Tối ưu Dung lượng Mã nguồn CAPYGO — 10/11/2026

## 1. Khảo sát & Môi trường Thực thi
- **Dự án**: CAPYGO Store (`accgiare-clone`)
- **Môi trường**: Local Development (Windows, Shell: PowerShell / cmd)
- **Framework & Runtimes**: Next.js 16.4.3 (App Router, Turbopack), React 19.3.0, Prisma 5.22.0 (SQLite), Tailwind CSS v4
- **Node & Package Manager**: Node.js `v24.18.0`, pnpm `12.16.1` (quản lý qua `pnpm-lock.yaml`)
- **Tiến trình đang hoạt động**: Next.js Dev Server đang chạy trên port 3000 (PID 24624) -> **Bảo toàn nguyên vẹn thư mục cache `.next` để tránh lỗi I/O file-lock trên Windows**.
- **Nguyên tắc bảo toàn**:
  - Không thay đổi bất kỳ logic nghiệp vụ, thanh toán VietQR / SePay, xác thực Admin hay quy trình fulfillment.
  - Bảo toàn 100% hai linh vật pixel art Capybara (`PixelCapybara` ở Hero và `OfficeCapybara` ở Footer), toàn bộ animation, canvas, âm thanh và giao diện caramel/dark theme.
  - Không tự commit, push hoặc deploy lên Git / Production.

---

## 2. Đo lường Dung lượng Ban đầu & Phân loại Mục tiêu

### Bảng phân rã dung lượng trước dọn dẹp:
| Phân vùng / Thư mục | Số file | Dung lượng logic (MB) | Tính chất |
| :--- | :--- | :--- | :--- |
| **`.next`** (Turbopack dev cache) | 1.858 | 761,79 MB | Cache có thể tái tạo (đang được dev server PID 24624 sử dụng) |
| **`node_modules`** | 26.900 | 633,93 MB | Dependencies (quản lý qua pnpm hardlink) |
| **`public/`** | 37 | 33,45 MB | Ảnh sản phẩm, avatar thương hiệu, banner pixel |
| **`.git/`** | 509 | 28,53 MB | Lịch sử phiên bản Git |
| **`prisma/`** | 9 | 2,35 MB | SQLite database (`dev.db`), schema, và 6 bản sao lưu backup `.bak` |
| **`.audit/`** | 59 | 2,14 MB | Bản ghi kiểm thử & acceptance logs cũ |
| **`app/`** | 75 | 0,70 MB | App router pages, layouts, API routes |
| **`components/`** | 23 | 0,26 MB | UI & storefront components |
| **`lib/`** | 32 | 0,26 MB | Services, providers, security, utilities |
| **`tsconfig.tsbuildinfo`** | 1 | 0,18 MB | TypeScript build incremental cache |
| **`scripts/` & `reports/`** | 14 | 0,08 MB | Automation scripts & báo cáo |
| **TỔNG THỂ DỰ ÁN** | **29.533 files** | **1.463,84 MB** | Tổng dung lượng trên ổ đĩa local |

---

## 3. Phân loại File & Tài nguyên Rà soát

### Nhóm A: Đã chứng minh không sử dụng & Xử lý an toàn
1. **Unused Lucide-React Icons trong `app/admin/coupons/CouponsClient.tsx`**:
   - *Bằng chứng*: 8 icons (`AlertTriangle`, `CheckCircle2`, `Calendar`, `Layers`, `Percent`, `DollarSign`, `HelpCircle`, `ShieldAlert`) chỉ có mặt trong khối `import` mà không có bất kỳ tham chiếu nào trong code JSX.
   - *Hành động*: Đã loại bỏ khỏi danh sách import, giảm kích thước client component bundle.
2. **Unused Dynamic Import trong `lib/fulfillment.ts`**:
   - *Bằng chứng*: `buyShopToolBuff` được import thừa trong nhánh serial fulfillment (line 467) trong khi luồng buff đã được tách riêng ở phần trước.
   - *Hành động*: Đã loại bỏ import không sử dụng.
3. **Unused Parameter trong `lib/vietqr.ts`**:
   - *Bằng chứng*: Tham số `accountName` không được URL template `qr_only` của SePay yêu cầu, gây cảnh báo ESLint.
   - *Hành động*: Đã đổi tên thành `accountName: _accountName` để giữ nguyên interface cho caller mà không sinh cảnh báo.

### Nhóm B: Cache & Tối ưu Gói Triển khai (Deployment Package Reduction)
1. **Loại bỏ `*.tsbuildinfo` và `AGENTS.md` khỏi gói triển khai (`.vercelignore`)**:
   - Bổ sung quy tắc vào `.vercelignore` nhằm ngăn Vercel đóng gói file cache TypeScript local (~182 KB) và file hướng dẫn agent vào serverless bundle / edge lambdas.
2. **Kích hoạt `poweredByHeader: false` trong `next.config.ts`**:
   - Loại bỏ header `X-Powered-By: Next.js` khỏi mọi HTTP response trả về trình duyệt, tiết kiệm băng thông mạng và tăng cường bảo mật.

### Nhóm C: Giữ lại do thiếu bằng chứng hoặc có khả năng tham chiếu động
1. **Các tệp ảnh trong `public/` (33,45 MB)**:
   - Trong database local hiện thời, danh mục sản phẩm đang liên kết đến URL CDN bên ngoài (`https://encrypted-tbn0.gstatic.com/...`).
   - Tuy nhiên, 36 tệp ảnh trong `public/` (như banner Netflix pixel, Grok Cursor pixel, Canva Pro/Edu...) được tạo từ các phiên làm việc của người dùng và có thể được tham chiếu từ môi trường production, trang quản trị Admin khi người dùng chọn đổi ảnh sản phẩm, hoặc từ các chiến dịch truyền thông bên ngoài repo.
   - Đặc biệt, 3 cặp tệp `.jpg` và `.png` (`grok-cursor-capygo-v1`, `grok-cursor-pixel-v1`, `grok-cursor-bw-pixel`) thực chất có nội dung byte giống nhau 100% (cùng là JPEG). **Theo đúng quy tắc khảo sát, các file này được giữ nguyên** và đưa vào mục đề xuất dọn dẹp có xác nhận của người dùng.
2. **Dependencies trong `package.json`**:
   - Toàn bộ 13 dependencies và 8 devDependencies đều có caller thực tế trong mã nguồn:
     - `@radix-ui/react-slot` dùng trong `components/ui/button.tsx`
     - `@radix-ui/react-toast` dùng trong `components/ui/toast.tsx`
     - `class-variance-authority`, `clsx`, `tailwind-merge` dùng trong `lib/utils.ts`
     - `jose` dùng trong `lib/auth.ts`
     - `lucide-react` dùng xuyên suốt storefront và admin
     - `tsx` dùng trong `lib/settings.ts` và script bảo trì
     - `@tailwindcss/turbopack` dùng trong `next.config.ts`
   - Không có dependency nào là thừa hoặc có thể gỡ bỏ an toàn.

### Nhóm D: Dữ liệu cần bảo toàn nguyên vẹn
1. **Cơ sở dữ liệu & Bản sao lưu (`prisma/dev.db` + các file `dev.db.bak*`)**:
   - Toàn bộ 29 sản phẩm, 33 biến thể, kho serials và cấu hình nhà cung cấp.
   - Các file backup (`dev.db.bak`, `dev.db.bak2`, `dev.db.bak3`, `dev.db.bak4`, `dev.db.bak_buff`, `dev.db.followup.bak` tổng cộng ~1,8 MB) đã được ignore trong Git (`.gitignore`) và Vercel (`.vercelignore`). Giữ nguyên theo quy định an toàn dữ liệu.
2. **Bản ghi kiểm định (`.audit/`)**:
   - Được ignore trong Git và Vercel, không ảnh hưởng đến dung lượng deploy.

---

## 4. Kết quả Kiểm thử Toàn diện

| Hạng mục kiểm tra | Lệnh thực hiện | Kết quả | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Kiểm tra kiểu dữ liệu (TypeScript)** | `pnpm tsc --noEmit` | **PASS (0 lỗi)** | Toàn bộ dự án vượt qua type check |
| **Kiểm thử hệ thống Buff Token Muse AI** | `pnpm tsx scripts/test-buff-system.ts` | **PASS (33/33 tests)** | Bảng giá 5 bậc, validate invite code, chống nạp trùng |
| **Kiểm thử cài đặt website & Monogram** | `pnpm tsx scripts/test-settings.ts` | **PASS (18/18 tests)** | Magic bytes ảnh, logo initials, catalog integrity |
| **Kiểm định Storefront Health** | `pnpm tsx scripts/verify-storefront-health.ts` | **PASS (6/6 endpoints)** | Homepage (200), Catalog Stock (200), Site Settings (200), Login (200), Admin (307), Detail (200) |
| **Capybara Mascots & Giao diện** | Kiểm tra DOM & Canvas | **PASS** | `PixelCapybara` & `OfficeCapybara` hoạt động nguyên vẹn 100% |

---

## 5. Hướng dẫn Khôi phục (Rollback) nếu cần
Nếu muốn hoàn tác các tinh chỉnh tối ưu trong đợt này:
```bash
git checkout -- .vercelignore next.config.ts lib/fulfillment.ts lib/vietqr.ts app/admin/coupons/CouponsClient.tsx
```

---

## 6. Đề xuất Bước tiếp theo (Cần xác nhận từ người dùng)
1. **Dọn dẹp các bản backup SQLite cục bộ**:
   - Nếu không còn nhu cầu đối soát các mốc trước đây, người dùng có thể xóa các tệp `prisma/*.bak*` để giải phóng ~1,8 MB trong thư mục `prisma/`.
2. **Dọn dẹp 3 tệp ảnh trùng lặp trong `public/`**:
   - `grok-cursor-capygo-v1.jpg` và `grok-cursor-capygo-v1.png` (528 KB)
   - `grok-cursor-pixel-v1.jpg` và `grok-cursor-pixel-v1.png` (283 KB)
   - `grok-cursor-bw-pixel.jpg` và `grok-cursor-bw-pixel.png` (264 KB)
   - Xóa các bản sao đuôi `.png` (vốn có cấu trúc nhị phân JPEG giống hệt bản `.jpg`) có thể giải phóng thêm ~1,07 MB dung lượng tĩnh.
3. **Giải phóng Cache `.next` (khi tắt Dev Server)**:
   - Khi người dùng dừng server dev (port 3000), có thể xóa thư mục `.next` (`rmdir /s /q .next`) để giải phóng ~750 MB dung lượng ổ cứng. Cache này sẽ tự động sinh lại gọn gàng ở lần build/start tiếp theo.
