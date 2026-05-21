const API_BASE = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('wms_token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `API Error: ${res.status}`)
  }
  // ← Явное приведение: fetch возвращает unknown, мы говорим "это тип T"
  return res.json() as Promise<T>
}

export const auth = {
  login: (data: { login: string; password: string }) => 
    request<{ access_token: string; token_type: string }>('/auth/login', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
  register: (data: { login: string; password: string; full_name?: string }) => 
    request<{ id: number; login: string; role: string }>('/auth/register', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
  me: () => request<{ id: number; login: string; role: string; full_name: string | null }>('/auth/me'),
}

export const catalog = {
  products: (search?: string) => 
    request<Array<{ 
      id: number; sku: string; name: string; category: string | null; 
      weight_kg: number; min_stock: number; max_stock: number 
    }>>(`/catalog/products${search ? `?search=${search}` : ''}`),
  createProduct: (data: any) => request('/catalog/products', { method: 'POST', body: JSON.stringify(data) }),
  zones: () => request('/catalog/zones'),
  cells: (zoneId?: number) => request(`/catalog/cells${zoneId ? `?zone_id=${zoneId}` : ''}`),
}

export const documents = {
  list: () => request('/documents/'),
  create: (data: any) => request('/documents/', { method: 'POST', body: JSON.stringify(data) }),
  complete: (id: number) => request(`/documents/${id}/complete`, { method: 'POST' }),
}

export const inventory = {
  report: () => request<Array<{ product_sku: string; product_name: string; quantity: number }>>('/inventory/report/stock'),
}