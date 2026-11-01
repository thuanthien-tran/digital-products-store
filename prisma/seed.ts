import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Bắt đầu tạo dữ liệu mẫu cho cửa hàng...")

  // Clear old data
  await prisma.payment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.serial.deleteMany()
  await prisma.variant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.productGroup.deleteMany()

  // 1. Tạo Danh Mục (Product Groups)
  const grpAI = await prisma.productGroup.create({
    data: {
      name: "AI",
      badgeText: "HOT",
      badgeColor: "#8b5cf6",
      sortOrder: 1,
    },
  })

  const grpDesign = await prisma.productGroup.create({
    data: {
      name: "Đồ Họa & Thiết Kế",
      badgeText: "BÁN CHẠY",
      badgeColor: "#06b6d4",
      sortOrder: 2,
    },
  })

  const grpOffice = await prisma.productGroup.create({
    data: {
      name: "Văn Phòng & Tiện Ích",
      badgeText: "BẢN QUYỀN",
      badgeColor: "#3b82f6",
      sortOrder: 3,
    },
  })

  const grpStudy = await prisma.productGroup.create({
    data: {
      name: "Học Tập & Ngôn Ngữ",
      badgeText: "GIÁ RẺ",
      badgeColor: "#10b981",
      sortOrder: 4,
    },
  })

  // 2. Tạo Sản Phẩm & Gói & Serials

  // 2.1 ChatGPT Plus
  await prisma.product.create({
    data: {
      groupId: grpAI.id,
      name: "Tài Khoản ChatGPT Plus 1 Tháng (Riêng Tư)",
      slug: "tai-khoan-chatgpt-plus-1-thang-rieng-tu",
      description: `Định dạng TK|MK|2FA, tài khoản riêng tư dùng bền cả tháng.\nĐầy đủ đặc quyền: GPT-4o, DALL-E 3 tạo ảnh và Voice Mode.\nChính sách bảo hành 1 đổi 1 trong suốt thời hạn gói.`,
      deliveryType: "serials",
      serviceInstructions: `🤖 HƯỚNG DẪN ĐĂNG NHẬP CHATGPT:\n1. Vào https://chatgpt.com chọn Đăng nhập với Email.\n2. Nhập Email và Mật khẩu được cấp.\n3. Khi hỏi mã 2FA, copy chuỗi mã 2FA dán vào trang https://2fa.live để lấy 6 số OTP.\n4. Đăng nhập thành công và đổi mật khẩu cá nhân.`,
      variants: {
        create: [
          {
            name: "Gói 1 Tháng Riêng Tư Full (BHF)",
            priceCents: 299000,
            compareAtPriceCents: 490000,
            serials: {
              create: [
                { content: "gpt_plus_vip1@gmail.com|Pass@2026|JBSWY3DPEHPK3PXP" },
                { content: "gpt_plus_vip2@gmail.com|Pass@2026|HXDMVJECJJWSRB3H" },
                { content: "gpt_plus_vip3@gmail.com|Pass@2026|MZXW6YTBOI======" },
              ],
            },
          },
          {
            name: "Gói 1 Tháng UPI Giá Rẻ",
            priceCents: 99000,
            compareAtPriceCents: 150000,
            serials: {
              create: [
                { content: "gpt_upi_acc1@gmail.com|Pass12345|JBSWY3DPEHPK3PXP" },
                { content: "gpt_upi_acc2@gmail.com|Pass12345|HXDMVJECJJWSRB3H" },
              ],
            },
          },
        ],
      },
    },
  })

  // 2.2 CapCut Pro
  await prisma.product.create({
    data: {
      groupId: grpDesign.id,
      name: "Tài Khoản CapCut Pro Bản Quyền Chính Hãng",
      slug: "tai-khoan-capcut-pro-chinh-hang",
      description: `Đăng nhập tối đa 2 thiết bị cùng lúc (điện thoại & máy tính).\nMở khóa toàn bộ template VIP, hiệu ứng AI và xóa phông video.\nXuất video độ phân giải cao 4K 60fps mượt mà không watermark.`,
      deliveryType: "serials",
      serviceInstructions: `📱 Cách đăng nhập điện thoại: Mở app CapCut -> Chọn Đăng nhập bằng Email -> Điền TK & MK.\n💻 Cách đăng nhập máy tính: Mở app CapCut PC -> Chọn Quét mã QR từ điện thoại đã đăng nhập.`,
      variants: {
        create: [
          {
            name: "Gói 30 Ngày Full Date (BHF)",
            priceCents: 50000,
            compareAtPriceCents: 120000,
            serials: {
              create: [
                { content: "capcut_pro_30d_01@gmail.com|CapcutPro@99|ID789456" },
                { content: "capcut_pro_30d_02@gmail.com|CapcutPro@99|ID789457" },
                { content: "capcut_pro_30d_03@gmail.com|CapcutPro@99|ID789458" },
              ],
            },
          },
          {
            name: "Gói 7 Ngày Trải Nghiệm",
            priceCents: 15000,
            compareAtPriceCents: 30000,
            serials: {
              create: [
                { content: "capcut_7d_test@gmail.com|Capcut7D@123|ID123456" },
              ],
            },
          },
        ],
      },
    },
  })

  // 2.3 Canva Pro
  await prisma.product.create({
    data: {
      groupId: grpDesign.id,
      name: "Slot Canva Pro 1 Tháng Nhóm Bản Quyền BHF",
      slug: "canva-pro-1-thang-bhf",
      description: `Nâng cấp trực tiếp trên email Canva chính chủ qua link nhóm.\nSử dụng không giới hạn kho 100M+ hình ảnh, video và đồ họa VIP.\nTích hợp trọn bộ công cụ Magic Studio AI và xóa nền 1 click.`,
      deliveryType: "serials",
      serviceInstructions: `1. Mở link nhận được bằng trình duyệt.\n2. Đăng nhập tài khoản Canva của bạn.\n3. Bấm 'Tham gia nhóm' (Join Team) để kích hoạt Canva Pro ngay lập tức!`,
      variants: {
        create: [
          {
            name: "Gói 1 Tháng Nhóm BHF",
            priceCents: 20000,
            compareAtPriceCents: 60000,
            serials: {
              create: [
                { content: "https://www.canva.com/brand/join?token=demo_token_canva_pro_team_1" },
                { content: "https://www.canva.com/brand/join?token=demo_token_canva_pro_team_2" },
              ],
            },
          },
        ],
      },
    },
  })

  // 2.4 Microsoft Office 365
  await prisma.product.create({
    data: {
      groupId: grpOffice.id,
      name: "Microsoft Office 365 Bản Quyền 1 Năm (Admin Family)",
      slug: "microsoft-office-365-ban-quyen-1-nam",
      description: `Tài khoản quản trị gói gia đình bản quyền thời hạn 1 năm.\nMời tối đa 5 tài khoản phụ riêng biệt, độc lập dữ liệu.\nMỗi tài khoản nhận 1TB lưu trữ OneDrive và trọn bộ ứng dụng Office.`,
      deliveryType: "serials",
      serviceInstructions: `Đăng nhập tại https://portal.office.com bằng TK|MK được cấp. Truy cập phần Gia đình để gửi link mời các tài khoản phụ.`,
      variants: {
        create: [
          {
            name: "Gói 1 Năm Admin Full Quyền",
            priceCents: 400000,
            compareAtPriceCents: 650000,
            serials: {
              create: [
                { content: "admin_ms365_01@onmicrosoft.com|Office365@Pass|recover_mail@domain.com" },
              ],
            },
          },
        ],
      },
    },
  })

  // 2.5 Duolingo Super
  await prisma.product.create({
    data: {
      groupId: grpStudy.id,
      name: "Link Duolingo Super 12 Tháng KBH",
      slug: "link-duolingo-super-12-thang",
      description: `Link kích hoạt chính thức Super Duolingo bản quyền 12 tháng.\nHọc không giới hạn trái tim, không bị gián đoạn bởi quảng cáo.\nMở khóa toàn bộ bài kiểm tra vượt cấp và luyện phát âm nâng cao.`,
      deliveryType: "serials",
      serviceInstructions: `1. Bật VPN Ấn Độ (Urban VPN hoặc Touch VPN).\n2. Đăng nhập Duolingo trên trình duyệt web.\n3. Mở link nhận được và bấm Xác nhận kích hoạt.\n4. Sau khi xong có thể tắt VPN dùng bình thường!`,
      variants: {
        create: [
          {
            name: "Gói 12 Tháng Link Redeem",
            priceCents: 50000,
            compareAtPriceCents: 180000,
            serials: {
              create: [
                { content: "https://www.duolingo.com/redeem?code=SUPER-DUO-VN2026-A1" },
                { content: "https://www.duolingo.com/redeem?code=SUPER-DUO-VN2026-B2" },
                { content: "https://www.duolingo.com/redeem?code=SUPER-DUO-VN2026-C3" },
              ],
            },
          },
        ],
      },
    },
  })

  console.log("✅ Đã tạo xong dữ liệu mẫu thành công!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
