import { calculateProductPricing } from '../lib/pricing'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`)
    process.exit(1)
  }
  console.log(`✅ PASSED: ${msg}`)
}

console.log('Testing calculateProductPricing...')

// 1. Single variant with valid discount
const res1 = calculateProductPricing([
  { id: 'v1', name: 'Gói 1 tháng', priceCents: 50000, compareAtPriceCents: 100000, availableStock: 10 },
])
assert(res1.lowestPrice === 50000, 'res1 lowestPrice is 50000')
assert(res1.comparePrice === 100000, 'res1 comparePrice is 100000')
assert(res1.discountPercent === 50, 'res1 discountPercent is 50%')
assert(res1.savings === 50000, 'res1 savings is 50000')
assert(res1.hasStock === true, 'res1 hasStock is true')

// 2. Multi-variant: variant with lowest price determines compare price (never mix)
const res2 = calculateProductPricing([
  { id: 'v1', name: 'Gói 12 tháng', priceCents: 120000, compareAtPriceCents: 200000, availableStock: 5 }, // 40% discount
  { id: 'v2', name: 'Gói 1 tháng', priceCents: 25000, compareAtPriceCents: 30000, availableStock: 10 }, // lowest price, 16% discount
])
assert(res2.lowestVariant?.id === 'v2', 'Picks lowest price variant v2')
assert(res2.lowestPrice === 25000, 'Lowest price is 25000')
assert(res2.comparePrice === 30000, 'Compare price is 30000 (from v2, not 200000 from v1)')
assert(res2.discountPercent === 16, 'Discount percent is 16% (Math.floor(5000 / 30000 * 100))')
assert(res2.hasMultipleVariants === true, 'hasMultipleVariants is true')

// 3. Multi-variant: out of stock variant is skipped if in-stock variant exists
const res3 = calculateProductPricing([
  { id: 'v1', name: 'Gói siêu rẻ (hết hàng)', priceCents: 10000, compareAtPriceCents: 20000, availableStock: 0 },
  { id: 'v2', name: 'Gói chuẩn (còn hàng)', priceCents: 40000, compareAtPriceCents: 60000, availableStock: 8 },
])
assert(res3.lowestVariant?.id === 'v2', 'Picks in-stock variant v2 over out-of-stock v1')
assert(res3.lowestPrice === 40000, 'Price is 40000')
assert(res3.hasStock === true, 'hasStock is true')

// 4. Strikethrough price <= price: no discount badge or savings
const res4 = calculateProductPricing([
  { id: 'v1', name: 'Gói bình thường', priceCents: 50000, compareAtPriceCents: 45000, availableStock: 10 },
])
assert(res4.comparePrice === null, 'comparePrice is null when compareAtPrice <= price')
assert(res4.discountPercent === null, 'discountPercent is null when compareAtPrice <= price')
assert(res4.savings === null, 'savings is null')

// 5. Completely out of stock
const res5 = calculateProductPricing([
  { id: 'v1', name: 'Gói A', priceCents: 50000, availableStock: 0 },
  { id: 'v2', name: 'Gói B', priceCents: 70000, availableStock: 0 },
])
assert(res5.hasStock === false, 'hasStock is false')
assert(res5.isOutOfStock === true, 'isOutOfStock is true')

console.log('All pricing calculation tests passed!')
