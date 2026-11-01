"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { ShieldCheck, Lock, User, Loader2 } from "lucide-react"

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Đăng nhập thất bại")
      }

      router.push("/admin")
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-2">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Cổng Quản Trị Viên</h1>
          <p className="text-xs text-muted-foreground">Đăng nhập để quản lý đơn hàng, kho serials và sản phẩm</p>
        </div>

        <Card className="border-border/80 bg-card/60 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-bold">Xác thực hệ thống</CardTitle>
            <CardDescription className="text-xs">
              Mặc định: <code>admin</code> / <code>admin123</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Tài khoản</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Tên đăng nhập"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full font-bold" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {loading ? "Đang xác thực..." : "Đăng nhập Admin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
