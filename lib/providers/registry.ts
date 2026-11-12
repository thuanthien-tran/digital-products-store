import net from 'net'
import dns from 'dns'
import { validateApiHost } from '../fatcat-adapter'

export interface SourceProductDTO {
  externalId: string
  sourceName: string
  sourceDescription: string
  sourcePrice: number
  sourceRegularPrice: number | null
  saleQty: number | null
  sourceStock: number
  maxQuantity: number | null
  rawJson?: string
}

export interface ProviderConnectionConfig {
  id?: string
  name?: string
  provider: string
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

export interface TestConnectionResult {
  ok: boolean
  balanceVnd?: number | null
  balanceUsdt?: number | null
  balanceStatus?: 'supported' | 'unsupported' | 'error'
  catalogCount?: number
  error?: string
}

export interface FetchCatalogResult {
  ok: boolean
  products?: SourceProductDTO[]
  error?: string
  statusCode?: number
  isNetworkOrTimeout?: boolean
}

export interface ProviderAdapter {
  id: string
  name: string
  validateHost(url: string): { valid: boolean; error?: string }
  testConnection(config: ProviderConnectionConfig): Promise<TestConnectionResult>
  fetchCatalog(config: ProviderConnectionConfig): Promise<FetchCatalogResult>
}

/**
 * Universal Safe Fetch helper for provider adapters:
 * - Prevents SSRF / unvalidated redirects
 * - Handles 401/403, 404/405, 429 (with Retry-After), 5xx
 * - Parses JSON safely, catching HTML / Cloudflare error pages
 * - Detects HTTP 200 with error payloads
 */
interface SafeFetchResult {
  ok: boolean
  status: number
  data?: any
  error?: string
  retryAfter?: string | null
  isNetworkOrTimeout?: boolean
}

async function readBoundedBody(res: Response, maxBytes = 5 * 1024 * 1024): Promise<string> {
  const clHeader = res.headers.get('content-length')
  if (clHeader) {
    const cl = parseInt(clHeader, 10)
    if (!isNaN(cl) && cl > maxBytes) {
      throw new Error(`Kích thước phản hồi (${cl} bytes) vượt quá giới hạn an toàn (${Math.round(maxBytes / (1024 * 1024))}MB)`)
    }
  }

  if (res.body && typeof (res.body as any).getReader === 'function') {
    const reader = (res.body as any).getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          totalBytes += value.length
          if (totalBytes > maxBytes) {
            try { await reader.cancel() } catch {}
            throw new Error(`Kích thước phản hồi vượt quá giới hạn an toàn (tối đa ${Math.round(maxBytes / (1024 * 1024))}MB)`)
          }
          chunks.push(value)
        }
      }
    } finally {
      try { reader.releaseLock() } catch {}
    }
    const combined = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    return new TextDecoder('utf-8').decode(combined)
  }

  const text = await res.text()
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new Error(`Kích thước phản hồi vượt quá giới hạn an toàn (tối đa ${Math.round(maxBytes / (1024 * 1024))}MB)`)
  }
  return text
}

async function safeFetchJson(
  url: string,
  options: RequestInit & {
    timeoutMs?: number
    validateHostFn: (u: string) => { valid: boolean; error?: string }
    isRetry?: boolean
  }
): Promise<SafeFetchResult> {
  const hostCheck = options.validateHostFn(url)
  if (!hostCheck.valid) {
    return { ok: false, status: 400, error: hostCheck.error || 'Địa chỉ URL không hợp lệ' }
  }

  try {
    const parsed = new URL(url)
    const dnsCheck = await validateHostDns(parsed.hostname)
    if (!dnsCheck.valid) {
      return { ok: false, status: 400, error: dnsCheck.error || 'Địa chỉ host không an toàn' }
    }
  } catch {
    return { ok: false, status: 400, error: 'URL không hợp lệ' }
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs || 8000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'manual', // do not blindly follow redirects to prevent SSRF
    })

    // Handle redirects (301, 302, 303, 307, 308)
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) {
        return { ok: false, status: res.status, error: `Máy chủ chuyển hướng nhưng thiếu header Location (HTTP ${res.status})` }
      }
      let targetUrl: string
      try {
        targetUrl = new URL(location, url).toString()
      } catch {
        return { ok: false, status: res.status, error: 'Địa chỉ chuyển hướng (Location) không hợp lệ' }
      }
      // 1. Strict Protocol check: Never downgrade HTTPS to HTTP
      const parsedOriginal = new URL(url)
      const parsedTarget = new URL(targetUrl)
      if (parsedOriginal.protocol === 'https:' && parsedTarget.protocol !== 'https:') {
        return { ok: false, status: 400, error: 'Chuyển hướng từ HTTPS xuống HTTP không an toàn bị từ chối' }
      }

      // 2. Host validation check
      const targetHostCheck = options.validateHostFn(targetUrl)
      if (!targetHostCheck.valid) {
        return { ok: false, status: res.status, error: 'Chuyển hướng (Redirect) sang máy chủ không tin cậy bị từ chối' }
      }

      const redirectDnsCheck = await validateHostDns(parsedTarget.hostname)
      if (!redirectDnsCheck.valid) {
        return { ok: false, status: 400, error: redirectDnsCheck.error || 'Địa chỉ chuyển hướng không an toàn' }
      }

      // 3. Credential isolation: Strip API Key & Authorization headers if origin changes
      const isSameOrigin = parsedTarget.origin === parsedOriginal.origin
      const forwardedHeaders: Record<string, string> = {}
      if (options.headers) {
        const rawHeaders = options.headers as Record<string, string>
        for (const [k, v] of Object.entries(rawHeaders)) {
          const lower = k.toLowerCase()
          if (!isSameOrigin && (lower === 'authorization' || lower.includes('key') || lower.includes('secret') || lower.includes('token'))) {
            // Strip sensitive credentials on cross-origin redirect
            continue
          }
          forwardedHeaders[k] = v
        }
      }

      // Follow single redirect safely using same timeout controller
      const res2 = await fetch(targetUrl, {
        ...options,
        headers: forwardedHeaders,
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'error', // Max 1 redirect allowed
      })
      return await parseResponse(res2)
    }

    const parsed = await parseResponse(res)
    // Tự động thử lại 1 lần sau 1.5 giây đối với lỗi gián đoạn tạm thời từ Cloudflare/Origin (5xx/530)
    if (!parsed.ok && res.status >= 500 && !options.isRetry) {
      await new Promise((r) => setTimeout(r, 1500))
      return await safeFetchJson(url, { ...options, isRetry: true })
    }

    return parsed
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, status: 408, isNetworkOrTimeout: true, error: `Quá thời gian kết nối tới API đại lý (Timeout ${Math.round(timeoutMs / 1000)}s)` }
    }
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối'
    return { ok: false, status: 0, isNetworkOrTimeout: true, error: `Không thể kết nối đến đại lý: ${msg}` }
  } finally {
    clearTimeout(timeout)
  }
}

