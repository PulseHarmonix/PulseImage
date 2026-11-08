const isTauri =
  typeof window !== 'undefined' &&
  Boolean(
    (window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }).__TAURI__ ||
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  )
const API_BASE = import.meta.env.DEV || isTauri ? 'http://127.0.0.1:8000' : ''

export class ApiError extends Error {
  status: number
  detail?: unknown

  constructor(message: string, status: number, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

export function mediaUrl(path?: string | null): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  return apiUrl(path.startsWith('/') ? path : `/${path}`)
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${response.status})`
    throw new ApiError(message, response.status, data)
  }

  return data as T
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  })
  return parseResponse<T>(response)
}

export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return parseResponse<T>(response)
}

export async function apiUpload(file: File): Promise<{ filename?: string; type?: string; error?: string }> {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(apiUrl('/upload'), { method: 'POST', body: form })
  return parseResponse(response)
}

export async function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    method: 'DELETE',
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  })
  return parseResponse<T>(response)
}

export async function apiDeleteGeneration(id: string): Promise<{ success?: boolean; error?: string }> {
  return apiPost('/delete-generation', { id })
}

export async function apiUpdateGeneration(
  id: string,
  updates: Record<string, unknown>,
): Promise<{ success?: boolean; error?: string }> {
  return apiPost('/update-generation', { id, ...updates })
}
