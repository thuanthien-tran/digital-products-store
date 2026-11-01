/**
 * Read-Only FatCat Provider Adapter
 * Strict adherence to FatCat Store API specification (GET /api/products)
 */

export interface ValidatedFatcatProduct {
  id: number
  name: string
  price_vnd: number
  regular_price_vnd: number | null
  sale_qty: number | null
  stock: number
  max_quantity: number | null
  description: string
}

export interface AdapterConfig {
  baseUrl: string
  apiKey: string
  timeoutMs: number
  maxRetries: number
}

export interface AdapterResult {
  success: boolean
  products?: ValidatedFatcatProduct[]
  error?: string
  statusCode?: number
  isNetworkOrTimeout?: boolean
}

/**
 * Validates the configured URL to prevent SSRF or sending API keys to unauthorized hosts.
 */
export function validateApiHost(urlStr: string): { valid: boolean; error?: string; parsedUrl?: URL } {
  try {
    const parsed = new URL(urlStr)
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'URL không được phép chứa thông tin userinfo (user:password)' }
    }

    const rawHost = parsed.hostname.toLowerCase()
    const canonicalHost = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost

    const isProduction = process.env.NODE_ENV === 'production'
    const isTestAllowed = !isProduction && (process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_API_MOCK === 'true')

    const isOfficialHost = canonicalHost === 'api.fatcatstore.click'
    const isLocalhost = (canonicalHost === 'localhost' || canonicalHost === '127.0.0.1' || canonicalHost === '::1') && isTestAllowed
    const isMockDomain = (canonicalHost.endsWith('.test') || canonicalHost.endsWith('.local')) && isTestAllowed

    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Chỉ chấp nhận giao thức HTTP/HTTPS' }
    }

    // Require HTTPS strictly in production or whenever connecting externally
    if (parsed.protocol === 'http:' && !isLocalhost && !isMockDomain) {
      return { valid: false, error: 'Kết nối ra ngoài bắt buộc sử dụng HTTPS bảo mật' }
    }

    if (parsed.port && !['443', '8443'].includes(parsed.port) && !isLocalhost && !isMockDomain) {
      return { valid: false, error: `Cổng ${parsed.port} không được phép` }
    }

    const isAllowed = isOfficialHost || isLocalhost || isMockDomain

    if (!isAllowed) {
      return { valid: false, error: `Host "${parsed.hostname}" không nằm trong danh sách máy chủ được phép của FatCat` }
    }

    return { valid: true, parsedUrl: parsed }
  } catch {
    return { valid: false, error: 'Cấu hình URL API không hợp lệ' }
  }
}

export function getAdapterConfig(overrides?: Partial<AdapterConfig>): AdapterConfig {
  const rawBase =
    overrides?.baseUrl ||
    process.env.FATCAT_API_BASE_URL ||
    process.env.FATCAT_API_URL ||
    'https://api.fatcatstore.click'

  const apiKey = overrides?.apiKey !== undefined ? overrides.apiKey : (process.env.FATCAT_API_KEY || '')
  const timeoutMs = overrides?.timeoutMs || 8000
  const maxRetries = overrides?.maxRetries !== undefined ? overrides.maxRetries : 2

  return {
    baseUrl: rawBase.replace(/\/+$/, ''),
    apiKey,
    timeoutMs,
    maxRetries,
  }
}

/**
 * Validates and sanitizes individual product item from FatCat API.
 * Ensures numbers are non-negative integers and required fields exist.
 */
export function validateProductItem(item: unknown, index: number): ValidatedFatcatProduct {
  if (!item || typeof item !== 'object') {
    throw new Error(`Phần tử thứ ${index} trong danh sách sản phẩm không phải là đối tượng hợp lệ`)
  }

  const rec = item as Record<string, unknown>

  // 1. ID: Positive integer
  const id = Number(rec.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Sản phẩm tại vị trí ${index} có id không hợp lệ: "${rec.id}"`)
  }

  // 2. Name: Non-empty string
  const name = typeof rec.name === 'string' ? rec.name.trim() : ''
  if (!name) {
    throw new Error(`Sản phẩm #${id} thiếu trường tên (name)`)
  }

  // 3. Price VND: Non-negative integer (Wholesale price as returned by API - NO 2% deduction)
  const price_vnd = Number(rec.price_vnd)
  if (!Number.isInteger(price_vnd) || price_vnd < 0) {
    throw new Error(`Sản phẩm #${id} (${name}) có giá sỉ price_vnd không hợp lệ: "${rec.price_vnd}"`)
  }

  // 4. Regular Price: Optional non-negative integer
  let regular_price_vnd: number | null = null
  if (rec.regular_price_vnd !== undefined && rec.regular_price_vnd !== null && rec.regular_price_vnd !== '') {
    const regPrice = Number(rec.regular_price_vnd)
    if (Number.isInteger(regPrice) && regPrice >= 0) {
      regular_price_vnd = regPrice
    }
  }

  // 5. Stock: Non-negative integer
  const stock = Number(rec.stock)
  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error(`Sản phẩm #${id} (${name}) có tồn kho stock không hợp lệ: "${rec.stock}"`)
  }

  // 6. Sale quantity: Optional non-negative integer
  let sale_qty: number | null = null
  if (rec.sale_qty !== undefined && rec.sale_qty !== null && rec.sale_qty !== '') {
    const sq = Number(rec.sale_qty)
    if (Number.isInteger(sq) && sq >= 0) {
      sale_qty = sq
    }
  }

  // 7. Max quantity: Optional positive integer
  let max_quantity: number | null = null
  if (rec.max_quantity !== undefined && rec.max_quantity !== null && rec.max_quantity !== '') {
    const mq = Number(rec.max_quantity)
    if (Number.isInteger(mq) && mq > 0) {
      max_quantity = mq
    }
  }

  // 8. Description: String
  const description = typeof rec.description === 'string' ? rec.description.trim() : ''

  return {
    id,
    name,
    price_vnd,
    regular_price_vnd,
    sale_qty,
    stock,
    max_quantity,
    description,
  }
}

