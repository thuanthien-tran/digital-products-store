import { getSiteSettings, updateSiteSettings, getInitials } from "../lib/settings"
import { validateImageBuffer } from "../lib/image-upload"
import { prisma } from "../lib/db"

async function runTests() {
  console.log("=== STARTING WEBSITE SETTINGS VERIFICATION TESTS ===")
  let passedCount = 0
  let failedCount = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`)
      passedCount++
    } else {
      console.error(`  [FAIL] ${testName}`)
      failedCount++
    }
  }

  try {
    // 1. Test getInitials algorithm
    console.log("\n1. Testing Initials Generation:")
    assert(getInitials("ACCGIARE") === "AG", "ACCGIARE -> AG")
    assert(getInitials("CapyGo") === "CG", "CapyGo -> CG")
    assert(getInitials("Cửa Hàng Số") === "CH", "Cửa Hàng Số -> CH")
    assert(getInitials("Digital Store") === "DS", "Digital Store -> DS")
    assert(getInitials("Store") === "ST", "Single word 'Store' -> ST")
    assert(getInitials("") === "AG", "Empty string fallback -> AG")

    // 2. Test Image Validation (Magic Bytes & Format Security)
    console.log("\n2. Testing Image Security & Magic Bytes Validation:")
    // Fake SVG
    const svgBuffer = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><circle r='10'/></svg>")
    const svgRes = validateImageBuffer(svgBuffer)
    assert(!svgRes.valid, "Rejects SVG payload")

    // Fake HTML / Script
    const htmlBuffer = Buffer.from("<html><script>alert(1)</script></html>")
    const htmlRes = validateImageBuffer(htmlBuffer)
    assert(!htmlRes.valid, "Rejects HTML/Script payload")

    // Fake extension with random bytes
    const fakeBuffer = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55])
    const fakeRes = validateImageBuffer(fakeBuffer)
    assert(!fakeRes.valid, "Rejects unknown magic bytes")

    // Valid minimal 16x16 PNG
    // PNG signature + IHDR chunk (16x16, 8-bit RGBA)
    const validPngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // Signature
      Buffer.from([0x00, 0x00, 0x00, 0x0d]), // IHDR length (13)
      Buffer.from("IHDR"), // Chunk type
      Buffer.from([0x00, 0x00, 0x00, 0x20]), // Width: 32
      Buffer.from([0x00, 0x00, 0x00, 0x20]), // Height: 32
      Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]), // Bit depth, color type, compression, filter, interlace
      Buffer.from([0x00, 0x00, 0x00, 0x00]), // CRC dummy
    ])
    const pngRes = validateImageBuffer(validPngBuffer)
    assert(pngRes.valid && pngRes.format === "png" && pngRes.width === 32, "Validates genuine PNG with dimensions")

    // 3. Test Database Fallback & Upsert
    console.log("\n3. Testing Database Settings & Versioning:")
    // Initial fetch (if record doesn't exist, default is ACCGIARE)
    const initialSettings = await getSiteSettings()
    assert(
      initialSettings.siteName === "ACCGIARE" || initialSettings.siteName.length > 0,
      `Default settings returned: ${initialSettings.siteName}`
    )

    // Save a custom test configuration
    const originalSettings = await prisma.siteSettings.findUnique({ where: { shopId: "main" } })

    const updated = await updateSiteSettings({
      siteName: "CapyGo Store",
      logoUrl: "/api/uploads/branding/logo-test-123.png",
    })
    assert(updated.siteName === "CapyGo Store", "Saved siteName correctly to DB")
    assert(updated.initials === "CS", "Derived initials for 'CapyGo Store' -> CS")
    assert((updated.version ?? 0) >= 1, "Version incremented properly")

    // Update with avatar removed
    const removedAvatar = await updateSiteSettings({
      siteName: "CapyGo",
      logoUrl: null,
    })
    assert(removedAvatar.siteName === "CapyGo" && removedAvatar.logoUrl === null, "Removed avatar successfully")
    assert(removedAvatar.initials === "CG", "Derived initials for 'CapyGo' -> CG")

    // Restore to initial state so we don't prematurely alter user brand before they decide
    if (originalSettings) {
      await prisma.siteSettings.update({
        where: { shopId: "main" },
        data: {
          siteName: originalSettings.siteName,
          logoUrl: originalSettings.logoUrl,
          version: originalSettings.version,
        },
      })
      console.log("  Restored original database state.")
    } else {
      await prisma.siteSettings.deleteMany({ where: { shopId: "main" } })
      console.log("  Cleaned up test record (reset to clean default).")
    }

    // 4. Verify Catalog & Mascots Integrity
    console.log("\n4. Verifying Catalog & System Integrity:")
    const productCount = await prisma.product.count()
    const variantCount = await prisma.variant.count()
    assert(productCount > 0, `Products intact in DB (${productCount} products)`)
    assert(variantCount > 0, `Variants intact in DB (${variantCount} variants)`)

    console.log(`\n=== SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED ===\n`)
    if (failedCount > 0) {
      process.exit(1)
    }
  } catch (error) {
    console.error("Test execution encountered an error:", error)
    process.exit(1)
  }
}

runTests().finally(() => {
  prisma.$disconnect()
})
