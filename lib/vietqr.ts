/**
 * Generate VietQR payment URL for bank transfer
 * Compatible with VietQR standard (Napas247)
 */
export function generateVietQRUrl({
  bankCode,
  accountNumber,
  accountName,
  amount,
  description,
}: {
  bankCode: string
  accountNumber: string
  accountName: string
  amount: number
  description: string
}): string {
  const encodedDescription = encodeURIComponent(description)
  const encodedAccountName = encodeURIComponent(accountName)
  return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodedDescription}&accountName=${encodedAccountName}`
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
