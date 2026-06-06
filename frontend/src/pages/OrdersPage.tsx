import { useEffect, useState, useMemo } from 'react'
import { orders, catalog } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { Plus, CheckCircle, Clock, Truck, XCircle, Package, Eye, X, Lock, LockOpen, Search, Filter, Calendar, XCircle as XIcon } from 'lucide-react'

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  processing: { label: 'В обработке', color: 'bg-blue-100 text-blue-700', icon: Package },
  shipped: { label: 'Отгружен', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700', icon: XCircle },
}

// 🔧 Вспомогательная функция: форматирование даты для группировки
const formatDateKey = (dateStr: string): string => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function OrdersPage() {
  const { hasRole } = useAuth()
  const [ordersList, setOrdersList] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isManagementVisible, setIsManagementVisible] = useState(true)
  
  // 🔍 ФИЛЬТРЫ И ПОИСК
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  
  // 👇 МОДАЛКА ПРОСМОТРА
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [isInfoLoading, setIsInfoLoading] = useState(false)

  const [newOrder, setNewOrder] = useState({ comment: '', items: [] as { product_id: number; quantity: number; unit_price: number }[] })

  useEffect(() => {
    const load = async () => {
      try {
        const [resOrders, resProducts] = await Promise.all([orders.list(), catalog.products()])
        setOrdersList(Array.isArray(resOrders) ? resOrders : [])
        setProducts(Array.isArray(resProducts) ? resProducts : [])
      } catch (err) { console.error(err) }
      finally { setIsLoading(false) }
    }
    load()
  }, [])

  // 🔧 ФИЛЬТРАЦИЯ И ГРУППИРОВКА ЗАКАЗОВ
  const filteredAndGroupedOrders = useMemo(() => {
    let filtered = [...ordersList]
    
    // Поиск по номеру
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(o => 
        o.order_number?.toLowerCase().includes(q) ||
        o.comment?.toLowerCase().includes(q)
      )
    }
    
    // Фильтр по статусу
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter)
    }
    
    // Фильтр по датам
    if (dateFrom) {
      const from = new Date(dateFrom)
      filtered = filtered.filter(o => new Date(o.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999) // до конца дня
      filtered = filtered.filter(o => new Date(o.created_at) <= to)
    }
    
    // Сортировка: новые сверху
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    // Группировка по датам
    const grouped: Record<string, any[]> = {}
    for (const order of filtered) {
      const dateKey = formatDateKey(order.created_at)
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(order)
    }
    
    return grouped
  }, [ordersList, searchQuery, statusFilter, dateFrom, dateTo])

  // 🔧 СБРОС ФИЛЬТРОВ
  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const handleViewInfo = async (id: number) => {
    setIsInfoLoading(true)
    setSelectedOrder({ id, items: [] })
    try {
      const res = await orders.get(id)
      setSelectedOrder(res)
    } catch (err) {
      console.error(err)
      setSelectedOrder(null)
    } finally {
      setIsInfoLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || newOrder.items.length === 0) return
    setIsSubmitting(true)
    try {
      const res = await orders.create({ comment: newOrder.comment, items: newOrder.items }) as any
      setShowForm(false)
      setNewOrder({ comment: '', items: [] })
      setOrdersList(prev => [res, ...prev])
      alert(`✅ Заказ создан: ${res.order_number}`)
    } catch (err: any) { alert('❌ ' + (err.message || 'Ошибка')) }
    finally { setIsSubmitting(false) }
  }

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await orders.updateStatus(id, status)
      setOrdersList(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    } catch (err: any) { alert('❌ ' + (err.message)) }
  }

  const addItem = () => setNewOrder(prev => ({ ...prev, items: [...prev.items, { product_id: products[0]?.id || 1, quantity: 1, unit_price: 0 }] }))
  const updateItem = (idx: number, field: string, val: any) => {
    const updated = [...newOrder.items]
    updated[idx] = { ...updated[idx], [field]: val }
    setNewOrder({ ...newOrder, items: updated })
  }

  // Подсчёт активных фильтров для бейджа
  const activeFiltersCount = [
    searchQuery.trim(),
    statusFilter !== 'all',
    dateFrom,
    dateTo
  ].filter(Boolean).length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 🔝 ЗАГОЛОВОК И КНОПКИ */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">📦 Заказы клиентов</h2>
        
        <div className="flex items-center gap-2">
          {hasRole(['admin', 'warehouse_manager']) && (
            <>
              {/* 🔒 Кнопка блокировки управления */}
              <button
                onClick={() => setIsManagementVisible(!isManagementVisible)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  isManagementVisible 
                    ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50' 
                    : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                }`}
                title={isManagementVisible ? 'Скрыть управление' : 'Показать управление'}
              >
                {isManagementVisible ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span className="hidden sm:inline">{isManagementVisible ? 'Управление' : 'Закрыто'}</span>
              </button>
              
              {/* 🔍 Кнопка фильтров */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border relative ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Фильтры</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              
              {/* ➕ Создать заказ */}
              <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{showForm ? 'Отмена' : 'Создать'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 🔍 ПАНЕЛЬ ФИЛЬТРОВ */}
      {showFilters && (
        <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Фильтры
            </h4>
            <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <XIcon className="w-3 h-3" /> Сбросить
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Поиск по номеру */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по номеру..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            
            {/* Фильтр по статусу */}
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">Все статусы</option>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            
            {/* Дата от */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            
            {/* Дата до */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          
          {/* Активные фильтры (теги) */}
          {(searchQuery || statusFilter !== 'all' || dateFrom || dateTo) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  Поиск: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  Статус: {statusConfig[statusFilter]?.label}
                  <button onClick={() => setStatusFilter('all')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  От: {dateFrom}
                  <button onClick={() => setDateFrom('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  До: {dateTo}
                  <button onClick={() => setDateTo('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ➕ Форма создания заказа */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Комментарий" value={newOrder.comment} onChange={e => setNewOrder({...newOrder, comment: e.target.value})} className="p-2 border rounded" />
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between mb-2"><h4 className="font-medium">Позиции заказа</h4><button type="button" onClick={addItem} className="text-sm text-indigo-600">+ Добавить товар</button></div>
            {newOrder.items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', +e.target.value)} className="p-2 border rounded flex-1">
                  {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
                <input type="number" min="1" placeholder="Кол-во" value={item.quantity} onChange={e => updateItem(idx, 'quantity', +e.target.value)} className="p-2 border rounded w-24" required />
                <input type="number" min="0" step="0.01" placeholder="Цена" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', +e.target.value)} className="p-2 border rounded w-32" required />
                <button type="button" onClick={() => setNewOrder(prev => ({...prev, items: prev.items.filter((_, i) => i !== idx)}))} className="text-red-500">✕</button>
              </div>
            ))}
          </div>
          <button type="submit" disabled={isSubmitting || newOrder.items.length === 0} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">Создать заказ</button>
        </form>
      )}

      {/* 📋 ТАБЛИЦА ЗАКАЗОВ С ГРУППИРОВКОЙ */}
      {isLoading ? (
        <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent mx-auto"></div></div>
      ) : Object.keys(filteredAndGroupedOrders).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Заказы не найдены. Попробуйте изменить фильтры.</p>
          {activeFiltersCount > 0 && (
            <button onClick={resetFilters} className="mt-2 text-sm text-indigo-600 hover:underline">Сбросить фильтры</button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(filteredAndGroupedOrders).map(([dateKey, dayOrders]) => (
            <div key={dateKey}>
              {/* 🗓️ ЗАГОЛОВОК ДАТЫ */}
              <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-700">{dateKey}</h3>
                <span className="text-xs text-gray-400">({dayOrders.length} {dayOrders.length === 1 ? 'заказ' : dayOrders.length < 5 ? 'заказа' : 'заказов'})</span>
              </div>
              
              {/* 📦 ТАБЛИЦА ЗАКАЗОВ ЗА ДЕНЬ */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-12">№</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">№ Заказа</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Время</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Сумма</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Отгрузка</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Инфо</th>
                      {hasRole(['admin', 'warehouse_manager']) && isManagementVisible && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Управление</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dayOrders.map((order, idx) => {
                      const st = statusConfig[order.status] || statusConfig.pending
                      return (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">
                            {idx + 1}.
                          </td>
                          <td className="px-4 py-3 font-mono text-sm font-medium">{order.order_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{new Date(order.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3 font-medium">{order.total_amount.toLocaleString('ru-RU')} ₽</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${st.color}`}>
                              <st.icon className="w-3 h-3" /> {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {order.shipment_doc_id ? '✅ Создана' : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              onClick={() => handleViewInfo(order.id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                              title="Посмотреть состав заказа"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                          {hasRole(['admin', 'warehouse_manager']) && isManagementVisible && (
                            <td className="px-4 py-3">
                              <select value={order.status} onChange={e => handleStatusChange(order.id, e.target.value)} className="p-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                                {Object.keys(statusConfig).map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
                              </select>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 👇 МОДАЛКА ПРОСМОТРА ЗАКАЗА (без изменений) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold flex items-center gap-2">
                📦 Заказ: {selectedOrder.order_number}
                <span className="text-xs font-normal text-gray-500">от {new Date(selectedOrder.created_at).toLocaleDateString()}</span>
              </h3>
              <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {isInfoLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent"></div></div>
              ) : (
                <div className="space-y-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left rounded-l">Товар</th>
                        <th className="px-3 py-2 text-center">Кол-во</th>
                        <th className="px-3 py-2 text-right">Цена</th>
                        <th className="px-3 py-2 text-right rounded-r">Сумма</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedOrder.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium">{item.product_name || `Товар #${item.product_id}`}</td>
                          <td className="px-3 py-2 text-center">{item.quantity} шт.</td>
                          <td className="px-3 py-2 text-right">{item.unit_price.toLocaleString()} ₽</td>
                          <td className="px-3 py-2 text-right font-bold">{item.total_price.toLocaleString()} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold text-base">
                        <td colSpan={3} className="px-3 py-3 text-right">ИТОГО:</td>
                        <td className="px-3 py-3 text-right text-indigo-600">{selectedOrder.total_amount.toLocaleString()} ₽</td>
                      </tr>
                    </tfoot>
                  </table>
                  {selectedOrder.comment && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      💬 Комментарий: {selectedOrder.comment}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}