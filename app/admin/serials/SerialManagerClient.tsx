"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { KeyRound, UploadCloud, Trash2, Eye, EyeOff, Copy, Check } from "lucide-react"

interface VariantOption {
  id: string
  name: string
}

interface SerialItem {
  id: string
  content: string
  status: string
  productVariant: string
  createdAt: string
}

function maskSerialContent(raw: string): string {
  if (!raw) return "••••••"
  if (raw.length <= 6) return "••••••"
  return `${raw.slice(0, 3)}••••••${raw.slice(-3)}`
}

export function SerialManagerClient({
  variants,
  recentSerials,
}: {
  variants: VariantOption[]
  recentSerials: SerialItem[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || "")
  const [serialsText, setSerialsText] = useState("")
  const [loading, setLoading] = useState(false)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())
  const [revealAll, setRevealAll] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const lineCount = serialsText
    .split("\n")
    .filter((l) => l.trim().length > 0).length

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
    toast({ title: "Đã sao chép nội dung serial" })
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVariantId || !serialsText.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/admin/serials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: selectedVariantId, serialsText }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Nạp serials thất bại")

      toast({
        title: "Nạp kho thành công",
        description: `Đã nạp ${data.count} serials vào kho.`,
        variant: "default",
      })

      setSerialsText("")
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nạp serials thất bại"
      toast({
        title: "Lỗi",
        description: msg,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (serialId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa serial này khỏi kho?")) return

    try {
      const res = await fetch("/api/admin/serials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialId }),
      })

      if (!res.ok) throw new Error("Xóa thất bại")
      toast({ title: "Đã xóa serial", variant: "default" })
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Xóa thất bại"
      toast({ title: "Lỗi", description: msg, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground font-semibold">Lưu ý phân biệt:</strong>{" "}
        Trang này dùng để <strong className="text-foreground font-medium">nạp tài khoản / mã kích hoạt vào kho giao tự động</strong>. Nếu bạn muốn ghi nhận chi phí nhập hàng để trừ vào doanh thu ngày, hãy sử dụng mục <strong className="text-foreground font-medium">Đơn hàng → Nhập hàng theo ngày</strong>.
      </div>

      {/* items-start prevents the upload form from stretching vertically to match the serial list */}
      <div className="grid gap-6 lg:grid-cols-5 items-start">
        {/* Upload Form */}
        <Card className="lg:col-span-2 border-border bg-card rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UploadCloud className="size-4 text-primary" />
              <span>Nạp kho tự động</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Mỗi dòng tương ứng 1 tài khoản hoặc 1 mã (VD: <code>tk|mk|2fa</code>)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="serial-variant-select" className="text-xs font-semibold text-muted-foreground block">
                  Chọn gói sản phẩm
                </label>
                <select
                  id="serial-variant-select"
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id} className="bg-card text-foreground">
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="serial-textarea" className="text-xs font-semibold text-muted-foreground block">
                  Danh sách serial / tài khoản
                </label>
                <Textarea
                  id="serial-textarea"
                  rows={8}
                  placeholder={"mail1@gmail.com|pass1|2fa1\nmail2@gmail.com|pass2|2fa2\nhttps://redeem.com/link-1"}
                  value={serialsText}
                  onChange={(e) => setSerialsText(e.target.value)}
                  className="font-mono text-xs rounded-xl bg-background border-border"
                  required
                />
                <p className="text-xs text-muted-foreground tabular-nums">
                  Số lượng nạp dự kiến: <strong className="text-foreground">{lineCount}</strong> dòng
                </p>
              </div>

              <Button type="submit" className="w-full h-11 rounded-xl font-semibold" disabled={loading || lineCount === 0}>
                {loading ? "Đang nạp kho..." : "Xác nhận nạp kho"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Serials List */}
        <Card className="lg:col-span-3 border-border bg-card rounded-2xl">
          <CardHeader className="pb-4 flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <KeyRound className="size-4 text-emerald-400" />
                <span>Kho serial gần đây</span>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                50 serial mới nhất (mặc định che nội dung nhạy cảm)
              </CardDescription>
            </div>
            {recentSerials.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRevealAll((prev) => !prev)}
                className="h-8 px-2.5 rounded-lg text-xs shrink-0"
              >
                {revealAll ? <EyeOff className="size-3.5 mr-1.5" /> : <Eye className="size-3.5 mr-1.5" />}
                <span>{revealAll ? "Ẩn tất cả" : "Hiện tất cả"}</span>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/70 border border-border rounded-xl overflow-hidden max-h-[540px] overflow-y-auto">
              {recentSerials.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">Chưa có serial nào trong kho.</p>
              ) : (
                recentSerials.map((s) => {
                  const isRevealed = revealAll || revealedIds.has(s.id)
                  return (
                    <div
                      key={s.id}
                      className="p-3 bg-background/40 hover:bg-secondary/40 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs text-muted-foreground break-words">
                          {s.productVariant}
                        </p>
                        <p className="font-mono text-xs text-foreground break-all mt-1">
                          {isRevealed ? s.content : maskSerialContent(s.content)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${
                            s.status === "available"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {s.status === "available" ? "Sẵn sàng" : "Đã bán"}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleReveal(s.id)}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn cursor-pointer"
                          title={isRevealed ? "Ẩn nội dung" : "Hiện nội dung"}
                          aria-label={isRevealed ? "Ẩn nội dung serial" : "Hiện nội dung serial"}
                        >
                          {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(s.id, s.content)}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-btn cursor-pointer"
                          title="Sao chép serial"
                          aria-label="Sao chép nội dung serial"
                        >
                          {copiedId === s.id ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                        </button>
                        {s.status === "available" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-btn cursor-pointer"
                            title="Xóa serial"
                            aria-label="Xóa serial khỏi kho"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
