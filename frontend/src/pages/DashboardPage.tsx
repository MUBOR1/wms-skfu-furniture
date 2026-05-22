import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalog, documents, inventory } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { Package, TrendingUp, FileText, AlertTriangle, ArrowRight, Plus } from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [stats, setStats] = useState({ products: 0, totalStock: 0, activeDocs: 0, lowStock: 0 })
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [productsRes, docsRes, stockRes] = await Promise.all([
          catalog.products(),
          documents.list(),
          inventory.report()
        ])
        const products = Array.isArray(productsRes) ? productsRes : []
        const docs = Array.isArray(docsRes) ? docsRes : []
        const stock = Array.isArray(stockRes) ? stockRes : []

        const totalStock = stock.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
        const low = stock.filter((item: any) => (item.quantity || 0) < 10 && (item.quantity || 0) > 0)
        const out = stock.filter((item: any) => (item.quantity || 0) === 0)

        setStats({
          products: products.length,
          totalStock,
          activeDocs: docs.filter((d: any) => d.status === 'draft' || d.status === 'in_progress').length,
          lowStock: low.length + out.length
        })
        setLowStockItems([...low, ...out].slice(0, 5))
        setRecentDocs(docs.slice(0, 5).map((d: any) => ({
          ...d,
          date: new Date(d.created_at).toLocaleDateString('ru-RU')
        })))
      } catch (err) { console.error('Dashboard error:', err) }
      finally { setIsLoading(false) }
    }
    load()
  }, [])

  const isManagerOrAdmin = hasRole(['admin', 'warehouse_manager'])

  if (isLoading) return <div className="p-6 flex justify-center"><div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent"></div></div>

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📊 Панель управления складом</h1>
        <span className="text-sm text-gray-500">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Package className="w-5 h-5 text-blue-600" />} value={stats.products} label="Позиций в номенклатуре" color="blue" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} value={stats.totalStock} label="Единиц на складе" color="green" />
        <StatCard icon={<FileText className="w-5 h-5 text-indigo-600" />} value={stats.activeDocs} label="Документов в работе" color="indigo" />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-red-600" />} value={stats.lowStock} label="Требуют пополнения" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Критические остатки */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">⚠️ Критические остатки</h3>
            <button onClick={() => navigate('/report')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              Полный отчёт <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {lowStockItems.length === 0 ? (
            <p className="text-gray-500 text-sm">Все позиции в достаточном количестве ✅</p>
          ) : (
            <div className="space-y-3">
              {lowStockItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.name || 'Без названия'}</p>
                    <p className="text-xs text-gray-500">{item.sku || '—'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${item.quantity === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {item.quantity === 0 ? 'Нет в наличии' : `${item.quantity} шт.`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Последние документы */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">📄 Последние документы</h3>
            <button onClick={() => navigate('/documents')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              Все документы <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentDocs.length === 0 ? (
            <p className="text-gray-500 text-sm">Документы ещё не создавались</p>
          ) : (
            <div className="space-y-2">
              {recentDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => navigate('/documents')}>
                  <div>
                    <p className="font-medium text-sm">{doc.doc_number}</p>
                    <p className="text-xs text-gray-500">{doc.date} • {doc.type}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${doc.status === 'draft' ? 'bg-gray-100 text-gray-700' : doc.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {doc.status === 'draft' ? 'Черновик' : doc.status === 'completed' ? 'Проведён' : 'В работе'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ⚡ Быстрые действия (с проверкой ролей) */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <h3 className="text-lg font-semibold mb-3">⚡ Быстрые действия</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {isManagerOrAdmin && (
            <button onClick={() => navigate('/documents')} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-3 rounded-lg transition-colors text-left">
              <Plus className="w-4 h-4" /> Создать приёмку
            </button>
          )}
          {isManagerOrAdmin && (
            <button onClick={() => navigate('/inventory')} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-3 rounded-lg transition-colors text-left">
              <Plus className="w-4 h-4" /> Начать инвентаризацию
            </button>
          )}
          {hasRole(['admin', 'warehouse_manager']) && (
            <button onClick={() => navigate('/products')} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-3 rounded-lg transition-colors text-left">
              <Plus className="w-4 h-4" /> Добавить товар
            </button>
          )}
          {!isManagerOrAdmin && !hasRole(['admin', 'warehouse_manager']) && (
            <p className="text-white/80 text-sm col-span-3">У вас ограниченный доступ. Обратитесь к менеджеру для выполнения операций.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Компонент карточки статистики
function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  const colorMap: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', indigo: 'bg-indigo-50 text-indigo-600', red: 'bg-red-50 text-red-600' }
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <span className={`text-xs font-medium px-2 py-1 rounded ${colorMap[color]}`}>Активно</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}