async function parseResponse(res: Response): Promise<SafeFetchResult> {
  const retryAfter = res.headers.get('retry-after')

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      status: res.status,
      error: `Xác thực thất bại: API Key không hợp lệ hoặc đã hết hạn (${res.status})`,
    }
  }

  if (res.status === 404 || res.status === 405) {
    return {
      ok: false,
      status: res.status,
      error: `Địa chỉ API không tìm thấy endpoint tương ứng (${res.status})`,
    }
  }

  if (res.status === 429) {
    const retryText = retryAfter ? ` - Thử lại sau ${retryAfter}s` : ''
    return {
      ok: false,
      status: 429,
      retryAfter,
      error: `Đại lý phản hồi quá nhiều yêu cầu (HTTP 429 - Rate limit)${retryText}`,
    }
  }

  if (res.status >= 500) {
    return {
      ok: false,
      status: res.status,
      error: `Máy chủ đại lý tạm thời gián đoạn (HTTP ${res.status})`,
    }
  }

  let rawText = ''
  try {
    rawText = await readBoundedBody(res, 5 * 1024 * 1024)
  } catch (bodyErr: unknown) {
    const msg = bodyErr instanceof Error ? bodyErr.message : 'Lỗi đọc dữ liệu phản hồi'
    return {
      ok: false,
      status: 413,
      error: msg,
    }
  }

  let data: any
  try {
    data = JSON.parse(rawText)
  } catch {
    return {
      ok: false,
      status: res.status,
      error: 'Phản hồi từ đại lý không phải định dạng JSON hợp lệ (có thể là trang lỗi HTML từ CDN hoặc máy chủ)',
    }
  }

  if (!res.ok) {
    const errText = data?.error || data?.message || data?.msg || `Máy chủ đại lý báo lỗi HTTP ${res.status}`
    return {
      ok: false,
      status: res.status,
      data,
      error: errText,
    }
  }

  // Detect HTTP 200 with error payload
  if (data && typeof data === 'object') {
    if (data.success === false || data.ok === false) {
      const errText = data.error || data.message || data.msg || 'Đại lý báo lỗi trong nội dung phản hồi'
      return {
        ok: false,
        status: res.status,
        data,
        error: errText,
      }
    }
  }

  return {
    ok: true,
    status: res.status,
    data,
  }
}

/**
 * FatCat Store Adapter Implementation
 */
