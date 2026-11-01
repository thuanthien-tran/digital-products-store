import { prisma } from './db'
import { fetchFatcatCatalog, ValidatedFatcatProduct } from './fatcat-adapter'
import crypto from 'crypto'

export interface SyncServiceResult {
  success: boolean
  syncLogId?: string
  newCount: number
  updatedCount: number
  discontinuedCount: number
  totalSourceProducts: number
  error?: string
  warning?: string
  timestamp: string
}

// In-process lock to prevent overlapping sync operations
let isSyncRunning = false

function computeContentHash(p: ValidatedFatcatProduct): string {
  const content = `${p.name}|${p.price_vnd}|${p.regular_price_vnd ?? ''}|${p.description}|${p.stock}`
  return crypto.createHash('sha256').update(content).digest('hex')
}

export async function runFatcatCatalogSync(options?: {
  customProducts?: ValidatedFatcatProduct[] // For testing / mock injection
  actorUsername?: string
}): Promise<SyncServiceResult> {
  if (isSyncRunning) {
    return {
      success: false,
      newCount: 0,
      updatedCount: 0,
      discontinuedCount: 0,
      totalSourceProducts: 0,
      error: 'Tiến trình đồng bộ đang được thực thi. Vui lòng không gửi nhiều yêu cầu đồng thời.',
      timestamp: new Date().toISOString(),
    }
  }

  isSyncRunning = true
  const startedAt = new Date()

  // 1. Create SyncLog record (status: running)
  const syncLog = await prisma.syncLog.create({
    data: {
      provider: 'fatcat',
      startedAt,
      status: 'running',
    },
  })

  try {
    let sourceProducts: ValidatedFatcatProduct[] = []

    if (options?.customProducts) {
      sourceProducts = options.customProducts
    } else {
      const fetchResult = await fetchFatcatCatalog()
      if (!fetchResult.success || !fetchResult.products) {
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            finishedAt: new Date(),
            status: 'failed',
            error: fetchResult.error || 'Lỗi không xác định khi kết nối API',
          },
        })

        // Also create an admin notification about the sync failure
        await prisma.adminNotification.create({
          data: {
            type: 'sync_error',
            title: 'Lỗi đồng bộ danh mục FatCat',
            message: fetchResult.error || 'Không thể lấy dữ liệu sản phẩm từ đại lý.',
            metadata: JSON.stringify({ statusCode: fetchResult.statusCode, isNetwork: fetchResult.isNetworkOrTimeout }),
            link: '/admin/fatcat',
          },
        })

        return {
          success: false,
          syncLogId: syncLog.id,
          newCount: 0,
          updatedCount: 0,
          discontinuedCount: 0,
          totalSourceProducts: 0,
          error: fetchResult.error,
          timestamp: new Date().toISOString(),
        }
      }
      sourceProducts = fetchResult.products
    }

    // Safety Check: Anomalous empty or drastic drop in catalog
    const previousTotal = await prisma.sourceProduct.count({
      where: { provider: 'fatcat', sourceStatus: { not: 'unavailable' } },
    })

    let warningMessage: string | undefined
    if (sourceProducts.length === 0 && previousTotal > 0) {
      warningMessage = `Cảnh báo an toàn: API trả về 0 sản phẩm trong khi hệ thống đang có ${previousTotal} sản phẩm. Không đánh dấu ngừng cung cấp hàng loạt.`
      await prisma.adminNotification.create({
        data: {
          type: 'sync_error',
          title: 'Cảnh báo đồng bộ: Danh mục API rỗng bất thường',
          message: warningMessage,
          link: '/admin/fatcat',
        },
      })
    }

    let newCount = 0
    let updatedCount = 0
    let discontinuedCount = 0
    const now = new Date()
    const seenExternalIds = new Set<number>()

    for (const fp of sourceProducts) {
      seenExternalIds.add(fp.id)
      const contentHash = computeContentHash(fp)
      const sourceStatus = fp.stock > 0 ? 'available' : 'out_of_stock'

      const existing = await prisma.sourceProduct.findFirst({
        where: {
          provider: 'fatcat',
          externalId: String(fp.id),
        },
        include: {
          product: {
            include: { variants: true },
          },
        },
      })

      if (!existing) {
        // --- SẢN PHẨM MỚI ---
        // Sản phẩm mới vào trạng thái 'new', KHÔNG tự xuất hiện trên storefront
        // Tính giá bán lẻ đề xuất trong draft (Lợi nhuận ~35%, làm tròn số đẹp)
        const wholesale = fp.price_vnd
        const markupRatio = wholesale < 20000 ? 1.5 : wholesale < 100000 ? 1.35 : 1.25
        const suggestedRetail = Math.round((wholesale * markupRatio) / 1000) * 1000

        await prisma.sourceProduct.create({
          data: {
            provider: 'fatcat',
            externalId: String(fp.id),
            sourceName: fp.name,
            sourceDescription: fp.description,
            sourcePrice: fp.price_vnd,
            sourceRegularPrice: fp.regular_price_vnd,
            saleQty: fp.sale_qty,
            sourceStock: fp.stock,
            maxQuantity: fp.max_quantity,
            sourceStatus,
            contentHash,
            firstDetectedAt: now,
            lastSeenAt: now,
            lastSyncedAt: now,
            editorialStatus: 'new',
            hasChangeAlert: false,
            customName: fp.name,
            customDescription: fp.description,
            customPrice: suggestedRetail,
          },
        })

        newCount++

        // Tạo thông báo Admin
        await prisma.adminNotification.create({
          data: {
            type: 'new_product',
            title: `Sản phẩm mới từ đại lý: #${fp.id} ${fp.name}`,
            message: `Đại lý vừa cập nhật sản phẩm "${fp.name}" với giá sỉ ${fp.price_vnd.toLocaleString('vi-VN')} đ (Tồn kho: ${fp.stock}). Vui lòng duyệt và đăng bán trong Admin.`,
            metadata: JSON.stringify({ externalId: fp.id, price: fp.price_vnd, stock: fp.stock }),
            link: `/admin/fatcat?tab=new&id=${fp.id}`,
          },
        })
      } else {
        // --- SẢN PHẨM ĐÃ CÓ TRƯỚC ĐÓ ---
        // Không ghi đè tên, mô tả, giá bán admin đã chỉnh!
        // Kiểm tra thay đổi quan trọng:
        let hasChange = false
        const alerts: string[] = []

        // 1. Kiểm tra thay đổi giá nhập
        if (existing.sourcePrice !== fp.price_vnd) {
          hasChange = true
          alerts.push(`Giá sỉ đổi từ ${existing.sourcePrice.toLocaleString('vi-VN')} đ sang ${fp.price_vnd.toLocaleString('vi-VN')} đ`)

          await prisma.adminNotification.create({
            data: {
              type: 'price_change',
              title: `Đổi giá sỉ: #${fp.id} ${existing.customName || existing.sourceName}`,
              message: `Đại lý đã thay đổi giá sỉ từ ${existing.sourcePrice.toLocaleString('vi-VN')} đ thành ${fp.price_vnd.toLocaleString('vi-VN')} đ. Giá bán của bạn vẫn giữ nguyên (${(existing.customPrice || 0).toLocaleString('vi-VN')} đ).`,
              metadata: JSON.stringify({
                externalId: fp.id,
                oldPrice: existing.sourcePrice,
                newPrice: fp.price_vnd,
                retailPrice: existing.customPrice,
              }),
              link: `/admin/fatcat?tab=review&id=${existing.id}`,
            },
          })
        }

        // 2. Kiểm tra thay đổi mô tả/điều kiện nguồn
        if (existing.sourceDescription !== fp.description && fp.description.length > 0) {
          hasChange = true
          alerts.push('Mô tả/điều kiện nguồn thay đổi')

          await prisma.adminNotification.create({
            data: {
              type: 'desc_change',
              title: `Đổi mô tả nguồn: #${fp.id} ${existing.customName || existing.sourceName}`,
              message: `Đại lý đã cập nhật lại mô tả nguồn của sản phẩm #${fp.id}. Mô tả bán hàng trên website của bạn không bị ghi đè.`,
              metadata: JSON.stringify({
                externalId: fp.id,
                oldDesc: existing.sourceDescription,
                newDesc: fp.description,
              }),
              link: `/admin/fatcat?tab=review&id=${existing.id}`,
            },
          })
        }

        // 3. Kiểm tra trạng thái tồn kho (Hết hàng / Có hàng lại)
        if (existing.sourceStock === 0 && fp.stock > 0) {
          alerts.push(`Có hàng lại (Kho: ${fp.stock})`)
          await prisma.adminNotification.create({
            data: {
              type: 'stock_status',
              title: `Có hàng lại: #${fp.id} ${existing.customName || existing.sourceName}`,
              message: `Đại lý đã nạp thêm hàng vào kho (Số lượng hiện có: ${fp.stock}).`,
              metadata: JSON.stringify({ externalId: fp.id, stock: fp.stock }),
              link: `/admin/fatcat?id=${existing.id}`,
            },
          })
        } else if (existing.sourceStock > 0 && fp.stock === 0) {
          alerts.push('Tạm hết hàng tại đại lý')
          await prisma.adminNotification.create({
            data: {
              type: 'stock_status',
              title: `Tạm hết hàng: #${fp.id} ${existing.customName || existing.sourceName}`,
              message: `Sản phẩm #${fp.id} tại kho đại lý hiện đã hết hàng (Tồn: 0).`,
              metadata: JSON.stringify({ externalId: fp.id, stock: 0 }),
              link: `/admin/fatcat?id=${existing.id}`,
            },
          })
        }

        // Cập nhật dữ liệu nguồn cho SourceProduct
        // Lưu ý: Sản phẩm ignored vẫn giữ nguyên ignored
        await prisma.sourceProduct.update({
          where: { id: existing.id },
          data: {
            sourceName: fp.name,
            sourceDescription: fp.description,
            sourcePrice: fp.price_vnd,
            sourceRegularPrice: fp.regular_price_vnd,
            saleQty: fp.sale_qty,
            sourceStock: fp.stock,
            maxQuantity: fp.max_quantity,
            sourceStatus,
            contentHash,
            lastSeenAt: now,
            lastSyncedAt: now,
            hasChangeAlert: existing.hasChangeAlert || hasChange,
            changeAlertDetails: hasChange ? JSON.stringify(alerts) : existing.changeAlertDetails,
          },
        })

        // Nếu sản phẩm này ĐANG BÁN (published) và có Product / Variant liên kết:
        // Cập nhật tồn kho thực tế của Variant và trạng thái tự động của Product
        // NHƯNG KHÔNG BAO GIỜ GHI ĐÈ GIÁ BÁN HAY NỘI DUNG ADMIN ĐÃ ĐẶT!
        if (existing.editorialStatus === 'published' && existing.product) {
          const linkedVariant = existing.product.variants.find((v) => v.id === existing.variantId) || existing.product.variants[0]
          if (linkedVariant) {
            await prisma.variant.update({
              where: { id: linkedVariant.id },
              data: {
                providerStock: fp.stock,
                providerPrice: fp.price_vnd,
              },
            })
          }

          await prisma.product.update({
            where: { id: existing.product.id },
            data: {
              statusOverride: fp.stock === 0 ? 'out_of_stock' : 'auto',
            },
          })
        }

        updatedCount++
      }
    }

    // --- KIỂM TRA SẢN PHẨM NGỪNG CUNG CẤP (DISCONTINUED) ---
    // Chỉ thực hiện khi nhận được danh mục đầy đủ hợp lệ và không có cảnh báo drop bất thường
    if (!warningMessage && sourceProducts.length > 0) {
      const missingProducts = await prisma.sourceProduct.findMany({
        where: {
          provider: 'fatcat',
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
            changeAlertDetails: JSON.stringify(['Sản phẩm đã bị gỡ khỏi danh mục của đại lý (Ngừng cung cấp)']),
          },
        })

        // Nếu đang bán, khóa mua để an toàn
        if (missing.product) {
          await prisma.product.update({
            where: { id: missing.product.id },
            data: {
              statusOverride: 'out_of_stock',
            },
          })
        }

        await prisma.adminNotification.create({
          data: {
            type: 'discontinued',
            title: `Ngừng cung cấp: #${missing.externalId} ${missing.customName || missing.sourceName}`,
            message: `Sản phẩm #${missing.externalId} không còn xuất hiện trong phản hồi API của đại lý. Hệ thống đã đánh dấu ngừng cung cấp và khóa mua tự động.`,
            metadata: JSON.stringify({ externalId: missing.externalId }),
            link: `/admin/fatcat?tab=review&id=${missing.id}`,
          },
        })
      }
    }

    const totalInDb = await prisma.sourceProduct.count({ where: { provider: 'fatcat' } })

    // Hoàn tất SyncLog
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

    return {
      success: true,
      syncLogId: syncLog.id,
      newCount,
      updatedCount,
      discontinuedCount,
      totalSourceProducts: totalInDb,
      warning: warningMessage,
      timestamp: new Date().toISOString(),
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Lỗi hệ thống đồng bộ'

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        status: 'failed',
        error: errorMsg,
      },
    })

    return {
      success: false,
      syncLogId: syncLog.id,
      newCount: 0,
      updatedCount: 0,
      discontinuedCount: 0,
      totalSourceProducts: 0,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }
  } finally {
    isSyncRunning = false
  }
}
