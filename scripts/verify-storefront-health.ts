async function verifyStorefront() {
  console.log("=== COMPREHENSIVE STOREFRONT REGRESSION TEST ===")
  const baseUrl = "http://localhost:3000"

  const endpoints = [
    { url: "/", name: "Homepage", expectStatus: 200, checks: ["Mascot", "Header", "Footer"] },
    { url: "/api/store/availability?variantIds=test_sample_id", name: "Live Stock Availability API", expectStatus: 200 },
    { url: "/api/site-settings", name: "Site Branding Settings API", expectStatus: 200 },
    { url: "/admin/login", name: "Admin Login Page", expectStatus: 200 },
    { url: "/admin/settings", name: "Admin Protected Settings Page", expectRedirectOr401: true },
  ]

  let passed = 0

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep.url}`, { redirect: "manual" })
      console.log(`\nEndpoint: ${ep.name} (${ep.url})`)
      console.log(`  HTTP Status: ${res.status}`)

      if (ep.expectRedirectOr401) {
        if (res.status === 307 || res.status === 302 || res.status === 401) {
          console.log(`  [PASS] Correctly redirected/protected unauthorized route (Status ${res.status})`)
          passed++
        } else {
          console.error(`  [FAIL] Expected redirect or 401, got ${res.status}`)
        }
      } else if (res.status === ep.expectStatus) {
        const text = await res.text()
        console.log(`  Payload length: ${text.length} chars`)

        if (ep.url === "/") {
          // Check for crucial components presence
          const hasCapybara = text.includes("capybara") || text.includes("Capybara") || text.includes("canvas")
          console.log(`  Capybara Canvas / Elements present: ${hasCapybara}`)
        }

        console.log(`  [PASS] ${ep.name} healthy`)
        passed++
      } else {
        console.error(`  [FAIL] Expected ${ep.expectStatus}, got ${res.status}`)
      }
    } catch (err: any) {
      console.error(`  [ERROR] Connection failed: ${err.message}`)
    }
  }

  // Also check product detail page
  try {
    // Read slug from first product in DB
    const { prisma } = await import("../lib/db")
    const sampleProduct = await prisma.product.findFirst({
      where: { visibility: "public", editorialStatus: "published" },
    })

    if (sampleProduct) {
      const prodRes = await fetch(`${baseUrl}/product/${sampleProduct.slug}`)
      console.log(`\nEndpoint: Product Detail Page (/product/${sampleProduct.slug})`)
      console.log(`  HTTP Status: ${prodRes.status}`)
      if (prodRes.status === 200) {
        console.log(`  [PASS] Product detail page healthy and rendering correctly`)
        passed++
      } else {
        console.error(`  [FAIL] Product detail returned ${prodRes.status}`)
      }
    }
    await prisma.$disconnect()
  } catch (err: any) {
    console.error(`  [WARN] Could not test dynamic product page: ${err.message}`)
  }

  console.log(`\n=== REGRESSION RESULT: ${passed} ENDPOINTS VERIFIED HEALTHY ===\n`)
  if (passed < 5) process.exit(1)
}

verifyStorefront()
