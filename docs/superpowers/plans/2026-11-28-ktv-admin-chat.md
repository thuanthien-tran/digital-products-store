# KTV <-> Admin Direct Web Chat Implementation Plan

> **For agentic workers:** Executed inline via superpowers:executing-plans.

**Goal:** Add two-way text + image chat between Admin (`/admin` header drawer) and KTV (`/ktv` floating chat widget), backed by SQLite/Prisma and Telegram new-message alerts.

**Spec:** `docs/superpowers/specs/2026-11-28-ktv-admin-chat-design.md`

### Tasks
1. Declare `KtvChatMessage` in `prisma/schema.prisma` + `lib/db.ts`, add `saveChatImage` in `lib/image-upload.ts`, add `lib/ktv-chat.ts` helpers + Telegram notifier, regenerate Prisma Client.
2. Add image serve endpoint `/api/uploads/chat/[filename]`, shared upload handler + `/api/ctv/chat` & `/api/admin/ktv-chat` CRUD routes.
3. Build shared `<KtvChatThread />`, `<KtvChatWidget />` inside `KtvPriceListClient.tsx`, and `<AdminKtvChatButton />` inside `app/admin/layout.tsx` (+ shortcut event from `/admin/ctv-notes`).
4. Verify Prisma validation, CRUD + auth test script, ESLint, `tsc --noEmit`, commit & push to `origin/main`.
