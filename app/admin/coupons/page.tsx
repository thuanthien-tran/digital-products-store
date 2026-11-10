import { CouponsClient } from "./CouponsClient"

export const dynamic = "force-dynamic"

export default function AdminCouponsPage() {
  return (
    <div className="space-y-6">
      <CouponsClient />
    </div>
  )
}
