import { prisma } from "@/lib/db"
import { SourcesClient } from "./SourcesClient"

export const dynamic = "force-dynamic"

export default async function AdminSourcesPage() {
  const connections = await prisma.providerConnection.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      provider: true,
      isEnabled: true,
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Danh Mục Nguồn Đại Lý
        </h1>
        <p className="text-xs text-muted-foreground">
          Khảo sát sản phẩm từ các kết nối đại lý, chọn lọc mặt hàng và bấm &ldquo;Thêm vào sản phẩm&rdquo; để tạo bản nháp kinh doanh
        </p>
      </div>

      <SourcesClient initialConnections={connections} />
    </div>
  )
}
