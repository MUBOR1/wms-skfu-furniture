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

// 🔧 Интерфейс для категории
export interface Category {
  name: string
  product_count?: number
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
    }>>(`/catalog/products${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    
  createProduct: (data: any) => request('/catalog/products', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  
  updateProduct: (id: number, data: any) => request(`/catalog/products/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),

  // 🔍 Архив товаров
  archived: (params?: { search?: string; date_from?: string; date_to?: string }) => {
  const queryParams = new URLSearchParams()
  if (params?.search) queryParams.append('search', params.search)
  if (params?.date_from) queryParams.append('date_from', params.date_from)
  if (params?.date_to) queryParams.append('date_to', params.date_to)
  
  const queryString = queryParams.toString()
  return request<Array<{ 
    id: number; 
    sku: string; 
    name: string; 
    category: string | null;
    archived_at?: string | null;
  }>>(`/catalog/products/archived${queryString ? '?' + queryString : ''}`)
},
  
  // ♻️ Восстановить товар
  restoreProduct: (id: number) => 
    request(`/catalog/products/${id}/restore`, { method: 'POST' }),
  
  // 🔥 Полное удаление из архива
  deletePermanent: (id: number) => 
    request(`/catalog/products/${id}/permanent`, { method: 'DELETE' }),
  
  // 🔧 УДАЛЕНИЕ ТОВАРА (с поддержкой hard delete)
  deleteProduct: (id: number, hard: boolean = false) => 
    request(`/catalog/products/${id}?hard=${hard}`, { method: 'DELETE' }),
  
  // 🔧 КАТЕГОРИИ — возвращаем Category[] | string[] для обратной совместимости
  categories: () => request<Category[] | string[]>('/catalog/categories'),
  
  // 🔧 НОВЫЕ МЕТОДЫ ДЛЯ УПРАВЛЕНИЯ КАТЕГОРИЯМИ
  createCategory: (name: string) => 
    request(`/catalog/categories?name=${encodeURIComponent(name)}`, { method: 'POST' }),
  
  updateCategory: (oldName: string, newName: string) => 
    request(`/catalog/categories/${encodeURIComponent(oldName)}?new_name=${encodeURIComponent(newName)}`, { method: 'PUT' }),
  
  deleteCategory: (name: string) => 
    request(`/catalog/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  
  zones: () => request('/catalog/zones'),
  cells: (zoneId?: number) => request(`/catalog/cells${zoneId ? `?zone_id=${zoneId}` : ''}`),
}

export const documents = {
  list: () => request('/documents/'),
  getDoc: (id: number) => request(`/documents/${id}`),
  create: (data: any) => request('/documents/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/documents/${id}`, { method: 'DELETE' }),
  complete: (id: number) => request(`/documents/${id}/complete`, { method: 'POST' }),
  // 🔧 НОВОЕ:
  updateStatus: (id: number, status: string) => request(`/documents/${id}/status`, { 
    method: 'PATCH', 
    body: JSON.stringify({ status }) 
  }),
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
  stockDetails: (productId: number) => request(`/analytics/stock-details?product_id=${productId}`),
}

export const audit = {
  logs: (params?: { entity_type?: string; start_date?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.entity_type) q.append('entity_type', params.entity_type)
    if (params?.start_date) q.append('start_date', params.start_date)
    if (params?.limit) q.append('limit', String(params.limit))
    const queryString = q.toString()
    return request<Array<AuditLog>>(`/audit/logs${queryString ? '?' + queryString : ''}`)
  },
  // 👇 НОВЫЙ МЕТОД ДЛЯ ДАШБОРДА
  logsRecent: (limit: number = 10) => 
    request<Array<AuditLog>>(`/audit/logs/recent?limit=${limit}`),
}

// 👇 ДОБАВЬТЕ ИНТЕРФЕЙС (в начало файла или перед audit)
interface AuditLog {
  id: number
  user_id: number
  action: string
  entity_type: string
  entity_id: number
  old_value: string | null
  new_value: string | null
  created_at: string
}

export const catalogExport = async (format: 'csv' | 'xlsx' = 'csv') => {
  const res = await fetch(`/api/catalog/products/export?format=${format}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('wms_token')}` }
  })
  if (!res.ok) throw new Error('Ошибка экспорта')
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `products_export_${new Date().toISOString().slice(0,10)}.${format}`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// 🔧 МАССОВОЕ УДАЛЕНИЕ (с поддержкой hard delete)
export const bulkDeleteProducts = (productIds: number[], hard: boolean = false) => 
  request<{ success: number; errors: number; error_details?: string[]; hard_delete?: boolean }>('/catalog/products/bulk-delete', { 
    method: 'POST', 
    body: JSON.stringify({ product_ids: productIds, hard }) 
  })

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
  items?: {
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