export const fatcatAdapter: ProviderAdapter = {
  id: 'fatcat',
  name: 'FatCat Store API',

  validateHost(urlStr: string) {
    const res = validateApiHost(urlStr)
    return { valid: res.valid, error: res.error }
  },

  async testConnection(config: ProviderConnectionConfig): Promise<TestConnectionResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) {
      return { ok: false, error: hostCheck.error }
    }

    if (!config.apiKey) {
      return { ok: false, error: 'Thiếu API Key' }
    }

    const endpoint = `${config.baseUrl.trim().replace(/\/+$/, '')}/api/balance`
    const balRes = await safeFetchJson(endpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        Accept: 'application/json',
      },
      timeoutMs: config.timeoutMs || 8000,
      validateHostFn: (u) => this.validateHost(u),
    })

    if (balRes.ok) {
      const d = balRes.data
      const balanceVnd = typeof d?.balance_vnd === 'number' ? d.balance_vnd : 0
      const balanceUsdt = typeof d?.balance_usdt === 'number' ? d.balance_usdt : 0
      return {
        ok: true,
        balanceVnd,
        balanceUsdt,
        balanceStatus: 'supported',
      }
    }

    // If balance endpoint is unsupported (404) or 5xx, fall back to probe catalog endpoint
    if (balRes.status === 404 || (balRes.status && balRes.status >= 500)) {
      const catCheck = await this.fetchCatalog(config)
      if (catCheck.ok) {
        return {
          ok: true,
          balanceVnd: null,
          balanceUsdt: null,
          balanceStatus: balRes.status === 404 ? 'unsupported' : 'error',
        }
      }
      return {
        ok: false,
        error: catCheck.error || balRes.error,
      }
    }

    return {
      ok: false,
      error: balRes.error,
    }
  },

  async fetchCatalog(config: ProviderConnectionConfig): Promise<FetchCatalogResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) {
      return { ok: false, error: hostCheck.error }
    }

    if (!config.apiKey) {
      return { ok: false, error: 'Chưa cấu hình API Key' }
    }

    const endpoint = `${config.baseUrl.trim().replace(/\/+$/, '')}/api/products`
    const fetchRes = await safeFetchJson(endpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey,
        Accept: 'application/json',
      },
      timeoutMs: config.timeoutMs || 10000,
      validateHostFn: (u) => this.validateHost(u),
    })

    if (!fetchRes.ok) {
      return {
        ok: false,
        statusCode: fetchRes.status,
        isNetworkOrTimeout: fetchRes.isNetworkOrTimeout,
        error: fetchRes.error,
      }
    }

    const body = fetchRes.data
    if (!body || !Array.isArray(body.products)) {
      return { ok: false, statusCode: 200, error: 'Định dạng dữ liệu API không đúng: thiếu trường "products" dạng mảng' }
    }

    const products: SourceProductDTO[] = []
    for (const item of body.products) {
      if (!item || typeof item !== 'object') continue
      const idNum = Number(item.id)
      if (!Number.isInteger(idNum) || idNum <= 0) continue
      const name = typeof item.name === 'string' ? item.name.trim() : ''
      if (!name) continue
      const price_vnd = Number(item.price_vnd)
      if (!Number.isInteger(price_vnd) || price_vnd < 0) continue

      let regPrice: number | null = null
      if (item.regular_price_vnd !== undefined && item.regular_price_vnd !== null && item.regular_price_vnd !== '') {
        const num = Number(item.regular_price_vnd)
        if (Number.isInteger(num) && num >= 0) regPrice = num
      }

      const stock = Number.isInteger(Number(item.stock)) ? Math.max(0, Number(item.stock)) : 0
      const sale_qty = Number.isInteger(Number(item.sale_qty)) ? Number(item.sale_qty) : null
      const max_quantity = Number.isInteger(Number(item.max_quantity)) ? Number(item.max_quantity) : null
      const description = typeof item.description === 'string' ? item.description.trim() : ''

      products.push({
        externalId: String(idNum),
        sourceName: name,
        sourceDescription: description,
        sourcePrice: price_vnd,
        sourceRegularPrice: regPrice,
        saleQty: sale_qty,
        sourceStock: stock,
        maxQuantity: max_quantity,
        rawJson: JSON.stringify(item),
      })
    }

    return { ok: true, products }
  },
}

/**
 * Checks whether an IP address is private, loopback, link-local, unspecified, or reserved.
 */
export function isPrivateOrInternalIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true
    if (parts[0] === 0) return true // 0.0.0.0/8
    if (parts[0] === 10) return true // 10.0.0.0/8
    if (parts[0] === 127) return true // 127.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return true // 169.254.0.0/16
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true // 192.168.0.0/16
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true // 100.64.0.0/10 Carrier-grade NAT
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true // 198.18.0.0/15
    if (parts[0] >= 224) return true // 224.0.0.0/4 Multicast & reserved
    return false
  }

  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase().trim()
    if (norm === '::' || norm === '::1') return true
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true // Unique Local Address
    if (/^fe[89ab]/i.test(norm)) return true // Link-Local
    if (norm.startsWith('ff')) return true // Multicast
    // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (norm.startsWith('::ffff:')) {
      const v4part = norm.slice(7)
      if (net.isIPv4(v4part)) return isPrivateOrInternalIp(v4part)
      return true
    }
    return false
  }

  return false
}

