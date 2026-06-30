// src/api/wms.ts
const API_BASE = '/api'

// 🔥 ФУНКЦИЯ ДЛЯ СОХРАНЕНИЯ ТОКЕНА
const saveToken = (token: string): void => {
  console.log('💾 Сохраняем токен в sessionStorage')
  const saved = sessionStorage.getItem('wms_auth')
  let authData = { token, user: null }
  
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      authData = { ...parsed, token }
    } catch {
      // ignore
    }
  }
  
  sessionStorage.setItem('wms_auth', JSON.stringify(authData))
  console.log('✅ Токен сохранен:', token.substring(0, 30) + '...')
}

// 🔥 ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ТОКЕНА
const getToken = (): string | null => {
  // Сначала проверяем sessionStorage
  const saved = sessionStorage.getItem('wms_auth')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.token) {
        console.log('✅ Токен из sessionStorage получен')
        return parsed.token
      }
    } catch {
      console.warn('⚠️ Ошибка парсинга sessionStorage')
    }
  }
  
  // Если в sessionStorage нет — проверяем localStorage (для обратной совместимости)
  const localToken = localStorage.getItem('wms_token')
  if (localToken) {
    console.log('✅ Токен из localStorage получен')
    // Переносим в sessionStorage
    saveToken(localToken)
    localStorage.removeItem('wms_token')
    return localToken
  }
  
  console.warn('⚠️ Токен не найден нигде')
  return null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  
  console.log(`📡 Запрос к: ${path}, метод: ${options.method || 'GET'}`)
  console.log(`🔑 Токен: ${token ? 'есть (' + token.substring(0, 20) + '...)' : 'НЕТ!'}`)
  
  const headers = new Headers(options.headers as HeadersInit)
  headers.set('Content-Type', 'application/json')
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
    console.log(`📨 Заголовок Authorization: Bearer ${token.substring(0, 20)}...`)
  } else {
    console.warn('⚠️ Токен отсутствует, запрос без авторизации!')
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  console.log(`📨 Ответ от ${path}: статус ${res.status}`)

  if (res.status === 401) {
    console.error('❌ 401 Unauthorized - токен недействителен или истек')
    // 🔥 ОЧИЩАЕМ ВСЁ
    sessionStorage.removeItem('wms_auth')
    localStorage.removeItem('wms_token')
    localStorage.removeItem('wms_user')
    throw new Error('Сессия истекла. Пожалуйста, войдите заново.')
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: `Ошибка сервера: ${res.status}` }))
    console.error(`❌ Ошибка ${res.status}:`, errData)
    throw new Error(errData.detail || `API Error: ${res.status}`)
  }

  return res.json() as Promise<T>
}

