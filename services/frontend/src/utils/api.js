// ===========================================
// API CLIENT — the only way the SPA talks to the backend.
// VITE_API_URL is the API origin (e.g. https://api.unistylescuracao.com).
// In local dev it is empty and the Vite proxy forwards /api to the backend.
// ===========================================

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '').replace(/\/api$/, '')

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export function apiUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

function authHeader() {
  try {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

function cartHeader() {
  try {
    const cartId = localStorage.getItem('cart_id')
    return cartId ? { 'X-Cart-Id': cartId } : {}
  } catch {
    return {}
  }
}

/**
 * fetch wrapper: prefixes API_BASE, sends JSON, attaches auth + guest cart id,
 * refuses non-JSON responses (an HTML page means the request hit the SPA, not the API)
 * and throws ApiError on non-2xx.
 */
export async function apiFetch(path, { method = 'GET', body, headers = {}, auth = true, raw = false } = {}) {
  const init = {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? authHeader() : {}),
      ...cartHeader(),
      ...headers
    }
  }
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body)

  let response
  try {
    response = await fetch(apiUrl(path), init)
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0, null)
  }

  if (raw) return response

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null

  if (data === null && response.status !== 204) {
    throw new ApiError('Unexpected response from the server.', response.status, null)
  }

  if (!response.ok) {
    const message = data?.error
      || data?.message
      || data?.errors?.[0]?.msg
      || `Request failed (${response.status})`
    throw new ApiError(message, response.status, data)
  }

  return data
}

export const api = {
  get: (path, opts) => apiFetch(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' })
}

export default api
