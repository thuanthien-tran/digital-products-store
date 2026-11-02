# BÁO CÁO PHÂN TÍCH ĐỊNH GIÁ & CHIẾN LƯỢC TỐI ƯU LỢI NHUẬN BÁN LẺ SẢN PHẨM SỐ
**Dự án:** ACCGIARE Store  
**Thời điểm thực hiện:** 02/11/2026  
**Chuyên viên phân tích:** Senior Pricing & Store Operations Specialist  
**Tập tin dữ liệu đính kèm:** [`reports/pricing-recommendations-20261102.csv`](file:///c:/Users/thuan/Downloads/WEB%20PROJECT/accgiare-clone/reports/pricing-recommendations-20261102.csv)

---

## 1. KHẢO SÁT HỆ THỐNG VÀ DỮ LIỆU DỰ ÁN

### 1.1. Cấu trúc dữ liệu & Đơn vị tiền tệ
- **Đơn vị tiền tệ:** Cơ sở dữ liệu Prisma (`Variant.priceCents`, `Variant.providerPrice`, `SourceProduct.sourcePrice`, `Order.totalCents`) lưu trữ trực tiếp bằng **đồng Việt Nam (VNĐ nguyên bản)** (ví dụ: `50000` = `50.000 VNĐ`). Không có chuyển đổi cent xu của ngoại tệ.
- **Nhà cung cấp kết nối (API Connections):**
  1. `fatcat`: Kết nối tự động qua API FatCat (tự động lấy mã, tra cứu số dư `balanceVnd`, tự động giao hàng mã thẻ/link).
  2. `dino`: Nhà cung cấp tích hợp kho mã serials / tài khoản thủ công hoặc qua API đối tác.
- **Danh mục hiện hành:** Tổng cộng **20 sản phẩm** đang ở trạng thái `editorialStatus: "published"` và `visibility: "public"` trên storefront.
- **Cơ chế bảo vệ giá:** Hệ thống đã trang bị cơ chế `draftSnapshot` và kiểm tra `confirmBelowCost`, đảm bảo việc cập nhật đồng bộ từ nhà cung cấp không tự động ghi đè giá bán lẻ do Admin thiết lập và không làm thay đổi giá của các đơn hàng đã tạo trước đó.

---

## 2. PHÂN TÍCH HIỆN TRẠNG & BẢNG SO SÁNH GIÁ VỐN - GIÁ BÁN HIỆN TẠI

### 2.1. Nhận định tổng quan về bộ giá hiện tại
1. **Một số sản phẩm bị định giá quá thấp (Underpriced) chịu rủi ro cao:**
   - **Youtube Premium Chính Chủ:** Giá vốn `20.000đ`, bán `25.000đ`. Lãi gộp chỉ có `5.000đ` (20%). Nếu khách hàng gặp lỗi đổi nhóm gia đình (family group limit) hoặc cần hướng dẫn kích hoạt qua Zalo, chi phí hỗ trợ và phí ngân hàng sẽ làm đơn hàng bị lỗ.
   - **Slot Microsoft Office 365 12 tháng BHF:** Giá vốn `73.500đ`, bán `89.000đ`. Lãi gộp chỉ `15.500đ` (17.4%) nhưng phải **cam kết bảo hành suốt 12 tháng** kèm 1TB OneDrive. Đây là tỷ lệ lãi/rủi ro hoàn toàn mất cân đối.
   - **Chat GPT Plus 1 tháng BHF:** Giá vốn `155.000đ`, bán `169.000đ`. Lãi gộp chỉ `14.000đ` (8.3%). Chỉ cần 1 tài khoản bị OpenAI truy quét cần cấp lại, toàn bộ lợi nhuận của 11 đơn hàng khác sẽ bị xóa sạch.
2. **Xung đột & Tự triệt tiêu doanh số (Cannibalization) trong cùng nhóm:**
   - Website đang hiển thị cùng lúc 3 sản phẩm Link Gemini 18M:
     - `Link Gemini Pro 18M (Dùng Trong 10P)` (FatCat, vốn 21.778đ, bán 39.000đ, kho 22).
     - `Link Gemini 18 Tháng (No Warranty)` (FatCat, vốn 22.442đ, bán 39.000đ, kho 49).
     - `Link Gemini Pro 18M` (Dino, vốn 30.750đ, bán 49.000đ, kho 312).
     *Hậu quả:* Khách hàng hoang mang không biết gói nào khác gói nào, trong khi bản chất kỹ thuật đều là link kích hoạt tài khoản Google One / Gemini 18 tháng.
3. **Sản phẩm hết hàng (Tồn kho = 0) vẫn đang để hiển thị bán công khai:**
   - Có **5 sản phẩm** đang có tồn kho bằng 0: `Cursor Pro`, `Google AI Pro 5TB 12 Tháng`, `Google AI PRO 5TB ACC CẤP SẴN`, `API CLAUDE - 50M Token`, `Slot Netflix 4K Premium`.
   *Rủi ro:* Khách hàng thanh toán xong sẽ bị treo đơn ở trạng thái chờ xử lý hoặc lỗi tự động do kho đại lý không có hàng để giao.

---

## 3. THÔNG TIN THAM CHIẾU GIÁ THỊ TRƯỜNG (DỮ LIỆU ĐỐI SOÁT THÁNG 11/2026)

*Khảo sát thực tế từ các nguồn công khai: Divine Shop, Tài Khoản Giá Tốt (taikhoangiatot.com), Tạp Hóa MMO (taphoammo.vn), Shopacc:*

| Nhóm sản phẩm | Sản phẩm tương đương trên thị trường | Mức giá bán lẻ thị trường phổ biến | Giá chính hãng / Gốc | Nhận định vị thế cạnh tranh |
| :--- | :--- | :--- | :--- | :--- |
| **YouTube** | YouTube Premium Family Add Mail (1 Tháng) | 49.000đ – 55.000đ/tháng | 79.000đ/tháng | Giá web 25k quá rẻ, có thể nâng lên 39k vẫn rẻ hơn thị trường 25%. |
| **Văn phòng** | Microsoft 365 Family Slot (1 Năm, 1TB OneDrive) | 250.000đ – 390.000đ/năm | 1.690.000đ/năm | Giá web 89k quá rẻ; nâng lên 149k vẫn rẻ hơn Divine Shop (390k) rất nhiều. |
| **AI / Bot** | ChatGPT Plus 1 Tháng (Tài khoản cấp riêng) | 220.000đ – 350.000đ/tháng | ~550.000đ ($20) | Giá web 169k quá sát vốn (155k). Đề xuất 199k vẫn thuộc top rẻ nhất. |
| **AI / Link** | Link Gemini Pro 18M / Google One 5TB | 53.000đ – 90.000đ (link ngắn hạn) | Không bán lẻ link | Mức 39k – 49k có sức hút rất lớn trên thị trường sinh viên/lập trình viên. |
| **Thiết kế** | Canva Pro Nâng cấp chính chủ (90 ngày) | 60.000đ – 90.000đ | 1.300.000đ/năm | Giá web 39k nâng lên 49k là điểm cân bằng hoàn hảo. |
| **Thiết kế** | CapCut Pro 1 Tháng (Acc cấp sẵn) | 60.000đ – 90.000đ/tháng | ~200.000đ/tháng | Giá web 49k nâng lên 59k vẫn thấp hơn mặt bằng chung 15-30%. |
| **Học tập** | Duolingo Super 1 Năm | 120.000đ – 299.000đ/năm | 1.200.000đ/năm | Giá web 45k – 49k là lợi thế cạnh tranh áp đảo. |

---

## 4. MÔ HÌNH TÍNH LỢI NHUẬN & CÁC KỊCH BẢN CHI PHÍ

### 4.1. Công thức phân bổ chi phí biến đổi trên từng đơn hàng
Để phản ánh chính xác **Lãi đóng góp (Contribution Margin)**, mỗi đơn hàng phải gánh các chi phí biến đổi sau:
1. **Phí thanh toán & Cổng chuyển khoản ngân hàng ($r_{pay}$):** Ước tính **1.5%** trên doanh thu (bao gồm phí duy trì cổng SePay, biến động đối soát ngân hàng).
2. **Quỹ dự phòng bảo hành & rủi ro đổi mới ($r_{risk}$):**
   - Nhóm sản phẩm Bảo hành Full (BHF) 30 ngày – 12 tháng: **5%** doanh thu.
   - Nhóm sản phẩm Không bảo hành (KBH) hoặc Link giới hạn thời gian (10P - 2H): **8%** doanh thu (do tỷ lệ khách quên kích hoạt, link hết hạn phải hỗ trợ xử lý bù).
3. **Chi phí nhân sự hỗ trợ kỹ thuật biến đổi ($C_{sup}$):** Phân bổ bình quân **2.000 VNĐ / đơn hàng** (cho thời gian trực chat, gửi email, kiểm tra serial).

$$\text{Lãi gộp} = \text{Giá bán} - \text{Giá vốn}$$
$$\text{Lãi đóng góp (CM)} = \text{Giá bán} - \text{Giá vốn} - (\text{Giá bán} \times (r_{pay} + r_{risk})) - C_{sup}$$
$$\text{Giá sàn hòa vốn (Break-even Floor)} = \frac{\text{Giá vốn} + C_{sup}}{1 - (r_{pay} + r_{risk})}$$

---

## 5. BẢNG TỔNG HỢP ĐỀ XUẤT ĐỊNH GIÁ CHI TIẾT (20 SẢN PHẨM)

*Ghi chú:* Toàn bộ tên sản phẩm giữ nguyên bản từ đại lý. Bảng này dùng để Chủ shop duyệt trước khi áp dụng.

| STT | Tên sản phẩm nguyên bản | Đại lý | Giá vốn (đ) | Giá hiện tại (đ) | Giá sàn (đ) | Giá bán đề xuất (đ) | Giá ban đầu (Giá gạch) | % Giảm | Lãi gộp (đ) | Lãi đóng góp (đ) | Biên CM (%) | Tồn kho | Khuyến nghị |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | **Youtube Premium Chính Chủ** | dino | 20.000 | 25.000 | 23.500 | **39.000** | 59.000 | -34% | 19.000 | 14.465 | 37.1% | 99 | **Tăng giá** |
| **2** | **Slot Microsoft Office 365 12 tháng BHF** | fatcat | 73.500 | 89.000 | 80.800 | **149.000** | 250.000 | -40% | 75.500 | 63.815 | 42.8% | 3 | **Tăng giá mạnh** |
| **3** | **Chat GPT Plus 1 tháng BHF** | fatcat | 155.000 | 169.000 | 167.900 | **199.000** | 290.000 | -31% | 44.000 | 29.065 | 14.6% | 10 | **Tăng giá** |
| **4** | **Chat GPT Plus Google Pay BH1D** | fatcat | 125.000 | 139.000 | 140.400 | **159.000** | 199.000 | -20% | 34.000 | 16.895 | 10.6% | 24 | **Tăng giá & Cảnh báo** |
| **5** | **Link Gemini Pro 18M (BH 30P)** | fatcat | 21.778 | 39.000 | 26.300 | **49.000** | 89.000 | -45% | 27.222 | 20.567 | 42.0% | 22 | **Sản phẩm mũi nhọn** |
| **6** | **Link Gemini 18 Tháng (BH 2H)** | fatcat | 22.442 | 39.000 | 27.000 | **49.000** | 89.000 | -45% | 26.558 | 19.903 | 40.6% | 49 | **Kho đệm / Gộp gói** |
| **7** | **Link Gemini Pro 18M** | dino | 30.750 | 49.000 | 36.200 | **59.000** | 89.000 | -34% | 28.250 | 20.645 | 35.0% | 312 | **Kho dự phòng lớn** |
| **8** | **Google AI Pro 5TB** | dino | 55.000 | 69.000 | 61.000 | **79.000** | 120.000 | -34% | 24.000 | 16.865 | 21.3% | 99 | **Tăng giá nhẹ** |
| **9** | **Slot Canva Pro 1 Tháng BHF** | fatcat | 980 | 19.000 | 3.200 | **19.000** | 30.000 | -37% | 18.020 | 14.785 | 77.8% | 24 | **Giữ giá (Phễu)** |
| **10** | **Canva Pro - Nâng cấp chính chủ** | dino | 20.000 | 39.000 | 23.500 | **49.000** | 79.000 | -38% | 29.000 | 23.815 | 48.6% | 99 | **Tăng giá** |
| **11** | **Capcut Pro 30D BHF acc cấp** | fatcat | 31.360 | 49.000 | 35.700 | **59.000** | 89.000 | -34% | 27.640 | 21.805 | 37.0% | 24 | **Tăng giá** |
| **12** | **Capcut Pro Team 1M Full Date (FW)** | dino | 46.800 | 69.000 | 52.200 | **79.000** | 110.000 | -28% | 32.200 | 25.065 | 31.7% | 61 | **Tăng giá** |
| **13** | **Link Duolingo Super 12 tháng KBH** | fatcat | 9.800 | 45.000 | 13.000 | **49.000** | 99.000 | -51% | 39.200 | 32.545 | 66.4% | 83 | **Mũi nhọn lợi nhuận** |
| **14** | **API ChatGPT CODEX - 10M Token - 1 day** | dino | 16.146 | 29.000 | 20.000 | **35.000** | 50.000 | -30% | 18.854 | 13.529 | 38.7% | 38 | **Tăng giá nhẹ** |
| **15** | **Muse AI 1B Tokens (NW)** | fatcat | 4.900 | 9.000 | 7.600 | **19.000** | 30.000 | -37% | 14.100 | 10.295 | 54.2% | 261 | **Tăng giá để bù hỗ trợ** |
| **16** | **Cursor Pro** | dino | 100.000 | 129.000 | 109.100 | **149.000** | 220.000 | -32% | 49.000 | 37.315 | 25.0% | 0 | **Tạm ẩn (Hết hàng)** |
| **17** | **Google AI Pro 5TB 12 Tháng** | dino | 150.000 | 179.000 | 167.900 | **219.000** | 350.000 | -37% | 69.000 | 46.195 | 21.1% | 0 | **Tạm ẩn (Hết hàng)** |
| **18** | **Google AI PRO 5TB ACC CẤP SẴN** | dino | 100.000 | 129.000 | 109.100 | **149.000** | 250.000 | -40% | 49.000 | 37.315 | 25.0% | 0 | **Tạm ẩn (Hết hàng)** |
| **19** | **API CLAUDE - 50M Token - 2 days** | dino | 63.180 | 89.000 | 71.200 | **99.000** | 150.000 | -34% | 35.820 | 24.415 | 24.7% | 0 | **Tạm ẩn (Hết hàng)** |
| **20** | **Slot Netflix 4K Premium** | dino | 9.900 | 29.000 | 13.100 | **35.000** | 65.000 | -46% | 25.100 | 19.775 | 56.5% | 0 | **Tạm ẩn (Hết hàng)** |

---

## 6. KỊCH BẢN DOANH THU & LỢI NHUẬN THEO QUY MÔ SẢN LƯỢNG

Giả định cơ cấu đơn hàng: 40% sản phẩm phễu (Canva, Muse AI, YouTube), 40% sản phẩm thiết yếu (Gemini 18M, Duolingo, CapCut), 20% sản phẩm giá trị cao (Office 365, ChatGPT Plus, Google 5TB).
- **Giá trị đơn hàng trung bình (AOV):** ~58.000 VNĐ.
- **Lãi đóng góp trung bình / đơn:** ~24.500 VNĐ (~42.2%).
- **Chi phí cố định phân bổ hàng tháng (Hosting Vercel, Domain, SePay, v.v.):** ~500.000 VNĐ/tháng.

| Kịch bản sản lượng | Số đơn / tháng | Doanh thu ước tính (VNĐ) | Tổng lãi đóng góp (VNĐ) | Chi phí cố định (VNĐ) | Lợi nhuận vận hành ước tính (VNĐ) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Khởi động (Thấp)** | 50 đơn (~1.7 đơn/ngày) | 2.900.000 | 1.225.000 | 500.000 | **725.000** |
| **Tăng trưởng (Vừa)** | 200 đơn (~6.7 đơn/ngày) | 11.600.000 | 4.900.000 | 500.000 | **4.400.000** |
| **Ổn định (Cao)** | 500 đơn (~16.7 đơn/ngày) | 29.000.000 | 12.250.000 | 500.000 | **11.750.000** |
| **Mở rộng (Rất cao)** | 1.000 đơn (~33 đơn/ngày) | 58.000.000 | 24.500.000 | 700.000 | **23.800.000** |

---

## 7. 4 CHIẾN THUẬT BÁN HÀNG ĐỀ XUẤT TRIỂN KHAI

### Chiến thuật 1: Sản phẩm Phễu "Lead Magnet" không lo lỗ
- **Sản phẩm áp dụng:** `Slot Canva Pro 1 Tháng BHF` (19.000đ) & `Link Duolingo Super 12 tháng KBH` (49.000đ).
- **Mục tiêu:** Kéo lượng truy cập mới, giúp khách hàng lần đầu tự tin chuyển khoản số tiền nhỏ để trải nghiệm tốc độ thanh toán tự động VietQR và nhận mã tức thì.
- **Chỉ số theo dõi:** Tỷ lệ khách hàng mua lại lần 2 (Repeat Purchase Rate) trong vòng 30 ngày (mục tiêu > 25%).

### Chiến thuật 2: Xử lý trùng lặp và phân tầng nhóm Gemini Link 18 Tháng
- **Vấn đề:** Hiện có 3 link Gemini 18M cùng bày bán gây cạnh tranh nội bộ.
- **Giải pháp:**
  - **Sản phẩm chính thức trên Web:** Đặt 1 sản phẩm duy nhất: `Link Gemini Pro 18M` giá **49.000đ** (liên kết ưu tiên nguồn FatCat ID 49 - vốn 21.778đ, lãi 27.222đ ~ 55%).
  - **Sản phẩm nguồn phụ:** Giữ FatCat ID 37 (kho 49) và Dino (kho 312) ở chế độ dự phòng. Khi kho chính hết, hệ thống tự động hoặc Admin dễ dàng chuyển sang nguồn phụ mà không làm đứt đoạn đơn hàng của khách.

### Chiến thuật 3: Minh bạch bảo hành để loại bỏ khiếu nại
- **Sản phẩm:** `Chat GPT Plus Google Pay BH1D` (159.000đ) vs `Chat GPT Plus 1 tháng BHF` (199.000đ).
- **Hành động:** Nêu rõ sự khác biệt ngay trên thẻ:
  - Bản 159k: *"Gói trải nghiệm ngắn hạn - Bảo hành kích hoạt 24 Giờ"*.
  - Bản 199k: *"Gói ổn định chính chủ - Bảo hành 1 đổi 1 suốt 30 ngày"*.
  Điều này sẽ thúc đẩy 80% người mua chuyển sang gói 199k để có sự yên tâm, đồng thời mang lại cho shop thêm `12.000đ` lãi đóng góp trên mỗi đơn.

### Chiến thuật 4: Tạm ẩn sản phẩm Tồn kho = 0
- **Sản phẩm:** 5 sản phẩm tồn kho 0 (`Cursor Pro`, `Google AI Pro 12M`, `Google AI Pro acc cấp`, `Claude 50M`, `Netflix 4K`).
- **Hành động:** Chuyển trạng thái sang `Tạm ẩn` trong Admin. Chỉ mở bán lại khi các kết nối API NCC báo số lượng khả dụng > 5.

---

## 8. ĐỀ XUẤT CẢI TIẾN TÍNH NĂNG QUẢN LÝ GIÁ TRONG ADMIN

1. **Hiển thị Giá sàn tự động (Floor Price Alert):**
   - Khi Admin nhập giá bán thấp hơn ngưỡng an toàn (ví dụ: `Giá vốn + 10.000đ`), hệ thống sẽ hiện cảnh báo viền đỏ để tránh việc định giá nhầm làm lỗ công hỗ trợ.
2. **Cảnh báo khi Nhà cung cấp tăng giá sỉ:**
   - Trong cronjob đồng bộ định kỳ (`/api/cron/sync`), nếu `sourcePrice` mới tăng vượt quá `priceCents - 5.000đ`, tự động gửi thông báo chuông (Notification) cho Admin kiểm tra cập nhật lại giá bán lẻ.
3. **Cột hiển thị % Chiết khấu trên danh sách sản phẩm Admin:**
   - Cho phép Admin nhìn nhanh mức chênh lệch giữa Giá ban đầu và Giá niêm yết của từng sản phẩm ngay trên bảng danh sách.

---

## 9. BƯỚC TIẾP THEO

- Bảng giá đề xuất đã được xuất sẵn thành tập tin CSV UTF-8 tại: [`reports/pricing-recommendations-20261102.csv`](file:///c:/Users/thuan/Downloads/WEB%20PROJECT/accgiare-clone/reports/pricing-recommendations-20261102.csv).
- **Không có bất kỳ dữ liệu giá nào trên website bị thay đổi ngầm.** Toàn bộ bảng giá hiện tại trên website vẫn đang giữ nguyên 100% để bạn kiểm tra, xem xét và phản hồi.
