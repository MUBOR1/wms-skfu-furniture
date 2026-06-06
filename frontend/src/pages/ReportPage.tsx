import { useEffect, useState, useMemo } from 'react'
import { inventory, catalog } from '../api/wms'
import { Package, TrendingUp, AlertTriangle, CheckCircle, Search, Filter, XCircle as XIcon, RefreshCw } from 'lucide-react'

// 🔧 ИНТЕРФЕЙС
interface StockItem {
  sku: string
  name: string
  category: string | null
  quantity: number
  min_stock?: number
  max_stock?: number
  status?: string
}

// Список статусов для фильтра
const statusOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'ok', label: '✅ В наличии' },
  { value: 'low', label: '⚠️ Мало' },
  { value: 'critical', label: '❌ Нет в наличии' },
]

export default function ReportPage() {
  const [report, setReport] = useState<StockItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 🔍 ФИЛЬТРЫ И ПОИСК
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [dataReport, dataCatalog] = await Promise.all([
          inventory.report(),
          catalog.categories()
        ])
        
        setReport(Array.isArray(dataReport) ? dataReport : [])
        
        // Извлекаем уникальные категории из отчёта + из каталога
        const cats = new Set<string>()
        if (Array.isArray(dataReport)) {
          dataReport.forEach((item: any) => {
            if (item.category) cats.add(item.category)
          })
        }
        if (Array.isArray(dataCatalog)) {
          dataCatalog.forEach((c: any) => {
            if (c.name) cats.add(c.name)
          })
        }
        setCategories(Array.from(cats).sort())
        setError(null)
      } catch (err: any) {
        console.error('Report error:', err)
        setError('Не удалось загрузить данные: ' + err.message)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // 🔧 ФИЛЬТРАЦИЯ ДАННЫХ
  const filteredReport = useMemo(() => {
    let filtered = [...report]
    
    // Поиск по SKU или названию
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.sku?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q)
      )
    }
    
    // Фильтр по статусу
    if (statusFilter !== 'all') {
      if (statusFilter === 'ok') {
        filtered = filtered.filter(i => i.status !== 'low' && i.status !== 'critical' && (i.quantity || 0) > 0)
      } else if (statusFilter === 'low') {
        filtered = filtered.filter(i => i.status === 'low' || ((i.min_stock && (i.quantity || 0) < i.min_stock) && i.status !== 'critical'))
      } else if (statusFilter === 'critical') {
        filtered = filtered.filter(i => i.status === 'critical' || (i.quantity || 0) === 0)
      }
    }
    
    // Фильтр по категории
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(i => i.category === categoryFilter)
    }
    
    // Сортировка: сначала критические, потом мало, потом по названию
    filtered.sort((a, b) => {
      const statusOrder = { critical: 0, low: 1, ok: 2 }
      const aStatus = a.status === 'critical' || (a.quantity || 0) === 0 ? 'critical' 
                    : a.status === 'low' || (a.min_stock && (a.quantity || 0) < a.min_stock) ? 'low' : 'ok'
      const bStatus = b.status === 'critical' || (b.quantity || 0) === 0 ? 'critical' 
                    : b.status === 'low' || (b.min_stock && (b.quantity || 0) < b.min_stock) ? 'low' : 'ok'
      
      if (aStatus !== bStatus) return statusOrder[aStatus as keyof typeof statusOrder] - statusOrder[bStatus as keyof typeof statusOrder]
      return (a.name || '').localeCompare(b.name || '')
    })
    
    return filtered
  }, [report, searchQuery, statusFilter, categoryFilter])

  // 🔧 СБРОС ФИЛЬТРОВ
  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setCategoryFilter('all')
  }

  // Подсчёт активных фильтров
  const activeFiltersCount = [
    searchQuery.trim(),
    statusFilter !== 'all',
    categoryFilter !== 'all'
  ].filter(Boolean).length

  // Статистика
  const totalItems = filteredReport.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const lowStock = filteredReport.filter(i => i.status === 'low' || ((i.min_stock && (i.quantity || 0) < i.min_stock) && i.status !== 'critical')).length
  const outOfStock = filteredReport.filter(i => i.status === 'critical' || (i.quantity || 0) === 0).length

  const getStatusBadge = (item: StockItem) => {
    const qty = item.quantity || 0
    if (item.status === 'critical' || qty === 0) 
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Нет в наличии</span>
    if (item.status === 'low' || (item.min_stock && qty < item.min_stock)) 
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Мало: {qty} шт.</span>
    return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">В наличии: {qty} шт.</span>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 🔝 ЗАГОЛОВОК И КНОПКИ */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">📊 Отчёт по складским остаткам</h2>
        
        <div className="flex items-center gap-2">
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
          
          {/* 🔄 Обновить */}
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Обновить</span>
          </button>
        </div>
      </div>

      {/* 🔍 ПАНЕЛЬ ФИЛЬТРОВ */}
      {showFilters && (
        <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700 flex items-center gap-2">
              <Filter className="w-4 h-4" /> Фильтры отчёта
            </h4>
            <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <XIcon className="w-3 h-3" /> Сбросить
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Поиск по SKU / названию */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по SKU или названию..."
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
              {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            
            {/* Фильтр по категории */}
            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">Все категории</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          
          {/* Теги активных фильтров */}
          {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
            <div className="mt-3 flex flex-wrap gap-2">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  Поиск: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  Статус: {statusOptions.find(o => o.value === statusFilter)?.label}
                  <button onClick={() => setStatusFilter('all')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
              {categoryFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  Категория: {categoryFilter}
                  <button onClick={() => setCategoryFilter('all')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Карточки статистики (обновляются по отфильтрованным данным) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-sm text-gray-500">Всего позиций</p><p className="text-xl font-bold">{filteredReport.length}</p></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-sm text-gray-500">Общий остаток</p><p className="text-xl font-bold">{totalItems} шт.</p></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-yellow-600" /></div>
            <div><p className="text-sm text-gray-500">Требуют пополнения</p><p className="text-xl font-bold text-yellow-700">{lowStock}</p></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><CheckCircle className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-sm text-gray-500">Отсутствуют</p><p className="text-xl font-bold text-red-700">{outOfStock}</p></div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
          <p className="text-gray-500">Загрузка данных со склада...</p>
        </div>
      ) : filteredReport.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Товары не найдены</p>
          <p className="text-sm text-gray-400 mt-1">Попробуйте изменить фильтры или добавить товары через «Номенклатуру»</p>
          {activeFiltersCount > 0 && (
            <button onClick={resetFilters} className="mt-2 text-sm text-indigo-600 hover:underline">Сбросить фильтры</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {/* 🔢 НУМЕРАЦИЯ */}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-12">№</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Товар</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Категория</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Остаток</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReport.map((item, idx) => (
                  <tr key={`${item.sku}-${item.name}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    {/* 🔢 НОМЕР СТРОКИ */}
                    <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">
                      {idx + 1}.
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-700">{item.sku || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name || 'Без названия'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.category || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{item.quantity ?? 0}</td>
                    <td className="px-4 py-3">{getStatusBadge(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}