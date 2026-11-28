# KTV <-> Admin Direct Web Chat — Short Design

## Intent & Why
Allow Admin and KTV (`/ktv` shared-PIN portal) to communicate directly inside the web app without switching to third-party apps, with image attachment support (for bills/screenshots), unread badges, and optional Telegram alert notifications to Admin when KTV sends a message.

## Architecture
- Standalone SQLite/Prisma model `KtvChatMessage` (`sender`: `"admin" | "ktv"`, `senderLabel`, `message`, `imageUrl`, `isReadByAdmin`, `isReadByKtv`, `createdAt`).
- Short-polling REST endpoints (`/api/ctv/chat` for KTV, `/api/admin/ktv-chat` for Admin) compatible with `next start` behind systemd without custom WebSocket servers.
- Shared image validation & local serving (`/api/uploads/chat/[filename]`), reusing `validateImageBuffer`.
- Shared chat thread UI (`components/chat/KtvChatThread.tsx`) consumed by:
  - Floating bottom-right chat launcher/window inside `/ktv` (`app/ktv/KtvChatWidget.tsx`).
  - Header button + right slide-over chat drawer in `/admin` (`components/admin/AdminKtvChatButton.tsx`).
- Best-effort Telegram notification sent to Admin via existing `getTelegramConfig()` whenever KTV posts a new message.
