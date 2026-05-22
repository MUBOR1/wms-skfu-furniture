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
export interface ShipmentResponse {
  message: string
  document_id: number
  doc_number: string
  status: string
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
      // 👇 ДОБАВЛЕНЫ ЦЕНЫ
      purchase_price: number;
      sale_price: number;
    }>>(`/catalog/products${search ? `?search=${search}` : ''}`),
    
  createProduct: (data: any) => request('/catalog/products', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  
  zones: () => request('/catalog/zones'),
  cells: (zoneId?: number) => request(`/catalog/cells${zoneId ? `?zone_id=${zoneId}` : ''}`),
}

export const documents = {
  list: () => request('/documents/'),
  create: (data: any) => request('/documents/', { method: 'POST', body: JSON.stringify(data) }),
  complete: (id: number) => request(`/documents/${id}/complete`, { method: 'POST' }),
}

export const inventory = {
  list: () => request('/inventory/'),
  create: (data: any) => request('/inventory/', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => request(`/inventory/${id}`),
  complete: (id: number) => request(`/inventory/${id}/complete`, { method: 'POST' }),
  // ← ИСПРАВЛЕНО: используем рабочий эндпоинт из analytics
  report: () => request('/analytics/stock-report'),
}

export const orders = {
  list: () => request('/orders/'),
  create: (data: any) => request('/orders/', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: number) => request(`/orders/${id}`),
  updateStatus: (id: number, status: string) => request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  // 👇 ИСПРАВЛЕНО: добавлен тип возврата
  createShipment: (orderId: number) => request<ShipmentResponse>(`/orders/${orderId}/create-shipment`, { method: 'POST' }),
}

export const analytics = {
  dashboardStats: (days: number = 30) => request(`/analytics/dashboard-stats?days=${days}`),
  stockReport: () => request<Array<{
  sku: string;
  name: string;
  category: string | null;
  purchase_price: number;
  sale_price: number;
  quantity: number;
  min_stock: number;
  max_stock: number;
  status: 'critical' | 'low' | 'normal' | 'overstock';
}>>('/analytics/stock-report'),
}

export const audit = {
  logs: (params?: { entity_type?: string; start_date?: string }) => {
    const q = new URLSearchParams(params as any).toString()
    return request(`/audit/logs${q ? '?' + q : ''}`)
  },
}

// Экспорт/Импорт (используем raw fetch для работы с файлами/blob)
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
  // 🔗 ДОБАВЛЕНО:
  shipment_doc_id?: number | null
}