/**
 * Executes a single HTTP GET request to FatCat /api/products with timeout.
 */
async function fetchProductsOnce(
  config: AdapterConfig
): Promise<{ status: number; ok: boolean; data?: unknown; rawText?: string; error?: string; isTimeout?: boolean }> {
  const hostCheck = validateApiHost(config.baseUrl)
  if (!hostCheck.valid) {
    return { status: 400, ok: false, error: hostCheck.error }
  }

  const endpoint = `${config.baseUrl}/api/products`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }

    if (config.apiKey) {
      headers['X-API-Key'] = config.apiKey
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timeoutId)

    const contentType = res.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')

    if (!isJson) {
      const rawText = await res.text()
      return {
        status: res.status,
        ok: false,
        rawText,
        error: `Máy chủ trả về phản hồi không phải định dạng JSON (Status ${res.status})`,
      }
    }

    try {
      const data = await res.json()
      return { status: res.status, ok: res.ok, data }
    } catch {
      return {
        status: res.status,
        ok: false,
        error: `Phản hồi từ máy chủ không thể giải mã JSON hợp lệ (Status ${res.status})`,
      }
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 408,
        ok: false,
        isTimeout: true,
        error: `Quá thời gian kết nối tới API FatCat (${config.timeoutMs}ms)`,
      }
    }
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối mạng'
    return { status: 0, ok: false, error: `Lỗi kết nối tới máy chủ API: ${msg}` }
  }
}

/**
 * Fetch products from FatCat API with validation, retry on 5xx/timeout, and security sanitization.
 */
export async function fetchFatcatCatalog(options?: Partial<AdapterConfig>): Promise<AdapterResult> {
  const config = getAdapterConfig(options)

  if (!config.apiKey) {
    return {
      success: false,
      statusCode: 401,
      error: 'Chưa cấu hình khóa API (FATCAT_API_KEY)',
    }
  }

  let attempt = 0
  let lastError = 'Không thể kết nối đến máy chủ FatCat'
  let lastStatus = 0
  let isNetworkOrTimeout = false

  while (attempt <= config.maxRetries) {
    attempt++

    const res = await fetchProductsOnce(config)
    lastStatus = res.status
    isNetworkOrTimeout = Boolean(res.isTimeout || res.status === 0)

    if (res.ok && res.data) {
      // Validate schema
      const payload = res.data as Record<string, unknown>
      if (!payload || typeof payload !== 'object' || !Array.isArray(payload.products)) {
        return {
          success: false,
          statusCode: 200,
          error: 'Cấu trúc dữ liệu API không đúng: thiếu trường "products" dạng mảng',
        }
      }

      try {
        const validated = payload.products.map((item, idx) => validateProductItem(item, idx))
        return {
          success: true,
          products: validated,
          statusCode: 200,
        }
      } catch (valErr: unknown) {
        const msg = valErr instanceof Error ? valErr.message : 'Dữ liệu sản phẩm không hợp lệ'
        return {
          success: false,
          statusCode: 200,
          error: `Dữ liệu sản phẩm từ đại lý không đạt chuẩn: ${msg}`,
        }
      }
    }

    // Specific error mapping without leaking secrets
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        statusCode: res.status,
        error: 'Khóa API FatCat không hợp lệ hoặc không có quyền truy cập (401/403).',
      }
    }

    if (res.status === 429) {
      return {
        success: false,
        statusCode: 429,
        error: 'Yêu cầu vượt quá giới hạn tần suất (Rate limit 429). Vui lòng thử lại sau.',
      }
    }

    lastError = res.error || `Lỗi máy chủ đại lý (Mã HTTP ${res.status})`

    // Only retry for 5xx server errors or timeouts
    const isRetryable = res.status >= 500 || res.isTimeout || res.status === 0
    if (!isRetryable || attempt > config.maxRetries) {
      break
    }

    // Exponential backoff: 300ms, 600ms
    const delay = attempt * 300
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  return {
    success: false,
    statusCode: lastStatus,
    isNetworkOrTimeout,
    error: lastError,
  }
}
