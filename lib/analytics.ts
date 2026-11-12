import { prisma } from "@/lib/db"
import { getSiteSettings } from "@/lib/settings"

export const ONLINE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes active window
const STALE_SESSION_MS = 24 * 60 * 60 * 1000 // Prune sessions older than 24h
const TOTAL_VISITS_METRIC_KEY = "total_visits"

const BOT_USER_AGENT_REGEX =
  /bot|crawl|spider|slurp|bingpreview|mediapartners|adsbot|lighthouse|headless|phantom|playwright|puppeteer|uptime|pingdom|statuscake|curl\/|wget\/|python-requests|python-urllib|axios\/|node-fetch|postman|insomnia|facebookexternalhit|twitterbot|telegrambot|discordbot|whatsapp|zalo/i

export interface VisitorStatsSnapshot {
  onlineCount: number
  totalVisits: number
  todayVisits: number
  showVisitorStats: boolean
}

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return BOT_USER_AGENT_REGEX.test(userAgent)
}

export function getVietnamDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function isValidVisitorId(id: string | null | undefined): id is string {
  if (!id) return false
  return /^[a-zA-Z0-9_-]{16,64}$/.test(id)
}

export async function getVisitorStats(): Promise<VisitorStatsSnapshot> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - ONLINE_WINDOW_MS)
  const today = getVietnamDateKey(now)

  const [onlineCount, totalMetric, todayRecord, settings] = await Promise.all([
    prisma.visitorSession.count({
      where: { lastSeenAt: { gte: cutoff } },
    }),
    prisma.siteMetric.findUnique({
      where: { key: TOTAL_VISITS_METRIC_KEY },
      select: { value: true },
    }),
    prisma.dailyTraffic.findUnique({
      where: { date: today },
      select: { visits: true },
    }),
    getSiteSettings(),
  ])

  return {
    onlineCount,
    totalVisits: totalMetric?.value ?? 0,
    todayVisits: todayRecord?.visits ?? 0,
    showVisitorStats: settings.showVisitorStats ?? true,
  }
}

export async function recordVisitorPing(
  sessionId: string,
  userAgent: string | null | undefined
): Promise<VisitorStatsSnapshot> {
  if (isBotUserAgent(userAgent)) {
    return getVisitorStats()
  }

  const now = new Date()
  const today = getVietnamDateKey(now)

  await prisma.$transaction(async (tx) => {
    const existing = await tx.visitorSession.findUnique({
      where: { id: sessionId },
      select: { lastVisitDate: true },
    })

    if (!existing || existing.lastVisitDate !== today) {
      await tx.siteMetric.upsert({
        where: { key: TOTAL_VISITS_METRIC_KEY },
        create: { key: TOTAL_VISITS_METRIC_KEY, value: 1 },
        update: { value: { increment: 1 } },
      })

      await tx.dailyTraffic.upsert({
        where: { date: today },
        create: { date: today, visits: 1 },
        update: { visits: { increment: 1 } },
      })

      await tx.visitorSession.upsert({
        where: { id: sessionId },
        create: {
          id: sessionId,
          lastSeenAt: now,
          lastVisitDate: today,
        },
        update: {
          lastSeenAt: now,
          lastVisitDate: today,
        },
      })
    } else {
      await tx.visitorSession.update({
        where: { id: sessionId },
        data: { lastSeenAt: now },
      })
    }
  })

  // Occasional lightweight cleanup of stale visitor sessions (>24h old)
  if (Math.random() < 0.03) {
    const staleCutoff = new Date(now.getTime() - STALE_SESSION_MS)
    void prisma.visitorSession
      .deleteMany({ where: { lastSeenAt: { lt: staleCutoff } } })
      .catch(() => {})
  }

  const snapshot = await getVisitorStats()
  return {
    ...snapshot,
    onlineCount: Math.max(1, snapshot.onlineCount),
  }
}
