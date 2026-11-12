import { Metadata } from "next"
import { cookies } from "next/headers"
import { verifyCtvToken, verifyAdminToken } from "@/lib/auth"
import { getKtvPriceListData, KtvPriceListPayload } from "@/lib/ktv"
import { KtvPriceListClient } from "./KtvPriceListClient"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Bảng Giá Trực Tiếp — KTV",
  description: "Bảng giá và tình trạng tồn kho sản phẩm trực tiếp theo thời gian thực dành cho KTV & Đại lý",
}

export default async function KtvPage() {
  const cookieStore = await cookies()
  const ctvToken = cookieStore.get("ctv_token")?.value
  const adminToken = cookieStore.get("admin_token")?.value

  let isAuth = false
  if (ctvToken && (await verifyCtvToken(ctvToken))) {
    isAuth = true
  } else if (adminToken && (await verifyAdminToken(adminToken))) {
    isAuth = true
  }

  let initialData: KtvPriceListPayload | null = null
  if (isAuth) {
    try {
      initialData = await getKtvPriceListData()
    } catch {
      initialData = null
    }
  }

  return <KtvPriceListClient initialAuth={isAuth} initialData={initialData} />
}
