"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { KeyRound, UploadCloud, Trash2 } from "lucide-react"

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
        title: "Nạp kho thành công!",
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
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Upload Form */}
      <Card className="lg:col-span-2 border-border/80 bg-card/60 backdrop-blur shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <UploadCloud className="size-4 text-primary" />
            <span>Nạp Kho Tự Động</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Mỗi dòng tương ứng 1 tài khoản hoặc 1 key (VD: <code>tk|mk|2fa</code>)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Chọn Gói Sản Phẩm</label>
              <select
                className="w-full rounded-xl border border-border/80 bg-background/50 px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              <label className="text-xs font-semibold text-muted-foreground">Danh Sách Serials / Tài Khoản</label>
              <Textarea
                rows={8}
                placeholder={`mail1@gmail.com|pass1|2fa1&#10;mail2@gmail.com|pass2|2fa2&#10;https://redeem.com/link-1`}
                value={serialsText}
                onChange={(e) => setSerialsText(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Số lượng nạp dự kiến: {serialsText.split("\n").filter(l => l.trim().length > 0).length}
              </p>
            </div>

            <Button type="submit" className="w-full font-bold" disabled={loading}>
              {loading ? "Đang nạp kho..." : "Xác nhận nạp kho"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Serials Table */}
      <Card className="lg:col-span-3 border-border/80 bg-card/60 backdrop-blur shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <KeyRound className="size-4 text-emerald-400" />
            <span>Kho Serials Gần Đây</span>
          </CardTitle>
          <CardDescription className="text-xs">Danh sách 50 serials mới nhất trong hệ thống</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {recentSerials.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Chưa có serials nào trong kho.</p>
            ) : (
              recentSerials.map((s) => (
                <div key={s.id} className="p-3 rounded-xl border border-border/60 bg-background/50 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[11px] text-muted-foreground">{s.productVariant}</p>
                    <p className="font-mono text-xs font-bold text-foreground truncate mt-0.5">{s.content}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.status === "available"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {s.status === "available" ? "Sẵn sàng" : "Đã bán"}
                    </span>
                    {s.status === "available" && (
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Xóa serial"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