export function validateGeneralHttpsHost(urlStr: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(urlStr)
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'URL không được phép chứa thông tin userinfo (user:password)' }
    }
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Chỉ chấp nhận giao thức HTTP/HTTPS' }
    }

    const rawHost = parsed.hostname.toLowerCase().trim()
    // Canonicalize IPv6 hostname by removing surrounding brackets [::1] -> ::1
    const canonicalHost = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost

    const isProduction = process.env.NODE_ENV === 'production'
    const isTestAllowed = !isProduction && (process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_API_MOCK === 'true')

    const isIp = net.isIP(canonicalHost) !== 0
    if (isIp) {
      const isInternal = isPrivateOrInternalIp(canonicalHost)
      if (isInternal) {
        const isLocalLoopback = (canonicalHost === '127.0.0.1' || canonicalHost === '::1') && isTestAllowed
        if (!isLocalLoopback) {
          return { valid: false, error: 'Không được phép kết nối đến địa chỉ IP nội bộ, loopback hoặc cloud metadata' }
        }
      }
    } else {
      // Hostname checks
      if (
        canonicalHost === 'localhost' ||
        canonicalHost.endsWith('.localhost') ||
        canonicalHost.endsWith('.local') ||
        canonicalHost.endsWith('.internal') ||
        canonicalHost.endsWith('.lan') ||
        canonicalHost.endsWith('.corp') ||
        canonicalHost.endsWith('.test') ||
        canonicalHost === 'metadata.google.internal' ||
        canonicalHost.includes('instance-data')
      ) {
        const isAllowedMock = (canonicalHost === 'localhost' || canonicalHost.endsWith('.test') || canonicalHost.endsWith('.local')) && isTestAllowed
        if (!isAllowedMock) {
          return { valid: false, error: `Host "${canonicalHost}" thuộc dải nội bộ / không được phép` }
        }
      }
    }

    const isLocalhostOrMock =
      isTestAllowed &&
      (canonicalHost === 'localhost' ||
        canonicalHost === '127.0.0.1' ||
        canonicalHost === '::1' ||
        canonicalHost.endsWith('.test') ||
        canonicalHost.endsWith('.local'))

    if (parsed.protocol === 'http:' && !isLocalhostOrMock) {
      return { valid: false, error: 'Kết nối ra ngoài bắt buộc sử dụng HTTPS bảo mật' }
    }

    // Port restriction: allow standard HTTPS 443/8443, or custom only in test mock
    if (parsed.port && !['443', '8443'].includes(parsed.port) && !isLocalhostOrMock) {
      return { valid: false, error: `Cổng kết nối ${parsed.port} không thuộc danh sách cổng được phép (443, 8443)` }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Cấu hình URL API không hợp lệ' }
  }
}

/**
 * Resolves all DNS addresses of a hostname and checks that NONE of them are private/internal.
 * Prevents DNS Rebinding and internal host pivoting.
 */
export async function validateHostDns(hostname: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const rawHost = hostname.toLowerCase().trim()
    const canonicalHost = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost

    const isProduction = process.env.NODE_ENV === 'production'
    const isTestAllowed = !isProduction && (process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_API_MOCK === 'true')

    if (net.isIP(canonicalHost)) {
      if (isPrivateOrInternalIp(canonicalHost)) {
        if (!isTestAllowed || (canonicalHost !== '127.0.0.1' && canonicalHost !== '::1')) {
          return { valid: false, error: `Địa chỉ IP "${canonicalHost}" thuộc dải nội bộ/riêng tư bị chặn` }
        }
      }
      return { valid: true }
    }

    if (canonicalHost === 'localhost' || canonicalHost.endsWith('.localhost')) {
      if (!isTestAllowed) {
        return { valid: false, error: 'Kết nối đến localhost bị cấm trong môi trường production' }
      }
      return { valid: true }
    }

    // Allow mock/test domains strictly in test mode without querying external DNS
    if (canonicalHost.endsWith('.test') || canonicalHost.endsWith('.local')) {
      if (isTestAllowed) return { valid: true }
      return { valid: false, error: `Tên miền thử nghiệm "${canonicalHost}" không được phép trong production` }
    }

    // Resolve all IPv4 and IPv6 addresses
    const addresses = await dns.promises.lookup(canonicalHost, { all: true })
    if (!addresses || addresses.length === 0) {
      return { valid: false, error: `Không thể phân giải tên miền DNS "${canonicalHost}"` }
    }

    for (const item of addresses) {
      if (isPrivateOrInternalIp(item.address)) {
        if (!isTestAllowed || (item.address !== '127.0.0.1' && item.address !== '::1')) {
          return {
            valid: false,
            error: `Tên miền "${canonicalHost}" phân giải về địa chỉ nội bộ (${item.address}) bị từ chối (DNS Rebinding Protection)`,
          }
        }
      }
    }

    return { valid: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi phân giải DNS'
    return { valid: false, error: `Không thể phân giải địa chỉ máy chủ "${hostname}": ${msg}` }
  }
}

/**
 * Dino Store / Generic Bot API Adapter Implementation
 * Uses v2 endpoints: GET /api/v2/me and GET /api/v2/catalog
 */
