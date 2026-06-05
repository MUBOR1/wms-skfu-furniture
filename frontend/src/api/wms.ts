const API_BASE = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('wms_token')
  
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

// 👇 ЭКСПОРТИРУЕМ ФУНКЦИЮ REQUEST
export { request }

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
    request<Array<{ 
      id: number; 
      sku: string; 
      name: string; 
      category: string | null; 
      weight_kg: number; 
      min_stock: number; 
      max_stock: number;
      purchase_price: number;
      sale_price: number;
    }>>(`/catalog/products${search ? `?search=${search}` : ''}`),
    
  createProduct: (data: any) => request('/catalog/products', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  
  // 👇 НОВЫЕ МЕТОДЫ:
  updateProduct: (id: number, data: any) => request(`/catalog/products/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  
  deleteProduct: (id: number) => request(`/catalog/products/${id}`, { method: 'DELETE' }),
  
  categories: () => request<string[]>('/catalog/categories'),
  
  zones: () => request('/catalog/zones'),
  cells: (zoneId?: number) => request(`/catalog/cells${zoneId ? `?zone_id=${zoneId}` : ''}`),
}

export const documents = {
  // 👇 ПРОСТОЙ СПИСОК БЕЗ ТИПА
  list: () => request('/documents/'),
  
  // 👇 getDoc возвращает any (просто для работы)
  getDoc: (id: number) => request(`/documents/${id}`),
  
  create: (data: any) => request('/documents/', { method: 'POST', body: JSON.stringify(data) }),
  
  // 👇 update и delete тоже без сложных типов
  update: (id: number, data: any) => request(`/documents/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  delete: (id: number) => request(`/documents/${id}`, { method: 'DELETE' }),
  
  complete: (id: number) => request(`/documents/${id}/complete`, { method: 'POST' }),
}

export const inventory = {
  list: () => request('/inventory/'),
  create: (data: any) => request('/inventory/', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => request(`/inventory/${id}`),
  complete: (id: number) => request(`/inventory/${id}/complete`, { method: 'POST' }),
  report: () => request('/analytics/stock-report'),
}

export const orders = {
  list: () => request('/orders/'),
  create: (data: any) => request('/orders/', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => request(`/orders/${id}`),
  updateStatus: (id: number, status: string) => request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
}

export const analytics = {
  dashboardStats: (days: number = 30) => request(`/analytics/dashboard-stats?days=${days}`),
  stockReport: () => request('/analytics/stock-report'),
}

export const audit = {
  logs: (params?: { entity_type?: string; start_date?: string }) => {
    const q = new URLSearchParams(params as any).toString()
    return request(`/audit/logs${q ? '?' + q : ''}`)
  },
}

export const catalogExport = async () => {
  const res = await fetch('/api/catalog/products/export', {
    headers: { Authorization: `Bearer ${localStorage.getItem('wms_token')}` }
  })
  if (!res.ok) throw new Error('Ошибка экспорта')
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'products_export.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export const catalogImport = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/catalog/products/import', {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('wms_token')}` },
    body: formData
  })
  return res.json()
}

export interface Order {
  id: number
  order_number: string
  client_id: number
  status: string
  total_amount: number
  comment: string | null
  created_at: string
  shipment_doc_id?: number | null
  items?: { // инфо о заказах
    id: number
    product_id: number
    quantity: number
    unit_price: number
    total_price: number
    product_name: string | null
  }[]
}

export interface DocumentDetails {
  id: number
  doc_number: string
  type: string
  status: string
  created_at: string | null
  comment: string | null
  items: Array<{
    id: number
    product_id: number
    product_name?: string
    product_sku?: string
    quantity: number
    from_cell_id?: number
    to_cell_id?: number
  }>
}