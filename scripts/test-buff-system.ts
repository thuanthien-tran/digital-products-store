import { PrismaClient } from '@prisma/client'
import { updateProductDetails } from '../lib/product-catalog-service'
import { evaluateVariantPurchasability } from '../lib/purchasability'
import { calculateExpectedBuffCost, isValidInviteCode, normalizeInviteCode } from '../lib/buff-pricing'

const prisma = new PrismaClient()

async function runTests() {
  console.log('==================================================')
  console.log('       TESTING BUFF TOKEN MUSE AI SYSTEM          ')
  console.log('==================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`)
      passed++
    } else {
      console.error(`[FAIL] ${testName} - ${detail || 'Assertion failed'}`)
      failed++
    }
  }

  // 1. Test Wholesale Tier Pricing Policy
  console.log('--- 1. Testing Wholesale Tier Pricing ---')
  assert(calculateExpectedBuffCost(1) === 3000, 'Tier 1B wholesale cost = 3.000đ')
  assert(calculateExpectedBuffCost(5) === 15000, 'Tier 5B wholesale cost = 15.000đ')
  assert(calculateExpectedBuffCost(10) === 20000, 'Tier 10B wholesale cost = 20.000đ (2.000đ/B)')
  assert(calculateExpectedBuffCost(20) === 40000, 'Tier 20B wholesale cost = 40.000đ')
  assert(calculateExpectedBuffCost(30) === 60000, 'Tier 30B wholesale cost = 60.000đ')

  // 2. Test Invite Code Validation
  console.log('\n--- 2. Testing Invite Code Validation ---')
  assert(isValidInviteCode('0FBALX'), 'Valid invite code: 0FBALX')
  assert(isValidInviteCode('ABCD1234EF'), 'Valid longer invite code: ABCD1234EF')
  assert(!isValidInviteCode(''), 'Empty invite code is invalid')
  assert(!isValidInviteCode('AB'), 'Too short (<4) invite code is invalid')
  assert(!isValidInviteCode('INVALID-CODE!'), 'Non-alphanumeric invite code is invalid')
  assert(normalizeInviteCode('  0fbalx  ') === '0FBALX', 'Normalizes and uppercases invite code')

  // 3. Test Muse AI Buff Product in Database
  console.log('\n--- 3. Testing Muse AI Buff Product & Variants in DB ---')
  const museProduct = await prisma.product.findFirst({
    where: { slug: 'dich-vu-bo-sung-token-muse-ai' },
    include: { variants: { orderBy: { sortOrder: 'asc' } } },
  })

  assert(Boolean(museProduct), 'Muse Buff Product exists in database')
  assert(museProduct?.fulfillmentType === 'buff', 'fulfillmentType is "buff"')
  assert(museProduct?.quantityMode === 'fixed_package', 'quantityMode is "fixed_package"')
  assert(museProduct?.requiresInviteCode === true, 'requiresInviteCode is true')
  assert((museProduct?.variants.length || 0) === 5, 'Has exactly 5 standard packages')

  const variant10B = museProduct?.variants.find((v) => v.tokenAmountB === 10)
  assert(Boolean(variant10B), '10B variant exists')
  assert(variant10B?.tokenAmountB === 10, '10B variant tokenAmountB === 10')
  assert(variant10B?.providerPrice === 20000, '10B variant providerPrice === 20000')

  // 4. Test Purchasability Evaluation
  console.log('\n--- 4. Testing Purchasability ---')
  if (museProduct && variant10B) {
    const purchasability = evaluateVariantPurchasability({
      product: {
        id: museProduct.id,
        name: museProduct.name,
        visibility: museProduct.visibility,
        editorialStatus: museProduct.editorialStatus,
        statusOverride: museProduct.statusOverride,
        deliveryType: museProduct.deliveryType,
      },
      variant: {
        id: variant10B.id,
        name: variant10B.name,
        priceCents: variant10B.priceCents,
        minQuantity: 1,
        maxQuantity: 1,
        provider: 'shoptool',
        providerStock: 999,
        connectionId: variant10B.connectionId,
        isActive: true,
      },
      localSerialCount: 0,
    })

    assert(purchasability.isPurchasable === true, 'Variant 10B is purchasable with virtual capacity')
    assert(purchasability.availableStock >= 999, 'Variant 10B has available virtual stock')
  }

  // 5. Test Multi-Variant Update via Catalog Service
  console.log('\n--- 5. Testing Multi-Variant Catalog Service Updates ---')
  if (museProduct) {
    const originalVariants = museProduct.variants
    const updatedPrice = 42000
    await updateProductDetails(museProduct.id, {
      variants: originalVariants.map((v) => ({
        id: v.id,
        name: v.name,
        tokenAmountB: v.tokenAmountB,
        providerPrice: v.providerPrice,
        priceCents: v.tokenAmountB === 10 ? updatedPrice : v.priceCents,
        compareAtPriceCents: v.compareAtPriceCents,
        isActive: v.isActive,
        sortOrder: v.sortOrder,
      })),
    })

    const refreshed = await prisma.variant.findUnique({
      where: { id: variant10B!.id },
    })
    assert(refreshed?.priceCents === updatedPrice, `Multi-variant price updated to ${updatedPrice}`)

    // Restore original price
    await prisma.variant.update({
      where: { id: variant10B!.id },
      data: { priceCents: variant10B!.priceCents },
    })
  }

  // 6. Test Order Creation & Fulfillment State Machine
  console.log('\n--- 6. Testing Order Fulfillment & Idempotency ---')
  if (museProduct && variant10B) {
    const testCode = `TEST_${Date.now().toString(36).toUpperCase()}`
    const testInviteCode = '0FBALX'

    // Create test order
    const testOrder = await prisma.order.create({
      data: {
        code: testCode,
        email: 'test_buff@capygo.vn',
        subtotalCents: variant10B.priceCents,
        discountCents: 0,
        totalCents: variant10B.priceCents,
        status: 'pending',
        inviteCode: testInviteCode,
        items: {
          create: [
            {
              productId: museProduct.id,
              variantId: variant10B.id,
              quantity: 1, // Fixed package is 1
              priceCents: variant10B.priceCents,
              productName: museProduct.name,
              variantName: variant10B.name,
              tokenAmountB: variant10B.tokenAmountB, // 10B
              inviteCode: testInviteCode,
              providerCost: variant10B.providerPrice,
            },
          ],
        },
      },
      include: { items: true },
    })

    assert(Boolean(testOrder), `Test Order created: ${testOrder.code}`)
    assert(testOrder.inviteCode === testInviteCode, 'Order inviteCode stored correctly')
    assert(testOrder.items[0].tokenAmountB === 10, 'OrderItem tokenAmountB is 10 (not 1)')
    assert(testOrder.items[0].quantity === 1, 'OrderItem quantity is 1 package')

    // Simulate fulfillment record creation (idempotent submission simulation)
    const orderItemId = testOrder.items[0].id
    const buffRec = await prisma.buffFulfillment.create({
      data: {
        orderItemId,
        orderId: testOrder.id,
        inviteCode: testInviteCode,
        tokenAmountB: 10,
        status: 'submitting',
        partnerRef: `${testOrder.code}-${orderItemId}`,
      },
    })
    assert(buffRec.status === 'submitting', 'BuffFulfillment created with status "submitting"')
    assert(buffRec.tokenAmountB === 10, 'BuffFulfillment tokenAmountB recorded as 10')

    // Transition to processing with mock provider code
    const mockProviderCode = `ST_ORDER_${Date.now()}`
    await prisma.buffFulfillment.update({
      where: { id: buffRec.id },
      data: {
        status: 'processing',
        providerOrderCode: mockProviderCode,
        usedMethod: 'credit',
      },
    })

    // Now test that fulfillOrder does NOT duplicate submission
    const { fulfillOrder } = await import('../lib/fulfillment')
    const fulfillResult = await fulfillOrder(testOrder.id)

    assert(fulfillResult.success === true, 'fulfillOrder succeeded')
    assert(fulfillResult.fullyFulfilled === true, 'Order counted as fully fulfilled')

    // Verify no fake serials created
    const serialCount = await prisma.serial.count({
      where: { orderItemId },
    })
    assert(serialCount === 0, 'No fake serial records created in database')

    // Check BuffFulfillment status remained stable
    const finalBuffRec = await prisma.buffFulfillment.findUnique({
      where: { orderItemId },
    })
    assert(finalBuffRec?.status === 'processing', 'BuffFulfillment retained status "processing" (idempotent)')
    assert(finalBuffRec?.providerOrderCode === mockProviderCode, 'Provider order code preserved')

    // Cleanup test order
    await prisma.buffFulfillment.deleteMany({ where: { orderId: testOrder.id } })
    await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } })
    await prisma.order.delete({ where: { id: testOrder.id } })
    console.log('Cleaned up test order.')
  }

  console.log('\n==================================================')
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log('==================================================')

  if (failed > 0) process.exit(1)
}

runTests()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
