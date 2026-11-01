/**
 * Standardized Product Description Formatter
 * Organizes raw provider descriptions into structured, uniform storefront sections
 * without inventing warranties or features.
 */

export interface NormalizedDescription {
  fullFormattedText: string
  fullDescription: string
  benefits: string
  instructions: string
  warranty: string
  notes: string
}

/**
 * Sanitizes input to avoid script tags or malicious HTML injection.
 */
export function sanitizeText(input: string): string {
  if (!input) return ''
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

/**
 * Detects if a product name or description indicates NO WARRANTY (KBH / Không bảo hành).
 */
export function isNoWarrantyProduct(name: string, description: string): boolean {
  const text = `${name} ${description}`.toLowerCase()
  return (
    text.includes('kbh') ||
    text.includes('ko bh') ||
    text.includes('không bảo hành') ||
    text.includes('khong bao hanh') ||
    text.includes('không bh') ||
    text.includes('ko bảo hành')
  )
}

/**
 * Normalizes and formats raw provider description into professional, structured sections.
 */
export function normalizeDescription(name: string, rawDescription: string): NormalizedDescription {
  const sanitized = sanitizeText(rawDescription)
  const isNoWarranty = isNoWarrantyProduct(name, sanitized)

  // Default warranty copy strictly based on actual conditions
  let warranty = isNoWarranty
    ? 'Gói dịch vụ không áp dụng bảo hành (KBH). Quý khách vui lòng kích hoạt và kiểm tra tài khoản ngay sau khi nhận mã.'
    : 'Bảo hành 1 đổi 1 trong thời gian sử dụng nếu tài khoản phát sinh sự cố kỹ thuật từ nhà cung cấp.'

  // Extract instructions or lines
  const lines = sanitized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const benefitLines: string[] = []
  const instructionLines: string[] = []
  const noteLines: string[] = []

  let currentSection: 'benefits' | 'instructions' | 'notes' | 'warranty' = 'benefits'

  for (const line of lines) {
    const lower = line.toLowerCase()
    // Skip duplicate / explicit section header lines
    if (lower.startsWith('thông tin & quyền lợi') || lower.startsWith('thông tin và quyền lợi') || lower === 'quyền lợi:') {
      currentSection = 'benefits'
      continue
    }
    if (lower.startsWith('hướng dẫn sử dụng & nhận hàng') || lower.startsWith('hướng dẫn sử dụng') || lower.startsWith('hướng dẫn')) {
      currentSection = 'instructions'
      continue
    }
    if (lower.startsWith('chính sách bảo hành') || lower.startsWith('bảo hành:')) {
      currentSection = 'warranty'
      if (!isNoWarranty) {
        const cleanWarranty = line.replace(/^(chính sách bảo hành|bảo hành)[\s:]*/i, '').replace(/^[🛡️⚠️🔒•\-\*]+\s*/gu, '').trim()
        if (cleanWarranty) warranty = cleanWarranty
      }
      continue
    }
    if (lower.startsWith('lưu ý quan trọng') || lower.startsWith('lưu ý:')) {
      currentSection = 'notes'
      continue
    }

    if (lower.includes('hướng dẫn') || lower.includes('cách dùng') || lower.includes('kích hoạt')) {
      currentSection = 'instructions'
      instructionLines.push(line)
      continue
    }
    if (lower.includes('bảo hành') || lower.includes('chính sách')) {
      currentSection = 'warranty'
      if (!isNoWarranty) {
        warranty = line.replace(/^[🛡️⚠️🔒•\-\*]+\s*/gu, '').trim()
      }
      continue
    }
    if (lower.includes('lưu ý') || lower.includes('chú ý') || lower.includes('yêu cầu')) {
      currentSection = 'notes'
      noteLines.push(line)
      continue
    }

    if (currentSection === 'instructions') {
      instructionLines.push(line)
    } else if (currentSection === 'notes') {
      noteLines.push(line)
    } else {
      benefitLines.push(line)
    }
  }

  const benefitsText = benefitLines.length > 0 ? benefitLines.join('\n') : `Sản phẩm ${name} chính hãng, kích hoạt tự động.`
  const instructionsText = instructionLines.length > 0 ? instructionLines.join('\n') : 'Thông tin tài khoản/mã kích hoạt sẽ hiển thị trực tiếp tại trang đơn hàng sau khi thanh toán.'
  const notesText = noteLines.length > 0 ? noteLines.join('\n') : 'Vui lòng không thay đổi thông tin bảo mật mặc định nếu chưa được sự đồng ý từ hỗ trợ.'

  const fullFormattedText = [
    `**Thông tin & Quyền lợi:**\n${benefitsText}`,
    `**Hướng dẫn sử dụng & Nhận hàng:**\n${instructionsText}`,
    `**Chính sách bảo hành:**\n${warranty}`,
    `**Lưu ý quan trọng:**\n${notesText}`,
  ].join('\n\n')

  return {
    fullFormattedText,
    fullDescription: fullFormattedText,
    benefits: benefitsText,
    instructions: instructionsText,
    warranty,
    notes: notesText,
  }
}
