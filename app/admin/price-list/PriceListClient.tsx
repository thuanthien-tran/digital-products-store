"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { 
  Download, 
  Copy, 
  Check, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Sparkles, 
  FileText, 
  ChevronRight, 
  Palette, 
  Sliders, 
  Layers, 
  Loader2, 
  Share2,
  PackageCheck,
  ArrowLeft,
  ExternalLink
} from "lucide-react"
import { toPng, toBlob } from "html-to-image"

export interface PriceMenuItem {
  id: string
  name: string
  note?: string
  price: number
  stock: number
  isEnabled: boolean
}

export interface PriceMenuGroup {
  id: string
  name: string
  isEnabled: boolean
  items: PriceMenuItem[]
}

interface ThemeConfig {
  id: string
  name: string
  bgColor: string
  containerBg: string
  textColor: string
  accentColor: string
  dividerColor: string
  mutedColor: string
  priceColor: string
  badgeBg: string
}

const THEMES: ThemeConfig[] = [
  {
    id: "luxury-dark",
    name: "Luxury Dark (Mẫu Capygo)",
    bgColor: "#090A0C",
    containerBg: "#0F1115",
    textColor: "#FAF4ED",
    accentColor: "#E6A66F",
    dividerColor: "#D4955B",
    mutedColor: "#9E9A95",
    priceColor: "#FAF4ED",
    badgeBg: "rgba(230, 166, 111, 0.15)",
  },
  {
    id: "obsidian-gold",
    name: "Obsidian Gold",
    bgColor: "#000000",
    containerBg: "#0B0B0B",
    textColor: "#FFFFFF",
    accentColor: "#F59E0B",
    dividerColor: "#B45309",
    mutedColor: "#A1A1AA",
    priceColor: "#FDE68A",
    badgeBg: "rgba(245, 158, 11, 0.15)",
  },
  {
    id: "deep-navy",
    name: "Deep Midnight",
    bgColor: "#070D1E",
    containerBg: "#0D1836",
    textColor: "#F8FAFC",
    accentColor: "#38BDF8",
    dividerColor: "#0284C7",
    mutedColor: "#94A3B8",
    priceColor: "#E0F2FE",
    badgeBg: "rgba(56, 189, 248, 0.15)",
  },
  {
    id: "clean-light",
    name: "Minimal White",
    bgColor: "#F1F5F9",
    containerBg: "#FFFFFF",
    textColor: "#0F172A",
    accentColor: "#D97706",
    dividerColor: "#E2E8F0",
    mutedColor: "#64748B",
    priceColor: "#0F172A",
    badgeBg: "rgba(217, 119, 6, 0.1)",
  },
]

const LOCAL_STORAGE_KEY = "capygo_price_list_v1"

