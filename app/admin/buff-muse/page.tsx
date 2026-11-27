import { ensureDatabaseSchema } from "@/lib/db"
import { getBuffMuseAdminConfig } from "@/lib/buff-config"
import { getTelegramConfig } from "@/lib/telegram-config"
import { BuffMuseAdminClient } from "./BuffMuseAdminClient"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminBuffMusePage() {
  await ensureDatabaseSchema()
  const [config, tgConfig] = await Promise.all([
    getBuffMuseAdminConfig(),
    getTelegramConfig(),
  ])

  return (
    <BuffMuseAdminClient
      initialConfig={config}
      initialTelegram={{
        configured: Boolean(tgConfig.botToken && tgConfig.chatId),
        source: tgConfig.source,
        maskedToken: tgConfig.maskedToken,
        chatId: tgConfig.chatId,
        webhookUrl: tgConfig.webhookUrl,
      }}
    />
  )
}
