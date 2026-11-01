import { runScheduledBackgroundSync } from '../lib/scheduler'

const INTERVAL_MS = Number(process.env.SYNC_INTERVAL_SECONDS || '60') * 1000

console.log(`[Sync Worker] Khởi động tiến trình đồng bộ nền tự động...`)
console.log(`[Sync Worker] Chu kỳ đồng bộ: ${INTERVAL_MS / 1000} giây`)

let isRunning = false
let shouldStop = false

async function cycle() {
  if (isRunning || shouldStop) return
  isRunning = true

  try {
    const summary = await runScheduledBackgroundSync({ minCooldownSeconds: 60 })
    if (summary.executedConnections > 0) {
      console.log(`[Sync Worker] Đã đồng bộ ${summary.executedConnections}/${summary.totalConnections} kết nối đại lý lúc ${summary.finishedAt}`)
      for (const r of summary.results) {
        if (r.success) {
          console.log(`  ✓ ${r.connectionName}: +${r.newCount} mới, ~${r.updatedCount} cập nhật, -${r.discontinuedCount} ngừng bán`)
        } else {
          console.error(`  ✗ ${r.connectionName} lỗi: ${r.error}`)
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Sync Worker Exception]`, msg)
  } finally {
    isRunning = false
  }
}

// Initial cycle
cycle()

// Standing interval
const timer = setInterval(cycle, INTERVAL_MS)

function shutdown() {
  console.log(`\n[Sync Worker] Đang dừng tiến trình đồng bộ...`)
  shouldStop = true
  clearInterval(timer)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
