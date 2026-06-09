import { useEffect, useState, useMemo } from 'react'
import { catalog } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { Search, Package, RotateCcw, Trash2, ArrowLeft, Calendar } from 'lucide-react'

interface ArchivedProduct {
  id: number
  sku: string
  name: string
  category: string | null
  archived_at?: string | null
}

export default function ArchivePage() {
  const { hasRole } = useAuth()
  const [archived, setArchived] = useState<ArchivedProduct[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<number | null>(null)

  const loadArchived = async () => {
    setIsLoading(true)
    try {
      const params: any = {}
      if (search) params.search = search
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      
      const data = await catalog.archived(params)
      setArchived(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading archived:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { 
    loadArchived() 
  }, [search, dateFrom, dateTo])

  // 🔧 ПОЛУЧАЕМ УНИКАЛЬНЫЕ КАТЕГОРИИ
  const categories = useMemo(() => {
    const cats = new Set<string>()
    archived.forEach(p => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats).sort()
  }, [archived])

  // 🔧 ФИЛЬТРАЦИЯ ПО КАТЕГОРИИ
  const filteredArchived = useMemo(() => {
    if (selectedCategory === 'all') return archived
    return archived.filter(p => p.category === selectedCategory)
  }, [archived, selectedCategory])

  // 🔧 ГРУППИРОВКА ПО ДАТАМ
  const groupedByDate = useMemo(() => {
    const groups: Record<string, ArchivedProduct[]> = {}
    
    filteredArchived.forEach(product => {
      let dateKey = 'Без даты'
      
      if (product.archived_at) {
        const date = new Date(product.archived_at)
        dateKey = date.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(product)
    })
    
    // Сортируем даты: новые сверху
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === 'Без даты') return 1
      if (b[0] === 'Без даты') return -1
      const dateA = new Date(a[0].split('.').reverse().join('-'))
      const dateB = new Date(b[0].split('.').reverse().join('-'))
      return dateB.getTime() - dateA.getTime()
    })
  }, [filteredArchived])

  // 🔧 ФОРМАТИРОВАНИЕ ДАТЫ И ВРЕМЕНИ
  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleRestore = async (id: number, name: string) => {
    if (!confirm(`Восстановить товар "${name}"?\n\nОн появится в основном списке номенклатуры.`)) return
    
    setIsProcessing(id)
    try {
      await catalog.restoreProduct(id)
      setArchived(prev => prev.filter(p => p.id !== id))
      alert('✅ Товар восстановлен')
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    } finally {
      setIsProcessing(null)
    }
  }

  const handlePermanentDelete = async (id: number, sku: string) => {
    if (!confirm(`🔥 ВЫ УВЕРЕНЫ, что хотите УДАЛИТЬ НАВСЕГДА товар "${sku}"?\n\nЭто действие НЕЛЬЗЯ ОТМЕНИТЬ!`)) return
    
    setIsProcessing(id)
    try {
      await catalog.deletePermanent(id)
      setArchived(prev => prev.filter(p => p.id !== id))
      alert('✅ Товар полностью удалён из базы')
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    } finally {
      setIsProcessing(null)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setSelectedCategory('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 🔝 Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🗄️ Архив товаров</h2>
            <p className="text-sm text-gray-500 mt-1">
              Найдено: <strong className="text-gray-900">{filteredArchived.length}</strong> из <strong className="text-gray-900">{archived.length}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* 🔍 Фильтры */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Поиск */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по архиву..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          {/* Категория */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          >
            <option value="all">Все категории ({archived.length})</option>
            {categories.map(cat => {
              const count = archived.filter(p => p.category === cat).length
              return (
                <option key={cat} value={cat}>
                  {cat} ({count})
                </option>
              )
            })}
          </select>
          
          {/* Дата от */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              title="Дата архивации от"
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
              title="Дата архивации до"
            />
          </div>
        </div>
        
        {/* Кнопка сброса */}
        {(search || selectedCategory !== 'all' || dateFrom || dateTo) && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="text-sm text-gray-600 flex flex-wrap gap-2">
              <span className="font-medium">Активные фильтры:</span>
              {search && <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">{search}</span>}
              {selectedCategory !== 'all' && <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">{selectedCategory}</span>}
              {dateFrom && <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">от {dateFrom}</span>}
              {dateTo && <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">до {dateTo}</span>}
            </div>
            <button 
              onClick={resetFilters}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

      {/* 📋 Таблица с группировкой */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 mx-auto border-t-transparent"></div>
        </div>
      ) : groupedByDate.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">
            {archived.length === 0 ? 'Архив пуст' : 'Товары не найдены'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {archived.length === 0 ? 'Нет архивированных товаров' : 'Попробуйте изменить фильтры'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([dateKey, products]) => (
            <div key={dateKey}>
              {/* 🔽 ЗАГОЛОВОК ГРУППЫ (ДАТА) - КАК В ДОКУМЕНТАХ */}
              <div className="sticky top-0 z-10 bg-indigo-50/95 backdrop-blur-sm px-4 py-2.5 border-b-2 border-indigo-200 flex items-center gap-2 rounded-t-lg">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">{dateKey}</h3>
                <span className="text-xs text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-full font-medium">
                  {products.length} {products.length === 1 ? 'товар' : products.length < 5 ? 'товара' : 'товаров'}
                </span>
              </div>
              
              {/* 📊 ТАБЛИЦА - КРАСИВАЯ */}
              <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-12">№</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Название</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Категория</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Время</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">
                          {idx + 1}.
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-700">{p.sku}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{p.category || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-mono text-xs">
                              {formatDateTime(p.archived_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRestore(p.id, p.name)}
                              disabled={isProcessing === p.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Восстановить товар"
                            >
                              {isProcessing === p.id ? (
                                <div className="animate-spin w-4 h-4 border-2 border-green-600 rounded-full border-t-transparent" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                              <span className="hidden sm:inline">Восстановить</span>
                            </button>
                            
                            {hasRole(['admin', 'warehouse_manager']) && (
                              <button
                                onClick={() => handlePermanentDelete(p.id, p.sku)}
                                disabled={isProcessing === p.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Удалить навсегда"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden sm:inline">Удалить</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}