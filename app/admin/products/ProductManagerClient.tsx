"use client"

import { useState, useEffect, useRef } from "react"
import { 
  Package, 
  Edit3, 
  Eye, 
  Trash2, 
  AlertTriangle, 
  Search, 
  X, 
  Save, 
  Send,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  UploadCloud
} from "lucide-react"
import { ProductCard } from "@/components/storefront/ProductCard"

interface RawVariant {
  id: string
  name: string
  priceCents: number
  compareAtPriceCents: number | null
  provider: string | null
  providerPrice: number | null
  providerStock: number | null
  _count?: { serials?: number }
  connectionId?: string | null
  connection?: { name: string } | null
  sourceProductId?: string | null
  sourceProduct?: { externalId: string } | null
}

interface RawProduct {
  id: string
  name: string
  slug: string
  groupId: string | null
  group?: { name: string } | null
  description: string | null
  images?: string | string[]
  warrantyTerms?: string | null
  usageInstructions?: string | null
  serviceInstructions?: string | null
  noticeNotes?: string | null
  deliveryType: string
  visibility: string
  editorialStatus?: "draft" | "published" | "hidden"
  hasPendingChanges?: boolean
  draftSnapshot?: string | null
  statusOverride?: string
  sortOrder?: number
  createdAt: string
  sourceProduct?: {
    id: string
    externalId: string
    hasChangeAlert: boolean
    changeAlertDetails: string | null
    sourcePrice: number
    sourceStatus: string
  } | null
  variants?: RawVariant[]
}

interface GroupOption {
  id: string
  name: string
}

interface ProductItem {
  id: string
  name: string
  slug: string
  sortOrder: number
  groupId: string | null
  groupName: string
  description: string
  images: string[]
  warrantyTerms?: string | null
  usageInstructions?: string | null
  noticeNotes?: string | null
  deliveryType: string
  visibility: string
  editorialStatus: "draft" | "published" | "hidden"
  hasPendingChanges: boolean
  draftSnapshot: string | null
  statusOverride?: string
  createdAt: string
  hasChangeAlert?: boolean
  changeAlertDetails?: string | null
  sourceAlert?: {
    hasAlert: boolean
    details: string[]
    sourcePrice?: number
    sourceStatus?: string
  } | null
  variants: Array<{
    id: string
    name: string
    priceCents: number
    compareAtPriceCents: number | null
    provider: string | null
    providerPrice: number | null
    providerStock: number | null
    stock: number
    connectionId?: string | null
    connectionName?: string | null
    sourceProductId?: string | null
    sourceExternalId?: string | null
  }>
}

interface Props {
  groups: GroupOption[]
}

function notifyCatalogChange() {
  if (typeof window === "undefined") return
  try {
    const bc = new BroadcastChannel("store_catalog_sync")
    bc.postMessage({ type: "CATALOG_MUTATED", timestamp: Date.now() })
    bc.close()
  } catch {}
  try {
    localStorage.setItem("store_catalog_sync", String(Date.now()))
  } catch {}
}

