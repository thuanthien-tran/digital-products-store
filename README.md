# 🛒 ACCGIARE Clone - Hệ Thống Bán Tài Khoản Số Tự Động 24/7

Dự án website thương mại điện tử chuyên phân phối tài khoản số, key bản quyền và phần mềm tự động 24/7 (mô phỏng theo mô hình của **accgiare.id.vn**).

---

## 🚀 Tính Năng Chính

### 1. Storefront (Dành Cho Khách Hàng)
- **Giao diện hiện đại**: Dark theme chuẩn UI/UX, responsive mượt mà trên Mobile & Desktop.
- **Danh mục phong phú**: Phân nhóm Trí Tuệ Nhân Tạo (AI), Đồ Họa & Thiết Kế, Văn Phòng, Học Tập.
- **Trang chi tiết sản phẩm**: Chọn gói/thời hạn, kiểm tra số lượng tồn kho theo thời gian thực.
- **Thanh toán VietQR Napas247**: Tự động sinh mã VietQR kèm số tài khoản, số tiền và mã đơn hàng.
- **Giao hàng tự động (Serials)**: Hệ thống tự động trích xuất serial/key trong kho và hiển thị ngay trên màn hình đơn hàng sau 3-5 giây khi chuyển khoản thành công.
- **Tra cứu đơn hàng (`/lookup`)**: Cho phép khách hàng tìm lại key/tài khoản bằng email đã mua.
- **Hỗ trợ Zalo 24/7**: Widget hotline Zalo cố định góc màn hình.

### 2. Admin Panel (Dành Cho Quản Trị Viên)
- **Bảo mật**: Đăng nhập qua JWT cookie (`/admin/login`), mặc định `admin` / `admin123`.
- **Dashboard (`/admin`)**: Thống kê tổng doanh thu, số đơn hàng, tồn kho và cảnh báo gói sắp hết hàng.
- **Quản lý sản phẩm (`/admin/products`)**: Thêm sản phẩm mới, thiết lập giá, danh mục, hướng dẫn sau mua.
- **Quản lý kho Serials (`/admin/serials`)**: Nạp hàng loạt tài khoản bằng cách copy-paste (mỗi dòng 1 serial `tk|mk|2fa` hoặc link), xóa serial lỗi.
- **Quản lý đơn hàng (`/admin/orders`)**: Xem danh sách đơn, lọc theo trạng thái, duyệt đơn thủ công hoặc hủy đơn.

### 3. Tự Động Hóa Webhook
- **SePay / Casso Webhook (`/api/webhooks/sepay`)**: Lắng nghe biến động số dư ngân hàng, match mã đơn hàng, tự động cấp serials và đánh dấu đơn hàng thành công.
- **Hỗ trợ Telegram Bot**: Tự động gửi tin nhắn báo doanh thu về Telegram của admin mỗi khi có đơn mới thanh toán.

---

## 🛠️ Cài Đặt & Chạy Thử

### Bước 1: Cài dependencies (đã cài sẵn)
```bash
pnpm install
```

### Bước 2: Cấu hình file `.env`
Mở file `.env` và điền thông tin tài khoản ngân hàng của bạn:
```env
DATABASE_URL="file:./dev.db"

# Cổng SePay (lấy tại sepay.vn)
SEPAY_WEBHOOK_KEY="demo_key_123"

# Thông tin tài khoản ngân hàng nhận VietQR
BANK_ACCOUNT_NUMBER="0123456789"
BANK_NAME="MB" # MB, VCB, TCB, ACB, VPB...
BANK_ACCOUNT_NAME="NGUYEN VAN A"

# Thông tin Admin
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
JWT_SECRET="your_secret_key"

# Hỗ trợ Zalo
NEXT_PUBLIC_STORE_NAME="ACCGIARE"
NEXT_PUBLIC_ZALO_PHONE_1="0356970964"
NEXT_PUBLIC_ZALO_PHONE_2="0356970964"
```

### Bước 3: Đồng bộ Database & Nạp dữ liệu mẫu
```bash
pnpm exec prisma db push
pnpm exec tsx prisma/seed.ts
```

### Bước 4: Chạy server Development
```bash
pnpm run dev
```
Truy cập:
- Trang chủ cửa hàng: [http://localhost:3000](http://localhost:3000)
- Tra cứu đơn hàng: [http://localhost:3000/lookup](http://localhost:3000/lookup)
- Trang Admin: [http://localhost:3000/admin](http://localhost:3000/admin) (Đăng nhập: `admin` / `admin123`)
