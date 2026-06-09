import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalog, documents, inventory, analytics, audit } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { 
  Package, TrendingUp, FileText, AlertTriangle, ArrowRight, Plus, 
  ShoppingCart, Users, DollarSign, Clock, CheckCircle, XCircle,
  BarChart3, ExternalLink, Zap, Minus, RefreshCw
} from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { hasRole, user } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState(7)

  useEffect(() => {
    const load = async () => {
      try {
        // Загружаем данные параллельно
        const [
          productsRes, 
          docsRes, 
          stockRes, 
          auditLogsRes
        ] = await Promise.all([
          catalog.products(),
          documents.list(),
          inventory.report(),
          analytics.dashboardStats(period),
          audit.logs({}) // 🔧 Загружаем логи без лимитов, чтобы фронт мог отфильтровать
        ])

        const products = Array.isArray(productsRes) ? productsRes : []
        const docs = Array.isArray(docsRes) ? docsRes : []
        const stock = Array.isArray(stockRes) ? stockRes : []
        const activities = Array.isArray(auditLogsRes) ? auditLogsRes : []

        // 🔧 РАСЧЕТ КРИТИЧЕСКИХ ОСТАТКОВ
        const criticalItems = stock.filter((item: any) => {
          const qty = item.quantity || 0
          const minStock = item.min_stock || 0
          return qty <= minStock // Показываем те, где меньше или равно минимуму
        }).sort((a: any, b: any) => (a.quantity || 0) - (b.quantity || 0))

        // 🔧 ПОСЛЕДНИЕ ДОКУМЕНТЫ (исключая отмененные)
        const recentDocsList = docs
          .filter((d: any) => d.status !== 'cancelled')
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)

        // 🔧 ТОП ТОВАРОВ (только те, что есть в наличии)
        const topByStock = [...stock]
          .filter((item: any) => (item.quantity || 0) > 0)
          .sort((a: any, b: any) => (b.quantity || 0) - (a.quantity || 0))
          .slice(0, 5)

        // 🔧 ПОДСЧЕТ СТАТИСТИКИ
        const totalValue = stock.reduce((sum: number, item: any) => 
          sum + ((item.quantity || 0) * (item.purchase_price || 0)), 0)
        
        const completedToday = docs.filter((d: any) => {
          const docDate = new Date(d.created_at)
          const today = new Date()
          return d.status === 'completed' && docDate.toDateString() === today.toDateString()
        }).length

        const inWorkDocs = docs.filter((d: any) => d.status === 'draft' || d.status === 'in_progress').length

        setStats({
          totalProducts: products.length,
          totalStock: stock.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0),
          totalValue,
          activeDocs: inWorkDocs,
          completedToday, // Новое поле
          totalDocs: docs.length,
          criticalStock: criticalItems.length,
          lowStock: criticalItems.filter((i: any) => i.quantity > 0).length,
          outOfStock: criticalItems.filter((i: any) => i.quantity === 0).length
        })

        setLowStockItems(criticalItems.slice(0, 6))
        
        setRecentDocs(recentDocsList.map((d: any) => ({
          ...d,
          date: new Date(d.created_at).toLocaleDateString('ru-RU'),
          time: new Date(d.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        })))

        // 🔧  ДЕДУПЛИКАЦИЯ ДЕЙСТВИЙ (Убирает спам от одного заказа)
        // Создаем карту, где ключ - ID сущности. Оставляем только последнее действие для каждой сущности.
        const uniqueActionsMap = new Map()
        
        activities.forEach((log: any) => {
          const key = `${log.entity_type}_${log.entity_id}`
          // Если в Map еще нет такой сущности, добавляем (так как массив activities обычно отсортирован по убыванию даты,
          // первое совпадение будет самым свежим).
          if (!uniqueActionsMap.has(key)) {
            uniqueActionsMap.set(key, {
              ...log,
              time: new Date(log.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              actionLabel: log.action === 'CREATE' ? 'Создан' : 
                           log.action === 'UPDATE' ? 'Изменён' : 
                           log.action === 'DELETE' ? 'Удалён' : 
                           log.action === 'STATUS_CHANGE' ? 'Статус изменён' :
                           log.action === 'AUTO_SHIP' ? 'Отгружен' :
                           log.action === 'CANCEL_SHIPMENT' ? 'Отменен' : log.action
            })
          }
        })
        
        // Берем последние 6 уникальных записей
        setRecentActivities(Array.from(uniqueActionsMap.values()).slice(0, 6))

        setTopProducts(topByStock)
      } catch (err) { 
        console.error('Dashboard error:', err) 
      } finally { 
        setIsLoading(false) 
      }
    }
    load()
  }, [period])

  const isManagerOrAdmin = hasRole(['admin', 'warehouse_manager'])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Черновик',
      in_progress: 'В работе',
      completed: 'Проведён',
      cancelled: 'Отменён'
    }
    return labels[status] || status
  }

  const getActionIcon = (action: string) => {
    switch(action) {
      case 'CREATE': return <Plus className="w-3 h-3 text-green-600" />
      case 'UPDATE': return <TrendingUp className="w-3 h-3 text-blue-600" />
      case 'DELETE': return <XCircle className="w-3 h-3 text-red-600" />
      default: return <Clock className="w-3 h-3 text-gray-600" />
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[600px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 mx-auto mb-4 border-t-transparent"></div>
          <p className="text-gray-500">Загрузка панели...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 🔝 ЗАГОЛОВОК */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
            Панель управления складом
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={period} 
            onChange={e => setPeriod(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          >
            <option value={7}>📅 7 дней</option>
            <option value={30}>📅 30 дней</option>
            <option value={90}>📅 90 дней</option>
          </select>
          <button 
            onClick={() => window.location.reload()}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Обновить данные"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* 📊 КАРТОЧКИ СТАТИСТИКИ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Package className="w-5 h-5 text-blue-600" />} 
          value={stats?.totalProducts || 0} 
          label="Позиций в номенклатуре"
          subLabel="Всего товаров"
          color="blue"
        />
        <StatCard 
          icon={<ShoppingCart className="w-5 h-5 text-green-600" />} 
          value={stats?.totalStock || 0} 
          label="Единиц на складе"
          subLabel="Общий остаток"
          color="green"
        />
        {/* 🔧 ИЗМЕНЕНО: Показываем завершенные заказы, чтобы не было "0" */}
        <StatCard 
          icon={<FileText className="w-5 h-5 text-indigo-600" />} 
          value={stats?.completedToday || 0} 
          label="Заказов завершено"
          subLabel={`${stats?.activeDocs || 0} в работе`}
          color="indigo"
        />
        <StatCard 
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />} 
          value={stats?.criticalStock || 0} 
          label="Требуют внимания"
          subLabel={`${stats?.outOfStock || 0} нет, ${stats?.lowStock || 0} мало`}
          color="red"
        />
      </div>

      {/* 💰 ФИНАНСОВАЯ ИНФОРМАЦИЯ */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Стоимость запасов
            </h3>
            <p className="text-3xl font-bold">
              {stats?.totalValue?.toLocaleString('ru-RU') || 0} ₽
            </p>
            <p className="text-indigo-100 text-sm mt-1">Закупочная стоимость всех товаров на складе</p>
          </div>
          <div className="hidden md:block">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <Users className="w-8 h-8 text-white/80" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ⚠️ КРИТИЧЕСКИЕ ОСТАТКИ */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-gray-900 text-lg">⚠️ Критические остатки</h3>
            </div>
            <button 
              onClick={() => navigate('/report')} 
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 hover:underline"
            >
              Полный отчёт <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          
          {lowStockItems.length === 0 ? (
            <div className="text-center py-12 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-green-800 font-medium">Все позиции в достаточном количестве</p>
              <p className="text-green-600 text-sm mt-1">Критических остатков не обнаружено ✅</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item, i) => {
                const isOutOfStock = item.quantity === 0
                return (
                  <div 
                    key={i} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isOutOfStock ? 'bg-red-50/50 border-red-200' : 'bg-yellow-50/50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${isOutOfStock ? 'bg-red-100' : 'bg-yellow-100'}`}>
                        {isOutOfStock ? <XCircle className="w-4 h-4 text-red-600" /> : <Minus className="w-4 h-4 text-yellow-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {item.name || 'Без названия'}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {item.sku || '—'} • {item.category || 'Без категории'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isOutOfStock ? 'text-red-700' : 'text-yellow-700'}`}>
                          {item.quantity} шт.
                        </p>
                        <p className="text-xs text-gray-500">
                          мин. {item.min_stock || 0}
                        </p>
                      </div>
                      {isManagerOrAdmin && (
                        <button 
                          onClick={() => navigate('/documents')}
                          className="p-2 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                          title="Создать документ"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 📄 ПОСЛЕДНИЕ ДОКУМЕНТЫ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900 text-lg">📄 Последние документы</h3>
            </div>
            <button 
              onClick={() => navigate('/documents')} 
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 hover:underline"
            >
              Все <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          
          {recentDocs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Нет активных документов</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDocs.map((doc) => (
                <div 
                  key={doc.id} 
                  className="group flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-all cursor-pointer"
                  onClick={() => navigate('/documents')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 group-hover:text-indigo-900 truncate">
                      {doc.doc_number}
                    </p>
                    <p className="text-xs text-gray-500 group-hover:text-indigo-600">
                      {doc.date} • {doc.time} • {doc.type}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(doc.status)}`}>
                    {getStatusLabel(doc.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 📊 ТОП ТОВАРОВ И АКТИВНОСТЬ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/*  ТОП ТОВАРОВ ПО ОСТАТКАМ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Топ товаров на складе
            </h3>
          </div>
          <div className="space-y-3">
            {topProducts.map((item, i) => {
              const price = item.sale_price || item.purchase_price || 0
              const value = (item.quantity || 0) * price
              
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name || 'Без названия'}
                    </p>
                    <p className="text-xs text-gray-500">{item.sku}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-indigo-600">
                      {item.quantity} шт.
                    </p>
                    {price > 0 ? (
                      <p className="text-xs text-gray-400">
                        {value.toLocaleString('ru-RU')} ₽
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300">—</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 🕐 ПОСЛЕДНИЕ ДЕЙСТВИЯ (С ДЕДУПЛИКАЦИЕЙ) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Последние действия
            </h3>
            <button 
              onClick={() => navigate('/audit')}
              className="text-sm text-indigo-600 hover:underline"
            >
              Весь журнал
            </button>
          </div>
          <div className="space-y-2">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  {getActionIcon(activity.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{activity.actionLabel}</span>
                    <span className="text-gray-600"> {activity.entity_type}</span>
                    <span className="text-gray-400">#{activity.entity_id}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {activity.time} • {activity.user_id === user?.id ? 'Вы' : `Пользователь #${activity.user_id}`}
                  </p>
                </div>
              </div>
            ))}
            {recentActivities.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-4">Нет недавних действий</p>
            )}
          </div>
        </div>
      </div>

      {/* ⚡ БЫСТРЫЕ ДЕЙСТВИЯ */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Быстрые действия
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {isManagerOrAdmin && (
            <>
              <QuickActionButton icon={<Plus className="w-5 h-5" />} label="Создать приёмку" onClick={() => navigate('/documents')} />
              <QuickActionButton icon={<Package className="w-5 h-5" />} label="Добавить товар" onClick={() => navigate('/products')} />
              <QuickActionButton icon={<FileText className="w-5 h-5" />} label="Инвентаризация" onClick={() => navigate('/inventory')} />
              <QuickActionButton icon={<BarChart3 className="w-5 h-5" />} label="Отчёт по остаткам" onClick={() => navigate('/report')} />
            </>
          )}
          {!isManagerOrAdmin && (
            <p className="text-white/80 text-sm col-span-full">
              У вас ограниченный доступ. Обратитесь к менеджеру для выполнения операций.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, value, label, subLabel, color }: { icon: React.ReactNode; value: number; label: string; subLabel: string; color: string }) {
  const colorMap: Record<string, string> = { 
    blue: 'bg-blue-50 text-blue-600 border-blue-200', 
    green: 'bg-green-50 text-green-600 border-green-200', 
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200', 
    red: 'bg-red-50 text-red-600 border-red-200' 
  }
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg border ${colorMap[color]}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600 font-medium mt-1">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{subLabel}</p>
    </div>
  )
}

function QuickActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-3.5 rounded-lg transition-all hover:scale-105 text-left group">
      <div className="p-2 bg-white/30 rounded-lg group-hover:bg-white/40 transition-colors">{icon}</div>
      <span className="font-medium">{label}</span>
      <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}