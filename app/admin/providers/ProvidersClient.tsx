"use client"

import { useState } from "react"
import { 
  Plus, 
  Globe, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Wallet, 
  Layers, 
  Trash2, 
  Edit3, 
  Key, 
  X,
  Play,
  Zap,
  Bot,
  Sparkles
} from "lucide-react"
import { DinoHubModal } from "./DinoHubModal"

interface ProviderConnectionItem {
  id: string
  name: string
  provider: string
  baseUrl: string
  apiKeyMasked: string
  isEnabled: boolean
  balanceVnd: number
  balanceUsdt: number
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  sourceCount: number
  variantCount: number
}

interface TestResult {
  ok: boolean
  balanceVnd?: number
  balanceUsdt?: number
  productCount?: number
  error?: string
}

interface ConnectionTestState {
  status: "idle" | "testing" | "success" | "failed"
  message?: string
  error?: string
  balanceVnd?: number | null
  balanceUsdt?: number | null
  balanceStatus?: "supported" | "unsupported" | "error"
  checkedAt?: string
}

export function ProvidersClient({ initialConnections }: { initialConnections: ProviderConnectionItem[] }) {
  const [connections, setConnections] = useState<ProviderConnectionItem[]>(initialConnections)
  const [loading, setLoading] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [testStates, setTestStates] = useState<Record<string, ConnectionTestState>>({})

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [dinoModalOpen, setDinoModalOpen] = useState(false)
  const [selectedDinoConnName, setSelectedDinoConnName] = useState("Dino Store")
  const [editingConn, setEditingConn] = useState<ProviderConnectionItem | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    provider: "dino",
    baseUrl: "https://api.abcxy.store",
    apiKey: "",
    isEnabled: true,
  })

  // Live test inside modal
  const [modalTesting, setModalTesting] = useState(false)
  const [modalTestResult, setModalTestResult] = useState<TestResult | null>(null)
  const [autoSyncOnSave, setAutoSyncOnSave] = useState(true)

  const refreshConnections = async () => {
    try {
      const res = await fetch("/api/admin/providers")
      if (res.ok) {
        const data = await res.json()
        setConnections(data.connections || [])
      }
    } catch {
      // silent
    }
  }

  const selectPreset = (type: "fatcat" | "dino" | "shoptool" | "custom") => {
    setModalTestResult(null)
    if (type === "fatcat") {
      setFormData((prev) => ({
        ...prev,
        provider: "fatcat",
        baseUrl: "https://api.fatcatstore.click",
        name: prev.name.trim() ? prev.name : "FatCat Store",
      }))
    } else if (type === "dino") {
      setFormData((prev) => ({
        ...prev,
        provider: "dino",
        baseUrl: "https://api.abcxy.store",
        name: prev.name.trim() ? prev.name : "Dino Store",
      }))
    } else if (type === "shoptool") {
      setFormData((prev) => ({
        ...prev,
        provider: "shoptool",
        baseUrl: "https://shoptoolgiare.com/api/v1",
        name: prev.name.trim() ? prev.name : "ShopTool Giá Rẻ",
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        provider: "custom",
        baseUrl: prev.baseUrl === "https://api.fatcatstore.click" || prev.baseUrl === "https://api.abcxy.store" || prev.baseUrl.includes("shoptoolgiare") ? "https://" : prev.baseUrl,
        name: prev.name.trim() ? prev.name : "Đại Lý Mới",
      }))
    }
  }

  const openCreateModal = () => {
    setEditingConn(null)
    setFormData({
      name: "Dino Store",
      provider: "dino",
      baseUrl: "https://api.abcxy.store",
      apiKey: "",
      isEnabled: true,
    })
    setModalTestResult(null)
    setAutoSyncOnSave(true)
    setIsModalOpen(true)
  }

  const openEditModal = (conn: ProviderConnectionItem) => {
    setEditingConn(conn)
    setFormData({
      name: conn.name,
      provider: conn.provider,
      baseUrl: conn.baseUrl,
      apiKey: "", // leave empty to keep existing key
      isEnabled: conn.isEnabled,
    })
    setModalTestResult(null)
    setAutoSyncOnSave(false)
    setIsModalOpen(true)
  }

  const handleModalLiveTest = async () => {
    if (!formData.baseUrl || (!formData.apiKey && !editingConn)) {
      setModalTestResult({
        ok: false,
        error: "Vui lòng nhập Địa chỉ URL API và Khóa API để kiểm tra",
      })
      return
    }

    setModalTesting(true)
    setModalTestResult(null)

    try {
      // If editing and key field is empty, test via existing connection ID
      if (editingConn && !formData.apiKey) {
        const res = await fetch(`/api/admin/providers/${editingConn.id}/test`, { method: "POST" })
        const data = await res.json()
        setModalTestResult({
          ok: Boolean(data.ok || data.success),
          balanceVnd: data.balanceVnd,
          balanceUsdt: data.balanceUsdt,
          productCount: data.productCount,
          error: data.error,
        })
        return
      }

      // Pre-save test
      const res = await fetch("/api/admin/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: formData.provider,
          baseUrl: formData.baseUrl,
          apiKey: formData.apiKey,
        }),
      })

      const data = await res.json()
      setModalTestResult({
        ok: Boolean(data.ok || data.success),
        balanceVnd: data.balanceVnd,
        balanceUsdt: data.balanceUsdt,
        productCount: data.productCount,
        error: data.error,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kiểm tra"
      setModalTestResult({ ok: false, error: msg })
    } finally {
      setModalTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const isEditing = Boolean(editingConn)
      const url = isEditing ? `/api/admin/providers/${editingConn!.id}` : "/api/admin/providers"
      const method = isEditing ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (res.ok) {
        const savedConnId = data.connection?.id || editingConn?.id
        setIsModalOpen(false)

        // Auto sync if requested
        if (autoSyncOnSave && savedConnId) {
          setMessage({
            text: isEditing
              ? "Đã cập nhật! Đang tự động đồng bộ danh mục..."
              : "Đã thêm đại lý mới! Đang tự động đồng bộ danh mục...",
            type: "success",
          })
          handleSyncConnection(savedConnId)
        } else {
          setMessage({
            text: isEditing ? "Đã cập nhật kết nối đại lý thành công!" : "Đã thêm kết nối đại lý mới thành công!",
            type: "success",
          })
          refreshConnections()
        }
      } else {
        setMessage({ text: data.error || "Thao tác thất bại", type: "error" })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối"
      setMessage({ text: msg, type: "error" })
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async (id: string) => {
    const conn = connections.find((c) => c.id === id)
    const connName = conn ? conn.name : id

    setTestingId(id)
    setTestStates((prev) => ({
      ...prev,
      [id]: { status: "testing" },
    }))

    try {
      const res = await fetch(`/api/admin/providers/${id}/test`, { method: "POST" })
      const data = await res.json()
      const isSuccess = res.ok && (data.ok || data.success)

      const timeStr = new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })

      if (isSuccess) {
        setTestStates((prev) => ({
          ...prev,
          [id]: {
            status: "success",
            message: data.message || "Kết nối hoạt động tốt",
            balanceVnd: data.balanceVnd,
            balanceUsdt: data.balanceUsdt,
            balanceStatus: data.balanceStatus,
            checkedAt: timeStr,
          },
        }))

        const balanceStr =
          data.balanceStatus === "unsupported"
            ? "Không hỗ trợ tra cứu ví"
            : typeof data.balanceVnd === "number"
            ? `${data.balanceVnd.toLocaleString("vi-VN")} đ${data.balanceUsdt ? ` (${data.balanceUsdt} USDT)` : ""}`
            : "0 đ"

        setMessage({
          type: "success",
          text: `Kiểm tra kết nối "${connName}" thành công! Số dư ví: ${balanceStr}`,
        })
        refreshConnections()
      } else {
        const errMsg = data.error || "Kiểm tra kết nối thất bại"
        setTestStates((prev) => ({
          ...prev,
          [id]: {
            status: "failed",
            error: errMsg,
            checkedAt: timeStr,
          },
        }))
        setMessage({
          type: "error",
          text: `Kiểm tra kết nối "${connName}" thất bại: ${errMsg}`,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi mạng khi kiểm tra kết nối"
      setTestStates((prev) => ({
        ...prev,
        [id]: {
          status: "failed",
          error: msg,
          checkedAt: new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      }))
      setMessage({ type: "error", text: `Lỗi mạng khi kiểm tra kết nối "${connName}": ${msg}` })
    } finally {
      setTestingId(null)
    }
  }

  const handleSyncConnection = async (id: string) => {
    const conn = connections.find((c) => c.id === id)
    const connName = conn ? conn.name : id

    setSyncingId(id)
    try {
      const res = await fetch(`/api/admin/providers/${id}/sync`, { method: "POST" })
      const data = await res.json()
      if (res.ok && (data.ok || data.success)) {
        setMessage({
          type: "success",
          text: `Đồng bộ hoàn tất (${data.connectionName || connName}): +${data.newCount} sản phẩm mới, cập nhật ${data.updatedCount}. Tổng ${data.totalSourceProducts} sản phẩm trong nguồn!`,
        })
        refreshConnections()
      } else {
        setMessage({
          type: "error",
          text: `Đồng bộ "${connName}" thất bại: ${data.error || "Vui lòng kiểm tra lại trạng thái API đại lý."}`,
        })
      }
    } catch {
      setMessage({ type: "error", text: `Lỗi mạng khi gọi đồng bộ "${connName}"` })
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa kết nối đại lý "${name}"? Toàn bộ sản phẩm nguồn liên kết chưa đăng bán sẽ bị xóa.`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/providers/${id}`, { method: "DELETE" })
      if (res.ok) {
        setMessage({ type: "success", text: `Đã xóa kết nối "${name}"` })
        refreshConnections()
      } else {
        const data = await res.json()
        setMessage({ type: "error", text: data.error || "Xóa thất bại" })
      }
    } catch {
      setMessage({ type: "error", text: "Lỗi khi xóa kết nối" })
    }
  }

  const formatMoney = (vnd: number) => {
    return `${vnd.toLocaleString("vi-VN")} đ`
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-in fade-in-50 duration-200 ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span>Danh Sách Kết Nối Đại Lý</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-secondary border border-border text-foreground font-mono">
              {connections.length}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cấu hình các cổng API nhà cung cấp độc lập (FatCat, Dino Store, Telegram Bot hoặc REST tùy chỉnh)
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all shadow-sm shadow-primary/20"
        >
          <Plus className="size-4" />
          <span>Thêm đại lý mới</span>
        </button>
      </div>

      {/* Connection Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connections.map((c) => {
          const isDino = c.provider === "dino" || c.name.toLowerCase().includes("dino")
          const isFatcat = c.provider === "fatcat"
          const isShopTool = c.provider === "shoptool" || c.provider === "shoptoolgiare" || c.name.toLowerCase().includes("shoptool")

          return (
            <div
              key={c.id}
              className={`p-5 rounded-2xl border bg-card space-y-4 transition-all relative overflow-hidden ${
                c.isEnabled ? "border-border shadow-sm hover:border-border/80" : "border-border/50 opacity-60"
              }`}
            >
              {/* Header info */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">{c.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 ${
                        isShopTool
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : isDino
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : isFatcat
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                      }`}
                    >
                      {isShopTool && <Zap className="size-2.5 text-amber-400" />}
                      {isDino && <Sparkles className="size-2.5" />}
                      {isFatcat && <Zap className="size-2.5" />}
                      {!isDino && !isFatcat && !isShopTool && <Bot className="size-2.5" />}
                      <span>{c.provider}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                    <Globe className="size-3 shrink-0" />
                    <span className="truncate max-w-[280px]">{c.baseUrl}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(c)}
                    className="p-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs transition-colors"
                    title="Chỉnh sửa cấu hình"
                  >
                    <Edit3 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id, c.name)}
                    className="p-1.5 rounded-lg border border-border bg-card hover:bg-destructive/10 text-destructive text-xs transition-colors"
                    title="Xóa kết nối"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* API Key Masked & Status */}
              <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/80 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Key className="size-3.5" />
                    <span>Khóa API:</span>
                  </div>
                  <span className="font-mono text-[11px] text-foreground bg-background px-2 py-0.5 rounded border border-border">
                    {c.apiKeyMasked}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="size-3.5" />
                    <span>Số dư ví chung:</span>
                  </div>
                  {testStates[c.id]?.balanceStatus === "unsupported" ? (
                    <span className="text-muted-foreground text-xs italic">
                      Không hỗ trợ tra cứu ví
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-foreground font-mono text-sm">
                        {formatMoney(
                          testStates[c.id]?.balanceVnd !== undefined && testStates[c.id]?.balanceVnd !== null
                            ? testStates[c.id].balanceVnd!
                            : c.balanceVnd
                        )}
                      </span>
                      {c.balanceUsdt > 0 && (
                        <span className="text-xs text-muted-foreground font-mono">
                          ({c.balanceUsdt} USDT)
                        </span>
                      )}
                      {testStates[c.id]?.status === "success" && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                          Đã xác minh
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Row 1: Connection Health Check */}
              <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1">
                  <span>Trạng thái kết nối:</span>
                </span>
                <div>
                  {testStates[c.id]?.status === "testing" && (
                    <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                      <RefreshCw className="size-3 animate-spin" />
                      Đang kiểm tra...
                    </span>
                  )}
                  {testStates[c.id]?.status === "success" && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20" title={testStates[c.id]?.message}>
                      <CheckCircle2 className="size-3" />
                      Hoạt động tốt {testStates[c.id]?.checkedAt ? `(${testStates[c.id]?.checkedAt})` : ""}
                    </span>
                  )}
                  {testStates[c.id]?.status === "failed" && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20" title={testStates[c.id]?.error}>
                      <AlertCircle className="size-3" />
                      Lỗi kết nối {testStates[c.id]?.checkedAt ? `(${testStates[c.id]?.checkedAt})` : ""}
                    </span>
                  )}
                  {(!testStates[c.id] || testStates[c.id]?.status === "idle") && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full border border-border">
                      <span className={`size-1.5 rounded-full ${c.isEnabled ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                      {c.isEnabled ? "Sẵn sàng (Chưa kiểm tra)" : "Đang tắt"}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Row 2: Catalog Stats & Sync Status */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Layers className="size-3.5 text-blue-400" />
                    <span className="font-semibold text-foreground">{c.sourceCount}</span> sản phẩm nguồn
                  </span>
                  <span>·</span>
                  <span><span className="font-semibold text-foreground">{c.variantCount}</span> gói web</span>
                </div>

                <div>
                  {c.lastSyncStatus === "success" && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20" title={c.lastSyncedAt ? `Đồng bộ lúc: ${new Date(c.lastSyncedAt).toLocaleString('vi-VN')}` : undefined}>
                      <CheckCircle2 className="size-3" />
                      Đã đồng bộ
                    </span>
                  )}
                  {c.lastSyncStatus === "failed" && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20" title={c.lastSyncError || ""}>
                      <AlertCircle className="size-3" />
                      Lỗi đồng bộ
                    </span>
                  )}
                  {(!c.lastSyncStatus || c.lastSyncStatus === "warning") && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      Chưa đồng bộ
                    </span>
                  )}
                </div>
              </div>

              {/* Actions: Test & Sync */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => handleTestConnection(c.id)}
                  disabled={testingId === c.id || syncingId === c.id}
                  className="py-2 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Play className={`size-3.5 ${testingId === c.id ? "animate-spin" : ""}`} />
                  <span>{testingId === c.id ? "Đang thử..." : "Kiểm tra kết nối"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSyncConnection(c.id)}
                  disabled={syncingId === c.id || testingId === c.id || !c.isEnabled}
                  className="py-2 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`size-3.5 ${syncingId === c.id ? "animate-spin" : ""}`} />
                  <span>{syncingId === c.id ? "Đang đồng bộ..." : "Đồng bộ danh mục"}</span>
                </button>
              </div>

              {isDino && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDinoConnName(c.name)
                    setDinoModalOpen(true)
                  }}
                  className="w-full mt-2 py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Bot className="size-4" />
                  <span>Trung tâm Dino (Lệnh Bot & API v2)</span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add / Edit Connection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  {editingConn ? "Cập Nhật Kết Nối Đại Lý" : "Thêm Kết Nối Đại Lý Mới"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Hỗ trợ tự động nhận diện chuẩn API v2, FatCat và Telegram Bot REST API
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Presets Bar (Chỉ hiển thị khi tạo mới) */}
            {!editingConn && (
              <div className="p-3 bg-secondary/20 border-b border-border/80">
                <span className="block text-[11px] font-semibold text-muted-foreground mb-2">
                  ⚡ Chọn nhanh mẫu đại lý có sẵn:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => selectPreset("shoptool")}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      formData.provider === "shoptool"
                        ? "bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm"
                        : "bg-card border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Zap className="size-3.5 text-amber-400" />
                    <span>ShopTool</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectPreset("dino")}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      formData.provider === "dino"
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm"
                        : "bg-card border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="size-3.5 text-emerald-400" />
                    <span>Dino Store</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectPreset("fatcat")}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      formData.provider === "fatcat"
                        ? "bg-purple-500/15 border-purple-500/50 text-purple-300 shadow-sm"
                        : "bg-card border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Zap className="size-3.5 text-purple-400" />
                    <span>FatCat Store</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectPreset("custom")}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      formData.provider === "custom"
                        ? "bg-blue-500/15 border-blue-500/50 text-blue-300 shadow-sm"
                        : "bg-card border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Bot className="size-3.5 text-blue-400" />
                    <span>Đại lý khác</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              {/* Preset Info Hint */}
              <div className="p-2.5 rounded-xl bg-secondary/50 border border-border/80 text-[11px] space-y-1 text-muted-foreground">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span>Quy chuẩn kết nối:</span>
                  <span className="uppercase text-primary font-mono">{formData.provider}</span>
                </div>
                {formData.provider === "shoptool" && (
                  <p>• Dùng Header: <code className="text-amber-400 font-mono">Authorization: Bearer tg_sk_...</code> · Tự động đọc số dư/credit qua <code className="text-foreground font-mono">/api/v1/account</code> và lấy hàng qua <code className="text-foreground font-mono">/api/v1/products</code> (Buff Token & Kho Muse AI)</p>
                )}
                {formData.provider === "dino" && (
                  <p>• Dùng Header: <code className="text-emerald-400 font-mono">x-api-key: token_...</code> · Tự động đọc số dư qua <code className="text-foreground font-mono">/api/v2/me</code> và lấy hàng qua <code className="text-foreground font-mono">/api/v2/catalog</code></p>
                )}
                {formData.provider === "fatcat" && (
                  <p>• Dùng Header: <code className="text-purple-400 font-mono">X-API-Key: mb_...</code> · Tự động đọc số dư qua <code className="text-foreground font-mono">/api/balance</code> và lấy hàng qua <code className="text-foreground font-mono">/api/products</code></p>
                )}
                {formData.provider === "custom" && (
                  <p>• Tự động quét và nhận diện các đường dẫn chuẩn (/api/v2/me, /api/balance, /api/v2/catalog, /api/products). Hỗ trợ mọi bot Telegram có REST API.</p>
                )}
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Tên đại lý gợi nhớ *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Dino Store hoặc FatCat Store"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Địa chỉ API Base URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.abcxy.store"
                  value={formData.baseUrl}
                  onChange={(e) => {
                    setFormData({ ...formData, baseUrl: e.target.value })
                    setModalTestResult(null)
                  }}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-muted-foreground font-medium">
                    Khóa bí mật API Key * {editingConn && <span className="text-[10px] text-muted-foreground font-normal">(để trống nếu giữ nguyên)</span>}
                  </label>
                  <button
                    type="button"
                    onClick={handleModalLiveTest}
                    disabled={modalTesting || (!formData.apiKey && !editingConn)}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 disabled:opacity-40"
                  >
                    <Play className={`size-3 ${modalTesting ? "animate-spin" : ""}`} />
                    <span>{modalTesting ? "Đang thử..." : "Thử kết nối ngay"}</span>
                  </button>
                </div>
                <input
                  type="password"
                  required={!editingConn}
                  placeholder={editingConn ? editingConn.apiKeyMasked : "Ví dụ: api_token_... hoặc key_..."}
                  value={formData.apiKey}
                  onChange={(e) => {
                    setFormData({ ...formData, apiKey: e.target.value })
                    setModalTestResult(null)
                  }}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Live Test Feedback inside Modal */}
              {modalTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium space-y-1 animate-in fade-in-50 duration-150 ${
                    modalTestResult.ok
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {modalTestResult.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
                    <span>{modalTestResult.ok ? "Kết nối đại lý thành công!" : "Kiểm tra kết nối thất bại"}</span>
                  </div>
                  {modalTestResult.ok ? (
                    <div className="text-[11px] text-emerald-300 space-y-0.5 pl-5">
                      <p>• Số dư ví chung: <strong className="font-mono text-emerald-200">{formatMoney(modalTestResult.balanceVnd || 0)}</strong></p>
                      {modalTestResult.productCount !== undefined && modalTestResult.productCount > 0 && (
                        <p>• Sẵn sàng tải: <strong className="font-mono text-emerald-200">{modalTestResult.productCount}</strong> sản phẩm từ đại lý</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] pl-5 opacity-90">{modalTestResult.error}</p>
                  )}
                </div>
              )}

              {/* Auto Sync On Save Checkbox */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoSyncOnSave"
                    checked={autoSyncOnSave}
                    onChange={(e) => setAutoSyncOnSave(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="autoSyncOnSave" className="text-xs font-medium text-foreground cursor-pointer">
                    Tự động đồng bộ sản phẩm từ đại lý ngay sau khi lưu
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                    className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="isEnabled" className="text-xs text-muted-foreground cursor-pointer">
                    Kích hoạt đại lý này cho cửa hàng
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 disabled:opacity-50 shadow-sm"
                >
                  {loading ? "Đang lưu..." : "Lưu kết nối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dino Store API v2 & Bot Hub Modal */}
      <DinoHubModal
        isOpen={dinoModalOpen}
        onClose={() => setDinoModalOpen(false)}
        connectionName={selectedDinoConnName}
      />
    </div>
  )
}
