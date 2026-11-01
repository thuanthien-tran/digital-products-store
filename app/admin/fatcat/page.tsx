import { prisma } from "@/lib/db"
import { getFatcatBalance } from "@/lib/fatcat"
import { FatCatClient } from "./FatCatClient"

export const dynamic = "force-dynamic"

export default async function AdminFatCatPage() {
  const [groups, balanceResult] = await Promise.all([
    prisma.productGroup.findMany({
      where: { visibility: "public" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    getFatcatBalance().catch(() => null),
  ])

  const balance = balanceResult?.success ? balanceResult.data : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Quản Lý Sản Phẩm Nguồn Đại Lý FatCat
        </h1>
        <p className="text-xs text-muted-foreground">
          Kiểm duyệt sản phẩm mới, đối soát giá sỉ, chỉnh sửa giá bán và chủ động duyệt đăng bán lên cửa hàng
        </p>
      </div>

      <FatCatClient
        groups={groups}
        initialBalance={balance}
      />
    </div>
  )
}
