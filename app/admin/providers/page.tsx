import { prisma } from "@/lib/db"
import { ProvidersClient } from "./ProvidersClient"

export const dynamic = "force-dynamic"

export default async function AdminProvidersPage() {
  const connections = await prisma.providerConnection.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          sourceProducts: true,
          variants: true,
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Quản Lý Đại Lý &amp; Kết Nối API
        </h1>
        <p className="text-xs text-muted-foreground">
          Cấu hình nhiều tài khoản đại lý độc lập, kiểm tra hạn mức số dư và kích hoạt đồng bộ danh mục nguồn
        </p>
      </div>

      <ProvidersClient
        initialConnections={connections.map((c) => ({
          id: c.id,
          name: c.name,
          provider: c.provider,
          baseUrl: c.baseUrl,
          apiKeyMasked: c.apiKeyMasked,
          isEnabled: c.isEnabled,
          balanceVnd: c.balanceVnd ?? 0,
          balanceUsdt: c.balanceUsdt ?? 0,
          lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
          lastSyncStatus: c.lastSyncStatus,
          lastSyncError: c.lastSyncError,
          sourceCount: c._count.sourceProducts,
          variantCount: c._count.variants,
        }))}
      />
    </div>
  )
}
