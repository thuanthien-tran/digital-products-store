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
  Sparkles, 
  FileText, 
  ChevronRight, 
  Palette, 
  Sliders, 
  Layers, 
  Loader2, 
  Link2, 
  Unlink, 
  RefreshCw, 
  Search, 
  X, 
  KeyRound, 
  Save, 
  ShieldCheck, 
  ExternalLink,
  Share2,
  Lock,
  Pipette
} from "lucide-react"
import { toPng, toBlob } from "html-to-image"
import { StoreCatalogOption } from "@/app/api/admin/price-list/route"
import { THEMES, ThemeConfig, resolveTheme, CustomColors } from "@/lib/ktv"

export interface PriceMenuItem {
  id: string
  name: string
  note?: string
  price: number
  stock: number
  isEnabled: boolean
  linkedProductId?: string
  linkedVariantId?: string
  linkedName?: string
  autoSync?: boolean
}

export interface PriceMenuGroup {
  id: string
  name: string
  isEnabled: boolean
  items: PriceMenuItem[]
}

const LOCAL_STORAGE_KEY = "capygo_price_list_v2"

export function PriceListClient() {
  const [groups, setGroups] = useState<PriceMenuGroup[]>([])
  const [catalog, setCatalog] = useState<StoreCatalogOption[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"items" | "settings" | "ctv">("items")

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
  const [customColors, setCustomColors] = useState<CustomColors>({
    containerBg: THEMES[0].containerBg,
    accentColor: THEMES[0].accentColor,
    textColor: THEMES[0].textColor,
  })

  // CTV Live Portal & Security Settings
  const [ctvPin, setCtvPin] = useState("888888")
  const [ctvAccessEnabled, setCtvAccessEnabled] = useState(true)
  const [isSavingPublish, setIsSavingPublish] = useState(false)
  const [copiedCtvLink, setCopiedCtvLink] = useState(false)

  // Search filter inside editor
  const [editorSearch, setEditorSearch] = useState("")

  // Linking Modal State
  const [linkingTarget, setLinkingTarget] = useState<{ groupId: string; itemId: string; currentName: string } | null>(null)
  const [pickerSearch, setPickerSearch] = useState("")

  // Action status states
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSyncingPrices, setIsSyncingPrices] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const previewCardRef = useRef<HTMLDivElement>(null)
  const pickerInputRef = useRef<HTMLInputElement>(null)

  const activeTheme = resolveTheme(selectedThemeId, customColors)

  // Focus picker search input when modal opens
  useEffect(() => {
    if (linkingTarget) {
      setTimeout(() => pickerInputRef.current?.focus(), 80)
    }
  }, [linkingTarget])

  // Load initial data
  const loadData = async (forceFresh = false) => {
    setLoading(true)
    setMessage(null)
    try {
      // Fetch latest catalog and saved settings from API
      const res = await fetch("/api/admin/price-list")
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể tải dữ liệu bảng giá")
      }

      const freshCatalog: StoreCatalogOption[] = data.catalog || []
      setCatalog(freshCatalog)

      if (data.ctvPin) setCtvPin(data.ctvPin)
      if (data.ctvAccessEnabled !== undefined) setCtvAccessEnabled(data.ctvAccessEnabled)
      if (data.meta?.domain) setFooterDomain(data.meta.domain)
      if (data.meta?.hotline) setHotline(data.meta.hotline)
      if (data.meta?.warrantyNote) setFooterNote(data.meta.warrantyNote)

      // 1. If user previously saved config in database, use it as baseline
      const savedDbConfig = data.savedConfig

      // 2. Check localStorage (local edits take priority unless forced)
      let candidateConfig = savedDbConfig
      if (!forceFresh && typeof window !== "undefined") {
        const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (localSaved) {
          try {
            candidateConfig = JSON.parse(localSaved)
          } catch {}
        }
      }

      if (candidateConfig && Array.isArray(candidateConfig.groups) && candidateConfig.groups.length > 0) {
        setGroups(candidateConfig.groups)
        if (candidateConfig.menuTitle) setMenuTitle(candidateConfig.menuTitle)
        if (candidateConfig.menuSubtitle !== undefined) setMenuSubtitle(candidateConfig.menuSubtitle)
        if (candidateConfig.footerDomain) setFooterDomain(candidateConfig.footerDomain)
        if (candidateConfig.footerNote) setFooterNote(candidateConfig.footerNote)
        if (candidateConfig.hotline) setHotline(candidateConfig.hotline)
        if (candidateConfig.showStock !== undefined) setShowStock(candidateConfig.showStock)
        if (candidateConfig.showNotes !== undefined) setShowNotes(candidateConfig.showNotes)
        if (candidateConfig.showLeaderDots !== undefined) setShowLeaderDots(candidateConfig.showLeaderDots)
        if (candidateConfig.currencyUnit) setCurrencyUnit(candidateConfig.currencyUnit)
        if (candidateConfig.selectedThemeId) setSelectedThemeId(candidateConfig.selectedThemeId)
        if (candidateConfig.customColors) {
          setCustomColors(candidateConfig.customColors)
        } else if (candidateConfig.selectedThemeId) {
          const found = THEMES.find((t) => t.id === candidateConfig.selectedThemeId) || THEMES[0]
          setCustomColors({
            containerBg: found.containerBg,
            accentColor: found.accentColor,
            textColor: found.textColor,
          })
        }
      } else {
        // Fallback: default generated groups from store catalog
        setGroups(data.groups || [])
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Lỗi kết nối khi tải bảng giá", type: "error" })
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
        customColors,
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
    customColors,
    loading,
  ])

  // Price formatter helper
  const formatPrice = (cents: number) => {
    if (currencyUnit === "k") {
      return `${Math.round(cents / 1000)}k`
    }
    return `${cents.toLocaleString("vi-VN")}${currencyUnit}`
  }

  // Save current menu config and publish to CTV live portal
  const handleSaveAndPublishCtv = async () => {
    setIsSavingPublish(true)
    setMessage(null)
    try {
      const config = {
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
        customColors,
      }

      const res = await fetch("/api/admin/price-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          ctvPin,
          ctvAccessEnabled,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setMessage({
          type: "success",
          text: "Đã lưu bảng giá và xuất bản thành công! Trang KTV (/ktv) sẽ hiển thị chuẩn xác 100% theo tùy chỉnh của bạn.",
        })
      } else {
        throw new Error(data.error || "Không thể lưu bảng giá")
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Lỗi lưu cấu hình bảng giá" })
    } finally {
      setIsSavingPublish(false)
    }
  }

  // Copy invitation link & PIN for KTVs
  const handleCopyCtvShare = async () => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://capygo.id.vn"
      const text = `🌟 BẢNG GIÁ SẢN PHẨM TRỰC TIẾP DÀNH CHO KTV & ĐẠI LÝ 🌟\n🔗 Link xem kho & giá: ${origin}/ktv\n🔑 Mã PIN truy cập: ${ctvPin}\n(Bảng giá tự động cập nhật số lượng tồn kho và giá bán mới nhất theo thời gian thực)`
      await navigator.clipboard.writeText(text)
      setCopiedCtvLink(true)
      setTimeout(() => setCopiedCtvLink(false), 3000)
      setMessage({ type: "success", text: "Đã sao chép link và mã PIN gửi KTV thành công!" })
    } catch {
      setMessage({ type: "error", text: "Không thể sao chép văn bản" })
    }
  }

  // Synchronize prices & stock from website for all linked items, KEEPING custom names!
  const handleSyncLinkedPrices = async () => {
    setIsSyncingPrices(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/price-list")
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Lỗi nạp dữ liệu từ web")

      const freshCatalog: StoreCatalogOption[] = data.catalog || []
      setCatalog(freshCatalog)

      let updatedCount = 0
      setGroups((prevGroups) =>
        prevGroups.map((group) => ({
          ...group,
          items: group.items.map((item) => {
            if (!item.linkedProductId) return item

            const target = freshCatalog.find((c) =>
              item.linkedVariantId
                ? c.productId === item.linkedProductId && c.variantId === item.linkedVariantId
                : c.productId === item.linkedProductId
            )

            if (target) {
              updatedCount++
              return {
                ...item,
                price: target.price,
                stock: target.stock,
                linkedName: target.fullName,
              }
            }
            return item
          }),
        }))
      )

      setMessage({
        type: "success",
        text: `Đã tự động đồng bộ giá và tồn kho cho ${updatedCount} sản phẩm được ghim (giữ nguyên 100% tên bạn đã tự đặt)!`,
      })
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Lỗi đồng bộ giá" })
    } finally {
      setIsSyncingPrices(false)
    }
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

  // Link an item to a catalog product
  const handleBindCatalogProduct = (catItem: StoreCatalogOption) => {
    if (!linkingTarget) return

    setGroups((prevGroups) =>
      prevGroups.map((g) => {
        if (g.id !== linkingTarget.groupId) return g
        return {
          ...g,
          items: g.items.map((i) => {
            if (i.id !== linkingTarget.itemId) return i

            const shouldUpdateName = !i.name || i.name === "Sản phẩm mới" || i.name.trim() === ""

            return {
              ...i,
              name: shouldUpdateName ? catItem.fullName : i.name,
              price: catItem.price,
              stock: catItem.stock,
              linkedProductId: catItem.productId,
              linkedVariantId: catItem.variantId,
              linkedName: catItem.fullName,
              autoSync: true,
            }
          }),
        }
      })
    )

    setMessage({
      type: "success",
      text: `Đã ghim dòng "${linkingTarget.currentName}" với sản phẩm "${catItem.fullName}"! Giá và tồn kho đã được cập nhật tự động.`,
    })
    setLinkingTarget(null)
    setPickerSearch("")
  }

  // Unlink an item
  const handleUnlinkItem = (groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        return {
          ...g,
          items: g.items.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  linkedProductId: undefined,
                  linkedVariantId: undefined,
                  linkedName: undefined,
                  autoSync: false,
                }
              : i
          ),
        }
      })
    )
  }

  // Sync a single linked item right now
  const handleSyncSingleItem = (groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        return {
          ...g,
          items: g.items.map((i) => {
            if (i.id !== itemId || !i.linkedProductId) return i
            const target = catalog.find((c) =>
              i.linkedVariantId
                ? c.productId === i.linkedProductId && c.variantId === i.linkedVariantId
                : c.productId === i.linkedProductId
            )
            if (target) {
              setMessage({
                type: "success",
                text: `Đã đồng bộ giá (${formatPrice(target.price)}) và kho (${target.stock}) cho dòng "${i.name}".`,
              })
              return { ...i, price: target.price, stock: target.stock, linkedName: target.fullName }
            }
            return i
          }),
        }
      })
    )
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
        await handleDownloadPng()
      }
    } catch (err: any) {
      setMessage({ text: "Không thể sao chép ảnh: " + err.message, type: "error" })
    }
  }

  // 3. Copy Text for Chat
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

  // Filtered catalog for picker modal
  const filteredCatalog = catalog.filter((c) =>
    pickerSearch
      ? c.fullName.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        c.groupName.toLowerCase().includes(pickerSearch.toLowerCase())
      : true
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
          {/* Save & Publish to KTV Live Page */}
          <button
            type="button"
            onClick={handleSaveAndPublishCtv}
            disabled={isSavingPublish}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            title="Lưu cấu hình menu hiện tại lên trang xem của KTV (/ktv)"
          >
            {isSavingPublish ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            <span>{isSavingPublish ? "Đang lưu..." : "Lưu menu"}</span>
          </button>

          {/* Sync Prices from Web */}
          <button
            type="button"
            onClick={handleSyncLinkedPrices}
            disabled={isSyncingPrices}
            className="px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            title="Đồng bộ ngay giá bán và tồn kho từ website cho các sản phẩm đã ghim (vẫn giữ nguyên 100% tên bạn tự đặt)"
          >
            <RefreshCw className={`size-3.5 ${isSyncingPrices ? "animate-spin" : ""}`} />
            <span>{isSyncingPrices ? "Đang đồng bộ..." : "Đồng bộ giá & kho"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm("Bạn có chắc chắn muốn nạp lại dữ liệu gốc từ website? Toàn bộ tùy chỉnh tên sẽ được khôi phục theo mặc định.")) {
                void loadData(true)
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-all shadow-sm"
            title="Khôi phục lại toàn bộ sản phẩm và tên mặc định từ website"
          >
            <RotateCcw className="size-3.5" />
            <span>Khôi phục gốc</span>
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
            <button
              onClick={() => setActiveTab("ctv")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === "ctv"
                  ? "bg-caramel text-espresso font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <KeyRound className="size-3.5" />
              <span>Cổng KTV & Mã PIN</span>
            </button>
          </div>

          {/* TAB 1: PRODUCT ITEMS EDITOR */}
          {activeTab === "items" && (
            <div className="space-y-4">
              {/* Header bar of items tab */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Lọc tên sản phẩm trong menu..."
                    value={editorSearch}
                    onChange={(e) => setEditorSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
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
                          group.name.toLowerCase().includes(editorSearch.toLowerCase()) ||
                          (item.linkedName && item.linkedName.toLowerCase().includes(editorSearch.toLowerCase()))
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
                        <div className="p-2 space-y-2">
                          {filteredItems.map((item) => (
                            <div
                              key={item.id}
                              className={`p-2.5 rounded-lg text-xs transition-colors space-y-1.5 ${
                                item.isEnabled ? "bg-background/80 hover:bg-secondary/30 border border-border/50" : "bg-muted/10 opacity-50"
                              }`}
                            >
                              {/* Row 1: Checkbox, Name, Note, Price, Stock, Delete */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={item.isEnabled}
                                  onChange={() => handleToggleItem(group.id, item.id)}
                                  className="size-3.5 rounded border-border bg-card text-caramel focus:ring-1 focus:ring-caramel cursor-pointer accent-caramel shrink-0"
                                  title="Bật/Tắt dòng này trên bảng giá"
                                />

                                {/* Custom Display Name Input */}
                                <div className="flex-1 min-w-[130px]">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) =>
                                      handleUpdateItem(group.id, item.id, "name", e.target.value)
                                    }
                                    placeholder="Tên hiển thị trên menu..."
                                    className="w-full px-2 py-1 rounded bg-card border border-border/70 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                                  />
                                </div>

                                {/* Item Note (e.g. 1 tháng / KBH) */}
                                <input
                                  type="text"
                                  value={item.note || ""}
                                  onChange={(e) =>
                                    handleUpdateItem(group.id, item.id, "note", e.target.value)
                                  }
                                  placeholder="Ghi chú (KBH, 1T...)"
                                  className="w-24 px-1.5 py-1 rounded bg-card border border-border/70 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary hidden sm:block shrink-0"
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
                                    className="w-20 px-2 py-1 rounded bg-card border border-border/70 text-xs text-right font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                                    className="w-14 px-1.5 py-1 rounded bg-card border border-border/70 text-xs text-center text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shrink-0 font-mono"
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

                              {/* Row 2: Product Binding / Ghim sản phẩm kho */}
                              <div className="pl-5.5 flex flex-wrap items-center justify-between gap-2 text-[11px] pt-0.5 border-t border-border/20">
                                {item.linkedProductId ? (
                                  <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 flex-1">
                                    <span className="inline-flex items-center gap-1 text-caramel font-semibold shrink-0">
                                      <Link2 className="size-3" />
                                      Đang ghim:
                                    </span>
                                    <span
                                      className="font-medium text-foreground truncate max-w-[260px] bg-secondary/40 px-1.5 py-0.5 rounded border border-border/40"
                                      title={item.linkedName}
                                    >
                                      {item.linkedName || "Sản phẩm trong kho"}
                                    </span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                        item.stock > 0
                                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                          : "bg-destructive/10 text-destructive border border-destructive/20"
                                      }`}
                                    >
                                      Kho: {item.stock}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-muted-foreground/80">
                                    <span className="italic text-[10.5px]">Chưa ghim với kho (nhập tay)</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-2 shrink-0">
                                  {item.linkedProductId ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSyncSingleItem(group.id, item.id)}
                                        className="text-[10.5px] text-primary hover:underline flex items-center gap-1 font-medium"
                                        title="Lấy lại giá bán và tồn kho mới nhất từ sản phẩm kho"
                                      >
                                        <RefreshCw className="size-2.5" />
                                        <span>Đồng bộ</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setLinkingTarget({
                                            groupId: group.id,
                                            itemId: item.id,
                                            currentName: item.name,
                                          })
                                        }
                                        className="text-[10.5px] text-caramel hover:underline font-medium"
                                        title="Đổi sang ghim sản phẩm/gói khác trong kho"
                                      >
                                        Đổi ghim
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUnlinkItem(group.id, item.id)}
                                        className="text-[10.5px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-0.5"
                                        title="Gỡ ghim (chuyển sang quản lý giá thủ công)"
                                      >
                                        <Unlink className="size-2.5" />
                                        <span>Gỡ</span>
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setLinkingTarget({
                                          groupId: group.id,
                                          itemId: item.id,
                                          currentName: item.name,
                                        })
                                      }
                                      className="text-[10.5px] text-caramel hover:text-caramel/80 flex items-center gap-1 font-semibold hover:underline"
                                      title="Chọn một sản phẩm/gói trong kho để tự động cập nhật giá và số lượng"
                                    >
                                      <Link2 className="size-3" />
                                      <span>+ Ghim với sản phẩm kho</span>
                                    </button>
                                  )}
                                </div>
                              </div>
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
                        onClick={() => {
                          setSelectedThemeId(theme.id)
                          setCustomColors({
                            containerBg: theme.containerBg,
                            accentColor: theme.accentColor,
                            textColor: theme.textColor,
                          })
                        }}
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

                {/* 3 Custom Color Pickers */}
                <div className="pt-3 border-t border-border/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <Pipette className="size-3.5 text-caramel" />
                      <span>Tùy chỉnh 3 màu menu theo ý bạn:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const def = THEMES[0]
                        setSelectedThemeId(def.id)
                        setCustomColors({
                          containerBg: def.containerBg,
                          accentColor: def.accentColor,
                          textColor: def.textColor,
                        })
                      }}
                      className="text-[10.5px] text-muted-foreground hover:text-caramel transition-colors"
                    >
                      Đặt lại mặc định
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    {/* Color 1: Container Background */}
                    <div className="p-2.5 rounded-xl border border-border bg-background space-y-1.5">
                      <label className="text-[10.5px] font-semibold text-muted-foreground block truncate">
                        1. Màu nền menu
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColors.containerBg}
                          onChange={(e) => {
                            setCustomColors((prev) => ({ ...prev, containerBg: e.target.value }))
                            setSelectedThemeId("custom")
                          }}
                          className="size-7 rounded-lg border border-border cursor-pointer bg-transparent p-0.5 shrink-0"
                        />
                        <input
                          type="text"
                          value={customColors.containerBg}
                          onChange={(e) => {
                            setCustomColors((prev) => ({ ...prev, containerBg: e.target.value }))
                            setSelectedThemeId("custom")
                          }}
                          className="w-full font-mono text-[11px] px-2 py-1 rounded bg-secondary/30 border border-border uppercase font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {/* Color 2: Accent / Highlight Color */}
                    <div className="p-2.5 rounded-xl border border-border bg-background space-y-1.5">
                      <label className="text-[10.5px] font-semibold text-muted-foreground block truncate">
                        2. Màu điểm nhấn
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColors.accentColor}
                          onChange={(e) => {
                            setCustomColors((prev) => ({ ...prev, accentColor: e.target.value }))
                            setSelectedThemeId("custom")
                          }}
                          className="size-7 rounded-lg border border-border cursor-pointer bg-transparent p-0.5 shrink-0"
                        />
                        <input
                          type="text"
                          value={customColors.accentColor}
                          onChange={(e) => {
                            setCustomColors((prev) => ({ ...prev, accentColor: e.target.value }))
                            setSelectedThemeId("custom")
                          }}
                          className="w-full font-mono text-[11px] px-2 py-1 rounded bg-secondary/30 border border-border uppercase font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>

                    {/* Color 3: Text & Price Color */}
                    <div className="p-2.5 rounded-xl border border-border bg-background space-y-1.5">
                      <label className="text-[10.5px] font-semibold text-muted-foreground block truncate">
                        3. Màu chữ & giá
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColors.textColor}
                          onChange={(e) => {
                            setCustomColors((prev) => ({ ...prev, textColor: e.target.value }))
                            setSelectedThemeId("custom")
                          }}
                          className="size-7 rounded-lg border border-border cursor-pointer bg-transparent p-0.5 shrink-0"
                        />
                        <input
                          type="text"
                          value={customColors.textColor}
                          onChange={(e) => {
                            setCustomColors((prev) => ({ ...prev, textColor: e.target.value }))
                            setSelectedThemeId("custom")
                          }}
                          className="w-full font-mono text-[11px] px-2 py-1 rounded bg-secondary/30 border border-border uppercase font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
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

          {/* TAB 3: CTV PORTAL & SECURITY PIN */}
          {activeTab === "ctv" && (
            <div className="space-y-4">
              {/* Card 1: PIN Management & Activation */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-caramel/15 border border-caramel/30 flex items-center justify-center">
                      <KeyRound className="size-4 text-caramel" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Mã PIN & Quyền truy cập KTV</h3>
                      <p className="text-[10.5px] text-muted-foreground">
                        KTV truy cập /ktv cần nhập đúng mã PIN này để xem kho & giá trực tiếp.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <span className={ctvAccessEnabled ? "text-emerald-400" : "text-muted-foreground"}>
                      {ctvAccessEnabled ? "Đang bật" : "Đang tắt"}
                    </span>
                    <input
                      type="checkbox"
                      checked={ctvAccessEnabled}
                      onChange={(e) => setCtvAccessEnabled(e.target.checked)}
                      className="size-4 rounded border-border text-primary cursor-pointer accent-primary"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      <Lock className="size-3 text-caramel" />
                      <span>Mã PIN bảo mật hiện tại:</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={ctvPin}
                        onChange={(e) => setCtvPin(e.target.value)}
                        placeholder="Ví dụ: 888888 hoặc ctv2024"
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-mono font-bold tracking-widest text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAndPublishCtv}
                    disabled={isSavingPublish}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                  >
                    {isSavingPublish ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    <span>{isSavingPublish ? "Đang lưu..." : "Lưu mã PIN"}</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Share Links & Live Test */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <span className="text-xs font-bold text-foreground block">
                  Đường dẫn & Tin nhắn mời KTV
                </span>

                <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span className="font-semibold text-foreground">Link xem trực tiếp cho KTV:</span>
                    <a
                      href="/ktv"
                      target="_blank"
                      rel="noreferrer"
                      className="text-caramel hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Xem thử trang KTV</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border font-mono text-[11px] text-foreground select-all break-all">
                    {typeof window !== "undefined" ? window.location.origin : "https://capygo.id.vn"}/ktv
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCtvShare}
                  className="w-full py-2.5 rounded-xl border border-caramel/40 bg-caramel/10 hover:bg-caramel/20 text-caramel text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  {copiedCtvLink ? <Check className="size-4 text-emerald-400" /> : <Share2 className="size-4" />}
                  <span>{copiedCtvLink ? "Đã copy tin nhắn kèm PIN!" : "📋 Sao chép Link & Mã PIN gửi KTV"}</span>
                </button>
              </div>

              {/* Card 3: Notice */}
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" />
                  <span>Cơ chế đồng bộ bảo mật cho KTV:</span>
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
                  <li>Trang <strong>/ktv</strong> chỉ hiển thị các nhóm và sản phẩm mà bạn đã bật (tích chọn) ở tab <em>Sản phẩm & Giá</em>.</li>
                  <li>Tên món sẽ hiển thị đúng theo <strong>tên bạn tự đặt</strong>, tồn kho và giá sẽ tự động lấy theo <strong>sản phẩm bạn ghim</strong>.</li>
                  <li>KTV chỉ cần nhập mã PIN 1 lần, phiên đăng nhập được lưu bảo mật trong 30 ngày.</li>
                </ul>
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
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
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

      {/* ===================== MODAL: LINK PRODUCT PICKER ===================== */}
      {linkingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-caramel/10 border border-caramel/30 flex items-center justify-center">
                  <Link2 className="size-4 text-caramel" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Ghim với sản phẩm trong kho</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Chọn sản phẩm tương ứng để tự động lấy giá và tồn kho cho:{" "}
                    <strong className="text-caramel font-semibold">
                      &quot;{linkingTarget.currentName}&quot;
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkingTarget(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                ref={pickerInputRef}
                type="text"
                placeholder="Tìm theo tên sản phẩm, danh mục, hoặc gói..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              />
            </div>

            {/* Catalog Items List */}
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/20">
              {filteredCatalog.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Không tìm thấy sản phẩm nào phù hợp với từ khóa &quot;{pickerSearch}&quot;.
                </div>
              ) : (
                filteredCatalog.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleBindCatalogProduct(cat)}
                    className="w-full pt-2 pb-1.5 px-2.5 rounded-xl hover:bg-secondary/60 text-left transition-all flex items-center justify-between gap-3 group border border-transparent hover:border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-secondary text-muted-foreground">
                          {cat.groupName}
                        </span>
                        <span className="text-xs font-semibold text-foreground group-hover:text-caramel transition-colors truncate">
                          {cat.fullName}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground">
                        Sản phẩm: {cat.productName}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-extrabold text-foreground tabular-nums">
                        {formatPrice(cat.price)}
                      </div>
                      <div
                        className={`text-[10px] font-mono font-medium ${
                          cat.stock > 0 ? "text-emerald-400" : "text-destructive"
                        }`}
                      >
                        {cat.stock > 0 ? `Còn ${cat.stock}` : "Hết hàng"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Đang có {catalog.length} sản phẩm/gói trong kho web</span>
              <button
                type="button"
                onClick={() => setLinkingTarget(null)}
                className="px-3 py-1 rounded-lg border border-border hover:bg-secondary text-foreground text-xs font-semibold"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
