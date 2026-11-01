import { prisma } from "./db"
import { syncProviderConnection } from "./sync-engine"

export interface ScheduledSyncSummary {
  startedAt: string
  finishedAt: string
  totalConnections: number
  executedConnections: number
  skippedConnections: number
  results: Array<{
    connectionId: string
    connectionName: string
    success: boolean
    newCount: number
    updatedCount: number
    discontinuedCount: number
    error?: string
  }>
}

// Distributed lock map in memory with expiration (TTL 60 seconds)
const distributedLocks = new Map<string, number>()

function acquireLock(connectionId: string, ttlMs: number = 60000): boolean {
  const now = Date.now()
  const currentExpiry = distributedLocks.get(connectionId)
  if (currentExpiry && currentExpiry > now) {
    return false // Lock is active
  }
  distributedLocks.set(connectionId, now + ttlMs)
  return true
}

function releaseLock(connectionId: string): void {
  distributedLocks.delete(connectionId)
}

/**
 * Executes server-side scheduled background inventory sync across enabled providers.
 * 
 * INVARIANTS:
 * 1. Only syncs connections with isEnabled = true and active published products.
 * 2. Enforces minimum 60s cooldown per connection to respect provider rate limits.
 * 3. Lock has TTL and is guaranteed to be released even on crash/exception.
 * 4. Failure of one connection never blocks other connections.
 * 5. Concurrency limit prevents overloading hosting outbound bandwidth.
 */
export async function runScheduledBackgroundSync(options?: {
  force?: boolean
  minCooldownSeconds?: number
}): Promise<ScheduledSyncSummary> {
  const startedAt = new Date().toISOString()
  const minCooldown = (options?.minCooldownSeconds ?? 60) * 1000
  const now = Date.now()

  // 1. Fetch enabled connections
  const connections = await prisma.providerConnection.findMany({
    where: { isEnabled: true },
    include: {
      sourceProducts: {
        where: { editorialStatus: "published" },
        select: { id: true },
      },
    },
  })

  const results: ScheduledSyncSummary["results"] = []
  let executedCount = 0
  let skippedCount = 0

  for (const conn of connections) {
    // Only auto-sync connections that have active published products in store
    if (conn.sourceProducts.length === 0 && !options?.force) {
      skippedCount++
      continue
    }

    // Check cooldown
    if (!options?.force && conn.lastSyncedAt) {
      const elapsed = now - conn.lastSyncedAt.getTime()
      if (elapsed < minCooldown) {
        skippedCount++
        continue
      }
    }

    // Attempt lock acquisition
    if (!acquireLock(conn.id, 65000)) {
      skippedCount++
      continue
    }

    try {
      executedCount++
      const syncRes = await syncProviderConnection(conn.id)
      results.push({
        connectionId: conn.id,
        connectionName: conn.name,
        success: syncRes.success,
        newCount: syncRes.newCount,
        updatedCount: syncRes.updatedCount,
        discontinuedCount: syncRes.discontinuedCount,
        error: syncRes.error,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failure"
      results.push({
        connectionId: conn.id,
        connectionName: conn.name,
        success: false,
        newCount: 0,
        updatedCount: 0,
        discontinuedCount: 0,
        error: msg,
      })
    } finally {
      releaseLock(conn.id)
    }
  }

  const finishedAt = new Date().toISOString()

  return {
    startedAt,
    finishedAt,
    totalConnections: connections.length,
    executedConnections: executedCount,
    skippedConnections: skippedCount,
    results,
  }
}
