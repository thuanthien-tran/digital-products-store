import { notFound } from "next/navigation"
import { cookies, headers } from "next/headers"
import { prisma } from "@/lib/db"
import { getSiteSettings } from "@/lib/settings"
import { Header } from "@/components/storefront/Header"
import { Footer } from "@/components/storefront/Footer"
import { ZaloWidget } from "@/components/storefront/ZaloWidget"
import { OrderStatus } from "@/components/storefront/OrderStatus"
import { generateVietQRUrl } from "@/lib/vietqr"
import { verifyAdminToken } from "@/lib/auth"
import { cancelIfExpired } from "@/lib/order-expiry"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface Props {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ token?: string }>
}

async function getOrder(id: string) {
  try {
    return await prisma.order.findUnique({
      where: { id },
      include: {
        payments: true,
        items: {
          include: {
            product: { select: { name: true, serviceInstructions: true, deliveryType: true } },
            variant: { select: { name: true } },
            serials: { select: { content: true } },
          },
        },
      },
    })
  } catch {
    return null
  }
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@")
  if (!domain) return "***"
  const visible = user.length <= 2 ? user[0] + "*" : user.slice(0, 2) + "***"
  return `${visible}@${domain}`
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = searchParams ? await searchParams : {}
  const [order, settings] = await Promise.all([
    getOrder(id),
    getSiteSettings(),
  ])
  if (!order) notFound()

  // 1. Authorization check for viewing serial credentials
  const cookieStore = await cookies()
  const headerStore = await headers()

  const cookieToken = cookieStore.get(`order_access_${order.id}`)?.value
  const queryToken = sp.token
  const headerToken = headerStore.get("x-order-token")

  const adminCookie = cookieStore.get("admin_token")?.value
  const adminHeader = headerStore.get("authorization")?.replace(/^Bearer\s+/, "")
  const isAdmin = Boolean(
    (adminCookie && (await verifyAdminToken(adminCookie))) ||
    (adminHeader && (await verifyAdminToken(adminHeader)))
  )

  const isOwner = Boolean(
    order.accessToken &&
      (cookieToken === order.accessToken ||
        queryToken === order.accessToken ||
        headerToken === order.accessToken)
  )

  const canViewCredentials = isAdmin || isOwner

  const bankCode = process.env.BANK_NAME || "MB"
  const accountNumber = process.env.BANK_ACCOUNT_NUMBER || "0356970964"
  const accountName = process.env.BANK_ACCOUNT_NAME || "TRAN THUAN THIEN"

  const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0)
  const remainingCents = Math.max(0, order.totalCents - totalPaid)

  // 10-minute payment timeout check on initial render
  let initialStatus = order.status
  if (order.status === "pending" && totalPaid === 0) {
    const isExpired = await cancelIfExpired(order.id, order.createdAt, order.status, totalPaid)
    if (isExpired) {
      initialStatus = "cancelled"
    }
  }

  const qrAmount = initialStatus === "partially_paid" && remainingCents > 0 ? remainingCents : order.totalCents

  const qrUrl = generateVietQRUrl({
    bankCode,
    accountNumber,
    accountName,
    amount: qrAmount,
    description: order.code,
  })

  // INVARIANT: Never expose serial credentials in HTML/RSC payload to unauthenticated callers
  const items = order.items.map((item) => {
    const isPaidOrder = order.status === "paid"
    const serialList = isPaidOrder && canViewCredentials ? item.serials.map((s) => s.content) : []
    return {
      productName: item.product.name,
      variantName: item.variant.name,
      priceCents: item.priceCents,
      quantity: item.quantity,
      serials: serialList,
      serial: serialList.length > 0 ? serialList.join("\n") : null,
      serviceInstructions: item.product.serviceInstructions,
    }
  })

  return (
    <div className="flex min-h-screen flex-col">
      <Header initialSettings={settings} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 sm:px-6 py-10">
        <OrderStatus
          orderId={order.id}
          initialStatus={initialStatus}
          createdAt={order.createdAt.toISOString()}
          orderCode={order.code}
          subtotalCents={order.subtotalCents ?? order.totalCents}
          discountCents={order.discountCents ?? 0}
          couponCode={order.couponCode || null}
          totalCents={order.totalCents}
          totalPaid={totalPaid}
          remainingCents={remainingCents}
          email={canViewCredentials ? order.email : maskEmail(order.email)}
          qrUrl={qrUrl}
          bankName={bankCode}
          accountNumber={accountNumber}
          accountName={accountName}
          items={items}
        />
      </main>
      <Footer initialSettings={settings} />
      <ZaloWidget />
    </div>
  )
}
