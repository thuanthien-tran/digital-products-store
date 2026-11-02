import { prisma } from "./db"
import { decryptSecret } from "./crypto"
import { getProviderAdapter } from "./providers/registry"
import { recordSourceStockUpdate } from "./inventory-pipeline"

export interface LiveVerificationResult {
  ok: boolean
  stock: number
  price?: number
  isAvailable: boolean
  isDiscontinued?: boolean
  isNetworkOrTimeout?: boolean
  error?: string
  verifiedAt: Date
}

// In-flight request coalescing cache to prevent duplicate concurrent API calls
// to the same provider for the same product. Key: `${connectionId}:${externalId}`
const inFlightVerifications = new Map<string, Promise<LiveVerificationResult>>()

/**
 * Live pre-checkout / on-demand verification of a provider-backed variant.
 * 
 * INVARIANTS:
 * 1. Coalesces concurrent verification requests for the same source product.
 * 2. If provider confirms stock = 0 or missing, triggers reverse-sync IMMEDIATELY to DB.
 * 3. If provider encounters a timeout or 5xx/network error, DOES NOT record stock = 0.
 * 4. Never reveals secrets or technical API internals to callers.
 */
export async function verifyVariantLiveStock(
  variantId: string
): Promise<LiveVerificationResult> {
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    include: {
      connection: true,
      sourceProduct: true,
      product: true,
      _count: {
        select: { serials: { where: { status: "available" } } },
      },
    },
  })

  const verifiedAt = new Date()

  if (!variant) {
    return {
      ok: false,
      stock: 0,
      isAvailable: false,
      error: "Gói sản phẩm không tồn tại",
      verifiedAt,
    }
  }

  // If variant is purely local serials (no provider attached)
  const isProviderBacked = Boolean(
    variant.connectionId ||
    variant.provider ||
    variant.product.deliveryType === "fatcat" ||
    variant.product.deliveryType === "dino"
  )

  if (!isProviderBacked || !variant.connection || !variant.sourceProduct) {
    const totalStock = (variant.providerStock ?? 0) + variant._count.serials
    return {
      ok: true,
      stock: totalStock,
      isAvailable: totalStock > 0,
      verifiedAt,
    }
  }

  const connection = variant.connection
  const sourceProduct = variant.sourceProduct

  if (!connection.isEnabled) {
    const totalStock = (variant.providerStock ?? 0) + variant._count.serials
    return {
      ok: true,
      stock: totalStock,
      isAvailable: totalStock > 0,
      verifiedAt,
    }
  }

  const coalescingKey = `${connection.id}:${sourceProduct.externalId}`

  // Check if an identical verification is already in-flight
  const existingPromise = inFlightVerifications.get(coalescingKey)
  if (existingPromise) {
    return existingPromise
  }

  const verificationPromise = (async (): Promise<LiveVerificationResult> => {
    try {
      let rawApiKey = ""
      try {
        rawApiKey = decryptSecret(connection.apiKeyEncrypted)
      } catch {
        console.warn(`[Stock Verifier] Không thể giải mã API key của kết nối "${connection.name}". Sử dụng tồn kho DB fallback.`)
        const totalStock = (variant.providerStock ?? 0) + variant._count.serials
        return {
          ok: true,
          stock: totalStock,
          isAvailable: totalStock > 0,
          verifiedAt,
        }
      }

      const adapter = getProviderAdapter(connection.provider)

      // Fetch live catalog from adapter
      const catalogRes = await adapter.fetchCatalog({
        baseUrl: connection.baseUrl,
        apiKey: rawApiKey,
        provider: connection.provider,
        timeoutMs: 10000, // Generous 10s timeout for cross-region network latency
      })

      if (!catalogRes.ok || !catalogRes.products) {
        const cachedStock = (variant.providerStock ?? 0) + variant._count.serials
        if (cachedStock > 0) {
          console.warn(`[Stock Verifier] Đại lý tạm thời timeout/lỗi. Sử dụng tồn kho DB fallback (${cachedStock}) cho "${variant.name}".`)
          return {
            ok: true,
            stock: cachedStock,
            isAvailable: true,
            price: variant.providerPrice ?? undefined,
            verifiedAt,
          }
        }
        return {
          ok: false,
          stock: cachedStock,
          isAvailable: false,
          isNetworkOrTimeout: catalogRes.isNetworkOrTimeout || false,
          error: catalogRes.error || "Không thể xác minh nguồn hàng từ đại lý",
          verifiedAt,
        }
      }

      const matched = catalogRes.products.find(
        (p) => String(p.externalId) === String(sourceProduct.externalId)
      )

      if (!matched) {
        // Product missing from provider catalog -> mark unavailable immediately
        await recordSourceStockUpdate({
          connectionId: connection.id,
          externalId: sourceProduct.externalId,
          sourceStock: 0,
          sourceStatus: "unavailable",
          reason: "pre_checkout_check",
          verifiedAt,
        })

        const totalStock = variant._count.serials
        return {
          ok: true,
          stock: totalStock,
          isAvailable: totalStock > 0,
          isDiscontinued: true,
          error: "Sản phẩm không còn trong danh mục của đại lý",
          verifiedAt,
        }
      }

      const freshStock = Math.max(0, matched.sourceStock)
      const totalStock = freshStock + variant._count.serials

      // If freshStock changed from database, update immediately via pipeline
      if (freshStock !== sourceProduct.sourceStock || matched.sourcePrice !== sourceProduct.sourcePrice) {
        await recordSourceStockUpdate({
          connectionId: connection.id,
          externalId: sourceProduct.externalId,
          sourceStock: freshStock,
          sourceStatus: freshStock > 0 ? "available" : "out_of_stock",
          wholesalePrice: matched.sourcePrice,
          reason: "pre_checkout_check",
          verifiedAt,
        })
      }

      return {
        ok: true,
        stock: totalStock,
        price: matched.sourcePrice,
        isAvailable: totalStock > 0,
        verifiedAt,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed"
      const cachedStock = (variant.providerStock ?? 0) + variant._count.serials
      if (cachedStock > 0) {
        console.warn(`[Stock Verifier] Ngoại lệ kết nối đại lý. Fallback tồn kho DB (${cachedStock}): ${msg}`)
        return {
          ok: true,
          stock: cachedStock,
          isAvailable: true,
          price: variant.providerPrice ?? undefined,
          verifiedAt,
        }
      }
      return {
        ok: false,
        stock: cachedStock,
        isAvailable: false,
        isNetworkOrTimeout: true,
        error: `Lỗi kết nối tới đại lý: ${msg}`,
        verifiedAt,
      }
    } finally {
      inFlightVerifications.delete(coalescingKey)
    }
  })()

  inFlightVerifications.set(coalescingKey, verificationPromise)
  return verificationPromise
}
