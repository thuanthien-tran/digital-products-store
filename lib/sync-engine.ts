import { prisma, ensureDatabaseSchema } from './db'
import { decryptSecret } from './crypto'
import { getProviderAdapter, SourceProductDTO } from './providers/registry'
import { recordSourceStockUpdate, touchGlobalInventoryTimestamp } from './inventory-pipeline'
import crypto from 'crypto'

export interface SyncEngineResult {
  success: boolean
  syncLogId?: string
  connectionId: string
  connectionName: string
  newCount: number
  updatedCount: number
  discontinuedCount: number
  totalSourceProducts: number
  warning?: string
  error?: string
  timestamp: string
}

// Global active sync lock set (keyed by connectionId)
const activeSyncLocks = new Set<string>()

function computeContentHash(p: SourceProductDTO): string {
  const content = `${p.sourceName}|${p.sourcePrice}|${p.sourceRegularPrice ?? ''}|${p.sourceDescription}|${p.sourceStock}`
  return crypto.createHash('sha256').update(content).digest('hex')
}

// Alias for convenience
export async function syncProviderCatalog(
  connectionId: string,
  options?: {
    customProducts?: SourceProductDTO[]
    actorUsername?: string
  }
): Promise<SyncEngineResult> {
  return syncProviderConnection(connectionId, options)
}

