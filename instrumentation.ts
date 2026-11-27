export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startTelegramBotPoller } = await import("./lib/telegram-bot")
    startTelegramBotPoller()
  }
}
