import { useEffect, useState } from 'react'
import { inventory } from '../api/wms'
import { Package, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

// 🔧 ИСПРАВЛЕННЫЙ ИНТЕРФЕЙС (поля как в бэкенде)
interface StockItem {
  sku: string
  name: string
  category: string | null
  quantity: number
  min_stock?: number
  max_stock?: number
  status?: string
}

export default function ReportPage() {
  const [report, setReport] = useState<StockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await inventory.report()
        setReport(Array.isArray(data) ? data : [])
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

  const totalItems = report.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const lowStock = report.filter(i => i.status === 'low' || i.status === 'critical').length
  const outOfStock = report.filter(i => i.status === 'critical').length

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📊 Отчёт по складским остаткам</h2>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          Обновить данные
        </button>
      </div>
      
      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-sm text-gray-500">Всего позиций</p><p className="text-xl font-bold">{report.length}</p></div>
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
      ) : report.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Нет данных об остатках</p>
          <p className="text-sm text-gray-400 mt-1">Добавьте товары через раздел «Номенклатура» или создайте документ приёмки</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Товар</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Категория</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Остаток</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    {/* 🔧 ИСПРАВЛЕНО: используем sku, name, category вместо product_* */}
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