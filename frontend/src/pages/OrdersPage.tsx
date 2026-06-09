import { useEffect, useState, useMemo } from 'react'
import { orders, catalog } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { Plus, CheckCircle, Clock, Truck, XCircle, Package, Eye, X, Lock, LockOpen, Search, Filter, Calendar, XCircle as XIcon, RotateCcw } from 'lucide-react'

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  processing: { label: 'В обработке', color: 'bg-blue-100 text-blue-700', icon: Package },
  shipped: { label: 'Отгружен', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700', icon: XCircle },
}

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
  
  const [isManagementVisible, setIsManagementVisible] = useState(() => {
    const saved = localStorage.getItem('orders_management_visible')
    return saved !== 'false'
  })

  useEffect(() => {
    localStorage.setItem('orders_management_visible', String(isManagementVisible))
  }, [isManagementVisible])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [isInfoLoading, setIsInfoLoading] = useState(false)

  const [newOrder, setNewOrder] = useState({ 
    comment: '', 
    items: [] as { product_id: number; quantity: number; unit_price: number }[] 
  })

  const [productSearch, setProductSearch] = useState('')
  const [productCategory, setProductCategory] = useState<string>('all')

  // 🔧 ЗАГРУЗКА СОХРАНЁННОЙ ФОРМЫ
  useEffect(() => {
    const savedForm = sessionStorage.getItem('order_form_data')
    if (savedForm) {
      try {
        const parsed = JSON.parse(savedForm)
        if (parsed.comment || parsed.items?.length > 0) {
          setNewOrder(parsed)
        }
      } catch (e) {
        console.error('Ошибка загрузки формы:', e)
      }
    }
  }, [])

  // 🔧 СОХРАНЕНИЕ ФОРМЫ
  useEffect(() => {
    if (newOrder.comment || newOrder.items.length > 0) {
      sessionStorage.setItem('order_form_data', JSON.stringify(newOrder))
    } else {
      sessionStorage.removeItem('order_form_data')
    }
  }, [newOrder])

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

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !productSearch || 
        p.sku?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.name?.toLowerCase().includes(productSearch.toLowerCase())
      const matchesCategory = productCategory === 'all' || p.category === productCategory
      return matchesSearch && matchesCategory
    })
  }, [products, productSearch, productCategory])

  const productCategories = useMemo(() => {
    const cats = new Set<string>()
    products.forEach(p => { if (p.category) cats.add(p.category) })
    return Array.from(cats).sort()
  }, [products])

  const filteredAndGroupedOrders = useMemo(() => {
    let filtered = [...ordersList]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(o => 
        o.order_number?.toLowerCase().includes(q) ||
        o.comment?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter)
    }
    if (dateFrom) {
      const from = new Date(dateFrom)
      filtered = filtered.filter(o => new Date(o.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      filtered = filtered.filter(o => new Date(o.created_at) <= to)
    }
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    const grouped: Record<string, any[]> = {}
    for (const order of filtered) {
      const dateKey = formatDateKey(order.created_at)
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(order)
    }
    return grouped
  }, [ordersList, searchQuery, statusFilter, dateFrom, dateTo])

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
      sessionStorage.removeItem('order_form_data')
      setOrdersList(prev => [res, ...prev])
      alert(`✅ Заказ создан: ${res.order_number}`)
    } catch (err: any) { 
      alert('❌ ' + (err.message || 'Ошибка')) 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await orders.updateStatus(id, status)
      setOrdersList(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    } catch (err: any) { alert('❌ ' + (err.message)) }
  }

  const updateItem = (idx: number, field: string, val: any) => {
    const updated = [...newOrder.items]
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === val)
      if (product) {
        updated[idx] = { 
          ...updated[idx], 
          product_id: val, 
          unit_price: product.sale_price || 0
        }
      } else {
        updated[idx] = { ...updated[idx], [field]: val }
      }
    } else {
      updated[idx] = { ...updated[idx], [field]: val }
    }
    setNewOrder({ ...newOrder, items: updated })
  }

  const removeItem = (idx: number) => {
    setNewOrder(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  // 🔧 ФУНКЦИЯ ОЧИСТКИ ФОРМЫ
  const clearOrderForm = () => {
    if (newOrder.items.length > 0 || newOrder.comment) {
      if (confirm('Очистить форму заказа? Все добавленные товары будут удалены.')) {
        setNewOrder({ comment: '', items: [] })
        sessionStorage.removeItem('order_form_data')
      }
    }
  }

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
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="all">Все статусы</option>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
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
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">➕ Создание заказа</h3>
            <button 
              type="button"
              onClick={clearOrderForm}
              className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              title="Очистить всю форму"
            >
              <RotateCcw className="w-4 h-4" />
              Очистить всё
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Комментарий" value={newOrder.comment} onChange={e => setNewOrder({...newOrder, comment: e.target.value})} className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-700 mb-3">Позиции заказа</h4>
            
            {/* 🔍 ПОИСК И ФИЛЬТР ДЛЯ ВЫБОРА ТОВАРА */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск по SKU или названию..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <select 
                  value={productCategory} 
                  onChange={e => setProductCategory(e.target.value)}
                  className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="all">Все категории</option>
                  {productCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              {/* 🔽 ВЫПАДАЮЩИЙ СПИСОК */}
              {filteredProducts.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                  {filteredProducts.map(p => {
                    const stockQty = p.total_quantity ?? p.quantity ?? 0
                    return (
                      <div 
                        key={p.id} 
                        className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                        onClick={() => {
                          const alreadyExists = newOrder.items.find(item => item.product_id === p.id)
                          if (alreadyExists) {
                            alert('⚠️ Этот товар уже добавлен в заказ')
                            return
                          }
                          
                          setNewOrder(prev => ({
                            ...prev,
                            items: [...prev.items, {
                              product_id: p.id,
                              quantity: 1,
                              unit_price: p.sale_price || 0
                            }]
                          }))
                          setProductSearch('')
                        }}
                      >
                        <div className="flex-1">
                          <span className="font-mono text-xs text-gray-500">{p.sku}</span>
                          <span className="ml-2 font-medium text-sm">{p.name}</span>
                          {p.category && <span className="ml-2 text-xs text-gray-400">({p.category})</span>}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-700">
                            {p.sale_price?.toLocaleString('ru-RU')} ₽
                          </div>
                          <div className={`text-xs ${stockQty > 0 ? 'text-gray-500' : 'text-red-500'}`}>
                            {stockQty} шт.
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              
              {productSearch && filteredProducts.length === 0 && (
                <div className="mt-2 text-sm text-gray-500 text-center py-2">
                  Товары не найдены
                </div>
              )}
            </div>
            
            {/* 📦 ВЫБРАННЫЕ ПОЗИЦИИ ЗАКАЗА - КРАСИВЫЙ СПИСОК */}
            {newOrder.items.length > 0 && (
              <div className="space-y-4">
                {newOrder.items.map((item, idx) => {
                  const selectedProduct = products.find(p => p.id === item.product_id)
                  const availableStock = selectedProduct?.total_quantity ?? selectedProduct?.quantity ?? 0
                  const isOverStock = item.quantity > availableStock && availableStock > 0
                  
                  return (
                    <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      {/* 📦 Информация о товаре */}
                      <div className="flex-1 min-w-[180px]">
                        <div className="text-sm font-semibold text-gray-900 truncate">{selectedProduct?.name || `Товар #${item.product_id}`}</div>
                        <div className="text-xs text-gray-500 font-mono">{selectedProduct?.sku}</div>
                      </div>

                      {/* 🔢 Количество + Наличие */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Кол-во"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', +e.target.value)}
                          className={`w-20 px-2 py-2 border rounded-lg text-sm text-center font-medium focus:ring-2 focus:ring-indigo-500 outline-none ${isOverStock ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300'}`}
                          required
                        />
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${availableStock === 0 ? 'bg-red-100 text-red-700' : isOverStock ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {availableStock} шт.
                        </span>
                      </div>

                      {/* 💰 Цена */}
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.unit_price}
                          onChange={e => updateItem(idx, 'unit_price', +e.target.value)}
                          className="w-28 px-3 py-2 pr-7 border border-gray-300 rounded-lg text-sm text-right font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                          required
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₽</span>
                      </div>

                      {/* ❌ Удалить */}
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить позицию"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            
            {newOrder.items.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-300">
                Выберите товары из списка выше (кликните на товар для добавления)
              </div>
            )}
          </div>
          
          {/* ИТОГО */}
          {newOrder.items.length > 0 && (
            <div className="border-t border-gray-200 pt-4 flex justify-between items-center bg-indigo-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">
                Позиций: {newOrder.items.length}
              </div>
              <div className="text-2xl font-bold text-indigo-700">
                Итого: {newOrder.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toLocaleString('ru-RU')} ₽
              </div>
            </div>
          )}
          
          <button type="submit" disabled={isSubmitting || newOrder.items.length === 0} className="bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed w-full font-medium transition-colors">
            Создать заказ
          </button>
        </form>
      )}

      {/* 📋 ТАБЛИЦА ЗАКАЗОВ - КРАСИВЫЙ СПИСОК */}
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
              {/* 🔵 СИНЯЯ ПОЛОСКА ДАТЫ (как в документах) */}
              <div className="sticky top-0 z-10 bg-indigo-50/95 backdrop-blur-sm px-4 py-2.5 border-b-2 border-indigo-200 flex items-center gap-2 rounded-t-lg">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">{dateKey}</h3>
                <span className="text-xs text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-full font-medium">
                  {dayOrders.length} {dayOrders.length === 1 ? 'заказ' : dayOrders.length < 5 ? 'заказа' : 'заказов'}
                </span>
              </div>
              
              <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
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
                  <tbody className="divide-y divide-gray-200">
                    {dayOrders.map((order, idx) => {
                      const st = statusConfig[order.status] || statusConfig.pending
                      return (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">{idx + 1}.</td>
                          <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{order.order_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{new Date(order.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{order.total_amount.toLocaleString('ru-RU')} ₽</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>
                              <st.icon className="w-3 h-3" /> {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{order.shipment_doc_id ? '✅ Создана' : '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleViewInfo(order.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Посмотреть состав заказа">
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                          {hasRole(['admin', 'warehouse_manager']) && isManagementVisible && (
                            <td className="px-4 py-3">
                              <select value={order.status} onChange={e => handleStatusChange(order.id, e.target.value)} className="p-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
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

      {/* 👇 МОДАЛКА ПРОСМОТРА ЗАКАЗА - КРАСИВАЯ */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                  📦 Заказ: {selectedOrder.order_number}
                  <span className="text-xs font-normal text-gray-500">от {new Date(selectedOrder.created_at).toLocaleDateString()}</span>
                </h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {isInfoLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent"></div></div>
              ) : (
                <div className="space-y-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="px-4 py-2.5 text-left rounded-l-lg">Товар</th>
                        <th className="px-4 py-2.5 text-center">Кол-во</th>
                        <th className="px-4 py-2.5 text-right">Цена</th>
                        <th className="px-4 py-2.5 text-right rounded-r-lg">Сумма</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedOrder.items?.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {item.product?.name || `Товар #${item.product_id}`}
                            </div>
                            {item.product?.sku && (
                              <div className="text-xs text-gray-400 font-mono">
                                {item.product.sku}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-indigo-600">{item.quantity} шт.</td>
                          <td className="px-4 py-3 text-right text-gray-700">{item.unit_price.toLocaleString()} ₽</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">{item.total_price.toLocaleString()} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-indigo-50 font-bold text-base">
                        <td colSpan={3} className="px-4 py-3 text-right text-indigo-900">ИТОГО:</td>
                        <td className="px-4 py-3 text-right text-indigo-700">{selectedOrder.total_amount.toLocaleString()} ₽</td>
                      </tr>
                    </tfoot>
                  </table>
                  {selectedOrder.comment && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                      💬 Комментарий: {selectedOrder.comment}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}