export async function syncProviderConnection(
  connectionId: string,
  options?: {
    customProducts?: SourceProductDTO[] // For test injection
    actorUsername?: string
  }
): Promise<SyncEngineResult> {
  await ensureDatabaseSchema()

  const connection = await prisma.providerConnection.findUnique({
    where: { id: connectionId },
  })

  if (!connection) {
    return {
      success: false,
      connectionId,
      connectionName: 'Unknown',
      newCount: 0,
      updatedCount: 0,
      discontinuedCount: 0,
      totalSourceProducts: 0,
      error: `Không tìm thấy kết nối đại lý với ID: ${connectionId}`,
      timestamp: new Date().toISOString(),
    }
  }

  if (!connection.isEnabled) {
    return {
      success: false,
      connectionId,
      connectionName: connection.name,
      newCount: 0,
      updatedCount: 0,
      discontinuedCount: 0,
      totalSourceProducts: 0,
      error: `Kết nối "${connection.name}" hiện đang bị tắt. Vui lòng bật kết nối trước khi đồng bộ.`,
      timestamp: new Date().toISOString(),
    }
  }

  if (activeSyncLocks.has(connectionId)) {
    return {
      success: false,
      connectionId,
      connectionName: connection.name,
      newCount: 0,
      updatedCount: 0,
      discontinuedCount: 0,
      totalSourceProducts: 0,
      error: `Tiến trình đồng bộ cho kết nối "${connection.name}" đang được thực hiện. Vui lòng chờ trong giây lát.`,
      timestamp: new Date().toISOString(),
    }
  }

  activeSyncLocks.add(connectionId)
  const startedAt = new Date()

  const syncLog = await prisma.syncLog.create({
    data: {
      connectionId,
      provider: connection.provider,
      startedAt,
      status: 'running',
    },
  })

  try {
    let sourceProducts: SourceProductDTO[] = []

    if (options?.customProducts) {
      sourceProducts = options.customProducts
    } else {
      let rawApiKey = ''
      try {
        rawApiKey = decryptSecret(connection.apiKeyEncrypted)
      } catch {
        throw new Error(`Không thể giải mã khóa bí mật của kết nối "${connection.name}"`)
      }

      const adapter = getProviderAdapter(connection.provider)
      const fetchRes = await adapter.fetchCatalog({
        baseUrl: connection.baseUrl,
        apiKey: rawApiKey,
        provider: connection.provider,
      })

      if (!fetchRes.ok || !fetchRes.products) {
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            finishedAt: new Date(),
            status: 'failed',
            error: fetchRes.error || 'Lỗi không xác định khi lấy danh mục',
          },
        })

        await prisma.providerConnection.update({
          where: { id: connectionId },
          data: {
            lastSyncedAt: new Date(),
            lastSyncStatus: 'failed',
            lastSyncError: fetchRes.error || 'Lỗi lấy danh mục',
          },
        })

        await prisma.adminNotification.create({
          data: {
            connectionId,
            type: 'sync_error',
            title: `Lỗi đồng bộ: ${connection.name}`,
            message: fetchRes.error || 'Không thể lấy dữ liệu sản phẩm từ đại lý.',
            link: '/admin/providers',
          },
        })

        return {
          success: false,
          syncLogId: syncLog.id,
          connectionId,
          connectionName: connection.name,
          newCount: 0,
          updatedCount: 0,
          discontinuedCount: 0,
          totalSourceProducts: 0,
          error: fetchRes.error,
          timestamp: new Date().toISOString(),
        }
      }

      sourceProducts = fetchRes.products

      // Probe balance if supported
      try {
        const bal = await adapter.testConnection({
          baseUrl: connection.baseUrl,
          apiKey: rawApiKey,
          provider: connection.provider,
        })
        if (bal.ok && bal.balanceVnd !== undefined) {
          await prisma.providerConnection.update({
            where: { id: connectionId },
            data: {
              balanceVnd: bal.balanceVnd,
              balanceUsdt: bal.balanceUsdt,
            },
          })
        }
      } catch {
        // Balance probe optional
      }
    }

    // Safety check: Anomalous empty response when previous count > 0
    const previousTotal = await prisma.sourceProduct.count({
      where: { connectionId, sourceStatus: { not: 'unavailable' } },
    })

    let warningMessage: string | undefined
    if (sourceProducts.length === 0 && previousTotal > 0) {
      warningMessage = `Cảnh báo an toàn: API trả về 0 sản phẩm trong khi kết nối đang có ${previousTotal} sản phẩm. Không đánh dấu ngừng bán hàng loạt.`
      await prisma.adminNotification.create({
        data: {
          connectionId,
          type: 'sync_error',
          title: `Cảnh báo danh mục rỗng: ${connection.name}`,
          message: warningMessage,
          link: '/admin/sources',
        },
      })
    }

    let newCount = 0
    let updatedCount = 0
    let discontinuedCount = 0
    const now = new Date()

    for (const fp of sourceProducts) {
      const contentHash = computeContentHash(fp)
      const sourceStatus = fp.sourceStock > 0 ? 'available' : 'out_of_stock'

      const existing = await prisma.sourceProduct.findUnique({
        where: {
          connectionId_externalId: {
            connectionId,
            externalId: fp.externalId,
          },
        },
        include: {
          product: {
            include: { variants: true },
          },
        },
      })

      if (!existing) {
        // New source product discovered
        await prisma.sourceProduct.create({
          data: {
            connectionId,
            provider: connection.provider,
            externalId: fp.externalId,
            sourceName: fp.sourceName,
            sourceDescription: fp.sourceDescription,
            sourcePrice: fp.sourcePrice,
            sourceRegularPrice: fp.sourceRegularPrice,
            saleQty: fp.saleQty,
            sourceStock: fp.sourceStock,
            maxQuantity: fp.maxQuantity,
            sourceStatus,
            contentHash,
            firstDetectedAt: now,
            lastSeenAt: now,
            lastSyncedAt: now,
            editorialStatus: 'new',
            isAddedToStore: false,
            customName: fp.sourceName,
            customDescription: fp.sourceDescription,
          },
        })

        newCount++

        await prisma.adminNotification.create({
          data: {
            connectionId,
            type: 'new_product',
            title: `Sản phẩm mới (${connection.name}): #${fp.externalId} ${fp.sourceName}`,
            message: `Kết nối "${connection.name}" vừa phát hiện sản phẩm #${fp.externalId} giá sỉ ${fp.sourcePrice.toLocaleString('vi-VN')} đ (Tồn: ${fp.sourceStock}). Bạn có thể chọn "Thêm vào sản phẩm" trong Danh mục nguồn.`,
            link: `/admin/sources?connectionId=${connectionId}`,
          },
        })
      } else {
        // Existing source product update
        let hasChange = false
        const alerts: string[] = []

        // 1. Price change check
        if (existing.sourcePrice !== fp.sourcePrice) {
          hasChange = true
          alerts.push(`Giá sỉ đổi từ ${existing.sourcePrice.toLocaleString('vi-VN')} đ sang ${fp.sourcePrice.toLocaleString('vi-VN')} đ`)

          await prisma.adminNotification.create({
            data: {
              connectionId,
              type: 'price_change',
              title: `Đổi giá sỉ (${connection.name}): #${fp.externalId} ${existing.customName || existing.sourceName}`,
              message: `Đại lý thay đổi giá sỉ từ ${existing.sourcePrice.toLocaleString('vi-VN')} đ thành ${fp.sourcePrice.toLocaleString('vi-VN')} đ. Giá bán đã duyệt của bạn vẫn giữ nguyên an toàn.`,
              link: `/admin/sources?connectionId=${connectionId}`,
            },
          })
        }

        // 2. Description change check
        if (existing.sourceDescription !== fp.sourceDescription && fp.sourceDescription.length > 0) {
          hasChange = true
          alerts.push('Mô tả nguồn thay đổi')

          await prisma.adminNotification.create({
            data: {
              connectionId,
              type: 'desc_change',
              title: `Đổi mô tả nguồn (${connection.name}): #${fp.externalId} ${existing.customName || existing.sourceName}`,
              message: `Mô tả từ đại lý đã cập nhật mới. Nội dung bạn đã biên tập không bị ghi đè.`,
              link: `/admin/sources?connectionId=${connectionId}`,
            },
          })
        }

        // Update SourceProduct record
        await prisma.sourceProduct.update({
          where: { id: existing.id },
          data: {
            sourceName: fp.sourceName,
            sourceDescription: fp.sourceDescription,
            sourcePrice: fp.sourcePrice,
            sourceRegularPrice: fp.sourceRegularPrice,
            saleQty: fp.saleQty,
            sourceStock: fp.sourceStock,
            maxQuantity: fp.maxQuantity,
            sourceStatus,
            contentHash,
            lastSeenAt: now,
            lastSyncedAt: now,
            hasChangeAlert: existing.hasChangeAlert || hasChange,
            changeAlertDetails: hasChange ? JSON.stringify(alerts) : existing.changeAlertDetails,
          },
        })

        // Route stock update through unified pipeline to protect retail prices and re-evaluate product status
        await recordSourceStockUpdate({
          connectionId,
          externalId: fp.externalId,
          sourceStock: fp.sourceStock,
          wholesalePrice: fp.sourcePrice,
          sourceStatus,
          reason: 'sync',
          verifiedAt: now,
          allowNotification: false,
        })

        updatedCount++
      }
    }

    // Check discontinued items
    if (!warningMessage && sourceProducts.length > 0) {
      const missingProducts = await prisma.sourceProduct.findMany({
        where: {
          connectionId,
          sourceStatus: { not: 'unavailable' },
          lastSeenAt: { lt: startedAt },
        },
        include: { product: true },
      })

      for (const missing of missingProducts) {
        discontinuedCount++
        await prisma.sourceProduct.update({
          where: { id: missing.id },
          data: {
            sourceStatus: 'unavailable',
            hasChangeAlert: true,
            changeAlertDetails: JSON.stringify(['Sản phẩm đã bị gỡ khỏi danh mục đại lý']),
          },
        })

        if (missing.product && missing.product.editorialStatus === 'published') {
          await prisma.product.update({
            where: { id: missing.product.id },
            data: { statusOverride: 'out_of_stock' },
          })
        }

        await prisma.adminNotification.create({
          data: {
            connectionId,
            type: 'discontinued',
            title: `Ngừng cung cấp (${connection.name}): #${missing.externalId} ${missing.customName || missing.sourceName}`,
            message: `Sản phẩm #${missing.externalId} không còn xuất hiện trong danh mục đại lý. Hệ thống đã khóa mua tự động.`,
            link: `/admin/sources?connectionId=${connectionId}`,
          },
        })
      }
    }

    const totalInDb = await prisma.sourceProduct.count({ where: { connectionId } })

    // Finish SyncLog
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        status: warningMessage ? 'warning' : 'success',
        newCount,
        updatedCount,
        discontinuedCount,
        totalSourceProducts: totalInDb,
        error: warningMessage,
      },
    })

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: warningMessage ? 'warning' : 'success',
        lastSyncError: warningMessage || null,
      },
    })

    touchGlobalInventoryTimestamp()

    return {
      success: true,
      syncLogId: syncLog.id,
      connectionId,
      connectionName: connection.name,
      newCount,
      updatedCount,
      discontinuedCount,
      totalSourceProducts: totalInDb,
      warning: warningMessage,
      timestamp: new Date().toISOString(),
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Lỗi đồng bộ'

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        status: 'failed',
        error: errorMsg,
      },
    })

    await prisma.providerConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: 'failed',
        lastSyncError: errorMsg,
      },
    })

    return {
      success: false,
      syncLogId: syncLog.id,
      connectionId,
      connectionName: connection.name,
      newCount: 0,
      updatedCount: 0,
      discontinuedCount: 0,
      totalSourceProducts: 0,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }
  } finally {
    activeSyncLocks.delete(connectionId)
  }
}
