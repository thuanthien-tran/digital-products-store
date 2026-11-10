/**
 * Generate VietQR payment URL for bank transfer
 * Compatible with VietQR standard (Napas247)
 * Template 'qr_only': Phóng to tối đa mã QR, loại bỏ hoàn toàn phần text thừa dưới chân ảnh
 */
export function generateVietQRUrl({
  bankCode,
  accountNumber,
  accountName: _accountName,
  amount,
  description,
  template = 'qr_only',
}: {
  bankCode: string
  accountNumber: string
  accountName?: string
  amount: number
  description: string
  template?: string
}): string {
  const encodedDescription = encodeURIComponent(description)
  // Use SePay's official high-performance VietQR renderer (returns direct PNG, 100% Napas247 standard)
  return `https://qr.sepay.vn/img?bank=${bankCode}&acc=${accountNumber}&template=${template}&amount=${amount}&des=${encodedDescription}`
}

/**
 * Generate VietQR deeplink for banking app
 */
export function generateVietQRDeeplink({
  bankCode,
  accountNumber,
  amount,
  description,
}: {
  bankCode: string
  accountNumber: string
  amount: number
  description: string
}): string {
  return `https://qr.sepay.vn/img?bank=${bankCode}&acc=${accountNumber}&template=compact&amount=${amount}&des=${encodeURIComponent(description)}`
}

// Map of common Vietnamese bank codes
export const BANK_CODES: Record<string, string> = {
  MB: 'MB',
  VCB: 'VCB',
  TCB: 'TCB',
  ACB: 'ACB',
  BIDV: 'BIDV',
  VPB: 'VPB',
  TPB: 'TPB',
  MSB: 'MSB',
  OCB: 'OCB',
  SHB: 'SHB',
  STB: 'STB',
  HDB: 'HDB',
  VIB: 'VIB',
}
