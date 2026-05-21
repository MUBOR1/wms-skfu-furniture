const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('wms_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

export const auth = {
  login: (data: { login: string; password: string }) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: { login: string; password: string; full_name?: string }) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
};

export const catalog = {
  zones: () => request('/catalog/zones'),
  cells: (zoneId?: number) => request(`/catalog/cells${zoneId ? `?zone_id=${zoneId}` : ''}`),
  products: (search?: string) => request(`/catalog/products${search ? `?search=${search}` : ''}`),
};

export const documents = {
  list: () => request('/documents/'),
  create: (data: any) => request('/documents/', { method: 'POST', body: JSON.stringify(data) }),
  complete: (id: number) => request(`/documents/${id}/complete`, { method: 'POST' }),
};

export const inventory = {
  report: () => request('/inventory/report/stock'),
  create: (data: any) => request('/inventory/', { method: 'POST', body: JSON.stringify(data) }),
  complete: (id: number) => request(`/inventory/${id}/complete`, { method: 'POST' }),
};