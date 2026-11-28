# CTV Order Notes & Daily Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent CTV Order Notes ledger with full CRUD and daily reconciliation across the shared-PIN `/ktv` portal and a dedicated `/admin/ctv-notes` Admin view.

**Architecture:** Persist notes in a standalone `CtvOrderNote` SQLite/Prisma model (never aggregated into storefront `Order` revenue). Expose CTV CRUD endpoints guarded by `verifyCtvRequest` (locking edits/deletes once `status === "settled"`) and Admin CRUD + settlement endpoints guarded by `verifyAdminRequest`. Render a tabbed CTV Notebook inside `/ktv` and a dedicated `/admin/ctv-notes` page in the Admin sidebar.

**Tech Stack:** Next.js 16.4.3 (App Router), TypeScript, Prisma 5.22 + SQLite, Tailwind CSS, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-11-28-ctv-order-notes-design.md`

## Global Constraints
- Never mix `CtvOrderNote` amounts into `Order` / `AdminDashboard` / `/admin/orders` revenue.
- Declare `model CtvOrderNote` in BOTH `prisma/schema.prisma` AND `ensureDatabaseSchema()` in `lib/db.ts` so `prisma db push` on VPS never warns about dropping tables.
- CTV cannot edit or delete notes where `status === "settled"`.
- Both CTV and Admin delete actions require a confirmation modal to prevent accidental deletion.

## Review Focus
1. Non-numeric or `<= 0` / `> 1_000_000_000` `amount` input -> rejected with HTTP 400 and clear Vietnamese message.
2. CTV attempts `PATCH` or `DELETE` on an already `settled` note -> rejected with HTTP 403 (`"Đơn này đã được Admin đối soát, không thể sửa hoặc xóa"`).
3. Invalid or missing `noteDate` -> validated against `/^\d{4}-\d{2}-\d{2}$/`, falling back to current Vietnam date `YYYY-MM-DD` on creation or returning 400 on invalid edit.
4. `prisma db push` compatibility -> `CtvOrderNote` schema in `prisma/schema.prisma` matches `CREATE TABLE IF NOT EXISTS "CtvOrderNote"` in `lib/db.ts`.
5. Unauthenticated request to `/api/ctv/notes` or `/api/admin/ctv-notes` -> rejected with HTTP 401.

---

### Task 1: Database Schema & Validation Helpers

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/db.ts`
- Create: `lib/ctv-notes.ts`

**Interfaces:**
- Produces:
  - `CtvOrderNoteDto` (`id`, `noteDate`, `customerName`, `content`, `amount`, `note`, `status: "pending" | "settled"`, `settledAt`, `createdAt`, `updatedAt`)
  - `validateCtvNoteInput(input: unknown): { ok: true; data: ValidatedCtvNoteInput } | { ok: false; error: string }`
  - `serializeCtvNote(row: CtvOrderNote): CtvOrderNoteDto`

- [x] **Step 1: Add `model CtvOrderNote` to `prisma/schema.prisma` and auto-migration table creation to `lib/db.ts`**
- [x] **Step 2: Create `lib/ctv-notes.ts` with validation, Vietnam date helper, and DTO serializer; regenerate Prisma client (`npx.cmd prisma generate`)**

---

### Task 2: CTV & Admin REST APIs

**Files:**
- Create: `app/api/ctv/notes/route.ts`
- Create: `app/api/ctv/notes/[id]/route.ts`
- Create: `app/api/admin/ctv-notes/route.ts`
- Create: `app/api/admin/ctv-notes/[id]/route.ts`

**Interfaces:**
- Consumes: `verifyCtvRequest`, `verifyAdminRequest`, `lib/ctv-notes.ts`
- Produces:
  - `GET /api/ctv/notes?date=YYYY-MM-DD` & `POST /api/ctv/notes`
  - `PATCH /api/ctv/notes/[id]` & `DELETE /api/ctv/notes/[id]` (blocks if `status === "settled"`)
  - `GET /api/admin/ctv-notes`, `POST /api/admin/ctv-notes`, `PATCH /api/admin/ctv-notes` (bulk `settle_date`)
  - `PATCH /api/admin/ctv-notes/[id]` (edit fields + toggle `status`) & `DELETE /api/admin/ctv-notes/[id]`

- [x] **Step 1: Implement CTV notes routes (`/api/ctv/notes` and `/api/ctv/notes/[id]`)**
- [x] **Step 2: Implement Admin notes & reconciliation routes (`/api/admin/ctv-notes` and `/api/admin/ctv-notes/[id]`)**

---

### Task 3: CTV Portal Notebook Tab (`/ktv`)

**Files:**
- Create: `app/ktv/CtvOrderNotesTab.tsx`
- Modify: `app/ktv/KtvPriceListClient.tsx`

**Interfaces:**
- Consumes: `/api/ctv/notes`, `ThemeConfig` from `@/lib/ktv`
- Produces: `<CtvOrderNotesTab activeTheme={activeTheme} />` rendered inside `KtvPriceListClient` with top tab switcher (`📋 Bảng giá` | `📝 Sổ ghi đơn`)

- [x] **Step 1: Build `CtvOrderNotesTab.tsx` with date navigation (`◀`, date picker, `▶`, `Hôm qua`, `Hôm nay`), daily summary strip, create/edit form, locked settled state, and delete confirmation modal**
- [x] **Step 2: Add tab switcher into `KtvPriceListClient.tsx`**

---

### Task 4: Admin Reconciliation View (`/admin/ctv-notes`)

**Files:**
- Create: `app/admin/ctv-notes/page.tsx`
- Create: `app/admin/ctv-notes/CtvNotesAdminClient.tsx`
- Modify: `app/admin/layout.tsx`

**Interfaces:**
- Consumes: `/api/admin/ctv-notes`, `CtvOrderNoteDto`
- Produces: Admin sidebar entry `"Sổ đối chiếu CTV"` (`/admin/ctv-notes`) with daily summary cards, 1-click single & bulk day settlement, undo settlement, search/status/all-dates filters, full Admin CRUD, and delete confirmation modal.

- [x] **Step 1: Create `CtvNotesAdminClient.tsx` and `app/admin/ctv-notes/page.tsx`, and wire `/admin/ctv-notes` into `app/admin/layout.tsx`**
- [x] **Step 2: Verify with `npx.cmd prisma validate`, `npx.cmd tsc --noEmit`, `npx.cmd eslint`, and unit/API validation script**
