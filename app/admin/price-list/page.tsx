import { Metadata } from "next"
import { PriceListClient } from "./PriceListClient"

export const metadata: Metadata = {
  title: "Bảng giá & Xuất Menu | Quản trị viên",
  description: "Tạo menu bảng giá tùy biến, xuất ảnh PNG chất lượng cao gửi khách hàng hoặc copy text",
}

export default function PriceListPage() {
  return <PriceListClient />
}