export const dinoAdapter: ProviderAdapter = {
  id: 'dino',
  name: 'Dino Store API (v2)',

  validateHost(urlStr: string) {
    return validateGeneralHttpsHost(urlStr)
  },

  async testConnection(config: ProviderConnectionConfig): Promise<TestConnectionResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Thiếu API Key' }

    const base = config.baseUrl.trim().replace(/\/+$/, '')
    const meUrl = `${base}/api/v2/me`

    const meRes = await safeFetchJson(meUrl, {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
        Accept: 'application/json',
      },
      timeoutMs: config.timeoutMs || 8000,
      validateHostFn: (u) => this.validateHost(u),
    })

    if (meRes.ok) {
      const data = meRes.data
      const d = data?.data || data
      const balanceVnd =
        typeof d?.balance === 'number'
          ? d.balance
          : typeof d?.balance_vnd === 'number'
          ? d.balance_vnd
          : typeof d?.balance_chung === 'number'
          ? d.balance_chung
          : 0

      return {
        ok: true,
        balanceVnd,
        balanceUsdt: 0,
        balanceStatus: 'supported',
      }
    }

    // If /api/v2/me returns 404 (endpoint not supported) or 5xx, probe /api/v2/catalog
    if (meRes.status === 404 || (meRes.status && meRes.status >= 500)) {
      const catCheck = await this.fetchCatalog(config)
      if (catCheck.ok) {
        return {
          ok: true,
          balanceVnd: null,
          balanceUsdt: null,
          balanceStatus: meRes.status === 404 ? 'unsupported' : 'error',
        }
      }
      return { ok: false, error: catCheck.error || meRes.error }
    }

    return { ok: false, error: meRes.error }
  },

  async fetchCatalog(config: ProviderConnectionConfig): Promise<FetchCatalogResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Chưa cấu hình API Key' }

    const base = config.baseUrl.trim().replace(/\/+$/, '')
    const catUrl = `${base}/api/v2/catalog`

    const catRes = await safeFetchJson(catUrl, {
      method: 'GET',
      headers: {
        'x-api-key': config.apiKey,
        Accept: 'application/json',
      },
      timeoutMs: config.timeoutMs || 10000,
      validateHostFn: (u) => this.validateHost(u),
    })

    if (!catRes.ok) {
      return {
        ok: false,
        statusCode: catRes.status,
        isNetworkOrTimeout: catRes.isNetworkOrTimeout,
        error: catRes.error,
      }
    }

    const data = catRes.data
    const d = data?.data || data
    const rawItems = Array.isArray(d?.products)
      ? d.products
      : Array.isArray(d?.catalog)
      ? d.catalog
      : Array.isArray(d)
      ? d
      : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data?.items)
      ? data.items
      : []

    const products: SourceProductDTO[] = []
    for (const item of rawItems) {
      const extId = String(item.product_id ?? item.product_code ?? item.id ?? item.code ?? '')
      if (!extId) continue

      let desc = item.description || item.desc || ''
      if (item.warranty) {
        desc += `\nBảo hành: ${item.warranty}`
      }
      if (item.duration) {
        desc += `\nThời hạn: ${item.duration}`
      }

      const rawStock =
        typeof item.stock_count === 'number'
          ? item.stock_count
          : typeof item.stock === 'number'
          ? item.stock
          : typeof item.quantity === 'number'
          ? item.quantity
          : item.available !== false && item.stock_status !== 'out_of_stock'
          ? 99
          : 0

      products.push({
        externalId: extId,
        sourceName: item.name || item.title || item.product_name || `Sản phẩm #${extId}`,
        sourceDescription: desc,
        sourcePrice:
          typeof item.price === 'number'
            ? item.price
            : typeof item.price_vnd === 'number'
            ? item.price_vnd
            : 0,
        sourceRegularPrice:
          typeof item.regular_price === 'number'
            ? item.regular_price
            : typeof item.regular_price_vnd === 'number'
            ? item.regular_price_vnd
            : null,
        saleQty: typeof item.sale_qty === 'number' ? item.sale_qty : null,
        sourceStock: rawStock,
        maxQuantity: typeof item.max_quantity === 'number' ? item.max_quantity : null,
        rawJson: JSON.stringify(item),
      })
    }

    return { ok: true, products }
  },
}

/**
 * Generic / Custom Telegram Bot & REST API Adapter Implementation
 */
