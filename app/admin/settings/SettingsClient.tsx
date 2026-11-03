"use client"

import { useState, useId, useRef, useTransition } from "react"
import { 
  Building2, 
  Upload, 
  Trash2, 
  RotateCcw, 
  Save, 
  Smartphone, 
  Monitor, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Loader2,
  Image as ImageIcon,
  ShieldCheck,
  X
} from "lucide-react"

interface InitialSettings {
  siteName: string
  logoUrl: string | null
  version: number
  updatedAt: string | null
}

function computeClientInitials(name: string): string {
  const clean = (name || "").trim()
  if (!clean) return "AG"
  if (clean.toUpperCase() === "ACCGIARE") return "AG"

  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    const first = Array.from(words[0])[0] || ""
    const second = Array.from(words[1])[0] || ""
    return (first + second).toUpperCase()
  }

  const single = words[0]
  const upperMatches = single.match(/[A-ZÀ-Ỹ]/g)
  if (upperMatches && upperMatches.length >= 2) {
    return (upperMatches[0] + upperMatches[1]).toUpperCase()
  }

  return Array.from(single).slice(0, 2).join("").toUpperCase()
}

export function SettingsClient({ initialData }: { initialData: InitialSettings }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [, startTransition] = useTransition()

  // Saved state
  const [savedData, setSavedData] = useState<InitialSettings>(initialData)

  // Working state
  const [siteName, setSiteName] = useState(initialData.siteName)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialData.logoUrl)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [isRemovingLogo, setIsRemovingLogo] = useState(false)

  // UI state
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const siteNameInputId = useId()

  // Calculate live initials
  const liveInitials = computeClientInitials(siteName)

  // Current effective logo for preview
  const currentEffectiveLogo = isRemovingLogo
    ? null
    : localPreviewUrl || logoUrl

  // Validation
  const trimmedName = siteName.trim()
  const nameError =
    trimmedName.length === 0
      ? "Tên website là bắt buộc."
      : trimmedName.length < 2
      ? "Tên website phải có ít nhất 2 ký tự."
      : trimmedName.length > 60
      ? "Tên website không được vượt quá 60 ký tự."
      : /[<>]/.test(trimmedName)
      ? "Tên website không được chứa ký tự < hoặc >."
      : null

  // Dirty detection
  const isDirty =
    trimmedName !== savedData.siteName ||
    selectedFile !== null ||
    isRemovingLogo !== (savedData.logoUrl === null && isRemovingLogo) ||
    (isRemovingLogo && savedData.logoUrl !== null) ||
    logoUrl !== savedData.logoUrl

  const canSave = isDirty && !nameError && !isSaving

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side checks
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Tệp quá lớn. Dung lượng tối đa cho phép là 5MB." })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const validTypes = ["image/png", "image/jpeg", "image/webp"]
    if (!validTypes.includes(file.type)) {
      setFeedback({ type: "error", message: "Định dạng không được hỗ trợ. Vui lòng chọn ảnh PNG, JPG hoặc WebP." })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    // Revoke previous local object URL if any
    if (localPreviewUrl && localPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(localPreviewUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setSelectedFile(file)
    setLocalPreviewUrl(objectUrl)
    setIsRemovingLogo(false)
    setFeedback(null)
  }

  // Remove newly picked file before saving
  const handleDiscardPickedFile = () => {
    if (localPreviewUrl && localPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(localPreviewUrl)
    }
    setSelectedFile(null)
    setLocalPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Remove avatar altogether (revert to initials)
  const handleRemoveAvatar = () => {
    handleDiscardPickedFile()
    setIsRemovingLogo(true)
    setLogoUrl(null)
  }

  // Revert all unsaved changes
  const handleReset = () => {
    handleDiscardPickedFile()
    setSiteName(savedData.siteName)
    setLogoUrl(savedData.logoUrl)
    setIsRemovingLogo(false)
    setFeedback(null)
  }

  // Save changes
  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    setFeedback(null)

    try {
      let finalLogoUrl: string | null = isRemovingLogo ? null : logoUrl

      // If a new file is staged, upload it first
      if (selectedFile) {
        const formData = new FormData()
        formData.append("file", selectedFile)

        const uploadRes = await fetch("/api/admin/settings/upload", {
          method: "POST",
          body: formData,
        })

        const uploadData = await uploadRes.json()
        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(uploadData.error || "Không thể tải ảnh lên máy chủ.")
        }

        finalLogoUrl = uploadData.url
      }

      // Save settings to database
      const saveRes = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: trimmedName,
          logoUrl: finalLogoUrl,
          version: savedData.version,
        }),
      })

      const saveData = await saveRes.json()
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.error || "Không thể lưu cấu hình.")
      }

      const updated = saveData.data
      const newSavedState: InitialSettings = {
        siteName: updated.siteName,
        logoUrl: updated.logoUrl,
        version: updated.version,
        updatedAt: updated.updatedAt || new Date().toISOString(),
      }

      // Cleanup local blob url
      if (localPreviewUrl && localPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl)
      }

      setSavedData(newSavedState)
      setSiteName(newSavedState.siteName)
      setLogoUrl(newSavedState.logoUrl)
      setSelectedFile(null)
      setLocalPreviewUrl(null)
      setIsRemovingLogo(false)

      setFeedback({
        type: "success",
        message: "Cập nhật nhận diện thương hiệu thành công! Thay đổi đã được áp dụng trên toàn bộ website.",
      })

      startTransition(() => {
        // Refresh client cache
      })
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Đã xảy ra lỗi không xác định khi lưu cấu hình.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="size-5 text-accent" />
          Cài đặt website & Nhận diện thương hiệu
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Tùy chỉnh tên cửa hàng và biểu tượng logo hiển thị trên menu, chân trang và tiêu đề website.
        </p>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            feedback.type === "success"
              ? "bg-emerald-950/20 border-emerald-800/50 text-emerald-300"
              : "bg-red-950/25 border-red-800/50 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="size-5 shrink-0 text-red-400 mt-0.5" />
          )}
          <div className="flex-1 text-xs leading-relaxed">
            <span className="font-semibold block mb-0.5">
              {feedback.type === "success" ? "Thao tác thành công" : "Lỗi thực hiện"}
            </span>
            {feedback.message}
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-muted-foreground hover:text-foreground text-xs p-1"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Grid: Settings Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: FORM CÀI ĐẶT */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent font-mono">
                NHẬN DIỆN THƯƠNG HIỆU
              </span>
              {savedData.updatedAt && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  Cập nhật: {new Date(savedData.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{" "}
                  {new Date(savedData.updatedAt).toLocaleDateString("vi-VN")}
                </span>
              )}
            </div>

            {/* Field A: Tên website */}
            <div className="space-y-2">
              <label htmlFor={siteNameInputId} className="block text-xs font-semibold text-foreground">
                Tên website <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  id={siteNameInputId}
                  type="text"
                  value={siteName}
                  onChange={(e) => {
                    setSiteName(e.target.value)
                    setFeedback(null)
                  }}
                  maxLength={60}
                  placeholder="Ví dụ: ACCGIARE, CapyGo, Cửa Hàng Số..."
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-secondary/60 border text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                    nameError ? "border-red-500/80 focus:border-red-500" : "border-border/80 focus:border-accent"
                  }`}
                />
                <span className="absolute right-3 top-2.5 text-[11px] text-muted-foreground/70 font-mono">
                  {trimmedName.length}/60
                </span>
              </div>
              {nameError && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {nameError}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground leading-relaxed flex items-center gap-1.5 mt-1.5">
                <Info className="size-3.5 text-accent shrink-0" />
                Tên này xuất hiện ở Header, Footer, bản quyền trang và thanh tiêu đề trình duyệt.
              </p>
            </div>

            {/* Field B: Avatar/Logo Website */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-foreground">
                  Avatar / Biểu tượng thương hiệu
                </label>
                <span className="text-[11px] text-muted-foreground">PNG, JPG, WebP ≤ 5MB</span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-secondary/30 p-4 rounded-xl border border-border/60">
                {/* Visual Box */}
                <div className="relative size-18 rounded-2xl border border-border/80 bg-background/80 flex items-center justify-center shrink-0 overflow-hidden shadow-inner group">
                  {currentEffectiveLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentEffectiveLogo}
                      alt="Logo xem trước"
                      className="size-full object-contain p-1 rounded-xl transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-br from-secondary via-card to-secondary text-base font-bold text-accent tracking-wider font-heading">
                      {liveInitials}
                    </div>
                  )}

                  {selectedFile && (
                    <span className="absolute bottom-1 right-1 size-2 rounded-full bg-emerald-500 ring-2 ring-background" title="Đã chọn ảnh mới" />
                  )}
                </div>

                {/* Upload & Management Actions */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-secondary/80 hover:bg-secondary hover:border-accent/40 text-xs font-medium text-foreground transition-all cursor-pointer shadow-xs active-bounce"
                    >
                      <Upload className="size-3.5 text-accent" />
                      {currentEffectiveLogo ? "Thay ảnh khác" : "Tải ảnh lên"}
                    </button>

                    {selectedFile && (
                      <button
                        type="button"
                        onClick={handleDiscardPickedFile}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-background/60 hover:bg-secondary/60 text-xs font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        title="Hủy ảnh vừa chọn từ máy tính"
                      >
                        <RotateCcw className="size-3.5" />
                        Bỏ ảnh vừa chọn
                      </button>
                    )}

                    {currentEffectiveLogo && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-xs font-medium text-destructive transition-all cursor-pointer"
                        title="Dùng chữ viết tắt thương hiệu thay vì ảnh"
                      >
                        <Trash2 className="size-3.5" />
                        Gỡ avatar (dùng chữ viết tắt)
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    Khuyến nghị dùng ảnh vuông (tỷ lệ 1:1, kích thước 512×512px) với nền trong suốt hoặc tối màu để hiển thị đẹp nhất trên thanh menu.
                  </p>
                </div>
              </div>

              {/* Status Badge when avatar removed */}
              {isRemovingLogo && (
                <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300 flex items-center gap-2">
                  <Info className="size-3.5 shrink-0 text-amber-400" />
                  Bạn đã chọn gỡ avatar. Khi lưu, website sẽ sử dụng huy hiệu chữ viết tắt{" "}
                  <strong className="font-bold underline text-amber-200">{liveInitials}</strong> làm biểu tượng thương hiệu.
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={!isDirty || isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                Hủy thay đổi
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer shadow-md ${
                  canSave
                    ? "bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-purple-950/40 active-bounce"
                    : "bg-secondary/60 text-muted-foreground/50 border border-border/40 cursor-not-allowed shadow-none"
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>Lưu thay đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Safe Mascot & Platform Info Note */}
          <div className="bg-secondary/20 border border-border/50 rounded-2xl p-4 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <ShieldCheck className="size-4 text-emerald-400" />
              Bảo tồn linh vật và an toàn hệ thống
            </div>
            <p className="text-[11px] leading-relaxed">
              • Biểu tượng avatar ở trên là huy hiệu thương hiệu của cửa hàng.
              <br />
              • Hai chú chuột lang <strong>Capybara pixel art</strong> trang trí ở Header và Footer được bảo tồn nguyên bản làm linh vật đồng hành.
              <br />
              • Mọi ảnh tải lên đều được kiểm tra mã nhị phân (magic bytes) chống tệp giả mạo, giới hạn kích thước tối đa 2048px và lưu trữ an toàn.
            </p>
          </div>
        </div>

        {/* CỘT PHẢI: BẢN XEM TRƯỚC TRỰC TIẾP (LIVE PREVIEW) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent font-mono flex items-center gap-1.5">
                <ImageIcon className="size-3.5" />
                XEM TRƯỚC TRỰC TIẾP
              </span>

              {/* View Switcher: Desktop vs Mobile */}
              <div className="inline-flex items-center bg-secondary/80 p-0.5 rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    previewDevice === "desktop"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="size-3" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    previewDevice === "mobile"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Smartphone className="size-3" />
                  Mobile
                </button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Mô phỏng giao diện thanh điều hướng Header khi áp dụng nhận diện:
            </p>

            {/* PREVIEW CONTAINER */}
            <div className="bg-[#0b0f12] border border-border rounded-xl p-3 sm:p-4 overflow-hidden relative shadow-inner">
              {/* Ambient Glow */}
              <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-purple-600/15 blur-2xl rounded-full" />

              {previewDevice === "desktop" ? (
                /* DESKTOP HEADER PREVIEW */
                <div className="w-full space-y-4">
                  {/* Simulated Browser Bar */}
                  <div className="flex items-center gap-1.5 pb-2 border-b border-border/40 text-[10px] text-muted-foreground font-mono">
                    <span className="size-2 rounded-full bg-red-500/80" />
                    <span className="size-2 rounded-full bg-amber-500/80" />
                    <span className="size-2 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 truncate max-w-[200px]">
                      {trimmedName || "ACCGIARE"} - Hệ thống tài khoản
                    </span>
                  </div>

                  {/* Desktop Mock Header */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-background/80 border border-border/80 backdrop-blur-md">
                    {/* Brand */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="size-8 rounded-xl bg-gradient-to-br from-secondary via-card to-secondary border border-border flex items-center justify-center text-xs font-bold text-accent shadow-xs overflow-hidden">
                        {currentEffectiveLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={currentEffectiveLogo}
                            alt="Logo"
                            className="size-full object-contain p-0.5 rounded-lg"
                          />
                        ) : (
                          <span>{liveInitials}</span>
                        )}
                      </div>
                      <span className="font-heading font-black text-sm tracking-tight text-foreground truncate max-w-[140px]">
                        {trimmedName || "ACCGIARE"}
                      </span>
                    </div>

                    {/* Nav Items */}
                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="text-foreground font-medium">Trang chủ</span>
                      <span>Sản phẩm</span>
                      <span>Hỗ trợ</span>
                    </div>

                    {/* Fake action button */}
                    <div className="size-6 rounded-md bg-secondary border border-border/80 flex items-center justify-center text-[10px] text-muted-foreground">
                      🔍
                    </div>
                  </div>

                  {/* Desktop Footer Mock Snippet */}
                  <div className="pt-2 border-t border-border/30 text-[10px] text-muted-foreground/80 flex items-center justify-between">
                    <span>© {new Date().getFullYear()} {trimmedName || "ACCGIARE"}. All rights reserved.</span>
                    <span className="text-emerald-400 font-mono">Online</span>
                  </div>
                </div>
              ) : (
                /* MOBILE HEADER PREVIEW */
                <div className="max-w-[280px] mx-auto space-y-3">
                  {/* Smartphone Frame Header */}
                  <div className="flex items-center justify-between px-2 text-[9px] text-muted-foreground font-mono">
                    <span>09:41</span>
                    <div className="flex items-center gap-1">
                      <span>5G</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Mobile Header Bar */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-background/90 border border-border/80">
                    {/* Brand */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-7 rounded-lg bg-gradient-to-br from-secondary via-card to-secondary border border-border flex items-center justify-center text-[11px] font-bold text-accent shrink-0 overflow-hidden">
                        {currentEffectiveLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={currentEffectiveLogo}
                            alt="Logo"
                            className="size-full object-contain p-0.5 rounded-md"
                          />
                        ) : (
                          <span>{liveInitials}</span>
                        )}
                      </div>
                      <span className="font-heading font-black text-xs tracking-tight text-foreground truncate">
                        {trimmedName || "ACCGIARE"}
                      </span>
                    </div>

                    {/* Hamburger Button */}
                    <div className="size-6 rounded-md bg-secondary/80 border border-border flex items-center justify-center text-xs text-foreground">
                      ☰
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/40 text-[10px] text-muted-foreground text-center">
                    Giao diện hiển thị nhỏ gọn trên smartphone và máy tính bảng.
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-secondary/40 border border-border/60 text-[11px] text-muted-foreground/90 space-y-1">
              <div className="font-medium text-foreground flex items-center gap-1.5">
                <Info className="size-3.5 text-accent" />
                Cơ chế hiển thị thông minh:
              </div>
              <p className="leading-relaxed">
                Khi chưa tải logo hoặc khi bạn bấm gỡ avatar, hệ thống tự động trích xuất chữ viết tắt{" "}
                <strong className="text-foreground font-bold font-mono">[{liveInitials}]</strong> từ tên thương hiệu để tạo biểu tượng tối giản, sắc nét.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