export function PriceListClient() {
  const [groups, setGroups] = useState<PriceMenuGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"items" | "settings">("items")

  // Header & Footer Customization
  const [menuTitle, setMenuTitle] = useState("BẢNG GIÁ")
  const [menuSubtitle, setMenuSubtitle] = useState("Tài khoản • Phần mềm • API")
  const [footerDomain, setFooterDomain] = useState("capygo.id.vn")
  const [footerNote, setFooterNote] = useState("KBH: Không bảo hành • Giá và tình trạng có thể thay đổi")
  const [hotline, setHotline] = useState("0356.970.964")

  // Column / Display Options
  const [showStock, setShowStock] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const [showLeaderDots, setShowLeaderDots] = useState(false)
  const [currencyUnit, setCurrencyUnit] = useState<"đ" | "VNĐ" | "k">("đ")
  const [selectedThemeId, setSelectedThemeId] = useState("luxury-dark")

  // Search filter inside editor
  const [editorSearch, setEditorSearch] = useState("")

  // Action status states
  const [isDownloading, setIsDownloading] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const previewCardRef = useRef<HTMLDivElement>(null)

  const activeTheme = THEMES.find((t) => t.id === selectedThemeId) || THEMES[0]

  // Load initial data
  const loadData = async (forceFresh = false) => {
    setLoading(true)
    setMessage(null)
    try {
      // Check localStorage first if not forced
      if (!forceFresh && typeof window !== "undefined") {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            if (Array.isArray(parsed.groups) && parsed.groups.length > 0) {
              setGroups(parsed.groups)
              if (parsed.menuTitle) setMenuTitle(parsed.menuTitle)
              if (parsed.menuSubtitle) setMenuSubtitle(parsed.menuSubtitle)
              if (parsed.footerDomain) setFooterDomain(parsed.footerDomain)
              if (parsed.footerNote) setFooterNote(parsed.footerNote)
              if (parsed.hotline) setHotline(parsed.hotline)
              if (parsed.showStock !== undefined) setShowStock(parsed.showStock)
              if (parsed.showNotes !== undefined) setShowNotes(parsed.showNotes)
              if (parsed.showLeaderDots !== undefined) setShowLeaderDots(parsed.showLeaderDots)
              if (parsed.currencyUnit) setCurrencyUnit(parsed.currencyUnit)
              if (parsed.selectedThemeId) setSelectedThemeId(parsed.selectedThemeId)
              setLoading(false)
              return
            }
          } catch {}
        }
      }

      // Fetch from API
      const res = await fetch("/api/admin/price-list")
      const data = await res.json()
      if (res.ok && data.success) {
        setGroups(data.groups || [])
        if (data.meta?.domain) setFooterDomain(data.meta.domain)
        if (data.meta?.hotline) setHotline(data.meta.hotline)
        if (data.meta?.warrantyNote) setFooterNote(data.meta.warrantyNote)
      } else {
        setMessage({ text: data.error || "Không thể tải dữ liệu bảng giá", type: "error" })
      }
    } catch {
      setMessage({ text: "Lỗi kết nối khi tải bảng giá", type: "error" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Auto-save customized state to localStorage
  useEffect(() => {
    if (loading || groups.length === 0) return
    try {
      const state = {
        groups,
        menuTitle,
        menuSubtitle,
        footerDomain,
        footerNote,
        hotline,
        showStock,
        showNotes,
        showLeaderDots,
        currencyUnit,
        selectedThemeId,
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [
    groups,
    menuTitle,
    menuSubtitle,
    footerDomain,
    footerNote,
    hotline,
    showStock,
    showNotes,
    showLeaderDots,
    currencyUnit,
    selectedThemeId,
    loading,
  ])

  // Price formatter helper
  const formatPrice = (cents: number) => {
    if (currencyUnit === "k") {
      return `${Math.round(cents / 1000)}k`
    }
    return `${cents.toLocaleString("vi-VN")}${currencyUnit}`
  }

  // Toggle group visibility
  const handleToggleGroup = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, isEnabled: !g.isEnabled } : g))
    )
  }

  // Toggle item visibility
  const handleToggleItem = (groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        return {
          ...g,
          items: g.items.map((i) => (i.id === itemId ? { ...i, isEnabled: !i.isEnabled } : i)),
        }
      })
    )
  }

  // Update item fields inline
  const handleUpdateItem = (
    groupId: string,
    itemId: string,
    field: "name" | "price" | "stock" | "note",
    value: any
  ) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        return {
          ...g,
          items: g.items.map((i) => {
            if (i.id !== itemId) return i
            return { ...i, [field]: value }
          }),
        }
      })
    )
  }

  // Delete item
  const handleDeleteItem = (groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        return {
          ...g,
          items: g.items.filter((i) => i.id !== itemId),
        }
      })
    )
  }

  // Add new item into group
  const handleAddItem = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        const newItem: PriceMenuItem = {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: "Sản phẩm mới",
          note: "",
          price: 50000,
          stock: 99,
          isEnabled: true,
        }
        return { ...g, items: [...g.items, newItem] }
      })
    )
  }

  // Add new group
  const handleAddGroup = () => {
    const name = prompt("Nhập tên nhóm mới (ví dụ: NETFLIX & SPOTIFY):")
    if (!name || !name.trim()) return
    const newGroup: PriceMenuGroup = {
      id: `group-${Date.now()}`,
      name: name.trim().toUpperCase(),
      isEnabled: true,
      items: [
        {
          id: `item-${Date.now()}`,
          name: "Gói 1 tháng",
          note: "",
          price: 59000,
          stock: 10,
          isEnabled: true,
        },
      ],
    }
    setGroups((prev) => [...prev, newGroup])
  }

  // Delete group
  const handleDeleteGroup = (groupId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ nhóm này khỏi bảng giá?")) return
    setGroups((prev) => prev.filter((g) => g.id !== groupId))
  }

  // 1. Export Image PNG
  const handleDownloadPng = async () => {
    if (!previewCardRef.current) return
    setIsDownloading(true)
    setMessage(null)
    try {
      const dataUrl = await toPng(previewCardRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        backgroundColor: activeTheme.containerBg,
      })
      const link = document.createElement("a")
      link.download = `Bang-Gia-${footerDomain.replace(/[^a-zA-Z0-9]/g, "-")}.png`
      link.href = dataUrl
      link.click()
      setMessage({ text: "Đã xuất và tải ảnh PNG thành công (Độ phân giải cao 2.5x)!", type: "success" })
    } catch (err: any) {
      setMessage({ text: "Không thể tạo ảnh: " + (err.message || "Lỗi render canvas"), type: "error" })
    } finally {
      setIsDownloading(false)
    }
  }

  // 2. Copy Image to Clipboard
  const handleCopyImage = async () => {
    if (!previewCardRef.current) return
    setMessage(null)
    try {
      const blob = await toBlob(previewCardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: activeTheme.containerBg,
      })
      if (!blob) throw new Error("Không thể tạo dữ liệu ảnh")

      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
        setCopiedImage(true)
        setTimeout(() => setCopiedImage(false), 3000)
        setMessage({ text: "Đã sao chép ảnh vào Clipboard! Bạn có thể nhấn Ctrl + V để dán ngay vào Zalo hoặc Telegram.", type: "success" })
      } else {
        // Fallback: download
        await handleDownloadPng()
      }
    } catch (err: any) {
      setMessage({ text: "Không thể sao chép ảnh (trình duyệt có thể chặn quyền clipboard): " + err.message, type: "error" })
    }
  }

  // 3. Copy Text for Chat (Zalo / Telegram / Messenger)
  const handleCopyChatText = async () => {
    try {
      let text = `🔥 ${menuTitle} — ${footerDomain.toUpperCase()} 🔥\n`
      if (menuSubtitle) text += `${menuSubtitle}\n`
      text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`

      for (const group of groups) {
        if (!group.isEnabled) continue
        const activeItems = group.items.filter((i) => i.isEnabled)
        if (activeItems.length === 0) continue

        text += `📌 ${group.name}\n`
        for (const item of activeItems) {
          text += `• ${item.name}`
          if (showNotes && item.note) text += ` (${item.note})`
          text += `: ${formatPrice(item.price)}`
          if (showStock) text += ` [Còn: ${item.stock}]`
          text += `\n`
        }
        text += `\n`
      }

      text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
      if (footerDomain) text += `🌐 Website: https://${footerDomain}\n`
      if (hotline) text += `📞 Hotline/Zalo: ${hotline}\n`
      if (footerNote) text += `⚠️ ${footerNote}\n`

      await navigator.clipboard.writeText(text)
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 3000)
      setMessage({ text: "Đã sao chép bảng giá dạng tin nhắn văn bản!", type: "success" })
    } catch {
      setMessage({ text: "Không thể sao chép văn bản", type: "error" })
    }
  }

  // Count active items
  const totalEnabledItems = groups.reduce(
    (sum, g) => sum + (g.isEnabled ? g.items.filter((i) => i.isEnabled).length : 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/admin" className="hover:text-foreground transition-colors">
              Quản trị viên
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-foreground font-medium">Bảng giá & Xuất Menu</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="size-6 text-caramel fill-caramel/20" />
              Tạo Bảng Giá & Xuất Menu
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-caramel/15 text-caramel border border-caramel/30 font-semibold">
              {totalEnabledItems} sản phẩm được chọn
            </span>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all shadow-sm"
            title="Đồng bộ lại toàn bộ sản phẩm và giá mới nhất từ website"
          >
            <RotateCcw className="size-3.5" />
            <span>Nạp lại từ web</span>
          </button>

          <button
            type="button"
            onClick={handleCopyChatText}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all shadow-sm"
            title="Sao chép toàn bộ bảng giá dạng văn bản đẹp để gửi tin nhắn Zalo/Telegram"
          >
            {copiedText ? <Check className="size-3.5 text-emerald-400" /> : <FileText className="size-3.5 text-primary" />}
            <span>{copiedText ? "Đã copy text!" : "Copy Text"}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyImage}
            className="px-3 py-1.5 rounded-lg border border-caramel/40 bg-caramel/10 hover:bg-caramel/20 text-xs font-semibold text-caramel flex items-center gap-1.5 transition-all shadow-sm"
            title="Sao chép ảnh trực tiếp vào Clipboard (nhấn Ctrl+V để dán vào Zalo/Telegram)"
          >
            {copiedImage ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            <span>{copiedImage ? "Đã copy ảnh!" : "Copy Ảnh"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isDownloading}
            className="px-3.5 py-1.5 rounded-lg bg-caramel text-espresso hover:opacity-90 active:scale-95 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            title="Xuất file ảnh PNG độ nét cao (2.5x)"
          >
            {isDownloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            <span>{isDownloading ? "Đang xuất..." : "Tải ảnh PNG"}</span>
          </button>
        </div>
      </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between border ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-destructive/10 text-destructive border-destructive/30"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs hover:underline opacity-80">
            Đóng
          </button>
        </div>
      )}

      {/* Main Split Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ===================== LEFT COLUMN: CONTROLS & EDITOR ===================== */}
        <div className="lg:col-span-6 space-y-4">
          {/* Navigation Tabs for Controls */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-secondary/50 border border-border w-fit text-xs">
            <button
              onClick={() => setActiveTab("items")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === "items"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5" />
              <span>Sản phẩm & Giá ({totalEnabledItems})</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === "settings"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sliders className="size-3.5" />
              <span>Giao diện & Cột</span>
            </button>
          </div>

          {/* TAB 1: PRODUCT ITEMS EDITOR */}
          {activeTab === "items" && (
            <div className="space-y-4">
              {/* Header bar of items tab */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
                <input
                  type="text"
                  placeholder="Lọc tên sản phẩm trong menu..."
                  value={editorSearch}
                  onChange={(e) => setEditorSearch(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs w-full max-w-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={handleAddGroup}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 border border-border"
                >
                  <Plus className="size-3.5 text-caramel" />
                  <span>+ Thêm nhóm</span>
                </button>
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-card rounded-xl border border-border">
                  Đang tải danh sách sản phẩm...
                </div>
              ) : groups.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-card rounded-xl border border-border">
                  Chưa có sản phẩm nào. Nhấn &quot;Nạp lại từ web&quot; ở trên để tự động tải sản phẩm đang bán.
                </div>
              ) : (
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                  {groups.map((group) => {
                    const filteredItems = group.items.filter((item) =>
                      editorSearch
                        ? item.name.toLowerCase().includes(editorSearch.toLowerCase()) ||
                          group.name.toLowerCase().includes(editorSearch.toLowerCase())
                        : true
                    )

                    if (editorSearch && filteredItems.length === 0) return null

                    return (
                      <div
                        key={group.id}
                        className={`rounded-xl border transition-all ${
                          group.isEnabled
                            ? "bg-card border-border/80"
                            : "bg-muted/10 border-border/40 opacity-60"
                        }`}
                      >
                        {/* Group Header */}
                        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-secondary/30 rounded-t-xl">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={group.isEnabled}
                              onChange={() => handleToggleGroup(group.id)}
                              className="size-4 rounded border-border bg-card text-caramel focus:ring-1 focus:ring-caramel cursor-pointer accent-caramel"
                              title="Bật/Tắt hiển thị cả nhóm này trên bảng giá"
                            />
                            <input
                              type="text"
                              value={group.name}
                              onChange={(e) => {
                                const val = e.target.value
                                setGroups((prev) =>
                                  prev.map((g) => (g.id === group.id ? { ...g, name: val } : g))
                                )
                              }}
                              className="font-bold text-xs uppercase bg-transparent text-foreground border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5"
                            />
                            <span className="text-[10px] text-muted-foreground">
                              ({filteredItems.filter((i) => i.isEnabled).length}/{filteredItems.length})
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAddItem(group.id)}
                              className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-[11px] font-semibold text-caramel flex items-center gap-1 transition-all"
                              title="Thêm một dòng sản phẩm mới vào nhóm này"
                            >
                              <Plus className="size-3" />
                              <span>Thêm dòng</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(group.id)}
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Xóa cả nhóm này khỏi menu"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Items inside Group */}
                        <div className="p-2 space-y-1.5">
                          {filteredItems.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-colors ${
                                item.isEnabled ? "bg-background/80 hover:bg-secondary/40 border border-border/40" : "bg-muted/10 opacity-50"
                              }`}
                            >
                              {/* Checkbox show/hide */}
                              <input
                                type="checkbox"
                                checked={item.isEnabled}
                                onChange={() => handleToggleItem(group.id, item.id)}
                                className="size-3.5 rounded border-border bg-card text-caramel focus:ring-1 focus:ring-caramel cursor-pointer accent-caramel shrink-0"
                                title="Bật/Tắt dòng này trên bảng giá"
                              />

                              {/* Item Name */}
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  handleUpdateItem(group.id, item.id, "name", e.target.value)
                                }
                                placeholder="Tên sản phẩm..."
                                className="flex-1 min-w-[140px] px-2 py-1 rounded bg-card border border-border/60 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                              />

                              {/* Item Note (e.g. 1 tháng / KBH) */}
                              <input
                                type="text"
                                value={item.note || ""}
                                onChange={(e) =>
                                  handleUpdateItem(group.id, item.id, "note", e.target.value)
                                }
                                placeholder="Ghi chú (KBH, 1T...)"
                                className="w-24 px-1.5 py-1 rounded bg-card border border-border/60 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary hidden sm:block"
                              />

                              {/* Price */}
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      group.id,
                                      item.id,
                                      "price",
                                      Math.max(0, parseInt(e.target.value) || 0)
                                    )
                                  }
                                  step={1000}
                                  className="w-20 px-2 py-1 rounded bg-card border border-border/60 text-xs text-right font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <span className="text-[11px] text-muted-foreground font-semibold">đ</span>
                              </div>

                              {/* Stock (if column enabled) */}
                              {showStock && (
                                <input
                                  type="number"
                                  value={item.stock}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      group.id,
                                      item.id,
                                      "stock",
                                      Math.max(0, parseInt(e.target.value) || 0)
                                    )
                                  }
                                  title="Tồn kho"
                                  className="w-14 px-1.5 py-1 rounded bg-card border border-border/60 text-xs text-center text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shrink-0"
                                />
                              )}

                              {/* Delete Item */}
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(group.id, item.id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                title="Xóa sản phẩm này"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: APPEARANCE & COLUMN SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              {/* Theme Picker */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Palette className="size-4 text-caramel" />
                  <span>Giao diện & Tông màu (Themes)</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {THEMES.map((theme) => {
                    const isSelected = theme.id === selectedThemeId
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setSelectedThemeId(theme.id)}
                        className={`p-3 rounded-xl border text-left text-xs transition-all flex flex-col justify-between gap-2 ${
                          isSelected
                            ? "border-caramel bg-caramel/10 ring-1 ring-caramel"
                            : "border-border hover:border-border/80 bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{theme.name}</span>
                          {isSelected && <Check className="size-3.5 text-caramel" />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-4 rounded-full border border-white/20"
                            style={{ backgroundColor: theme.containerBg }}
                          />
                          <span
                            className="size-4 rounded-full border border-white/20"
                            style={{ backgroundColor: theme.accentColor }}
                          />
                          <span
                            className="size-4 rounded-full border border-white/20"
                            style={{ backgroundColor: theme.textColor }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Column & Element Toggles */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <span className="text-xs font-bold text-foreground block">
                  Tùy chỉnh Ẩn / Hiện các chi tiết (Cột)
                </span>
                <div className="space-y-2.5">
                  <label className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer text-xs">
                    <span className="font-medium text-foreground">Hiển thị cột Số lượng / Tồn kho</span>
                    <input
                      type="checkbox"
                      checked={showStock}
                      onChange={(e) => setShowStock(e.target.checked)}
                      className="size-4 rounded border-border text-primary cursor-pointer accent-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer text-xs">
                    <span className="font-medium text-foreground">Hiển thị Ghi chú / Bảo hành phụ (Slot, KBH...)</span>
                    <input
                      type="checkbox"
                      checked={showNotes}
                      onChange={(e) => setShowNotes(e.target.checked)}
                      className="size-4 rounded border-border text-primary cursor-pointer accent-primary"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer text-xs">
                    <span className="font-medium text-foreground">Đường chấm nối giữa tên và giá (. . . . . .)</span>
                    <input
                      type="checkbox"
                      checked={showLeaderDots}
                      onChange={(e) => setShowLeaderDots(e.target.checked)}
                      className="size-4 rounded border-border text-primary cursor-pointer accent-primary"
                    />
                  </label>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Định dạng đơn vị tiền tệ:
                  </label>
                  <div className="flex items-center gap-2">
                    {(["đ", "VNĐ", "k"] as const).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => setCurrencyUnit(unit)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          currencyUnit === unit
                            ? "bg-caramel text-espresso border-caramel shadow-sm"
                            : "bg-secondary text-foreground border-border hover:bg-secondary/80"
                        }`}
                      >
                        {unit === "k" ? "Dạng k (29k)" : unit === "VNĐ" ? "Dạng VNĐ" : "Dạng đ (29.000đ)"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Header & Footer Text Customization */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <span className="text-xs font-bold text-foreground block">
                  Nội dung Tiêu đề & Chân bảng giá
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Tiêu đề chính:
                    </label>
                    <input
                      type="text"
                      value={menuTitle}
                      onChange={(e) => setMenuTitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Phụ đề bên dưới:
                    </label>
                    <input
                      type="text"
                      value={menuSubtitle}
                      onChange={(e) => setMenuSubtitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Website / Thương hiệu chân trang:
                    </label>
                    <input
                      type="text"
                      value={footerDomain}
                      onChange={(e) => setFooterDomain(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-caramel"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Hotline / Zalo:
                    </label>
                    <input
                      type="text"
                      value={hotline}
                      onChange={(e) => setHotline(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Ghi chú điều khoản / bảo hành ở chân ảnh:
                    </label>
                    <input
                      type="text"
                      value={footerNote}
                      onChange={(e) => setFooterNote(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===================== RIGHT COLUMN: LIVE PREVIEW & EXPORT CONTAINER ===================== */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Eye className="size-3.5 text-caramel" />
              Xem trước hình ảnh (Live Canvas Preview)
            </span>
            <span className="text-[11px] opacity-80">Khung ảnh chuẩn tỷ lệ gửi smartphone / Zalo</span>
          </div>

          {/* Wrapper to center & scale */}
          <div className="rounded-2xl border border-border bg-secondary/20 p-2 sm:p-4 overflow-x-auto flex justify-center shadow-inner">
            {/* The Actual Render Canvas Card */}
            <div
              ref={previewCardRef}
              style={{
                backgroundColor: activeTheme.containerBg,
                color: activeTheme.textColor,
                width: "100%",
                maxWidth: "520px",
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
              className="p-6 sm:p-8 rounded-xl shadow-2xl relative select-none"
            >
              {/* Top Header */}
              <div className="text-center pb-5 mb-5 border-b border-white/10">
                <h2
                  style={{ color: activeTheme.textColor }}
                  className="text-3xl sm:text-4xl font-black tracking-wider uppercase mb-1 drop-shadow-sm"
                >
                  {menuTitle}
                </h2>
                {menuSubtitle && (
                  <p
                    style={{ color: activeTheme.mutedColor }}
                    className="text-xs sm:text-sm font-medium tracking-wide"
                  >
                    {menuSubtitle}
                  </p>
                )}
              </div>

              {/* Menu Categories */}
              <div className="space-y-6">
                {groups
                  .filter((g) => g.isEnabled && g.items.some((i) => i.isEnabled))
                  .map((group) => {
                    const activeItems = group.items.filter((i) => i.isEnabled)
                    if (activeItems.length === 0) return null

                    return (
                      <div key={`preview-group-${group.id}`} className="space-y-2.5">
                        {/* Group Header with stylish line */}
                        <div className="flex items-center gap-3">
                          <h3
                            style={{ color: activeTheme.accentColor }}
                            className="text-xs sm:text-sm font-black tracking-wider uppercase shrink-0"
                          >
                            {group.name}
                          </h3>
                          <div
                            style={{ backgroundColor: activeTheme.dividerColor }}
                            className="h-[1.5px] flex-1 opacity-70"
                          />
                        </div>

                        {/* Items in Group */}
                        <div className="space-y-1.5 pt-0.5">
                          {activeItems.map((item) => (
                            <div
                              key={`preview-item-${item.id}`}
                              className="flex items-baseline justify-between gap-3 text-xs sm:text-[13px] leading-relaxed group"
                            >
                              {/* Left Name & Subtitle */}
                              <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                                <span className="font-medium text-foreground/95 truncate">
                                  {item.name}
                                </span>
                                {showNotes && item.note && (
                                  <span
                                    style={{ color: activeTheme.mutedColor }}
                                    className="text-[10.5px] opacity-80 shrink-0"
                                  >
                                    — {item.note}
                                  </span>
                                )}
                              </div>

                              {/* Leader Dots (if enabled) */}
                              {showLeaderDots && (
                                <div
                                  style={{ color: activeTheme.mutedColor }}
                                  className="flex-1 overflow-hidden border-b border-dotted border-current opacity-25 mx-1"
                                />
                              )}

                              {/* Right Price & Stock */}
                              <div className="flex items-baseline gap-2 shrink-0 text-right">
                                {showStock && (
                                  <span
                                    style={{
                                      backgroundColor: activeTheme.badgeBg,
                                      color: activeTheme.accentColor,
                                    }}
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                  >
                                    {item.stock > 0 ? `Còn ${item.stock}` : "Hết"}
                                  </span>
                                )}
                                <span
                                  style={{ color: activeTheme.priceColor }}
                                  className="font-extrabold text-xs sm:text-sm tabular-nums"
                                >
                                  {formatPrice(item.price)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>

              {/* Bottom Footer */}
              <div className="mt-8 pt-5 border-t border-white/10 text-center space-y-1">
                {footerDomain && (
                  <div
                    style={{ color: activeTheme.accentColor }}
                    className="text-sm sm:text-base font-black tracking-wider uppercase"
                  >
                    {footerDomain}
                  </div>
                )}
                <div
                  style={{ color: activeTheme.mutedColor }}
                  className="text-[10.5px] sm:text-[11px] font-medium leading-relaxed opacity-85"
                >
                  {footerNote}
                  {hotline && (
                    <span className="block mt-0.5 font-bold text-foreground/90">
                      Zalo / Hotline: {hotline}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