export const customAdapter: ProviderAdapter = {
  id: 'custom',
  name: 'Đại lý Tùy chỉnh (Auto-Detect REST / Bot API)',

  validateHost(urlStr: string) {
    return validateGeneralHttpsHost(urlStr)
  },

  async testConnection(config: ProviderConnectionConfig): Promise<TestConnectionResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Thiếu API Key' }

    const base = config.baseUrl.trim().replace(/\/+$/, '')
    const possibleBalanceEndpoints = [
      '/api/v2/me',
      '/api/balance',
      '/balance',
      '/api/me',
      '/api/profile',
      '/api/v1/balance',
    ]

    for (const ep of possibleBalanceEndpoints) {
      const res = await safeFetchJson(`${base}${ep}`, {
        method: 'GET',
        headers: {
          'x-api-key': config.apiKey,
          'X-API-Key': config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
        timeoutMs: 4000,
        validateHostFn: (u) => this.validateHost(u),
      })

      if (res.ok) {
        const d = res.data?.data || res.data
        const balanceVnd =
          typeof d?.balance === 'number'
            ? d.balance
            : typeof d?.balance_vnd === 'number'
            ? d.balance_vnd
            : typeof d?.balance_chung === 'number'
            ? d.balance_chung
            : 0
        return { ok: true, balanceVnd, balanceUsdt: 0, balanceStatus: 'supported' }
      }
    }

    // If balance endpoints were not found, try testing catalog endpoint directly
    const catCheck = await this.fetchCatalog(config)
    if (catCheck.ok && catCheck.products) {
      return { ok: true, balanceVnd: null, balanceUsdt: null, balanceStatus: 'unsupported' }
    }
    return { ok: false, error: catCheck.error || 'Không thể kết nối đến máy chủ API đại lý' }
  },

  async fetchCatalog(config: ProviderConnectionConfig): Promise<FetchCatalogResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Chưa cấu hình API Key' }

    const base = config.baseUrl.trim().replace(/\/+$/, '')
    const possibleCatalogEndpoints = [
      '/api/v2/catalog',
      '/api/products?format=flat',
      '/api/products',
      '/products',
      '/catalog',
      '/api/v1/products',
      '/api/catalog',
    ]

    for (const ep of possibleCatalogEndpoints) {
      const res = await safeFetchJson(`${base}${ep}`, {
        method: 'GET',
        headers: {
          'x-api-key': config.apiKey,
          'X-API-Key': config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
        timeoutMs: 6000,
        validateHostFn: (u) => this.validateHost(u),
      })

      if (res.ok) {
        const data = res.data
        const d = data?.data || data
        let rawItems: any[] = Array.isArray(d?.products)
          ? d.products
          : Array.isArray(d?.catalog)
          ? d.catalog
          : Array.isArray(d?.items)
          ? d.items
          : Array.isArray(d)
          ? d
          : Array.isArray(data?.products)
          ? data.products
          : []

        if (rawItems.length === 0 && Array.isArray(d?.menus)) {
          rawItems = []
          for (const menu of d.menus) {
            if (Array.isArray(menu?.products)) {
              for (const p of menu.products) {
                rawItems.push({ ...p, menu_name: p.menu_name || menu.name, menu_path: p.menu_path || menu.menu_path })
              }
            }
          }
        }

        if (rawItems.length === 0 && !Array.isArray(d)) {
          continue // Try next endpoint
        }

        const products: SourceProductDTO[] = []
        for (const item of rawItems) {
          const extId = String(item.product_id ?? item.product_code ?? item.id ?? item.code ?? '')
          if (!extId) continue

          let desc = item.description || item.desc || ''
          if (item.warranty) desc += `\nBảo hành: ${item.warranty}`
          if (item.duration) desc += `\nThời hạn: ${item.duration}`

          const rawStock =
            typeof item.stock_count === 'number'
              ? item.stock_count
              : typeof item.stock === 'number'
              ? item.stock
              : typeof item.quantity === 'number'
              ? item.quantity
              : item.available !== false && item.stock_status !== 'out_of_stock'
              ? 99
              : 0

          const rawName = String(item.name || item.title || item.product_name || `Sản phẩm #${extId}`).trim()
          const menuName = typeof item.menu_name === 'string' ? item.menu_name.trim() : ''
          const displayName =
            menuName && !rawName.toLowerCase().includes(menuName.toLowerCase())
              ? `${menuName} - ${rawName}`
              : rawName

          products.push({
            externalId: extId,
            sourceName: displayName,
            sourceDescription: desc,
            sourcePrice:
              typeof item.price === 'number'
                ? item.price
                : typeof item.price_vnd === 'number'
                ? item.price_vnd
                : 0,
            sourceRegularPrice:
              typeof item.regular_price === 'number'
                ? item.regular_price
                : typeof item.regular_price_vnd === 'number'
                ? item.regular_price_vnd
                : typeof item.original_price_vnd === 'number'
                ? item.original_price_vnd
                : null,
            saleQty: typeof item.sale_qty === 'number' ? item.sale_qty : null,
            sourceStock: rawStock,
            maxQuantity: typeof item.max_quantity === 'number' ? item.max_quantity : null,
            rawJson: JSON.stringify(item),
          })
        }

        return { ok: true, products }
      }
    }

    return {
      ok: false,
      error: 'Không thể tự động tìm thấy danh mục sản phẩm từ địa chỉ API này. Vui lòng kiểm tra lại URL và API key.',
    }
  },
}

/**
 * ShopTool Giá Rẻ API Adapter Implementation
 * Uses:
 * - GET /api/v1/account
 * - GET /api/v1/products
 */
export const shoptoolAdapter: ProviderAdapter = {
  id: 'shoptool',
  name: 'ShopTool Giá Rẻ (Buff Token & Bot API)',

  validateHost(urlStr: string) {
    return validateGeneralHttpsHost(urlStr)
  },

  async testConnection(config: ProviderConnectionConfig): Promise<TestConnectionResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Thiếu API Token' }

    const base = config.baseUrl.trim().replace(/\/+$/, '')
    const accountUrl = base.endsWith('/api/v1') ? `${base}/account` : `${base}/api/v1/account`

    const res = await safeFetchJson(accountUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        Accept: 'application/json',
      },
      timeoutMs: config.timeoutMs || 8000,
      validateHostFn: (u) => this.validateHost(u),
    })

    if (res.ok) {
      const data = res.data
      const user = data?.user || data?.data || data
      const balanceVnd = typeof user?.balance === 'number' ? user.balance : 0
      const credits = typeof user?.buff_credits === 'number' ? user.buff_credits : 0

      return {
        ok: true,
        balanceVnd,
        balanceUsdt: credits,
        balanceStatus: 'supported',
      }
    }

    return {
      ok: false,
      error: res.error || 'Không thể kết nối đến máy chủ ShopTool Giá Rẻ',
    }
  },

  async fetchCatalog(config: ProviderConnectionConfig): Promise<FetchCatalogResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Chưa cấu hình API Token' }

    const base = config.baseUrl.trim().replace(/\/+$/, '')
    const productsUrl = base.endsWith('/api/v1') ? `${base}/products` : `${base}/api/v1/products`

    const res = await safeFetchJson(productsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
        Accept: 'application/json',
      },
      timeoutMs: config.timeoutMs || 10000,
      validateHostFn: (u) => this.validateHost(u),
    })

    if (!res.ok) {
      return {
        ok: false,
        statusCode: res.status,
        isNetworkOrTimeout: res.isNetworkOrTimeout,
        error: res.error,
      }
    }

    const data = res.data
    const rawItems = Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
      ? data
      : []

    const products: SourceProductDTO[] = []
    for (const item of rawItems) {
      const extId = String(item.code || item.id || item.product_id || '').trim()
      if (!extId) continue

      const isBuff = Boolean(item.is_buff)
      const stock =
        isBuff || item.stock_available === 'unlimited'
          ? 999
          : typeof item.stock_available === 'number'
          ? item.stock_available
          : typeof item.stock === 'number'
          ? item.stock
          : 0

      const priceVnd =
        typeof item.price === 'number'
          ? item.price
          : typeof item.price_vnd === 'number'
          ? item.price_vnd
          : typeof item.unit_price === 'number'
          ? item.unit_price
          : 0

      const regPrice = item.tiered_pricing?.regular_price || item.regular_price || null

      products.push({
        externalId: extId,
        sourceName: item.name || `Sản phẩm #${extId}`,
        sourceDescription: item.description || '',
        sourcePrice: priceVnd,
        sourceRegularPrice: typeof regPrice === 'number' ? regPrice : null,
        saleQty: null,
        sourceStock: stock,
        maxQuantity: typeof item.max_quantity === 'number' ? item.max_quantity : null,
        rawJson: JSON.stringify(item),
      })
    }

    return { ok: true, products }
  },
}

