import { normalizeVietnamese } from '../lib/utils'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`✅ PASSED: ${msg}`)
}

console.log('Testing Search, Category and Price Range Filtering...')

// Mock catalog data
const mockProducts = [
  {
    id: 'p1',
    name: 'Link Duolingo Super 12 tháng KBH',
    groupName: 'Học Tập & Ngôn Ngữ',
    groupId: 'g-study',
    description: 'Không cần add thẻ visa.',
    variants: [{ priceCents: 45000, availableStock: 10, name: '12 tháng' }],
  },
  {
    id: 'p2',
    name: 'Tài khoản Canva Pro Vĩnh Viễn',
    groupName: 'Đồ Họa & Thiết Kế',
    groupId: 'g-design',
    description: 'Full tính năng premium.',
    variants: [{ priceCents: 85000, availableStock: 5, name: 'Vĩnh viễn' }],
  },
  {
    id: 'p3',
    name: 'ChatGPT Plus 1 Tháng',
    groupName: 'Trí Tuệ Nhân Tạo (AI)',
    groupId: 'g-ai',
    description: 'Mô hình GPT-4o.',
    variants: [{ priceCents: 250000, availableStock: 3, name: '1 tháng' }],
  },
]

type PriceRangeKey = 'all' | 'under_50k' | '50k_100k' | '100k_200k' | 'above_200k'

function filterCatalog(
  products: typeof mockProducts,
  selectedGroup: string,
  searchQuery: string,
  priceRange: PriceRangeKey
) {
  const qTrim = searchQuery.trim().toLowerCase()
  const qNorm = normalizeVietnamese(searchQuery)

  return products.filter((p) => {
    // 1. Group
    if (selectedGroup !== 'all' && p.groupId !== selectedGroup) return false

    // 2. Price
    const lowestPrice = p.variants[0].priceCents
    if (priceRange === 'under_50k' && lowestPrice >= 50000) return false
    if (priceRange === '50k_100k' && (lowestPrice < 50000 || lowestPrice > 100000)) return false
    if (priceRange === '100k_200k' && (lowestPrice < 100000 || lowestPrice > 200000)) return false
    if (priceRange === 'above_200k' && lowestPrice <= 200000) return false

    // 3. Search query
    if (!qTrim) return true

    const nameLow = p.name.toLowerCase()
    const nameNorm = normalizeVietnamese(p.name)
    if (nameLow.includes(qTrim) || nameNorm.includes(qNorm)) return true

    const groupLow = p.groupName.toLowerCase()
    const groupNorm = normalizeVietnamese(p.groupName)
    if (groupLow.includes(qTrim) || groupNorm.includes(qNorm)) return true

    return false
  })
}

// 1. Price Filter: under_50k -> should only return Duolingo (45.000)
const r1 = filterCatalog(mockProducts, 'all', '', 'under_50k')
assert(r1.length === 1 && r1[0].id === 'p1', 'Price filter under_50k matches Duolingo (45k)')

// 2. Price Filter: 50k_100k -> should only return Canva (85.000)
const r2 = filterCatalog(mockProducts, 'all', '', '50k_100k')
assert(r2.length === 1 && r2[0].id === 'p2', 'Price filter 50k_100k matches Canva (85k)')

// 3. Price Filter: above_200k -> should only return ChatGPT Plus (250.000)
const r3 = filterCatalog(mockProducts, 'all', '', 'above_200k')
assert(r3.length === 1 && r3[0].id === 'p3', 'Price filter above_200k matches ChatGPT Plus (250k)')

// 4. Combined: Category + Price
const r4 = filterCatalog(mockProducts, 'g-study', '', 'under_50k')
assert(r4.length === 1 && r4[0].id === 'p1', 'Combined category + price matches correctly')

// 5. Combined: Search "canva" + Price 50k_100k
const r5 = filterCatalog(mockProducts, 'all', 'canva', '50k_100k')
assert(r5.length === 1 && r5[0].id === 'p2', 'Search canva + price 50k_100k matches Canva')

console.log('All search, category and price filter tests passed!')