export function ProductManagerClient({ groups }: Props) {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [activeTab, setActiveTab] = useState<"published" | "draft" | "hidden" | "all">("published")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [counts, setCounts] = useState({ all: 0, draft: 0, published: 0, hidden: 0 })
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)

  // Editor Modal State
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    groupId: "",
    priceCents: 50000,
    compareAtPriceCents: 0,
    providerPrice: 0,
    imageUrl: "",
    highlights: "",
    benefits: "",
    instructions: "",
    warranty: "",
    notes: "",
    deliveryType: "serials",
    statusOverride: "auto",
    sortOrder: 1,
  })
  const [saving, setSaving] = useState(false)
  const [confirmBelowCost, setConfirmBelowCost] = useState(false)

  // Add Manual Product Modal State
  const [isAddManualOpen, setIsAddManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState({
    name: "",
    groupId: groups[0]?.id || "",
    priceCents: 50000,
    providerPrice: 0,
    variantName: "Gói Mặc Định",
    description: "",
    imageUrl: "",
    deliveryType: "contact",
    warrantyTerms: "Bảo hành 1 đổi 1 trong thời gian sử dụng.",
  })

  // Image Uploading States & Refs
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false)
  const [isUploadingManualImage, setIsUploadingManualImage] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)
  const manualFileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadImage = async (file: File, target: "edit" | "manual") => {
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert("Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.")
      return
    }

    const setLoading = target === "edit" ? setIsUploadingEditImage : setIsUploadingManualImage
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || "Tải ảnh lên thất bại")
        return
      }

      if (target === "edit") {
        setEditForm((prev) => ({ ...prev, imageUrl: data.url }))
      } else {
        setManualForm((prev) => ({ ...prev, imageUrl: data.url }))
      }
    } catch (err: any) {
      alert("Lỗi khi tải ảnh lên: " + (err.message || "Không xác định"))
    } finally {
      setLoading(false)
    }
  }

  const [isSyncing, setIsSyncing] = useState(false)

  const handleSyncProviders = async () => {
    setIsSyncing(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setMessage({ text: data.message || "Đã đồng bộ tồn kho và giá từ đại lý thành công!", type: "success" })
        setRefreshTrigger((prev) => prev + 1)
      } else {
        setMessage({ text: data.error || "Lỗi đồng bộ đại lý", type: "error" })
      }
    } catch {
      setMessage({ text: "Lỗi kết nối khi đồng bộ đại lý", type: "error" })
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("tab", activeTab)
        if (search) params.set("search", search)

        const res = await fetch(`/api/admin/products?${params.toString()}`)
        if (res.ok && !ignore) {
          const data = await res.json()
          const mapped: ProductItem[] = ((data.products as RawProduct[]) || []).map((p: RawProduct) => {
            let parsedImages: string[] = []
            if (typeof p.images === "string") {
              try {
                parsedImages = JSON.parse(p.images)
              } catch {
                parsedImages = []
              }
            } else if (Array.isArray(p.images)) {
              parsedImages = p.images
            }

            return {
              id: p.id,
              name: p.name,
              slug: p.slug,
              sortOrder: typeof p.sortOrder === "number" ? p.sortOrder : 0,
              groupId: p.groupId,
              groupName: p.group?.name || "Chưa phân loại",
              description: p.description || "",
              images: parsedImages,
              warrantyTerms: p.warrantyTerms || "",
              usageInstructions: p.usageInstructions || p.serviceInstructions || "",
              noticeNotes: p.noticeNotes || "",
              deliveryType: p.deliveryType,
              visibility: p.visibility,
              editorialStatus: p.editorialStatus || (p.visibility === "public" ? "published" : "draft"),
              hasPendingChanges: Boolean(p.hasPendingChanges),
              draftSnapshot: p.draftSnapshot || null,
              statusOverride: p.statusOverride || "auto",
              createdAt: p.createdAt,
              hasChangeAlert: Boolean(p.sourceProduct?.hasChangeAlert),
              changeAlertDetails: p.sourceProduct?.changeAlertDetails || null,
              sourceAlert: p.sourceProduct?.hasChangeAlert
                ? {
                    hasAlert: true,
                    details: (() => {
                      try {
                        return p.sourceProduct?.changeAlertDetails
                          ? JSON.parse(p.sourceProduct.changeAlertDetails)
                          : ["Nguồn hàng có biến động"]
                      } catch {
                        return [p.sourceProduct?.changeAlertDetails || "Nguồn hàng có biến động"]
                      }
                    })(),
                    sourcePrice: p.sourceProduct?.sourcePrice,
                    sourceStatus: p.sourceProduct?.sourceStatus,
                  }
                : null,
              variants: (p.variants || []).map((v: RawVariant) => ({
                id: v.id,
                name: v.name,
                priceCents: v.priceCents,
                compareAtPriceCents: v.compareAtPriceCents,
                provider: v.provider,
                providerPrice: v.providerPrice,
                providerStock: v.providerStock,
                stock: (v.providerStock ?? 0) + (v._count?.serials ?? 0),
                connectionId: v.connectionId,
                connectionName: v.connection?.name || null,
                sourceProductId: v.sourceProductId,
                sourceExternalId: v.sourceProduct?.externalId || null,
              })),
            }
          })
          mapped.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          setProducts(mapped)
          if (data.counts) setCounts(data.counts)
        }
      } catch {
        // silent
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [activeTab, search, refreshTrigger])

  useEffect(() => {
    setSelectedIds([])
  }, [activeTab, search])

  const openEditor = (prod: ProductItem) => {
    setEditingProduct(prod)
    const mainVariant = prod.variants[0]

    let initialName = prod.name
    let initialGroup = prod.groupId || groups[0]?.id || ""
    let initialPrice = mainVariant?.priceCents || 50000
    let initialCompare = mainVariant?.compareAtPriceCents || 0
    let initialProviderPrice = mainVariant?.providerPrice || 0
    let initialImage = prod.images[0] || ""
    let initialHighlights = ""
    let initialBenefits = prod.description || ""
    let initialInstructions = prod.usageInstructions || ""
    let initialWarranty = prod.warrantyTerms || ""
    let initialNotes = prod.noticeNotes || ""

    // Cleanly extract sections if prod.description was combined with markdown headers
    const desc = prod.description || ""
    const bMatch = desc.match(/\*\*(?:Thông tin & Quyền lợi|Quyền lợi|Đặc quyền)[^*]*\*\*([\s\S]*?)(?=\*\*(?:Hướng dẫn|Chính sách|Lưu ý|Bảo hành)|$)/i)
    if (bMatch && bMatch[1]) {
      initialBenefits = bMatch[1].replace(/\*\*(?:Thông tin & Quyền lợi|Quyền lợi|Đặc quyền)[^*]*\*\*/gi, "").trim()
    } else {
      initialBenefits = initialBenefits
        .replace(/\*\*(?:Thông tin & Quyền lợi|Quyền lợi|Đặc quyền)[^*]*\*\*/gi, "")
        .trim()
    }

    const iMatch = desc.match(/\*\*(?:Hướng dẫn sử dụng & Nhận hàng|Hướng dẫn)[^*]*\*\*([\s\S]*?)(?=\*\*(?:Chính sách|Lưu ý|Bảo hành|Thông tin)|$)/i)
    if (iMatch && iMatch[1] && !initialInstructions) {
      initialInstructions = iMatch[1].trim()
    }

    const wMatch = desc.match(/\*\*(?:Chính sách bảo hành|Bảo hành)[^*]*\*\*([\s\S]*?)(?=\*\*(?:Lưu ý|Thông tin|Hướng dẫn)|$)/i)
    if (wMatch && wMatch[1] && !initialWarranty) {
      initialWarranty = wMatch[1].trim()
    }

    const nMatch = desc.match(/\*\*(?:Lưu ý quan trọng|Lưu ý)[^*]*\*\*([\s\S]*?)(?=\*\*(?:Thông tin|Hướng dẫn|Chính sách)|$)/i)
    if (nMatch && nMatch[1] && !initialNotes) {
      initialNotes = nMatch[1].trim()
    }

    if (prod.draftSnapshot) {
      try {
        const staged = JSON.parse(prod.draftSnapshot)
        if (staged.name) initialName = staged.name
        if (staged.groupId) initialGroup = staged.groupId
        if (staged.images && staged.images[0]) initialImage = staged.images[0]
        if (staged.highlights && Array.isArray(staged.highlights)) {
          initialHighlights = staged.highlights.join("\n")
        }
        if (staged.variants && staged.variants[0]) {
          initialPrice = staged.variants[0].priceCents
          initialCompare = staged.variants[0].compareAtPriceCents || 0
          if (staged.variants[0].providerPrice !== undefined) {
            initialProviderPrice = staged.variants[0].providerPrice || 0
          }
        }
        if (staged.warrantyTerms !== undefined) initialWarranty = staged.warrantyTerms
        if (staged.usageInstructions !== undefined) initialInstructions = staged.usageInstructions
        if (staged.noticeNotes !== undefined) initialNotes = staged.noticeNotes
      } catch {
        // ignore
      }
    }

    if (!initialHighlights && initialBenefits) {
      const bulletLines = initialBenefits
        .split("\n")
        .map((l) => l.replace(/^[-*•\s]+/, "").trim())
        .filter((l) => l.length >= 3)
      initialHighlights = bulletLines.slice(0, 3).join("\n")
    }

    setEditForm({
      name: initialName,
      groupId: initialGroup,
      priceCents: initialPrice,
      compareAtPriceCents: initialCompare,
      providerPrice: initialProviderPrice,
      imageUrl: initialImage,
      highlights: initialHighlights,
      benefits: initialBenefits,
      instructions: initialInstructions,
      warranty: initialWarranty,
      notes: initialNotes,
      deliveryType: prod.deliveryType || "serials",
      statusOverride: prod.statusOverride || "auto",
      sortOrder: prod.sortOrder || 1,
    })
    setConfirmBelowCost(false)
  }

  const handleSaveProduct = async (actionType: "save_draft" | "publish_now") => {
    if (!editingProduct) return
    setSaving(true)
    setMessage(null)

    const mainVariant = editingProduct.variants[0]

    // Clean headers from each field to avoid accidental nesting
    const cleanBenefits = editForm.benefits
      .replace(/\*\*(?:Thông tin & Quyền lợi|Quyền lợi|Đặc quyền)[^*]*\*\*/gi, "")
      .trim()
    const cleanInstructions = editForm.instructions
      .replace(/\*\*(?:Hướng dẫn sử dụng & Nhận hàng|Hướng dẫn)[^*]*\*\*/gi, "")
      .trim()
    const cleanWarranty = editForm.warranty
      .replace(/\*\*(?:Chính sách bảo hành|Bảo hành)[^*]*\*\*/gi, "")
      .trim()
    const cleanNotes = editForm.notes
      .replace(/\*\*(?:Lưu ý quan trọng|Lưu ý)[^*]*\*\*/gi, "")
      .trim()

    const cleanHighlights = editForm.highlights
      .split("\n")
      .map((l) => l.replace(/^[-*•\s]+/, "").trim())
      .filter((l) => l.length > 0)

    // Combine structured sections
    const fullDesc = [
      `**Thông tin & Quyền lợi:**\n${cleanBenefits}`,
      cleanInstructions ? `**Hướng dẫn sử dụng & Nhận hàng:**\n${cleanInstructions}` : "",
      cleanWarranty ? `**Chính sách bảo hành:**\n${cleanWarranty}` : "",
      cleanNotes ? `**Lưu ý quan trọng:**\n${cleanNotes}` : "",
    ].filter(Boolean).join("\n\n")

    const imageList = editForm.imageUrl.trim() ? [editForm.imageUrl.trim()] : []

    try {
      const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          groupId: editForm.groupId,
          deliveryType: editForm.deliveryType,
          statusOverride: editForm.statusOverride,
          sortOrder: Number(editForm.sortOrder) || 1,
          description: fullDesc,
          warrantyTerms: editForm.warranty,
          usageInstructions: editForm.instructions,
          noticeNotes: editForm.notes,
          images: imageList,
          highlights: cleanHighlights,
          action: actionType,
          confirmBelowCost,
          variants: mainVariant
            ? [
                {
                  id: mainVariant.id,
                  name: editForm.name,
                  priceCents: editForm.priceCents,
                  compareAtPriceCents: editForm.compareAtPriceCents || null,
                  providerPrice: editForm.providerPrice !== undefined ? editForm.providerPrice : (mainVariant.providerPrice ?? null),
                },
              ]
            : undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        notifyCatalogChange()
        setMessage({
          text: "Đã cập nhật giá bán và thông tin sản phẩm đồng bộ thành công lên website!",
          type: "success",
        })
        setEditingProduct(null)
        setRefreshTrigger((prev) => prev + 1)
      } else {
        if (data.error && data.error.includes("thấp hơn giá sỉ")) {
          setConfirmBelowCost(true)
        }
        setMessage({ text: data.error || "Lỗi cập nhật sản phẩm", type: "error" })
      }
    } catch {
      setMessage({ text: "Lỗi kết nối khi cập nhật", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleQuickSortOrderChange = (productId: string, newOrder: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, sortOrder: newOrder } : p))
    )
  }

  const handleSaveSortOrder = async (productId: string, newOrder: number) => {
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: newOrder }),
      })
      if (res.ok) {
        notifyCatalogChange()
        setProducts((prev) =>
          [...prev].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        )
        setMessage({
          text: `Đã cập nhật STT ưu tiên (#${newOrder}) và tự động sắp xếp lại danh sách!`,
          type: "success",
        })
      }
    } catch {
      setMessage({ text: "Lỗi lưu STT sản phẩm", type: "error" })
    }
  }

  const handlePublishDirect = async (productId: string) => {
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      })
      const data = await res.json()
      if (res.ok) {
        notifyCatalogChange()
        setMessage({ text: "Đã công bố sản phẩm lên website thành công!", type: "success" })
        setRefreshTrigger((prev) => prev + 1)
      } else {
        setMessage({ text: data.error || "Không thể công bố sản phẩm", type: "error" })
      }
    } catch {
      setMessage({ text: "Lỗi kết nối", type: "error" })
    }
  }

  const handleHideProduct = async (productId: string) => {
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hide" }),
      })
      const data = await res.json()
      if (res.ok) {
        notifyCatalogChange()
        setMessage({ text: "Đã tạm ẩn sản phẩm khỏi website!", type: "success" })
        setRefreshTrigger((prev) => prev + 1)
      } else {
        setMessage({ text: data.error || "Không thể ẩn sản phẩm", type: "error" })
      }
    } catch {
      setMessage({ text: "Lỗi kết nối", type: "error" })
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn sản phẩm này?")) return
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        notifyCatalogChange()
        setMessage({ text: data.message || "Đã xóa sản phẩm thành công", type: "success" })
        setSelectedIds((prev) => prev.filter((id) => id !== productId))
        setRefreshTrigger((prev) => prev + 1)
      } else {
        setMessage({ text: data.error || "Lỗi xóa sản phẩm", type: "error" })
      }
    } catch {
      setMessage({ text: "Lỗi kết nối", type: "error" })
    }
  }

  const isAllSelected = products.length > 0 && products.every((p) => selectedIds.includes(p.id))
  const isSomeSelected = products.some((p) => selectedIds.includes(p.id)) && !isAllSelected

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(products.map((p) => p.id))
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa vĩnh viễn ${count} sản phẩm đã chọn? Thao tác này không thể hoàn tác.`
      )
    ) {
      return
    }

    setIsDeletingBulk(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selectedIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        notifyCatalogChange()
        setMessage({
          text: data.message || `Đã xóa thành công ${count} sản phẩm`,
          type: "success",
        })
        setSelectedIds([])
        setRefreshTrigger((prev) => prev + 1)
      } else {
        setMessage({ text: data.error || "Lỗi khi xóa các sản phẩm đã chọn", type: "error" })
      }
    } catch {
      setMessage({ text: "Lỗi kết nối khi xóa các sản phẩm", type: "error" })
    } finally {
      setIsDeletingBulk(false)
    }
  }

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manualForm.name,
          groupId: manualForm.groupId,
          priceCents: manualForm.priceCents,
          providerPrice: manualForm.providerPrice,
          variantName: manualForm.variantName,
          deliveryType: manualForm.deliveryType,
          description: manualForm.description,
          images: manualForm.imageUrl ? [manualForm.imageUrl.trim()] : [],
          warrantyTerms: manualForm.warrantyTerms,
          editorialStatus: "draft",
        }),
      })

      const data = await res.json()
      if (res.ok) {
        notifyCatalogChange()
        setMessage({ text: "Đã tạo sản phẩm bản nháp thành công! Bạn có thể chỉnh sửa và duyệt đăng bán.", type: "success" })
        setIsAddManualOpen(false)
        setManualForm({
          name: "",
          groupId: groups[0]?.id || "",
          priceCents: 50000,
          providerPrice: 0,
          variantName: "Gói Mặc Định",
          description: "",
          imageUrl: "",
          deliveryType: "contact",
          warrantyTerms: "Bảo hành 1 đổi 1 trong thời gian sử dụng.",
        })
        setRefreshTrigger((prev) => prev + 1)
      } else {
        setMessage({ text: data.error || "Không thể tạo sản phẩm", type: "error" })
      }
    } catch {
      setMessage({ text: "Lỗi kết nối khi tạo", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const formatMoney = (amount: number) => {
    return amount.toLocaleString("vi-VN") + " ₫"
  }

  // Live preview helpers
  const selectedGroup = groups.find((g) => g.id === editForm.groupId)
  const currentDiff = editForm.compareAtPriceCents > editForm.priceCents ? editForm.compareAtPriceCents - editForm.priceCents : 0
  const currentDiscountPercent =
    editForm.compareAtPriceCents > editForm.priceCents
      ? Math.floor((currentDiff / editForm.compareAtPriceCents) * 100)
      : 0

  const previewVariant = editingProduct
    ? {
        id: editingProduct.variants[0]?.id || "v-preview",
        name: editForm.name || "Tên sản phẩm",
        priceCents: editForm.priceCents || 0,
        compareAtPriceCents: editForm.compareAtPriceCents || null,
        availableStock: editingProduct.variants[0]?.stock || 99,
        providerStock: editingProduct.variants[0]?.providerStock,
      }
    : null

  const previewHighlights = editForm.highlights
    .split("\n")
    .map((l) => l.replace(/^[-*•\s]+/, "").trim())
    .filter((l) => l.length > 0)

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="p-1 hover:opacity-80">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border w-fit text-xs">
          <button
            onClick={() => setActiveTab("published")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "published"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Đang bán ({counts.published})
          </button>
          <button
            onClick={() => setActiveTab("draft")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "draft"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bản nháp ({counts.draft})
          </button>
          <button
            onClick={() => setActiveTab("hidden")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "hidden"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tạm ẩn ({counts.hidden})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tất cả ({counts.all})
          </button>
        </div>

        {/* Right Search & Add manual */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary w-48 sm:w-64"
            />
          </div>

          <button
            onClick={handleSyncProviders}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold hover:border-primary/50 transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            title="Đồng bộ ngay tồn kho và giá sỉ mới nhất từ Dino & FatCat"
          >
            <RefreshCw className={`size-3.5 text-primary ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Đang đồng bộ..." : "Đồng bộ đại lý"}</span>
          </button>

          <button
            onClick={() => setIsAddManualOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Package className="size-3.5" />
            <span>Thêm sản phẩm</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 text-xs">
          <div className="flex items-center gap-2.5 text-foreground font-medium">
            <span className="flex items-center justify-center size-6 rounded-full bg-destructive text-destructive-foreground text-xs font-bold shadow-sm">
              {selectedIds.length}
            </span>
            <span>
              Đã chọn <strong className="font-bold text-destructive">{selectedIds.length}</strong> sản phẩm
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              disabled={isDeletingBulk}
              onClick={handleDeleteSelected}
              className="px-3.5 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isDeletingBulk ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span>Xóa tất cả mục đã chọn ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/40 text-muted-foreground border-b border-border uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected
                    }}
                    onChange={handleToggleSelectAll}
                    disabled={loading || products.length === 0}
                    className="size-4 rounded border-border bg-card text-primary focus:ring-1 focus:ring-primary cursor-pointer accent-primary align-middle disabled:opacity-40"
                    title="Chọn tất cả sản phẩm"
                  />
                </th>
                <th className="py-3 px-2 w-16 text-center font-bold" title="Thứ tự ưu tiên hiển thị (1, 2, 3...)">
                  STT
                </th>
                <th className="py-3 px-4">Sản phẩm</th>
                <th className="py-3 px-4">Danh mục</th>
                <th className="py-3 px-4">Giá bán</th>
                <th className="py-3 px-4 text-center">Tồn kho</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Đang tải danh sách sản phẩm...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Không có sản phẩm nào trong mục này.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const mainVariant = p.variants[0]
                  const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0)
                  const hasDraft = p.hasPendingChanges
                  const isSelected = selectedIds.includes(p.id)

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        p.hasChangeAlert
                          ? "bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-l-amber-500"
                          : isSelected
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-secondary/20"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(p.id)}
                          className="size-4 rounded border-border bg-card text-primary focus:ring-1 focus:ring-primary cursor-pointer accent-primary align-middle"
                          title={`Chọn ${p.name}`}
                        />
                      </td>

                      {/* STT Priority Input */}
                      <td className="py-3 px-2 text-center">
                        <input
                          type="number"
                          min={1}
                          value={p.sortOrder || ""}
                          placeholder={String(products.indexOf(p) + 1)}
                          onChange={(e) => handleQuickSortOrderChange(p.id, parseInt(e.target.value) || 0)}
                          onBlur={() => handleSaveSortOrder(p.id, p.sortOrder)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur()
                            }
                          }}
                          className="w-12 h-7 text-center font-bold text-xs rounded-md border border-border bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
                          title="Nhập STT ưu tiên (1, 2, 3...) và bấm Enter hoặc click ra ngoài để lưu & tự sắp xếp"
                        />
                      </td>

                      {/* Product Name & Source Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg overflow-hidden bg-muted/40 border border-border shrink-0 relative flex items-center justify-center">
                            {p.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.images[0]}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="size-5 text-muted-foreground/50" />
                            )}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-foreground text-sm truncate max-w-xs block">
                                {p.name}
                              </span>
                              {hasDraft && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  Bản nháp chờ công bố
                                </span>
                              )}
                              {p.hasChangeAlert && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                                  <AlertTriangle className="size-3 text-amber-400" />
                                  <span>Đại lý có biến động</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground block truncate">
                              /{p.slug}
                            </span>
                            {p.sourceAlert && p.sourceAlert.details.length > 0 && (
                              <div className="pt-1 flex flex-col gap-0.5">
                                {p.sourceAlert.details.map((detail, idx) => (
                                  <div
                                    key={idx}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 max-w-fit"
                                  >
                                    <span className="size-1 rounded-full bg-amber-400" />
                                    <span>{detail}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Group */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground border border-border">
                          {p.groupName}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-foreground block">
                          {formatMoney(mainVariant?.priceCents || 0)}
                        </span>
                        {mainVariant?.compareAtPriceCents ? (
                          <span className="text-[10px] text-muted-foreground line-through block">
                            {formatMoney(mainVariant.compareAtPriceCents)}
                          </span>
                        ) : null}
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            totalStock > 0
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {totalStock}
                        </span>
                      </td>

                      {/* Editorial Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.editorialStatus === "published" && p.visibility === "public"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : p.editorialStatus === "draft"
                              ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                              : "bg-secondary text-muted-foreground border border-border"
                          }`}
                        >
                          {p.editorialStatus === "published" && p.visibility === "public"
                            ? "Đang bán"
                            : p.editorialStatus === "draft"
                            ? "Bản nháp"
                            : "Tạm ẩn"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditor(p)}
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs"
                            title="Biên tập sản phẩm"
                          >
                            <Edit3 className="size-3.5" />
                          </button>

                          <a
                            href={`/admin/products/preview/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs"
                            title="Xem trước khách thấy"
                          >
                            <Eye className="size-3.5" />
                          </a>

                          {p.editorialStatus !== "published" || p.visibility !== "public" ? (
                            <button
                              type="button"
                              onClick={() => handlePublishDirect(p.id)}
                              className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 active:scale-95 transition-all"
                            >
                              Đăng bán
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleHideProduct(p.id)}
                              className="px-2 py-1 rounded-lg border border-border hover:bg-secondary text-[11px] font-medium transition-colors"
                            >
                              Tạm ẩn
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal with 16:9 Image, Structured Pricing & Real-time Live Card Preview */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-5xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in-50 zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Biên Tập Chi Tiết Sản Phẩm: {editingProduct.name}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Trạng thái: <strong className="text-foreground uppercase">{editingProduct.editorialStatus}</strong>
                  {editingProduct.hasPendingChanges && " · (Đang có thay đổi nháp chờ công bố)"}
                </span>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body: Split view (Form on left, Real-time Live Card Preview on right) */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Form Controls: lg:col-span-7 */}
                <div className="lg:col-span-7 space-y-4">
                  {/* 1. Cover Image 16:9 */}
                  <div className="p-3.5 rounded-xl border border-border bg-secondary/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <ImageIcon className="size-3.5" />
                        Ảnh đại diện 16:9 trên thẻ sản phẩm
                      </label>
                      {editForm.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, imageUrl: "" })}
                          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Xóa ảnh
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUploadImage(file, "edit")
                          e.target.value = ""
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        disabled={isUploadingEditImage}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {isUploadingEditImage ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>Đang tải lên…</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="size-3.5" />
                            <span>Tải ảnh từ máy tính</span>
                          </>
                        )}
                      </button>

                      <input
                        type="url"
                        placeholder="Hoặc dán link ảnh HTTPS (ví dụ: https://...)"
                        value={editForm.imageUrl}
                        onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                        className="w-full p-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono text-[11px]"
                      />
                    </div>

                    {editForm.imageUrl && (
                      <div className="flex items-center gap-3 p-2 rounded-lg border border-border/60 bg-background/60">
                        <div className="relative size-12 rounded-md overflow-hidden border border-border shrink-0 bg-secondary/50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={editForm.imageUrl}
                            alt="Ảnh sản phẩm"
                            className="size-full object-cover"
                            onError={(e) => {
                              ;(e.target as HTMLElement).style.display = "none"
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-foreground truncate">
                            {editForm.imageUrl}
                          </p>
                          <p className="text-[10px] text-emerald-400 font-medium">✓ Đã gắn ảnh sản phẩm</p>
                        </div>
                      </div>
                    )}

                    <p className="text-[10.5px] text-muted-foreground">
                      Gợi ý: Hỗ trợ tệp PNG, JPG, WebP tối đa 5MB. Tỷ lệ 16:9 (1280x720 hoặc 1920x1080), không viền thừa để tràn đều khung thẻ sản phẩm.
                    </p>
                  </div>

                  {/* 2. Product Name, Category, Delivery Type & Sort Order */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-muted-foreground font-medium mb-1">
                        Tên sản phẩm trên website *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-muted-foreground font-medium mb-1">
                        Danh mục nhóm sản phẩm *
                      </label>
                      <select
                        value={editForm.groupId}
                        onChange={(e) => setEditForm({ ...editForm, groupId: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-muted-foreground font-medium mb-1" title="Hình thức phân phối sản phẩm">
                        Hình thức bán *
                      </label>
                      <select
                        value={editForm.deliveryType}
                        onChange={(e) => setEditForm({ ...editForm, deliveryType: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                      >
                        <option value="serials">Kho mã / Key (Tự động)</option>
                        <option value="fatcat">Đại lý FatCat (API)</option>
                        <option value="service">Nâng cấp thủ công</option>
                        <option value="contact">Liên hệ Zalo đặt mua</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-muted-foreground font-medium mb-1" title="Trạng thái hàng hiển thị cho khách">
                        Trạng thái kho *
                      </label>
                      <select
                        value={editForm.statusOverride}
                        onChange={(e) => setEditForm({ ...editForm, statusOverride: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                      >
                        <option value="auto">Tự động (Theo tồn kho)</option>
                        <option value="in_stock">Bắt buộc Còn hàng</option>
                        <option value="out_of_stock">Bắt buộc Hết hàng</option>
                      </select>
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-muted-foreground font-medium mb-1" title="Số thứ tự ưu tiên hiển thị (1, 2, 3...)">
                        STT
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={editForm.sortOrder || 1}
                        onChange={(e) => setEditForm({ ...editForm, sortOrder: parseInt(e.target.value) || 1 })}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-bold text-center"
                        title="Số thứ tự hiển thị trên website (1 là đầu tiên, 2, 3...)"
                      />
                    </div>
                  </div>

                  {/* 3. Structured Pricing & Discount Indicator */}
                  <div className="p-3.5 rounded-xl border border-border bg-secondary/20 space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                      Cấu trúc Giá bán &amp; Mức giảm giá
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-muted-foreground font-medium">
                            Giá bên đại lý (VNĐ)
                          </label>
                          {editingProduct.variants[0]?.provider ? (
                            <span className="text-[10px] text-primary/80 uppercase font-semibold">
                              {editingProduct.variants[0].provider}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              (Tự nhập)
                            </span>
                          )}
                        </div>
                        {editingProduct.variants[0]?.provider ? (
                          <input
                            type="text"
                            readOnly
                            value={editForm.providerPrice ? `${editForm.providerPrice.toLocaleString("vi-VN")} ₫` : "0 ₫"}
                            className="w-full p-2.5 rounded-lg border border-border bg-secondary/40 text-muted-foreground text-xs font-mono font-medium focus:outline-none cursor-not-allowed select-none"
                            title="Giá sỉ từ nhà cung cấp / đại lý (Đồng bộ qua API, không thể sửa tay)"
                          />
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={editForm.providerPrice || 0}
                            onChange={(e) => setEditForm({ ...editForm, providerPrice: Number(e.target.value) || 0 })}
                            className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Nhập giá vốn đại lý..."
                            title="Giá vốn / giá bên đại lý để tự tính lợi nhuận"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-muted-foreground font-medium mb-1">
                          Giá bán niêm yết (VNĐ) *
                        </label>
                        <input
                          type="number"
                          required
                          value={editForm.priceCents}
                          onChange={(e) => setEditForm({ ...editForm, priceCents: Number(e.target.value) })}
                          className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                          step="any"
                          min={0}
                        />
                      </div>

                      <div>
                        <label className="block text-muted-foreground font-medium mb-1">
                          Giá ban đầu
                        </label>
                        <input
                          type="number"
                          value={editForm.compareAtPriceCents || ""}
                          onChange={(e) => setEditForm({ ...editForm, compareAtPriceCents: Number(e.target.value) })}
                          className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          step="any"
                          min={0}
                          placeholder="Bỏ trống nếu không giảm giá"
                        />
                      </div>
                    </div>

                    {/* Calculated Indicators */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      {currentDiscountPercent >= 1 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 font-bold border border-rose-500/30">
                          Mức giảm: -{currentDiscountPercent}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10.5px]">
                          (Nhập giá ban đầu cao hơn giá bán để hiển thị nhãn giảm giá)
                        </span>
                      )}

                      {currentDiff > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30">
                          Khách tiết kiệm: {formatMoney(currentDiff)}
                        </span>
                      )}

                      {editForm.providerPrice > 0 ? (
                        <span className="text-muted-foreground ml-auto flex items-center gap-1.5 flex-wrap">
                          <span>Giá sỉ: <strong className="text-foreground">{formatMoney(editForm.providerPrice)}</strong></span>
                          <span>·</span>
                          <span>
                            Lãi:{" "}
                            <strong
                              className={
                                editForm.priceCents >= editForm.providerPrice
                                  ? "text-emerald-400 font-bold"
                                  : "text-rose-400 font-bold"
                              }
                            >
                              {formatMoney(editForm.priceCents - editForm.providerPrice)}
                              <span className="text-[10px] ml-1 font-normal opacity-85">
                                ({Math.round(((editForm.priceCents - editForm.providerPrice) / editForm.providerPrice) * 100)}%)
                              </span>
                            </strong>
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {confirmBelowCost && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span>Cảnh báo bán dưới giá sỉ!</span>
                      </div>
                      <p className="text-[11px]">
                        Giá bán ({formatMoney(editForm.priceCents)}) thấp hơn giá sỉ đại lý (
                        {formatMoney(editForm.providerPrice || editingProduct.variants[0]?.providerPrice || 0)}). Bấm xác nhận lần nữa nếu bạn đồng ý bán chịu lỗ.
                      </p>
                    </div>
                  )}

                  {/* 4. Highlights on Card */}
                  <div className="p-3.5 rounded-xl border border-border bg-secondary/20 space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                      Điểm nổi bật trên thẻ (2 - 3 ý chính)
                    </label>
                    <textarea
                      rows={3}
                      placeholder={"Kích hoạt chính chủ trên email cá nhân\nKhông cần thẻ thanh toán quốc tế\nHỗ trợ đổi mới trong thời gian bảo hành"}
                      value={editForm.highlights}
                      onChange={(e) => setEditForm({ ...editForm, highlights: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                    />
                    <p className="text-[10.5px] text-muted-foreground">
                      Mỗi dòng là 1 gạch đầu dòng nổi bật hiển thị trực tiếp trên thẻ sản phẩm ở trang chủ (tối đa 3 dòng).
                    </p>
                  </div>

                  {/* 5. Standardized 4 Sections */}
                  <div className="pt-2 border-t border-border/70 space-y-3">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-primary block">
                      Bố cục mô tả chi tiết:
                    </span>

                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">
                        1. Thông tin gói &amp; Quyền lợi *
                      </label>
                      <textarea
                        rows={3}
                        value={editForm.benefits}
                        onChange={(e) => setEditForm({ ...editForm, benefits: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">
                        2. Hướng dẫn sử dụng &amp; Nhận hàng
                      </label>
                      <textarea
                        rows={2}
                        value={editForm.instructions}
                        onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">
                        3. Chính sách bảo hành
                      </label>
                      <textarea
                        rows={2}
                        value={editForm.warranty}
                        onChange={(e) => setEditForm({ ...editForm, warranty: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-muted-foreground font-medium mb-1">
                        4. Lưu ý quan trọng trước khi mua
                      </label>
                      <textarea
                        rows={2}
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Real-time Live Card Preview (lg:col-span-5) */}
                <div className="lg:col-span-5 sticky top-0 space-y-3">
                  <div className="p-3.5 rounded-2xl border border-border/80 bg-secondary/30 backdrop-blur">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/50">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Eye className="size-3.5 text-accent" />
                        Xem trước thẻ thực tế
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        Live Preview
                      </span>
                    </div>

                    <div className="max-w-[320px] mx-auto">
                      <ProductCard
                        id={editingProduct.id}
                        name={editForm.name || "Tên sản phẩm"}
                        slug={editingProduct.slug}
                        description={editForm.benefits}
                        images={editForm.imageUrl.trim() ? [editForm.imageUrl.trim()] : []}
                        groupId={editForm.groupId}
                        groupName={selectedGroup?.name || "Chưa phân loại"}
                        deliveryType={editingProduct.deliveryType}
                        highlights={previewHighlights}
                        warrantyTerms={editForm.warranty}
                        noticeNotes={editForm.notes}
                        variants={previewVariant ? [previewVariant] : []}
                      />
                    </div>

                    <p className="text-[10.5px] text-center text-muted-foreground mt-3">
                      Thẻ hiển thị theo tỷ lệ 16:9, tự động tính nhãn giảm giá và cập nhật ngay khi bạn sửa thông tin.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-secondary/30">
              <a
                href={`/admin/products/preview/${editingProduct.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Eye className="size-3.5" />
                <span>Xem trước toàn trang</span>
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-3.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground text-xs"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveProduct("publish_now")}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  <span>
                    {saving
                      ? "Đang lưu..."
                      : "Lưu & Cập nhật giá lên web ngay"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Product Creation Modal */}
      {isAddManualOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
              <h3 className="font-bold text-sm text-foreground">Thêm Sản Phẩm Mới (Bản Nháp Ẩn)</h3>
              <button
                onClick={() => setIsAddManualOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Tên sản phẩm *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Duolingo Super 12 Tháng"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Danh mục nhóm *</label>
                <select
                  value={manualForm.groupId}
                  onChange={(e) => setManualForm({ ...manualForm, groupId: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-muted-foreground font-medium">
                    Ảnh đại diện 16:9
                  </label>
                  {manualForm.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setManualForm({ ...manualForm, imageUrl: "" })}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={manualFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUploadImage(file, "manual")
                        e.target.value = ""
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => manualFileInputRef.current?.click()}
                      disabled={isUploadingManualImage}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isUploadingManualImage ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Đang tải lên…</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="size-3.5" />
                          <span>Tải ảnh từ máy tính</span>
                        </>
                      )}
                    </button>

                    <input
                      type="url"
                      placeholder="Hoặc dán link: https://..."
                      value={manualForm.imageUrl}
                      onChange={(e) => setManualForm({ ...manualForm, imageUrl: e.target.value })}
                      className="flex-1 p-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono text-[11px]"
                    />
                  </div>

                  {manualForm.imageUrl && (
                    <div className="flex items-center gap-2.5 p-2 rounded-lg border border-border/60 bg-background/60">
                      <div className="size-10 rounded overflow-hidden border border-border shrink-0 bg-secondary/50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={manualForm.imageUrl}
                          alt="Preview"
                          className="size-full object-cover"
                          onError={(e) => {
                            ;(e.target as HTMLElement).style.display = "none"
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-foreground font-mono truncate flex-1">
                        {manualForm.imageUrl}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Hình thức bán *</label>
                <select
                  value={manualForm.deliveryType}
                  onChange={(e) => setManualForm({ ...manualForm, deliveryType: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="contact">Liên hệ Zalo đặt mua (Khuyên dùng cho đại lý không có API)</option>
                  <option value="serials">Kho mã / Key (Tự động)</option>
                  <option value="service">Nâng cấp thủ công</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Giá bên đại lý / Giá vốn (VNĐ)</label>
                  <input
                    type="number"
                    value={manualForm.providerPrice || 0}
                    onChange={(e) => setManualForm({ ...manualForm, providerPrice: Number(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="0"
                    step="any"
                    min={0}
                    title="Giá bạn mua từ đại lý (chỉ dùng nội bộ để tính lãi/lỗ)"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Giá bán niêm yết (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    value={manualForm.priceCents}
                    onChange={(e) => setManualForm({ ...manualForm, priceCents: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                    step="any"
                    min={0}
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Mô tả tóm tắt</label>
                <textarea
                  rows={3}
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Mô tả quyền lợi và thông tin sản phẩm..."
                />
              </div>

              <div className="p-3 rounded-xl bg-secondary/50 border border-border/80 text-[11px] text-muted-foreground">
                Sản phẩm tạo mới sẽ ở trạng thái <strong>Bản nháp ẩn</strong>, chưa công khai lên website cho đến khi bạn chủ động duyệt &ldquo;Đăng bán&rdquo;.
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddManualOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-muted-foreground hover:text-foreground text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Đang tạo..." : "Tạo bản nháp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
