const API_BASE = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('wms_token')
  
  // Безопасно собираем заголовки
  const headers = new Headers(options.headers as HeadersInit)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    localStorage.removeItem('wms_token')
    localStorage.removeItem('wms_user')
    throw new Error('Сессия истекла. Пожалуйста, войдите заново.')
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: `Ошибка сервера: ${res.status}` }))
    throw new Error(errData.detail || `API Error: ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const auth = {
  login: (data: { login: string; password: string }) => 
    request<{ access_token: string; token_type: string }>('/auth/login', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
  register: (data: { login: string; password: string; full_name?: string }) => 
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<{ id: number; login: string; role: 'admin' | 'warehouse_manager' | 'warehouse_worker' | 'client'; full_name: string | null; is_active: boolean }>('/auth/me'),
}

export const catalog = {
  products: (search?: string) => 
    request<Array<{ id: number; sku: string; name: string; category: string | null; weight_kg: number; min_stock: number; max_stock: number }>>(
      `/catalog/products${search ? `?search=${search}` : ''}`
    ),
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
  create: (data: any) => request('/inventory/', { method: 'POST', body: JSON.stringify(data) }),
  complete: (id: number) => request(`/inventory/${id}/complete`, { method: 'POST' }),
}