/**
 * Hải Vân Kho Sỉ (Shop Bot API) Adapter Implementation
 * Official Docs: https://webshop.haivankhosi.site/api/docs
 * Uses:
 * - Header: X-API-Key
 * - GET /api/balance
 * - GET /api/products?format=flat
 */
export const haivanAdapter: ProviderAdapter = {
  id: 'haivan',
  name: 'Hải Vân Kho Sỉ (Shop Bot API)',

  validateHost(urlStr: string) {
    return validateGeneralHttpsHost(urlStr)
  },

  async testConnection(config: ProviderConnectionConfig): Promise<TestConnectionResult> {
    const cleanBase = normalizeProviderBaseUrl(config.baseUrl)
    const hostCheck = this.validateHost(cleanBase)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Thiếu API Key' }

    const balUrl = `${cleanBase}/api/balance`

    const res = await safeFetchJson(balUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey.trim(),
        Accept: 'application/json',
      },
      timeoutMs: config.timeoutMs || 8000,
      validateHostFn: (u) => this.validateHost(u),
    })

    if (res.ok && res.data && res.data.success !== false) {
      const d = res.data
      const balanceVnd = typeof d.balance_vnd === 'number' ? d.balance_vnd : 0
      const balanceUsdt = typeof d.balance_usdt === 'number' ? d.balance_usdt : 0

      return {
        ok: true,
        balanceVnd,
        balanceUsdt,
        balanceStatus: 'supported',
      }
    }

    return {
      ok: false,
      error: res.data?.error || res.error || 'Không thể kết nối đến máy chủ Hải Vân Kho Sỉ',
    }
  },

  async fetchCatalog(config: ProviderConnectionConfig): Promise<FetchCatalogResult> {
    const cleanBase = normalizeProviderBaseUrl(config.baseUrl)
    const hostCheck = this.validateHost(cleanBase)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Chưa cấu hình API Key' }

    const productsUrl = `${cleanBase}/api/products?format=flat`

    const res = await safeFetchJson(productsUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': config.apiKey.trim(),
        Accept: 'application/json',
      },
      timeoutMs: config.timeoutMs || 12000,
      validateHostFn: (u) => this.validateHost(u),
    })

    if (!res.ok) {
      return {
        ok: false,
        statusCode: res.status,
        isNetworkOrTimeout: res.isNetworkOrTimeout,
        error: res.error,
      }
    }

    const data = res.data
    let rawItems: any[] = []
    if (Array.isArray(data?.products)) {
      rawItems = data.products
    } else if (Array.isArray(data?.menus)) {
      for (const menu of data.menus) {
        if (Array.isArray(menu?.products)) {
          for (const p of menu.products) {
            rawItems.push({
              ...p,
              menu_name: p.menu_name || menu.name,
              menu_path: p.menu_path || menu.menu_path,
            })
          }
        }
      }
    }

    const products: SourceProductDTO[] = []
    for (const item of rawItems) {
      const extId = String(item?.id ?? item?.product_id ?? '').trim()
      if (!extId) continue

      const rawName = String(item.name || `Sản phẩm #${extId}`).trim()
      const menuName = typeof item.menu_name === 'string' ? item.menu_name.trim() : ''
      const displayName =
        menuName && !rawName.toLowerCase().includes(menuName.toLowerCase())
          ? `${menuName} - ${rawName}`
          : rawName

      const desc = typeof item.description === 'string' ? item.description.trim() : ''
      const priceVnd = typeof item.price_vnd === 'number' ? Math.max(0, Math.round(item.price_vnd)) : 0
      const origPriceVnd =
        typeof item.original_price_vnd === 'number' && item.original_price_vnd > 0
          ? Math.round(item.original_price_vnd)
          : null
      const stock = typeof item.stock === 'number' ? Math.max(0, Math.floor(item.stock)) : 0

      products.push({
        externalId: extId,
        sourceName: displayName,
        sourceDescription: desc,
        sourcePrice: priceVnd,
        sourceRegularPrice: origPriceVnd,
        saleQty: null,
        sourceStock: stock,
        maxQuantity: 100, // API doc max quantity per /api/buy request is 100
        rawJson: JSON.stringify(item),
      })
    }

    return { ok: true, products }
  },
}

