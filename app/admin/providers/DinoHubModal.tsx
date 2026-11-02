"use client"

import { useState, useEffect } from "react"
import {
  X,
  Bot,
  RefreshCw,
  Wallet,
  ShieldCheck,
  Terminal,
  Copy,
  Check,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react"

interface DinoHubModalProps {
  isOpen: boolean
  onClose: () => void
  connectionName: string
}

interface DinoMeData {
  version: string
  partner_name: string
  is_admin: boolean
  balance: number
  maintenance_mode: boolean
  rank_name: string
  rank_discount_percent: number
}

interface DinoOrderItem {
  id?: string | number
  order_code?: string
  partner_ref?: string
  product_id?: string
  product_name?: string
  quantity?: number
  price?: number
  total_amount?: number
  status?: string
  delivery_mode?: string
  items?: any[]
  credentials?: any[]
  serials?: any[]
  content?: string
  created_at?: string | number
  [key: string]: any
}

interface DinoCatalogItem {
  product_id: string
  name: string
  price: number
  duration?: string
  warranty?: string
  stock_status?: string
  stock_count?: number | null
  available?: boolean
}

export function DinoHubModal({ isOpen, onClose, connectionName }: DinoHubModalProps) {
  const [activeTab, setActiveTab] = useState<"me" | "orders" | "lookup" | "catalog">("me")
  
  // Tab 1: Me
  const [meLoading, setMeLoading] = useState(false)
  const [meData, setMeData] = useState<DinoMeData | null>(null)
  const [meError, setMeError] = useState<string | null>(null)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  // Tab 2: Orders
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orders, setOrders] = useState<DinoOrderItem[]>([])
  const [ordersPagination, setOrdersPagination] = useState({ limit: 20, offset: 0, total: 0 })
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<DinoOrderItem | null>(null)

  // Tab 3: Lookup
  const [lookupType, setLookupType] = useState<"by-ref" | "by-code">("by-ref")
  const [lookupQuery, setLookupQuery] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState<DinoOrderItem | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  // Tab 4: Catalog & Test Buy
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogItems, setCatalogItems] = useState<DinoCatalogItem[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogFilter, setCatalogFilter] = useState("")
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null)
  const [buyResult, setBuyResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadMe()
    }
  }, [isOpen])

  const loadMe = async () => {
    setMeLoading(true)
    setMeError(null)
    try {
      const res = await fetch("/api/admin/providers/dino?action=me")
      const json = await res.json()
      if (res.ok && json.success) {
        setMeData(json.data)
      } else {
        setMeError(json.error || "Không thể tải thông tin Dino")
      }
    } catch (err: unknown) {
      setMeError(err instanceof Error ? err.message : "Lỗi mạng")
    } finally {
      setMeLoading(false)
    }
  }

  const loadOrders = async () => {
    setOrdersLoading(true)
    setOrdersError(null)
    try {
      const res = await fetch("/api/admin/providers/dino?action=orders&limit=30&offset=0")
      const json = await res.json()
      if (res.ok && json.success) {
        setOrders(json.data?.orders || [])
        if (json.data?.pagination) {
          setOrdersPagination(json.data.pagination)
        }
      } else {
        setOrdersError(json.error || "Không thể lấy lịch sử đơn Dino")
      }
    } catch (err: unknown) {
      setOrdersError(err instanceof Error ? err.message : "Lỗi mạng")
    } finally {
      setOrdersLoading(false)
    }
  }

  const loadCatalog = async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const res = await fetch("/api/admin/providers/dino?action=catalog")
      const json = await res.json()
      if (res.ok && json.success) {
        setCatalogItems(json.catalog || [])
      } else {
        setCatalogError(json.error || "Không thể tải catalog Dino")
      }
    } catch (err: unknown) {
      setCatalogError(err instanceof Error ? err.message : "Lỗi mạng")
    } finally {
      setCatalogLoading(false)
    }
  }

  const handleTabChange = (tab: "me" | "orders" | "lookup" | "catalog") => {
    setActiveTab(tab)
    if (tab === "orders" && orders.length === 0) {
      loadOrders()
    } else if (tab === "catalog" && catalogItems.length === 0) {
      loadCatalog()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(text)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lookupQuery.trim()) return

    setLookupLoading(true)
    setLookupError(null)
    setLookupResult(null)

    try {
      const action = lookupType === "by-code" ? "order-by-code" : "order-by-ref"
      const paramKey = lookupType === "by-code" ? "code" : "ref"
      const res = await fetch(`/api/admin/providers/dino?action=${action}&${paramKey}=${encodeURIComponent(lookupQuery.trim())}`)
      const json = await res.json()

      if (res.ok && json.success) {
        setLookupResult(json.order)
      } else {
        setLookupError(json.error || "Không tìm thấy đơn hàng tương ứng")
      }
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : "Lỗi mạng")
    } finally {
      setLookupLoading(false)
    }
  }

  const handleTestBuy = async (item: DinoCatalogItem) => {
    const qty = 1
    const testRef = `TEST-${Date.now()}`
    const confirmed = window.confirm(
      `Xác nhận mua thử nghiệm 1x "${item.name}" với giá ${item.price.toLocaleString("vi-VN")} đ từ ví Dino?\n(Lưu ý: Tiền ví Dino sẽ bị trừ trực tiếp nếu có đủ số dư).`
    )
    if (!confirmed) return

    setBuyingProductId(item.product_id)
    setBuyResult(null)

    try {
      const res = await fetch("/api/admin/providers/dino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "buy",
          product_id: item.product_id,
          partner_ref: testRef,
          quantity: qty,
        }),
      })

      const json = await res.json()
      if (res.ok && json.success) {
        setBuyResult({
          success: true,
          message: `Mua thành công! Mã đơn Dino: ${json.order?.order_code || json.order?.id || "N/A"}. Dữ liệu bàn giao: ${JSON.stringify(json.credentials || json.order?.items || "Đã nhận")}`,
        })
        loadMe() // refresh balance
      } else {
        const isInsuff = json.isInsufficientBalance
        setBuyResult({
          success: false,
          message: isInsuff
            ? `Số dư không đủ! Hãy gõ /napapi [số_tiền] trên Telegram Bot Dino để nạp tiền.`
            : json.error || "Mua thử nghiệm thất bại.",
        })
      }
    } catch (err: unknown) {
      setBuyResult({
        success: false,
        message: err instanceof Error ? err.message : "Lỗi mạng",
      })
    } finally {
      setBuyingProductId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border/80 flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">Trung tâm Dino Store (Lệnh Bot & API v2)</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  v2.0 Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Kết nối: <span className="text-foreground font-medium">{connectionName}</span> (api.abcxy.store)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-border bg-secondary/10 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => handleTabChange("me")}
            className={`py-2 px-3 border-b-2 font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "me"
                ? "border-emerald-500 text-emerald-400 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wallet className="size-3.5" />
            <span>Ví & Lệnh Bot Telegram</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("orders")}
            className={`py-2 px-3 border-b-2 font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "orders"
                ? "border-emerald-500 text-emerald-400 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="size-3.5" />
            <span>Lịch sử Đơn API ({orders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("lookup")}
            className={`py-2 px-3 border-b-2 font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "lookup"
                ? "border-emerald-500 text-emerald-400 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Search className="size-3.5" />
            <span>Tra cứu Đơn hàng</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("catalog")}
            className={`py-2 px-3 border-b-2 font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "catalog"
                ? "border-emerald-500 text-emerald-400 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="size-3.5" />
            <span>Catalog Sản Phẩm ({catalogItems.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: ME & BOT COMMANDS */}
          {activeTab === "me" && (
            <div className="space-y-6">
              {/* Account / Balance Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                    <span>Số dư ví chung (API)</span>
                    <Wallet className="size-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {meLoading ? (
                      <span className="text-muted-foreground text-sm flex items-center gap-1">
                        <RefreshCw className="size-3.5 animate-spin" /> Đang đọc...
                      </span>
                    ) : meData ? (
                      `${meData.balance.toLocaleString("vi-VN")} đ`
                    ) : (
                      "0 đ"
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1">
                    Dùng để trừ tiền tự động khi mua hàng qua API
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                    <span>Tài khoản đối tác</span>
                    <ShieldCheck className="size-4 text-blue-400" />
                  </div>
                  <div className="text-lg font-bold text-foreground truncate">
                    {meData?.partner_name || "thuanthientran"}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                      {meData?.rank_name || "⭐️ Thành viên"}
                    </span>
                    {Boolean(meData?.rank_discount_percent) && (
                      <span className="text-[11px] text-emerald-400 font-semibold">
                        -{meData?.rank_discount_percent}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                    <span>Trạng thái cổng Dino</span>
                    <RefreshCw className={`size-4 ${meLoading ? "animate-spin text-emerald-400" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 className="size-3.5" />
                      API v2 Đã Duyệt
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={loadMe}
                    disabled={meLoading}
                    className="text-[11px] text-primary hover:underline text-left mt-2 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Làm mới số dư</span>
                  </button>
                </div>
              </div>

              {meError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{meError}</span>
                </div>
              )}

              {/* Bot Instructions Box */}
              <div className="p-5 rounded-2xl bg-secondary/20 border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="size-4 text-emerald-400" />
                    <h4 className="font-bold text-sm text-foreground">
                      Full Lệnh Bot Telegram Cho Thành Viên API
                    </h4>
                  </div>
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                    Menu chỉ hiển thị khi đã được Admin Dino duyệt API
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Để nạp tiền vào ví chung dùng cho API hoặc tra cứu đơn từ Telegram, mở Bot Dino trên Telegram và sử dụng các cú pháp sau:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Command 1: /napapi */}
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        /napapi [số_tiền]
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("/napapi 200000")}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                        title="Copy lệnh mẫu 200k"
                      >
                        {copiedCmd === "/napapi 200000" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-foreground font-medium">Tạo QR nạp tiền vào ví chung (API Balance)</p>
                    <p className="text-[11px] text-muted-foreground">
                      Ví dụ gõ: <code className="text-primary font-mono font-semibold">/napapi 200000</code>. Bot sẽ sinh mã VietQR tự động cộng tiền ngay sau 30 giây.
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground">Mẫu nhanh:</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("/napapi 100000")}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                      >
                        /napapi 100000
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("/napapi 200000")}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                      >
                        /napapi 200000
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("/napapi 500000")}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                      >
                        /napapi 500000
                      </button>
                    </div>
                  </div>

                  {/* Command 2: /lichsu */}
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        /lichsu
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("/lichsu")}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                        title="Copy lệnh /lichsu"
                      >
                        {copiedCmd === "/lichsu" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-foreground font-medium">Xem lịch sử đơn thường + đơn API</p>
                    <p className="text-[11px] text-muted-foreground">
                      Hiển thị danh sách các đơn đã đặt, trạng thái đơn và chi tiết mã kích hoạt đã bàn giao.
                    </p>
                  </div>
                </div>

                {/* API Specs List */}
                <div className="pt-2 border-t border-border/60">
                  <span className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Các API Endpoint v2 đã tích hợp trên Website:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-card/60 border border-border flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold">GET /api/v2/me</span>
                      <span className="text-muted-foreground text-[11px]">Kiểm tra key + số dư</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card/60 border border-border flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold">GET /api/v2/catalog</span>
                      <span className="text-muted-foreground text-[11px]">Lấy danh mục sản phẩm</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card/60 border border-border flex items-center justify-between">
                      <span className="text-blue-400 font-semibold">GET /api/v2/orders</span>
                      <span className="text-muted-foreground text-[11px]">Lấy lịch sử đơn API</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card/60 border border-border flex items-center justify-between">
                      <span className="text-amber-400 font-semibold">POST /api/v2/orders</span>
                      <span className="text-muted-foreground text-[11px]">Tạo đơn mua tự động</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card/60 border border-border flex items-center justify-between">
                      <span className="text-purple-400 font-semibold">GET /api/v2/orders/:code</span>
                      <span className="text-muted-foreground text-[11px]">Tra cứu theo mã Dino</span>
                    </div>
                    <div className="p-2 rounded-lg bg-card/60 border border-border flex items-center justify-between">
                      <span className="text-purple-400 font-semibold">GET /api/v2/orders/by-ref/:ref</span>
                      <span className="text-muted-foreground text-[11px]">Tra cứu theo mã Shop</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS HISTORY */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-foreground">Lịch sử Đơn hàng API (GET /api/v2/orders)</h4>
                  <p className="text-xs text-muted-foreground">
                    Danh sách đơn hàng đã mua từ đại lý Dino qua API
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadOrders}
                  disabled={ordersLoading}
                  className="py-1.5 px-3 rounded-lg border border-border hover:bg-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`size-3.5 ${ordersLoading ? "animate-spin" : ""}`} />
                  <span>Tải lại</span>
                </button>
              </div>

              {ordersError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {ordersError}
                </div>
              )}

              {ordersLoading ? (
                <div className="py-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="size-6 animate-spin text-emerald-400" />
                  <span>Đang tải danh sách đơn hàng từ Dino...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs bg-secondary/10 rounded-xl border border-dashed border-border">
                  Chưa có đơn hàng nào được tạo qua API Dino.
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-3">Mã đơn Dino</th>
                          <th className="p-3">Mã Shop (partner_ref)</th>
                          <th className="p-3">Sản phẩm</th>
                          <th className="p-3">SL</th>
                          <th className="p-3">Tổng tiền</th>
                          <th className="p-3">Trạng thái</th>
                          <th className="p-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {orders.map((ord, idx) => (
                          <tr key={ord.id || ord.order_code || idx} className="hover:bg-secondary/20">
                            <td className="p-3 font-mono font-bold text-foreground">
                              {ord.order_code || ord.id || "N/A"}
                            </td>
                            <td className="p-3 font-mono text-muted-foreground">
                              {ord.partner_ref || "—"}
                            </td>
                            <td className="p-3 font-medium text-foreground">
                              {ord.product_name || ord.product_id || "Sản phẩm"}
                            </td>
                            <td className="p-3">{ord.quantity || 1}</td>
                            <td className="p-3 font-mono">
                              {(ord.total_amount || ord.price || 0).toLocaleString("vi-VN")} đ
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ord.status === "completed" || ord.status === "success"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : ord.status === "failed"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}
                              >
                                {ord.status || "completed"}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedOrderDetails(ord)}
                                className="text-primary hover:underline font-semibold cursor-pointer"
                              >
                                Xem serial
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Order Details Modal Popup */}
              {selectedOrderDetails && (
                <div className="fixed inset-0 z-60 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="w-full max-w-lg bg-card border border-border rounded-xl p-5 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <h4 className="font-bold text-sm text-foreground">
                        Chi tiết đơn: {selectedOrderDetails.order_code || selectedOrderDetails.id}
                      </h4>
                      <button
                        onClick={() => setSelectedOrderDetails(null)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Mã đối tác (partner_ref): </span>
                        <span className="font-mono font-semibold text-foreground">
                          {selectedOrderDetails.partner_ref || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sản phẩm: </span>
                        <span className="font-semibold text-foreground">
                          {selectedOrderDetails.product_name || selectedOrderDetails.product_id}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Dữ liệu bàn giao (Serials/Accounts):</span>
                        <pre className="mt-1 p-3 rounded-lg bg-secondary/40 border border-border font-mono text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                          {JSON.stringify(
                            selectedOrderDetails.items ||
                              selectedOrderDetails.credentials ||
                              selectedOrderDetails.serials ||
                              selectedOrderDetails.content ||
                              selectedOrderDetails,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LOOKUP TOOL */}
          {activeTab === "lookup" && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-sm text-foreground">Công Cụ Tra Cứu Đơn Hàng Dino</h4>
                <p className="text-xs text-muted-foreground">
                  Tra cứu chi tiết đơn hàng và tài khoản bàn giao từ máy chủ Dino theo mã đơn hoặc mã đối tác
                </p>
              </div>

              <form onSubmit={handleLookup} className="space-y-3 p-4 rounded-xl bg-secondary/20 border border-border">
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="lookupType"
                      checked={lookupType === "by-ref"}
                      onChange={() => setLookupType("by-ref")}
                      className="accent-primary"
                    />
                    <span>Tra theo Mã Shop (partner_ref)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="lookupType"
                      checked={lookupType === "by-code"}
                      onChange={() => setLookupType("by-code")}
                      className="accent-primary"
                    />
                    <span>Tra theo Mã đơn Dino (order_code)</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={lookupQuery}
                      onChange={(e) => setLookupQuery(e.target.value)}
                      placeholder={lookupType === "by-ref" ? "Ví dụ: ORD-1730567890 hoặc mã đơn web bạn" : "Ví dụ: ORD_987654"}
                      className="w-full py-2.5 px-3 rounded-xl bg-card border border-border text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={lookupLoading || !lookupQuery.trim()}
                    className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Search className={`size-3.5 ${lookupLoading ? "animate-spin" : ""}`} />
                    <span>{lookupLoading ? "Đang tra..." : "Tra cứu"}</span>
                  </button>
                </div>
              </form>

              {lookupError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              {lookupResult && (
                <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="font-bold text-sm text-foreground">Kết quả tra cứu</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {lookupResult.status || "Thành công"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Mã đơn Dino:</span>{" "}
                      <span className="font-mono font-bold text-foreground">
                        {lookupResult.order_code || lookupResult.id || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mã đối tác:</span>{" "}
                      <span className="font-mono font-bold text-foreground">
                        {lookupResult.partner_ref || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sản phẩm:</span>{" "}
                      <span className="font-medium text-foreground">
                        {lookupResult.product_name || lookupResult.product_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Số lượng:</span>{" "}
                      <span className="font-medium text-foreground">{lookupResult.quantity || 1}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground font-semibold">Dữ liệu bàn giao (Key / Serial):</span>
                    <pre className="mt-1 p-3 rounded-lg bg-secondary/40 border border-border font-mono text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                      {JSON.stringify(
                        lookupResult.items ||
                          lookupResult.credentials ||
                          lookupResult.serials ||
                          lookupResult.content ||
                          lookupResult,
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CATALOG & TEST BUY */}
          {activeTab === "catalog" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 max-w-sm">
                  <input
                    type="text"
                    value={catalogFilter}
                    onChange={(e) => setCatalogFilter(e.target.value)}
                    placeholder="Tìm sản phẩm Dino theo tên, mã..."
                    className="w-full py-2 px-3 rounded-xl bg-card border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadCatalog}
                  disabled={catalogLoading}
                  className="py-1.5 px-3 rounded-lg border border-border hover:bg-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`size-3.5 ${catalogLoading ? "animate-spin" : ""}`} />
                  <span>Tải lại catalog</span>
                </button>
              </div>

              {buyResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    buyResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  }`}
                >
                  {buyResult.success ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
                  <span>{buyResult.message}</span>
                </div>
              )}

              {catalogLoading ? (
                <div className="py-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="size-6 animate-spin text-emerald-400" />
                  <span>Đang tải danh mục từ Dino...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                  {catalogItems
                    .filter((item) =>
                      catalogFilter ? item.name.toLowerCase().includes(catalogFilter.toLowerCase()) || item.product_id.includes(catalogFilter) : true
                    )
                    .map((item) => (
                      <div
                        key={item.product_id}
                        className="p-3.5 rounded-xl bg-card border border-border flex flex-col justify-between space-y-2 hover:border-emerald-500/40 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              #{item.product_id}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                item.available !== false && item.stock_status !== "out_of_stock"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-rose-500/10 text-rose-400"
                              }`}
                            >
                              {item.available !== false && item.stock_status !== "out_of_stock" ? "Còn hàng" : "Hết hàng"}
                            </span>
                          </div>
                          <h5 className="font-bold text-xs text-foreground mt-1 line-clamp-1">{item.name}</h5>
                          {item.duration && (
                            <span className="text-[11px] text-muted-foreground block">
                              Thời hạn: {item.duration} · Bảo hành: {item.warranty || "Theo gói"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/60">
                          <span className="font-mono font-bold text-emerald-400 text-xs">
                            {item.price.toLocaleString("vi-VN")} đ
                          </span>
                          <button
                            type="button"
                            onClick={() => handleTestBuy(item)}
                            disabled={buyingProductId === item.product_id}
                            className="py-1 px-2.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <ArrowRight className={`size-3 ${buyingProductId === item.product_id ? "animate-spin" : ""}`} />
                            <span>{buyingProductId === item.product_id ? "Đang đặt..." : "Mua thử"}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-border/80 bg-secondary/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Chuẩn giao tiếp: REST API v2 (api.abcxy.store)</span>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl border border-border bg-card hover:bg-secondary text-foreground font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
