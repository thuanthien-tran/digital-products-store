import { NextRequest, NextResponse } from "next/server"
import { verifyAdminRequest } from "@/lib/auth"
import { getSiteSettings, updateSiteSettings } from "@/lib/settings"

// Maximum allowed length for store name
const MIN_NAME_LENGTH = 2
const MAX_NAME_LENGTH = 60

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên" }, { status: 401 })
  }

  try {
    const settings = await getSiteSettings()
    return NextResponse.json(settings)
  } catch (error: any) {
    console.error("[GET /api/admin/settings] Error:", error)
    return NextResponse.json({ error: "Không thể lấy cấu hình website" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Yêu cầu đăng nhập quản trị viên" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      siteName,
      siteTitle,
      logoUrl,
      heroTitle,
      heroSubtitle,
      heroTitleColor,
      heroHighlightColor,
      heroCtaText,
      showVisitorStats,
      version,
    } = body

    if (typeof siteName !== "string") {
      return NextResponse.json({ error: "Tên website không hợp lệ." }, { status: 400 })
    }

    const trimmedName = siteName.trim()
    let trimmedTitle: string | null | undefined = undefined
    if (siteTitle !== undefined) {
      if (typeof siteTitle === "string") {
        trimmedTitle = siteTitle.trim() || null
        if (trimmedTitle && /[<>]/.test(trimmedTitle)) {
          return NextResponse.json(
            { error: "Tiêu đề website không được chứa ký tự đặc biệt như dấu < hoặc >." },
            { status: 400 }
          )
        }
      } else if (siteTitle === null) {
        trimmedTitle = null
      }
    }

    if (trimmedName.length < MIN_NAME_LENGTH || trimmedName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Tên website phải từ ${MIN_NAME_LENGTH} đến ${MAX_NAME_LENGTH} ký tự.` },
        { status: 400 }
      )
    }

    // Disallow HTML tags or angle brackets for security
    if (/[<>]/.test(trimmedName)) {
      return NextResponse.json(
        { error: "Tên website không được chứa ký tự đặc biệt như dấu < hoặc >." },
        { status: 400 }
      )
    }

    // Validate logoUrl format if provided
    let cleanLogoUrl: string | null = null
    if (logoUrl !== undefined && logoUrl !== null && logoUrl !== "") {
      if (typeof logoUrl !== "string") {
        return NextResponse.json({ error: "Đường dẫn ảnh không hợp lệ." }, { status: 400 })
      }
      const trimmedLogo = logoUrl.trim()
      // Allow relative uploads or valid safe URLs
      if (
        !trimmedLogo.startsWith("/api/uploads/branding/") &&
        !trimmedLogo.startsWith("/uploads/") &&
        !trimmedLogo.startsWith("http://") &&
        !trimmedLogo.startsWith("https://")
      ) {
        return NextResponse.json({ error: "Đường dẫn ảnh không hợp lệ." }, { status: 400 })
      }
      cleanLogoUrl = trimmedLogo
    }

    const updated = await updateSiteSettings({
      siteName: trimmedName,
      siteTitle: trimmedTitle,
      logoUrl: cleanLogoUrl,
      heroTitle: typeof heroTitle === "string" ? heroTitle.trim() || null : (heroTitle === null ? null : undefined),
      heroSubtitle: typeof heroSubtitle === "string" ? heroSubtitle.trim() || null : (heroSubtitle === null ? null : undefined),
      heroTitleColor: typeof heroTitleColor === "string" ? heroTitleColor.trim() || null : undefined,
      heroHighlightColor: typeof heroHighlightColor === "string" ? heroHighlightColor.trim() || null : undefined,
      heroCtaText: typeof heroCtaText === "string" ? heroCtaText.trim() || null : (heroCtaText === null ? null : undefined),
      showVisitorStats: typeof showVisitorStats === "boolean" ? showVisitorStats : undefined,
      expectedVersion: typeof version === "number" ? version : undefined,
    })

    return NextResponse.json({
      success: true,
      message: "Cập nhật cấu hình website thành công.",
      data: updated,
    })
  } catch (error: any) {
    console.error("[PUT /api/admin/settings] Error:", error)
    if (error.message?.includes("VERSION_CONFLICT")) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: "Lỗi lưu cấu hình: " + (error.message || "Không xác định") }, { status: 500 })
  }
}