/**
 * 6. ShopXoaiNon (Shop Xoài Non API v1) Adapter
 * Chuẩn API https://shopxoainon.online/api/v1
 */
const shopXoaiNonAdapter: ProviderAdapter = {
  id: 'shopxoainon',
  name: 'Shop Xoài Non (API v1)',

  validateHost(url: string): { valid: boolean; error?: string } {
    return validateGeneralHttpsHost(url)
  },

  async testConnection(config: ProviderConnectionConfig): Promise<TestConnectionResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Chưa cấu hình API Key' }

    try {
      const { getShopXoaiNonBalance } = await import('../shopxoainon')
      const res = await getShopXoaiNonBalance({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs || 8000,
      })

      if (!res.success) {
        return { ok: false, error: res.error || 'Kiểm tra kết nối Shop Xoài Non thất bại' }
      }

      return {
        ok: true,
        balanceVnd: res.balanceVnd ?? 0,
        balanceUsdt: 0,
        balanceStatus: 'supported',
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Shop Xoài Non'
      return { ok: false, error: msg }
    }
  },

  async fetchCatalog(config: ProviderConnectionConfig): Promise<FetchCatalogResult> {
    const hostCheck = this.validateHost(config.baseUrl)
    if (!hostCheck.valid) return { ok: false, error: hostCheck.error }
    if (!config.apiKey) return { ok: false, error: 'Chưa cấu hình API Key' }

    try {
      const { getShopXoaiNonProducts } = await import('../shopxoainon')
      const res = await getShopXoaiNonProducts({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs || 10000,
      })

      if (!res.success || !res.products) {
        return { ok: false, error: res.error || 'Lỗi lấy danh mục sản phẩm từ Shop Xoài Non' }
      }

      const products: SourceProductDTO[] = []
      for (const prod of res.products) {
        if (!prod || !Array.isArray(prod.variants) || prod.variants.length === 0) continue

        // Duyệt từng phân loại variant (mỗi variant tương ứng 1 mã đặt hàng riêng biệt)
        for (const v of prod.variants) {
          const extId = String(v.id || prod.id).trim()
          const name = v.title?.trim() || prod.title?.trim() || extId
          const desc = v.description?.trim() || ''
          const priceVnd = typeof v.prices?.vnd === 'number' ? Math.max(0, Math.round(v.prices.vnd)) : 0
          const stock = typeof v.available_quantity === 'number' ? Math.max(0, Math.floor(v.available_quantity)) : (v.in_stock ? 1 : 0)

          products.push({
            externalId: extId,
            sourceName: name,
            sourceDescription: desc,
            sourcePrice: priceVnd,
            sourceRegularPrice: null,
            saleQty: null,
            sourceStock: stock,
            maxQuantity: 100,
            rawJson: JSON.stringify({ ...prod, variant: v }),
          })
        }
      }

      return { ok: true, products }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đồng bộ danh mục Shop Xoài Non'
      return { ok: false, error: msg }
    }
  },
}

const adapters: Record<string, ProviderAdapter> = {
  fatcat: fatcatAdapter,
  dino: dinoAdapter,
  shoptool: shoptoolAdapter,
  shoptoolgiare: shoptoolAdapter,
  haivan: haivanAdapter,
  shopbot: haivanAdapter,
  shopxoainon: shopXoaiNonAdapter,
  xoainon: shopXoaiNonAdapter,
  custom: customAdapter,
}

export function normalizeProviderBaseUrl(urlStr: string): string {
  const trimmed = (urlStr || '').trim().replace(/\/+$/, '')
  return trimmed
    .replace(/\/api\/docs$/i, '')
    .replace(/\/docs$/i, '')
    .replace(/\/api\/products$/i, '')
    .replace(/\/api\/balance$/i, '')
    .replace(/\/+$/, '')
}

export function resolveEffectiveProvider(providerType: string, baseUrl?: string): string {
  const lowerUrl = (baseUrl || '').toLowerCase()
  if (lowerUrl.includes('shopxoainon')) return 'shopxoainon'
  if (lowerUrl.includes('haivankhosi')) return 'haivan'
  if (lowerUrl.includes('shoptoolgiare')) return 'shoptool'
  if (lowerUrl.includes('fatcatstore')) return 'fatcat'
  if (lowerUrl.includes('abcxy.store')) return 'dino'
  return (providerType || 'custom').trim().toLowerCase()
}

export function registerProviderAdapter(id: string, adapter: ProviderAdapter) {
  adapters[id.toLowerCase()] = adapter
}

export function getProviderAdapter(providerType: string, baseUrl?: string): ProviderAdapter {
  const resolved = resolveEffectiveProvider(providerType, baseUrl)
  const adapter = adapters[resolved] || adapters[providerType.toLowerCase()]
  if (!adapter) {
    throw new Error(`Nhà cung cấp "${providerType}" chưa được hỗ trợ adapter trong hệ thống`)
  }
  return adapter
}

export function getAvailableProviderTypes(): Array<{ id: string; name: string }> {
  return Object.values(adapters).map((a) => ({ id: a.id, name: a.name }))
}
