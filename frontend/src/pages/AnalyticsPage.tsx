import { useEffect, useState } from 'react'
import { analytics } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { Package, AlertTriangle, TrendingUp, FileText } from 'lucide-react'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function AnalyticsPage() {
  const { hasRole } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [stockReport, setStockReport] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState(30)

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, stockRes] = await Promise.all([
          analytics.dashboardStats(period),
          analytics.stockReport()
        ])
        setStats(statsRes)
        setStockReport(Array.isArray(stockRes) ? stockRes : [])
      } catch (err) { console.error(err) }
      finally { setIsLoading(false) }
    }
    load()
  }, [period])

  if (isLoading) return <div className="p-6 flex justify-center"><div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent"></div></div>

  // Подготовка данных для графиков
  const turnoverData = stats?.daily_turnover?.map((d: any) => ({ 
    date: new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), 
    count: d.count 
  })) || []
  
  const topProductsData = stats?.top_products?.slice(0, 5).map((p: any) => ({ 
    name: p.name?.length > 15 ? p.name.slice(0, 15) + '...' : p.name, 
    qty: p.total_qty 
  })) || []
  
  const statusData = stats?.order_statuses?.map((s: any) => ({ 
    name: s.status, 
    value: s.count 
  })) || []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">📈 Аналитика склада</h2>
        <select value={period} onChange={e => setPeriod(+e.target.value)} className="p-2 border rounded">
          <option value={7}>7 дней</option>
          <option value={30}>30 дней</option>
          <option value={90}>90 дней</option>
        </select>
      </div>

      {/* Карточки сводки */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Package className="w-5 h-5 text-blue-600" />} value={stats?.summary?.total_products} label="Всего товаров" color="blue" />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-green-600" />} value={stats?.summary?.total_stock} label="Общий остаток" color="green" />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-red-600" />} value={stats?.summary?.low_stock} label="Требуют пополнения" color="red" />
        <StatCard icon={<FileText className="w-5 h-5 text-indigo-600" />} value={turnoverData.reduce((sum: number, d: any) => sum + d.count, 0)} label={`Документов за ${period} дн.`} color="indigo" />
      </div>

      {/* Сетка графиков */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* График оборотов */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">📊 Оборот документов по дням</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={turnoverData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Топ товаров */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">🏆 Топ-5 товаров по обороту</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topProductsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qty" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Статусы заказов */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">📋 Статусы заказов</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {statusData.map((_: any, index: number) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Критические остатки */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">⚠️ Критические остатки</h3>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {stockReport.filter((item: any) => item.status === 'critical' || item.status === 'low').slice(0, 8).map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-sm">{item.name || 'Без названия'}</p>
                  <p className="text-xs text-gray-500">{item.sku || '—'}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${item.status === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {item.quantity} / мин. {item.min_stock}
                </span>
              </div>
            ))}
            {stockReport.filter((item: any) => item.status === 'critical' || item.status === 'low').length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">Все позиции в норме ✅</p>
            )}
          </div>
        </div>
      </div>

      {/* Детальная таблица остатков */}
      {hasRole(['admin', 'warehouse_manager']) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">📦 Детальный отчёт по остаткам</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Товар</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Категория</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Остаток</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Мин./Макс.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stockReport.map((item: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{item.sku || '—'}</td>
                    <td className="px-4 py-3 font-medium">{item.name || 'Без названия'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.category || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{item.quantity ?? 0}</td>
                    <td className="px-4 py-3 text-sm">{item.min_stock ?? 0} / {item.max_stock ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'critical' ? 'bg-red-100 text-red-700' :
                        item.status === 'low' ? 'bg-yellow-100 text-yellow-700' :
                        item.status === 'overstock' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.status === 'critical' ? 'Нет в наличии' :
                         item.status === 'low' ? 'Мало' :
                         item.status === 'overstock' ? 'Переизбыток' : 'Норма'}
                      </span>
                    </td>
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

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value?: number; label: string; color: string }) {
  const colorMap: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', red: 'bg-red-50 text-red-600', indigo: 'bg-indigo-50 text-indigo-600' }
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <p className="text-2xl font-bold">{value ?? 0}</p>
      </div>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  )
}