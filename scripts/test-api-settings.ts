import fs from "fs"
import path from "path"

// Load .env into process.env if running as standalone script
const envPath = path.resolve(process.cwd(), ".env")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
        process.env[key] = val
      }
    }
  }
}

import { signAdminToken } from "../lib/auth"

async function runApiTests() {
  console.log("=== TESTING API ENDPOINTS (/api/admin/settings & /api/site-settings) ===")
  const baseUrl = "http://localhost:3000"

  // 1. Test public GET /api/site-settings
  console.log("\n1. Testing Public GET /api/site-settings:")
  const publicRes = await fetch(`${baseUrl}/api/site-settings`)
  console.log("  Status:", publicRes.status)
  const publicData = await publicRes.json()
  console.log("  Response:", publicData)
  if (publicRes.status === 200 && publicData.siteName) {
    console.log("  [PASS] Public site-settings endpoint works correctly")
  } else {
    console.error("  [FAIL] Public endpoint failed")
    process.exit(1)
  }

  // 2. Test Unauthorized access to /api/admin/settings (GET & PUT)
  console.log("\n2. Testing Unauthorized Access (Expect 401):")
  const unauthGet = await fetch(`${baseUrl}/api/admin/settings`)
  console.log("  GET without auth:", unauthGet.status)
  if (unauthGet.status === 401) {
    console.log("  [PASS] GET /api/admin/settings blocked unauthorized (401)")
  } else {
    console.error("  [FAIL] Should be 401")
    process.exit(1)
  }

  const unauthPut = await fetch(`${baseUrl}/api/admin/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteName: "HackerStore" }),
  })
  console.log("  PUT without auth:", unauthPut.status)
  if (unauthPut.status === 401) {
    console.log("  [PASS] PUT /api/admin/settings blocked unauthorized (401)")
  } else {
    console.error("  [FAIL] Should be 401")
    process.exit(1)
  }

  const unauthUpload = await fetch(`${baseUrl}/api/admin/settings/upload`, {
    method: "POST",
  })
  console.log("  POST /upload without auth:", unauthUpload.status)
  if (unauthUpload.status === 401) {
    console.log("  [PASS] POST /api/admin/settings/upload blocked unauthorized (401)")
  } else {
    console.error("  [FAIL] Should be 401")
    process.exit(1)
  }

  // 3. Test Authorized Admin Access
  console.log("\n3. Testing Authorized Admin Access:")
  const adminToken = await signAdminToken("admin")
  const authHeaders = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  }

  const authGet = await fetch(`${baseUrl}/api/admin/settings`, {
    headers: authHeaders,
  })
  console.log("  GET with auth status:", authGet.status)
  const authGetData = await authGet.json()
  console.log("  Current settings data:", authGetData)
  if (authGet.status === 200 && authGetData.siteName) {
    console.log("  [PASS] GET /api/admin/settings succeeded with admin token")
  } else {
    console.error("  [FAIL] Failed authorized GET")
    process.exit(1)
  }

  // 4. Test Validation on PUT (Too short, too long, HTML injection)
  console.log("\n4. Testing Input Validation Rules:")
  const shortPut = await fetch(`${baseUrl}/api/admin/settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ siteName: "A" }), // <2 chars
  })
  console.log("  PUT short name status:", shortPut.status)
  if (shortPut.status === 400) {
    console.log("  [PASS] Rejects <2 chars")
  } else {
    console.error("  [FAIL] Should reject <2 chars")
    process.exit(1)
  }

  const htmlPut = await fetch(`${baseUrl}/api/admin/settings`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ siteName: "Evil<script>alert(1)</script>" }),
  })
  console.log("  PUT HTML tags status:", htmlPut.status)
  if (htmlPut.status === 400) {
    console.log("  [PASS] Rejects HTML/script tags")
  } else {
    console.error("  [FAIL] Should reject HTML tags")
    process.exit(1)
  }

  // 5. Test Safe Image Upload with real FormData
  console.log("\n5. Testing Safe Image Upload API:")
  // Create genuine 32x32 PNG file
  const validPngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d]),
    Buffer.from("IHDR"),
    Buffer.from([0x00, 0x00, 0x00, 0x20]),
    Buffer.from([0x00, 0x00, 0x00, 0x20]),
    Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
  ])

  const formData = new FormData()
  formData.append("file", new Blob([validPngBuffer], { type: "image/png" }), "avatar.png")

  const uploadRes = await fetch(`${baseUrl}/api/admin/settings/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
    body: formData,
  })

  console.log("  Upload status:", uploadRes.status)
  const uploadData = await uploadRes.json()
  console.log("  Upload response:", uploadData)
  if (uploadRes.status === 200 && uploadData.success && uploadData.url) {
    console.log("  [PASS] Upload genuine PNG succeeded and returned URL:", uploadData.url)

    // Test serving endpoint
    console.log("\n6. Testing Image Serving Endpoint:")
    const serveRes = await fetch(`${baseUrl}${uploadData.url}`)
    console.log("  Serve status:", serveRes.status)
    console.log("  Content-Type:", serveRes.headers.get("content-type"))
    console.log("  X-Content-Type-Options:", serveRes.headers.get("x-content-type-options"))
    if (
      serveRes.status === 200 &&
      serveRes.headers.get("content-type") === "image/png" &&
      serveRes.headers.get("x-content-type-options") === "nosniff"
    ) {
      console.log("  [PASS] Image served securely with nosniff and correct MIME type")
    } else {
      console.error("  [FAIL] Image serve failed header verification")
      process.exit(1)
    }
  } else {
    console.error("  [FAIL] Upload failed")
    process.exit(1)
  }

  console.log("\n=== ALL API TESTS PASSED SUCCESSFULLY! ===\n")
}

runApiTests()