export { request, saveToken, getToken }

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
  
  restoreProduct: (id: number) => 
    request(`/catalog/products/${id}/restore`, { method: 'POST' }),
  
  deletePermanent: (id: number) => 
    request(`/catalog/products/${id}/permanent`, { method: 'DELETE' }),
  
  deleteProduct: (id: number, hard: boolean = false) => 
    request(`/catalog/products/${id}?hard=${hard}`, { method: 'DELETE' }),
  
  categories: () => request<Category[] | string[]>('/catalog/categories'),
  
  createCategory: (name: string) => 
    request(`/catalog/categories?name=${encodeURIComponent(name)}`, { method: 'POST' }),
  
  updateCategory: (oldName: string, newName: string) => 
    request(`/catalog/categories/${encodeURIComponent(oldName)}?new_name=${encodeURIComponent(newName)}`, { method: 'PUT' }),
  
  deleteCategory: (name: string) => 
    request(`/catalog/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  
  favorites: () => request<Array<{ 
    id: number; 
    sku: string; 
    name: string; 
    sale_price: number 
  }>>('/client/favorites'),
  
  toggleFavorite: (productId: number) => request<{ 
    message: string; 
    favorited: boolean 
  }>(`/client/favorites/${productId}`, {
    method: 'POST'
  }),
  
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

// ============================================
// 🔥 АНАЛИТИКА И ОТЧЁТЫ (РАСШИРЕНО)
// ============================================

export const analytics = {
  // Существующие
  dashboardStats: (days: number = 30) => request(`/analytics/dashboard-stats?days=${days}`),
  stockReport: () => request('/analytics/stock-report'),
  stockDetails: (productId: number) => request(`/analytics/stock-details?product_id=${productId}`),
  
  // 🔥 НОВЫЕ ОТЧЁТЫ
  turnoverReport: (period: string = '30', category?: string) => {
    let url = `/analytics/turnover-report?period=${period}`
    if (category) url += `&category=${encodeURIComponent(category)}`
    return request<any[]>(url)
  },
  
  criticalReport: (category?: string) => {
    let url = '/analytics/critical-report'
    if (category) url += `?category=${encodeURIComponent(category)}`
    return request<any[]>(url)
  },
  
  valueReport: (category?: string) => {
    let url = '/analytics/value-report'
    if (category) url += `?category=${encodeURIComponent(category)}`
    return request<{ items: any[]; total_value: number }>(url)
  },
  
  // 🔥 ЭКСПОРТ ОТЧЁТА В EXCEL
  exportReport: async (reportType: string, period?: string, category?: string): Promise<Blob> => {
    const token = getToken()
    let url = `/analytics/export-excel?report_type=${reportType}`
    if (period) url += `&period=${period}`
    if (category) url += `&category=${encodeURIComponent(category)}`
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка экспорта' }))
      throw new Error(error.detail || `Ошибка: ${response.status}`)
    }
    
    return response.blob()
  }
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
  logsRecent: (limit: number = 10) => 
    request<Array<AuditLog>>(`/audit/logs/recent?limit=${limit}`),
}

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
  const token = getToken()
  const res = await fetch(`/api/catalog/products/export?format=${format}`, {
    headers: { Authorization: `Bearer ${token}` }
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

export const bulkDeleteProducts = (productIds: number[], hard: boolean = false) => 
  request<{ success: number; errors: number; error_details?: string[]; hard_delete?: boolean }>('/catalog/products/bulk-delete', { 
    method: 'POST', 
    body: JSON.stringify({ product_ids: productIds, hard }) 
  })

export const catalogImport = async (file: File) => {
  const token = getToken()
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/catalog/products/import', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
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

export const clientCatalog = {
  products: (params?: { 
    search?: string
    category?: string
    min_price?: number
    max_price?: number
    in_stock?: boolean
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append('search', params.search)
    if (params?.category) queryParams.append('category', params.category)
    if (params?.min_price) queryParams.append('min_price', params.min_price.toString())
    if (params?.max_price) queryParams.append('max_price', params.max_price.toString())
    if (params?.in_stock) queryParams.append('in_stock', 'true')
    
    return request(`/client/products?${queryParams.toString()}`)
  },
  
  categories: () => request('/client/categories'),
  
  getProduct: (id: number) => request(`/client/products/${id}`),
  
  createOrder: (data: { items: { product_id: number; quantity: number }[]; comment?: string }) =>
    request('/client/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  myOrders: () => request('/client/my-orders'),
}

export const chat = {
  messages: (limit: number = 50) => request(`/chat/messages?limit=${limit}`),
  
  sendMessage: (message: string, is_client_message: boolean = true) =>
    request('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ message, is_client_message })
    }),
  
  unreadCount: () => request('/chat/unread-count'),
  
  markRead: () => request('/chat/mark-read', { method: 'POST' }),
}

// ============================================
// 🔥 ЭКСПОРТ ДОКУМЕНТОВ (ДЛЯ СКЛАДСКИХ ДОКУМЕНТОВ)
// ============================================

export const exportDocumentExcel = async (docId: number): Promise<Blob> => {
  const token = getToken()
  const response = await fetch(`/api/documents/${docId}/export-excel`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Ошибка экспорта' }))
    throw new Error(error.detail || `Ошибка: ${response.status}`)
  }
  
  return response.blob()
}

export const exportDocumentCSV = async (docId: number): Promise<Blob> => {
  const token = getToken()
  const response = await fetch(`/api/documents/${docId}/export-csv`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Ошибка экспорта' }))
    throw new Error(error.detail || `Ошибка: ${response.status}`)
  }
  
  return response.blob()
}