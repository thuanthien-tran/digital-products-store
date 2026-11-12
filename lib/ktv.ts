import { prisma, ensureDatabaseSchema } from "@/lib/db"
import { PriceMenuGroup } from "@/app/api/admin/price-list/route"

export interface KtvItem {
  id: string
  name: string
  note?: string
  price: number
  stock: number
  isEnabled: boolean
}

export interface KtvGroup {
  id: string
  name: string
  sortOrder: number
  isEnabled: boolean
  items: KtvItem[]
}

export interface CustomColors {
  containerBg: string
  accentColor: string
  textColor: string
}

export interface ThemeConfig {
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

export const THEMES: ThemeConfig[] = [
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

export function resolveTheme(themeId?: string, customColors?: Partial<CustomColors>): ThemeConfig {
  const base = THEMES.find((t) => t.id === themeId) || THEMES[0]
  if (customColors && (customColors.containerBg || customColors.accentColor || customColors.textColor)) {
    return {
      ...base,
      id: themeId || "custom",
      name: themeId === "custom" ? "Tùy chỉnh cá nhân" : base.name,
      containerBg: customColors.containerBg || base.containerBg,
      accentColor: customColors.accentColor || base.accentColor,
      textColor: customColors.textColor || base.textColor,
      dividerColor: customColors.accentColor || base.dividerColor,
      priceColor: customColors.textColor || base.priceColor,
    }
  }
  return base
}

export interface KtvMeta {
  menuTitle: string
  menuSubtitle: string
  footerDomain: string
  footerNote: string
  hotline: string
  showStock: boolean
  showNotes: boolean
  showLeaderDots: boolean
  currencyUnit: "đ" | "VNĐ" | "k"
  selectedThemeId: string
  customColors?: CustomColors
  theme: ThemeConfig
}

export interface KtvPriceListPayload {
  groups: KtvGroup[]
  meta: KtvMeta
  updatedAt: string
}

export async function getKtvPriceListData(): Promise<KtvPriceListPayload> {
  await ensureDatabaseSchema()

  const [settings, products, productGroups] = await Promise.all([
    prisma.siteSettings.findFirst(),
    prisma.product.findMany({
      where: {
        editorialStatus: "published",
        visibility: "public",
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      include: {
        group: true,
        variants: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
          include: {
            _count: {
              select: { serials: { where: { status: "available" } } },
            },
          },
        },
      },
    }),
    prisma.productGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ])

  // Build real-time lookup maps for live prices and stock
  const variantStockMap = new Map<string, { stock: number; price: number }>()
  const productStockMap = new Map<string, { stock: number; price: number }>()

  for (const p of products) {
    let prodStock = 0
    let minPrice = Infinity

    for (const v of p.variants) {
      const vStock = (v.providerStock ?? 0) + (v._count?.serials ?? 0)
      variantStockMap.set(v.id, { stock: vStock, price: v.priceCents })
      prodStock += vStock
      if (v.priceCents < minPrice) minPrice = v.priceCents
    }

    productStockMap.set(p.id, {
      stock: prodStock,
      price: minPrice === Infinity ? 0 : minPrice,
    })
  }

  // Parse Admin's custom priceListConfig
  let config: any = null
  const rawConfig = (settings as any)?.priceListConfig
  if (rawConfig && typeof rawConfig === "string") {
    try {
      config = JSON.parse(rawConfig)
    } catch {}
  }

  let groups: PriceMenuGroup[] = []
  let menuTitle = "BẢNG GIÁ"
  let menuSubtitle = "Tài khoản • Phần mềm • API"
  let footerDomain = "capygo.id.vn"
  let footerNote = "KBH: Không bảo hành • Giá và tình trạng có thể thay đổi"
  let hotline = process.env.NEXT_PUBLIC_ZALO_PHONE_1 || "0356.970.964"
  let showStock = true
  let showNotes = true
  let showLeaderDots = false
  let currencyUnit: "đ" | "VNĐ" | "k" = "đ"
  let selectedThemeId = "luxury-dark"
  let customColors: CustomColors | undefined = undefined

  if (config) {
    if (Array.isArray(config.groups)) groups = config.groups
    if (config.menuTitle) menuTitle = config.menuTitle
    if (config.menuSubtitle !== undefined) menuSubtitle = config.menuSubtitle
    if (config.footerDomain) footerDomain = config.footerDomain
    if (config.footerNote) footerNote = config.footerNote
    if (config.hotline) hotline = config.hotline
    if (config.showStock !== undefined) showStock = config.showStock
    if (config.showNotes !== undefined) showNotes = config.showNotes
    if (config.showLeaderDots !== undefined) showLeaderDots = config.showLeaderDots
    if (config.currencyUnit) currencyUnit = config.currencyUnit
    if (config.selectedThemeId) selectedThemeId = config.selectedThemeId
    if (config.customColors) customColors = config.customColors
  }

  // Resolve theme with customColors priority
  const theme = resolveTheme(selectedThemeId, customColors)

  // Fallback: If admin hasn't configured custom groups yet, auto-generate from store products
  if (groups.length === 0) {
    const gMap = new Map<string, { id: string; name: string; sortOrder: number; items: any[] }>()
    for (const g of productGroups) {
      gMap.set(g.id, {
        id: g.id,
        name: g.name.toUpperCase(),
        sortOrder: g.sortOrder || 0,
        items: [],
      })
    }
    const otherId = "other"
    gMap.set(otherId, {
      id: otherId,
      name: "SẢN PHẨM KHÁC",
      sortOrder: 999,
      items: [],
    })

    for (const p of products) {
      const targetGroup = (p.groupId && gMap.get(p.groupId)) || gMap.get(otherId)!
      if (p.variants.length > 0) {
        for (const v of p.variants) {
          const vStock = (v.providerStock ?? 0) + (v._count?.serials ?? 0)
          targetGroup.items.push({
            id: `v-${v.id}`,
            name: p.variants.length > 1 ? `${p.name} | ${v.name}` : p.name,
            price: v.priceCents,
            stock: vStock,
            isEnabled: true,
            sortOrder: targetGroup.items.length,
            linkedProductId: p.id,
            linkedVariantId: v.id,
          })
        }
      } else {
        targetGroup.items.push({
          id: `p-${p.id}`,
          name: p.name,
          price: 0,
          stock: 0,
          isEnabled: true,
          sortOrder: targetGroup.items.length,
          linkedProductId: p.id,
        })
      }
    }

    groups = Array.from(gMap.values())
      .filter((g) => g.items.length > 0)
      .map((g) => ({
        ...g,
        isEnabled: true,
      }))
  }

  // Filter to ONLY enabled groups and ONLY enabled items
  const liveGroups: KtvGroup[] = groups
    .filter((g) => g.isEnabled)
    .map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder || 0,
      isEnabled: true,
      items: g.items
        .filter((item) => item.isEnabled)
        .map((item) => {
          let livePrice = item.price
          let liveStock = item.stock

          if (item.linkedVariantId && variantStockMap.has(item.linkedVariantId)) {
            const live = variantStockMap.get(item.linkedVariantId)!
            liveStock = live.stock
            if (livePrice === undefined || livePrice === null || livePrice <= 0) {
              livePrice = live.price
            }
          } else if (item.linkedProductId && productStockMap.has(item.linkedProductId)) {
            const live = productStockMap.get(item.linkedProductId)!
            liveStock = live.stock
            if (livePrice === undefined || livePrice === null || livePrice <= 0) {
              livePrice = live.price
            }
          }

          return {
            id: item.id,
            name: item.name,
            note: item.note,
            price: livePrice,
            stock: liveStock,
            isEnabled: true,
          }
        }),
    }))
    .filter((g) => g.items.length > 0)

  return {
    groups: liveGroups,
    meta: {
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
      theme,
    },
    updatedAt: new Date().toISOString(),
  }
}
