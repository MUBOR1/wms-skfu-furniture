import { useEffect, useState, useMemo } from 'react'
import { inventory, catalog, analytics } from '../api/wms'
import { Package, TrendingUp, AlertTriangle, CheckCircle, Search, XCircle as XIcon, RefreshCw, Eye, X, Calendar } from 'lucide-react'

interface StockItem {
  id: number 
  sku: string
  name: string
  category: string | null
  quantity: number
  min_stock?: number
  max_stock?: number
  status?: string
}

const statusOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'normal', label: 'Норма' },
  { value: 'low', label: 'Мало' },
  { value: 'critical', label: 'Нет в наличии' },
  { value: 'overstock', label: 'Переизбыток' },
]

const statusStyles: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Нет в наличии', icon: AlertTriangle },
  low: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Мало', icon: AlertTriangle },
  overstock: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Переизбыток', icon: Package },
  normal: { bg: 'bg-green-100', text: 'text-green-700', label: 'Норма', icon: CheckCircle },
}

export default function ReportPage() {
  const [report, setReport] = useState<StockItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [stockDetails, setStockDetails] = useState<any[]>([])
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [dataReport, dataCatalog] = await Promise.all([
          inventory.report(),
          catalog.categories()
        ])
        setReport(Array.isArray(dataReport) ? dataReport : [])
        const cats = new Set<string>()
        if (Array.isArray(dataReport)) dataReport.forEach((item: any) => { if (item.category) cats.add(item.category) })
        if (Array.isArray(dataCatalog)) dataCatalog.forEach((c: any) => { if (c.name) cats.add(c.name) })
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

  const getItemStatus = (item: StockItem): string => {
    const qty = item.quantity || 0
    const minStock = item.min_stock || 0
    const maxStock = item.max_stock || 0
    if (qty === 0) return 'critical'
    if (minStock > 0 && qty < minStock) return 'low'
    if (maxStock > 0 && qty > maxStock) return 'overstock'
    return 'normal'
  }

  const filteredReport = useMemo(() => {
    let filtered = [...report]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(item => item.sku?.toLowerCase().includes(q) || item.name?.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') filtered = filtered.filter(item => getItemStatus(item) === statusFilter)
    if (categoryFilter !== 'all') filtered = filtered.filter(i => i.category === categoryFilter)
    filtered.sort((a, b) => {
      const priority: Record<string, number> = { critical: 0, low: 1, overstock: 2, normal: 3 }
      return priority[getItemStatus(a)] - priority[getItemStatus(b)]
    })
    return filtered
  }, [report, searchQuery, statusFilter, categoryFilter])

  const resetFilters = () => { setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all') }
  const activeFiltersCount = [searchQuery.trim(), statusFilter !== 'all', categoryFilter !== 'all'].filter(Boolean).length

  const totalItems = filteredReport.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const criticalCount = filteredReport.filter(i => getItemStatus(i) === 'critical').length
  const lowCount = filteredReport.filter(i => getItemStatus(i) === 'low').length
  const overstockCount = filteredReport.filter(i => getItemStatus(i) === 'overstock').length
  const normalCount = filteredReport.filter(i => getItemStatus(i) === 'normal').length

  const handleViewDetails = async (productId: number) => {
    setSelectedProductId(productId)
    setIsDetailsLoading(true)
    setStockDetails([])
    try {
      const data = await analytics.stockDetails(productId)
      setStockDetails(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Ошибка загрузки мест:', err)
      setStockDetails([])
    } finally {
      setIsDetailsLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 🔝 ЗАГОЛОВОК И КНОПКИ */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-7 h-7 text-indigo-600" /> Отчёт по складским остаткам
        </h2>
        <button 
          onClick={() => window.location.reload()} 
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Обновить</span>
        </button>
      </div>

      {/* 📊 КАРТОЧКИ СТАТИСТИКИ - МЯГКОЕ ВЫДЕЛЕНИЕ */}
<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
  {[
    { label: 'Всего позиций', value: filteredReport.length, icon: Package, color: 'blue' },
    { label: 'Общий остаток', value: `${totalItems} шт.`, icon: TrendingUp, color: 'indigo' },
    { label: 'Нет в наличии', value: criticalCount, icon: AlertTriangle, color: 'red', highlight: criticalCount > 0 },
    { label: 'Мало', value: lowCount, icon: AlertTriangle, color: 'yellow', highlight: lowCount > 0 },
    { label: 'Норма', value: normalCount, icon: CheckCircle, color: 'green' },
    { label: 'Переизбыток', value: overstockCount, icon: Package, color: 'purple', highlight: overstockCount > 0 },
  ].map((stat, idx) => (
    <div 
      key={idx} 
      className={`bg-white p-4 rounded-xl border transition-all hover:shadow-md ${
        stat.highlight 
          ? `border-${stat.color}-300 bg-${stat.color}-50/50` 
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${
          stat.highlight 
            ? `bg-${stat.color}-100` 
            : `bg-${stat.color}-50`
        }`}>
          <stat.icon className={`w-5 h-5 ${
            stat.highlight 
              ? `text-${stat.color}-600` 
              : `text-${stat.color}-500`
          }`} />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{stat.label}</p>
          <p className={`text-xl font-bold ${
            stat.highlight 
              ? `text-${stat.color}-700` 
              : 'text-gray-900'
          }`}>
            {stat.value}
          </p>
        </div>
      </div>
    </div>
  ))}
</div>

      {/* 🔍 ФИЛЬТРЫ - КРАСИВЫЕ */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" /> Фильтры отчёта
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Поиск по SKU или названию..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)} 
            className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          >
            {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select 
            value={categoryFilter} 
            onChange={e => setCategoryFilter(e.target.value)} 
            className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          >
            <option value="all">Все категории</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium">
                Поиск: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-red-500 transition-colors">
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium">
                Статус: {statusOptions.find(o => o.value === statusFilter)?.label}
                <button onClick={() => setStatusFilter('all')} className="hover:text-red-500 transition-colors">
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium">
                Категория: {categoryFilter}
                <button onClick={() => setCategoryFilter('all')} className="hover:text-red-500 transition-colors">
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            )}
            <button onClick={resetFilters} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline transition-colors">
              Сбросить все
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 📋 ТАБЛИЦА - КРАСИВАЯ */}
      {isLoading ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 mx-auto mb-3 border-t-transparent"></div>
          <p className="text-gray-500 text-sm">Загрузка данных...</p>
        </div>
      ) : filteredReport.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Товары не найдены</p>
          <p className="text-sm text-gray-400 mt-1">Добавьте товары или измените фильтры</p>
          {activeFiltersCount > 0 && (
            <button onClick={resetFilters} className="mt-3 text-sm text-indigo-600 hover:underline font-medium">
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 🔵 ЗАГОЛОВОК ГРУППЫ (всегда "Все товары" для отчёта) */}
          <div className="sticky top-0 z-10 bg-indigo-50/95 backdrop-blur-sm px-4 py-2.5 border-b-2 border-indigo-200 flex items-center gap-2 rounded-t-lg">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-indigo-900">Складские остатки</h3>
            <span className="text-xs text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-full font-medium">
              {filteredReport.length} {filteredReport.length === 1 ? 'позиция' : filteredReport.length < 5 ? 'позиции' : 'позиций'}
            </span>
          </div>
          
          <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-12">№</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Товар</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Категория</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Остаток</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Мин./Макс.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-16">Детали</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredReport.map((item, idx) => {
                    const status = getItemStatus(item)
                    const style = statusStyles[status]
                    const StatusIcon = style.icon
                    
                    return (
                      <tr key={`${item.sku}-${item.name}-${idx}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">{idx + 1}.</td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-700">{item.sku || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.name || 'Без названия'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.category || '—'}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-900">{item.quantity ?? 0}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-gray-700">
                            {item.min_stock || 0} / {item.max_stock || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => handleViewDetails((item as any).id || (item as any).product_id)} 
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Посмотреть места хранения"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 МОДАЛЬНОЕ ОКНО: МЕСТА ХРАНЕНИЯ - КРАСИВОЕ */}
      {selectedProductId !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                📍 Места хранения
              </h3>
              <button 
                onClick={() => setSelectedProductId(null)} 
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {isDetailsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent"></div>
                </div>
              ) : stockDetails.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 font-medium">Товар отсутствует на складе</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stockDetails.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="font-mono font-medium text-gray-900">{d.cell_code}</span>
                      <span className="font-bold text-indigo-600">{d.quantity} шт.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setSelectedProductId(null)} 
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}