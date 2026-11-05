"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { CheckCircle2, Copy, Check, AlertCircle, AlertTriangle, Loader2, Clock, ArrowLeft, RefreshCw } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"

interface OrderStatusProps {
  orderId: string
  initialStatus: string
  createdAt?: string
  orderCode: string
  totalCents: number
  totalPaid?: number
  remainingCents?: number
  email: string
  qrUrl: string
  bankName: string
  accountNumber: string
  accountName: string
  items: Array<{
    productName: string
    variantName: string
    priceCents: number
    quantity?: number
    serials?: string[]
    serial?: string | null
    serviceInstructions: string | null
  }>
}

export function OrderStatus({
  orderId,
  initialStatus,
  createdAt,
  orderCode,
  totalCents,
  totalPaid: initialTotalPaid = 0,
  remainingCents: initialRemainingCents,
  email,
  qrUrl,
  bankName,
  accountNumber,
  accountName,
  items,
}: OrderStatusProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState(initialStatus)
  const [totalPaid, setTotalPaid] = useState(initialTotalPaid)
  const [remainingCents, setRemainingCents] = useState(
    initialRemainingCents !== undefined ? initialRemainingCents : Math.max(0, totalCents - initialTotalPaid)
  )
  const [currentItems, setCurrentItems] = useState(items)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [pollingError, setPollingError] = useState(false)
  const [qrLoaded, setQrLoaded] = useState(true)
  const [verifying, setVerifying] = useState(false)

  // 10-minute (600s) countdown timer
  const ORDER_TIMEOUT_SECONDS = 10 * 60
  const calculateRemainingSeconds = () => {
    if (!createdAt) return ORDER_TIMEOUT_SECONDS
    const createdTime = new Date(createdAt).getTime()
    const elapsed = Math.floor((Date.now() - createdTime) / 1000)
    return Math.max(0, ORDER_TIMEOUT_SECONDS - elapsed)
  }

  const [secondsLeft, setSecondsLeft] = useState<number>(calculateRemainingSeconds())

  // Countdown tick effect every 1 second
  useEffect(() => {
    if (status !== "pending") return

    if (secondsLeft <= 0) {
      setStatus("cancelled")
      return
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setStatus("cancelled")
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [status, secondsLeft])

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Polling check order status every 3s until paid or cancelled or refunded
  useEffect(() => {
    if (status === "paid" || status === "cancelled" || status === "refunded") return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`)
        if (!res.ok) throw new Error("Network response not ok")
        const data = await res.json()
        setPollingError(false)

        if (data.status) {
          setStatus(data.status)
        }
        if (typeof data.totalPaid === "number") {
          setTotalPaid(data.totalPaid)
        }
        if (typeof data.remainingCents === "number") {
          setRemainingCents(data.remainingCents)
        }
        if (Array.isArray(data.items)) {
          setCurrentItems(data.items)
        }

        if (data.status === "paid" || data.status === "cancelled" || data.status === "refunded") {
          clearInterval(interval)
        }
      } catch {
        setPollingError(true)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [orderId, status])

  const copyText = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyName)
    setTimeout(() => setCopiedKey(null), 2000)
    toast({ title: "Đã sao chép", description: text, variant: "default" })
  }

  const handleManualCheck = async () => {
    if (verifying) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/verify`, { method: "POST" })
      const data = await res.json()
      if (data.status) {
        setStatus(data.status)
      }
      if (data.paid || data.status === "paid") {
        toast({
          title: "Thanh toán thành công!",
          description: "Hệ thống đã nhận diện được giao dịch ngân hàng và tự động duyệt đơn.",
          variant: "default",
        })
      } else {
        toast({
          title: "Đang kiểm tra...",
          description: data.message || "Chưa tìm thấy giao dịch khớp mã. Nếu vừa chuyển, vui lòng đợi vài giây rồi thử lại.",
          variant: "default",
        })
      }
    } catch {
      toast({
        title: "Lỗi kết nối",
        description: "Không thể kiểm tra ngay bây giờ. Vui lòng thử lại sau.",
        variant: "destructive",
      })
    } finally {
      setVerifying(false)
    }
  }

  // CASE 1: ĐÃ THANH TOÁN THÀNH CÔNG (Hiển thị Serial/Key)
  if (status === "paid") {
    return (
      <div className="space-y-6">
        {/* Status Confirmation Banner */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-left flex items-start gap-3.5">
          <CheckCircle2 className="size-5 text-emerald-400 shrink-0 mt-0.5" strokeWidth={2} />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">Thanh toán thành công</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Đơn hàng <span className="font-mono font-semibold text-foreground">#{orderCode}</span> đã được ghi nhận. Thông tin tài khoản được lưu trực tiếp dưới đây.
            </p>
          </div>
        </div>

        {/* Serials / Credentials List */}
        <div className="space-y-4">
          {currentItems.map((item, idx) => {
            const serialList =
              item.serials && item.serials.length > 0
                ? item.serials
                : item.serial
                ? item.serial.split("\n").filter(Boolean)
                : []

            return (
              <div key={idx} className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{item.productName}</h3>
                    <p className="text-xs text-muted-foreground">{item.variantName}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground">{formatPrice(item.priceCents)}</span>
                </div>

                {serialList.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Thông tin tài khoản bàn giao ({serialList.length} mục)
                    </label>
                    <div className="space-y-2">
                      {serialList.map((serialContent, sIdx) => (
                        <div
                          key={sIdx}
                          className="relative rounded-lg border border-border bg-secondary/60 p-3.5 font-mono text-xs sm:text-sm text-foreground break-all select-all flex items-center justify-between gap-3"
                        >
                          <span>{serialContent}</span>
                          <button
                            type="button"
                            onClick={() => copyText(serialContent, `serial-${idx}-${sIdx}`)}
                            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            aria-label="Sao chép tài khoản"
                          >
                            {copiedKey === `serial-${idx}-${sIdx}` ? (
                              <Check className="size-4 text-emerald-400" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>

                    {item.serviceInstructions && (
                      <div className="pt-2">
                        <span className="text-xs font-semibold text-muted-foreground block mb-1">
                          Hướng dẫn kích hoạt:
                        </span>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line p-3 rounded-md bg-secondary/30 border border-border/40">
                          {item.serviceInstructions}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300">
                    Tài khoản đang được chuẩn bị và sẽ cập nhật tại đây trong vài phút.
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Bạn có thể đánh dấu lưu lại đường dẫn này hoặc kiểm tra hộp thư email <span className="font-medium text-foreground">{email}</span> để xem lại thông tin đơn hàng bất kỳ lúc nào.
        </p>
      </div>
    )
  }

  // CASE 2: ĐƠN ĐÃ HỦY (DO QUÁ 10 PHÚT HOẶC ADMIN HỦY)
  if (status === "cancelled") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 sm:p-7 text-center space-y-4">
          <div className="size-12 rounded-full bg-destructive/20 border border-destructive/30 flex items-center justify-center mx-auto text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">Đơn hàng đã hết hạn thanh toán</h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
              Đơn hàng <span className="font-mono font-semibold text-foreground">#{orderCode}</span> đã tự động bị hủy do quá thời gian chờ thanh toán 10 phút.
            </p>
          </div>
          <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl max-w-md mx-auto leading-relaxed">
            ⚠️ <strong>Lưu ý:</strong> Vui lòng không quét mã chuyển khoản cho đơn hàng này. Nếu bạn đã lỡ chuyển khoản muộn, vui lòng liên hệ Zalo CSKH để được kích hoạt đơn hoặc hỗ trợ hoàn tiền ngay.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="size-3.5" />
              <span>Quay lại trang chủ tạo đơn mới</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // CASE 3: ĐƠN ĐÃ HOÀN TIỀN
  if (status === "refunded") {
    return (
      <div className="rounded-xl border border-border bg-secondary/50 p-6 text-center space-y-3">
        <AlertCircle className="size-8 text-muted-foreground mx-auto" />
        <h2 className="text-base font-bold text-foreground">Đơn hàng đã hoàn tiền</h2>
        <p className="text-xs text-muted-foreground">
          Đơn #{orderCode} đã được xử lý hoàn tiền. Vui lòng liên hệ CSKH nếu bạn cần hỗ trợ thêm.
        </p>
      </div>
    )
  }

  // CASE 4: ĐÃ THANH TOÁN ĐỦ — ĐANG XUẤT KHO (PROCESSING)
  if (status === "processing") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 text-left flex items-start gap-3.5">
          <Loader2 className="size-5 text-blue-400 shrink-0 mt-0.5 animate-spin" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">Đã nhận thanh toán — Đang xuất kho</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Đơn hàng <span className="font-mono font-semibold text-foreground">#{orderCode}</span> đã được thanh toán đủ. Hệ thống đang chuẩn bị tài khoản và tự động giao ngay tại trang này. Vui lòng giữ nguyên màn hình.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">Sản phẩm trong đơn:</h3>
          <div className="space-y-2">
            {currentItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 text-xs">
                <div>
                  <span className="font-medium text-foreground block">{item.productName}</span>
                  <span className="text-muted-foreground">{item.variantName} x {item.quantity || 1}</span>
                </div>
                <span className="font-semibold text-foreground">{formatPrice(item.priceCents)}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Hệ thống đang tự động kiểm tra kho. Trang sẽ cập nhật ngay khi tài khoản sẵn sàng.
        </p>
      </div>
    )
  }

  // CASE 5: CHỜ THANH TOÁN (PENDING) HOẶC THANH TOÁN THIẾU (PARTIALLY_PAID)
  const isPartiallyPaid = status === "partially_paid"
  const qrTransferAmount = isPartiallyPaid && remainingCents > 0 ? remainingCents : totalCents
  const currentQrUrl =
    isPartiallyPaid && remainingCents > 0
      ? `https://qr.sepay.vn/img?bank=${bankName}&acc=${accountNumber}&amount=${qrTransferAmount}&des=${orderCode}&template=qr_only`
      : qrUrl

  return (
    <div className="space-y-6">
      {/* Banner */}
      {isPartiallyPaid ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Đã nhận thanh toán một phần</span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/20 text-amber-200">
              Đơn #{orderCode}
            </span>
          </div>
          <p className="text-muted-foreground leading-relaxed pt-1">
            Hệ thống đã nhận <span className="font-bold text-foreground tabular-nums">{formatPrice(totalPaid)}</span>. Số tiền còn thiếu là{" "}
            <span className="font-bold text-amber-400 tabular-nums">{formatPrice(remainingCents)}</span>. Vui lòng quét mã VietQR cập nhật bên dưới để chuyển tiếp số tiền còn lại.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Loader2 className="size-4 text-accent animate-spin shrink-0" />
              <div>
                <span className="font-semibold text-foreground block">Đang chờ nhận chuyển khoản</span>
                <span className="text-muted-foreground text-[11px]">Hệ thống kiểm tra giao dịch tự động</span>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-border bg-secondary text-muted-foreground">
              Đơn #{orderCode}
            </span>
          </div>

          {/* Countdown timer: 10 minutes auto-cancel */}
          <div className={`rounded-xl border p-3 flex items-center justify-between text-xs transition-colors ${
            secondsLeft <= 120
              ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}>
            <div className="flex items-center gap-2 font-medium">
              <Clock className={`size-4 ${secondsLeft <= 120 ? "text-rose-400 animate-pulse" : "text-amber-400"}`} />
              <span>Thời hạn giữ đơn &amp; thanh toán:</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
              <span className={`px-2 py-0.5 rounded-md border font-mono text-sm tracking-wider font-extrabold ${
                secondsLeft <= 120
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"
                  : "bg-amber-500/20 border-amber-500/30 text-amber-300"
              }`}>
                {formatCountdown(secondsLeft)}
              </span>
            </div>
          </div>
        </div>
      )}

      {pollingError && (
        <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs">
          Kết nối kiểm tra gián đoạn. Hệ thống vẫn đang tiếp tục thử lại...
        </div>
      )}

      {/* Payment Details Container */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold text-foreground">
            {isPartiallyPaid ? "Quét mã VietQR chuyển số tiền còn thiếu" : "Quét mã VietQR để thanh toán"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isPartiallyPaid
              ? `Số tiền còn thiếu: ${formatPrice(remainingCents)}. Quét mã để thanh toán tự động.`
              : "Mở ứng dụng ngân hàng bất kỳ để quét mã và chuyển tiền chính xác."}
          </p>
        </div>

        {/* Clean, high-contrast QR wrapper - Phóng to tối đa để siêu nhạy khi quét */}
        <div className="flex justify-center">
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center">
            {qrLoaded ? (
              <Image
                src={currentQrUrl}
                alt={`Mã VietQR thanh toán cho đơn hàng ${orderCode}`}
                width={320}
                height={320}
                unoptimized
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
                onError={() => setQrLoaded(false)}
              />
            ) : (
              <div className="w-64 h-64 sm:w-72 sm:h-72 flex flex-col items-center justify-center text-slate-800 text-xs p-3 text-center space-y-2">
                <AlertCircle className="size-6 text-amber-600" />
                <span>Không tải được ảnh QR. Vui lòng chuyển khoản theo thông tin bên dưới.</span>
              </div>
            )}
          </div>
        </div>

        {/* Transfer Metadata with Copy Actions */}
        <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-2.5 text-xs">
          {[
            { label: "Ngân hàng nhận", value: bankName, copyVal: bankName, key: "bank" },
            { label: "Số tài khoản", value: accountNumber, copyVal: accountNumber, key: "acc" },
            { label: "Tên chủ tài khoản", value: accountName, copyVal: accountName, key: "name" },
            ...(isPartiallyPaid
              ? [
                  { label: "Tổng đơn hàng", value: formatPrice(totalCents), copyVal: totalCents.toString(), key: "origTotal" },
                  { label: "Đã thanh toán", value: formatPrice(totalPaid), copyVal: totalPaid.toString(), key: "paidAmount" },
                  { label: "Số tiền cần chuyển thêm", value: formatPrice(remainingCents), copyVal: remainingCents.toString(), key: "remainingAmount", isCode: true },
                ]
              : [
                  { label: "Số tiền chuyển", value: formatPrice(totalCents), copyVal: totalCents.toString(), key: "amount" },
                ]),
            { label: "Nội dung chuyển khoản", value: orderCode, copyVal: orderCode, key: "code", isCode: true },
          ].map(({ label, value, copyVal, key, isCode }) => (
            <div key={key} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
              <span className="text-muted-foreground">{label}:</span>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${isCode ? "text-accent font-bold font-mono" : key === "acc" ? "text-foreground font-mono" : "text-foreground tabular-nums"}`}>
                  {value}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(copyVal, key)}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Sao chép ${label}`}
                >
                  {copiedKey === key ? (
                    <Check className="size-3 text-emerald-400" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Warning about Transfer Content */}
        <div className="p-3 rounded-md border border-border bg-secondary/30 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground font-semibold">Lưu ý quan trọng:</strong> Vui lòng điền đúng mã nội dung{" "}
          <span className="font-mono font-bold text-accent">{orderCode}</span> để hệ thống nhận diện giao dịch tự động.
        </div>

        {/* Manual Verification Button */}
        <div className="pt-2 space-y-2">
          <Button
            type="button"
            disabled={verifying}
            onClick={handleManualCheck}
            className="w-full py-5 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.99] transition-all cursor-pointer"
          >
            <RefreshCw className={`size-4 ${verifying ? "animate-spin" : ""}`} />
            <span>{verifying ? "Đang đối soát giao dịch SePay..." : "Tôi đã chuyển tiền (Kiểm tra ngay)"}</span>
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">
            Hệ thống đang tự động quét biến động số dư SePay mỗi 3 giây. Nếu bạn vừa chuyển xong, bấm nút trên để kích hoạt kiểm tra ngay lập tức.
          </p>
        </div>
      </div>
    </div>
  )
}
