# CTV Order Notes & Daily Reconciliation Ledger — Short Design

## Intent & Why
Provide a dedicated, lightweight order notebook for Collaborators (CTV) to record orders and payments collected from external customers (`Tên khách` – `Nội dung` – `Số tiền` – `Ghi chú`), view their daily total to remit to Admin, and allow Admin to reconcile and mark entries as settled without mixing into or double-counting the main storefront revenue ledger.

## Goals & Non-Goals
- **Goals:**
  - Full CRUD (`Create`, `Read`, `Update`, `Delete` with confirmation modal) for CTV order notes.
  - Date navigation (`◀ Ngày trước`, `Hôm qua`, `Hôm nay`, custom date picker) so late-night entries past `00:00` can be recorded on the correct date.
  - Shared PIN authentication integrated directly as a second tab (`📝 Sổ ghi đơn`) inside the existing `/ktv` (`/ctv`) portal.
  - Dedicated Admin reconciliation page (`/admin/ctv-notes`) in the Admin sidebar (`Kinh doanh` group) supporting single-item settlement, bulk daily settlement, un-settlement (undo), search/filter, and full Admin CRUD.
- **Non-Goals / Anti-Goals:**
  - Do **not** add CTV note amounts into main `Order` / `AdminDashboard` / `/admin/orders` revenue.
  - Do **not** allow CTV to edit or delete an entry once Admin has marked it `settled` (`Đã đối soát`), preventing post-settlement discrepancies.

## Approaches Considered
1. **Selected:** Tab `📝 Sổ ghi đơn` inside `/ktv` (shared PIN) + dedicated `/admin/ctv-notes` page in Admin sidebar. Fast access for both CTV and Admin, zero conflict with storefront accounting.
2. **Rejected — Sub-tab inside `/admin/price-list`:** Buries daily financial reconciliation inside a visual menu theme editor.
3. **Rejected — Merging into `/admin/orders`:** Violates the requirement to keep CTV reconciliation separate from main shop revenue.

## Data Model & Permissions
- Prisma & SQLite table `CtvOrderNote`:
  - `id` (`String @id @default(cuid())`)
  - `noteDate` (`String`, normalized `YYYY-MM-DD`, indexed)
  - `customerName` (`String`)
  - `content` (`String`)
  - `amount` (`Int`, VND > 0)
  - `note` (`String?`)
  - `status` (`String @default("pending")` — `"pending"` | `"settled"`)
  - `settledAt` (`DateTime?`)
  - `createdAt` (`DateTime @default(now())`), `updatedAt` (`DateTime @updatedAt`)
- **CTV API (`/api/ctv/notes` & `/api/ctv/notes/[id]`):** Protected by `verifyCtvRequest`. Can list, create, and update/delete only when `status === "pending"`.
- **Admin API (`/api/admin/ctv-notes` & `/api/admin/ctv-notes/[id]`):** Protected by `verifyAdminRequest`. Full CRUD regardless of status, toggle `settled` / `pending`, and bulk settle all `pending` items for a selected `noteDate`.
