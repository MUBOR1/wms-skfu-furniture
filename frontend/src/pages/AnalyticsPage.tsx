import { useEffect, useState, useMemo } from 'react'
import { analytics, catalog } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { 
  Package, AlertTriangle, TrendingUp, FileText, Search, XCircle as XIcon, 
  DollarSign, Wallet, Percent, Calendar, RefreshCw, Printer, FileDown, 
  FileSpreadsheet, BarChart3
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

const statusOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'normal', label: 'Норма' },
  { value: 'low', label: 'Мало' },
  { value: 'critical', label: 'Нет в наличии' },
  { value: 'overstock', label: 'Переизбыток' },
]

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Нет в наличии' },
  low: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Мало' },
  overstock: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Переизбыток' },
  normal: { bg: 'bg-green-100', text: 'text-green-700', label: 'Норма' },
}

export default function AnalyticsPage() {
  const { hasRole } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [stockReport, setStockReport] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState(30)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, stockRes, catsRes] = await Promise.all([
          analytics.dashboardStats(period),
          analytics.stockReport(),
          catalog.categories()
        ])
        
        setStats(statsRes)
        setStockReport(Array.isArray(stockRes) ? stockRes : [])
        
        const cats = new Set<string>()
        if (Array.isArray(stockRes)) {
          stockRes.forEach((item: any) => { if (item.category) cats.add(item.category) })
        }
        if (Array.isArray(catsRes)) {
          catsRes.forEach((c: any) => { if (c.name) cats.add(c.name) })
        }
        setCategories(Array.from(cats).sort())
      } catch (err) { 
        console.error('❌ Ошибка загрузки аналитики:', err) 
      }
      finally { setIsLoading(false) }
    }
    load()
  }, [period])

  const getItemStatus = (item: any): string => {
    const qty = item.quantity ?? item.qty ?? 0
    const minStock = item.min_stock ?? 0
    const maxStock = item.max_stock ?? 0
    
    if (qty === 0) return 'critical'
    if (minStock > 0 && qty < minStock) return 'low'
    if (maxStock > 0 && qty > maxStock) return 'overstock'
    return 'normal'
  }

  const filteredStockReport = useMemo(() => {
    let filtered = [...stockReport]
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        (item.sku || item.product_sku || '').toLowerCase().includes(q) ||
        (item.name || item.product_name || '').toLowerCase().includes(q)
      )
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => getItemStatus(item) === statusFilter)
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(i => (i.category || i.product_category) === categoryFilter)
    }
    
    filtered.sort((a, b) => {
      const priority: Record<string, number> = { critical: 0, low: 1, overstock: 2, normal: 3 }
      return priority[getItemStatus(a)] - priority[getItemStatus(b)]
    })
    
    return filtered
  }, [stockReport, searchQuery, statusFilter, categoryFilter])

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setCategoryFilter('all')
  }

  const activeFiltersCount = [searchQuery.trim(), statusFilter !== 'all', categoryFilter !== 'all'].filter(Boolean).length

  // 🔧 ФИНАНСОВЫЕ МЕТРИКИ
  const financials = useMemo(() => {
    const items = stockReport.filter((i: any) => i.quantity > 0)
    
    const totalPurchaseValue = items.reduce((sum: number, i: any) => {
      const qty = i.quantity ?? 0
      const price = i.purchase_price ?? 0
      return sum + (qty * price)
    }, 0)
    
    const totalSaleValue = items.reduce((sum: number, i: any) => {
      const qty = i.quantity ?? 0
      const price = i.sale_price ?? 0
      return sum + (qty * price)
    }, 0)
    
    const potentialProfit = totalSaleValue - totalPurchaseValue
    const margin = totalSaleValue > 0 ? ((potentialProfit / totalSaleValue) * 100).toFixed(1) : '0'
    
    const atRiskValue = stockReport
      .filter((i: any) => getItemStatus(i) === 'critical' || getItemStatus(i) === 'low')
      .reduce((sum: number, i: any) => {
        const minStock = i.min_stock ?? 0
        const currentQty = i.quantity ?? 0
        const needed = Math.max(0, minStock - currentQty)
        const price = i.purchase_price ?? 0
        return sum + (needed * price)
      }, 0)
    
    return {
      totalPurchaseValue,
      totalSaleValue,
      potentialProfit,
      margin,
      atRiskValue
    }
  }, [stockReport])

  const criticalCount = stockReport.filter((i: any) => getItemStatus(i) === 'critical').length
  const lowCount = stockReport.filter((i: any) => getItemStatus(i) === 'low').length
  const normalCount = stockReport.filter((i: any) => getItemStatus(i) === 'normal').length
  const overstockCount = stockReport.filter((i: any) => getItemStatus(i) === 'overstock').length

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

  // 🔧 ДАННЫЕ ДЛЯ ГРАФИКА ПО КАТЕГОРИЯМ
  const categoryValueData = useMemo(() => {
    const byCategory: Record<string, { purchase: number; sale: number }> = {}
    stockReport.forEach((item: any) => {
      const cat = item.category || 'Без категории'
      const qty = item.quantity ?? 0
      if (!byCategory[cat]) byCategory[cat] = { purchase: 0, sale: 0 }
      byCategory[cat].purchase += qty * (item.purchase_price ?? 0)
      byCategory[cat].sale += qty * (item.sale_price ?? 0)
    })
    return Object.entries(byCategory).slice(0, 6).map(([name, values]: [string, { purchase: number; sale: number }]) => ({
      name: name.length > 12 ? name.slice(0, 12) + '...' : name,
      purchase: Math.round(values.purchase),
      sale: Math.round(values.sale)
    }))
  }, [stockReport])

  // 🔥 ПЕЧАТЬ
  const handlePrint = () => {
    window.print()
  }

  // 🔥 PDF - экспорт аналитики
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      
      // Заголовок
      doc.setFontSize(16)
      doc.text('📊 Аналитика склада', pageWidth / 2, 15, { align: 'center' })
      
      doc.setFontSize(10)
      doc.text(`Дата: ${new Date().toLocaleString()}`, pageWidth / 2, 22, { align: 'center' })
      doc.text(`Период: ${period} дней`, pageWidth / 2, 29, { align: 'center' })
      
      // Финансовая сводка
      doc.setFontSize(11)
      doc.text('💰 Финансовая сводка', 14, 40)
      doc.setFontSize(9)
      doc.text(`Стоимость запасов: ${financials.totalPurchaseValue.toLocaleString('ru-RU')} ₽`, 14, 47)
      doc.text(`Потенциальная выручка: ${financials.totalSaleValue.toLocaleString('ru-RU')} ₽`, 14, 53)
      doc.text(`Маржинальность: ${financials.margin}%`, 14, 59)
      doc.text(`Риск дефицита: ${financials.atRiskValue.toLocaleString('ru-RU')} ₽`, 14, 65)
      
      // Статистика по статусам
      doc.text(`📊 Статистика по статусам`, 14, 74)
      doc.text(`Нет в наличии: ${criticalCount}`, 14, 80)
      doc.text(`Мало: ${lowCount}`, 14, 86)
      doc.text(`Норма: ${normalCount}`, 14, 92)
      doc.text(`Переизбыток: ${overstockCount}`, 14, 98)
      
      // Таблица с остатками
      const headers = ['№', 'SKU', 'Наименование', 'Категория', 'Остаток', 'Мин./Макс.', 'Статус']
      const rows = filteredStockReport.slice(0, 50).map((item: any, idx: number) => [
        `${idx + 1}`,
        item.sku || item.product_sku || '—',
        item.name || item.product_name || '—',
        item.category || item.product_category || '—',
        `${item.quantity ?? item.qty ?? 0}`,
        `${item.min_stock ?? 0}/${item.max_stock ?? 0}`,
        statusStyles[getItemStatus(item)]?.label || 'Норма'
      ])
      
      // @ts-ignore
      doc.autoTable({
        head: [headers],
        body: rows,
        startY: 105,
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 25 },
          2: { cellWidth: 45 },
          3: { cellWidth: 25 },
          4: { cellWidth: 15 },
          5: { cellWidth: 22 },
          6: { cellWidth: 25 }
        },
        margin: { top: 105, bottom: 20 }
      })
      
      doc.save(`Analytics_${new Date().toISOString().slice(0,10)}.pdf`)
      
    } catch (err: any) {
      console.error('❌ Ошибка PDF:', err)
      alert('❌ Ошибка создания PDF: ' + err.message)
    }
  }

  // 🔥 ЭКСПОРТ В EXCEL
  const handleExportExcel = () => {
    try {
      const rows = filteredStockReport.map((item: any) => ({
        'SKU': item.sku || item.product_sku || '—',
        'Наименование': item.name || item.product_name || '—',
        'Категория': item.category || item.product_category || '—',
        'Остаток': item.quantity ?? item.qty ?? 0,
        'Мин.': item.min_stock ?? 0,
        'Макс.': item.max_stock ?? 0,
        'Статус': statusStyles[getItemStatus(item)]?.label || 'Норма'
      }))
      
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      
      // Добавляем сводку сверху
      const summary: any[][] = [
        ['📊 Аналитика склада'],
        [`Дата: ${new Date().toLocaleString()}`],
        [`Период: ${period} дней`],
        [],
        ['💰 Финансовая сводка'],
        [`Стоимость запасов: ${financials.totalPurchaseValue.toLocaleString('ru-RU')} ₽`],
        [`Потенциальная выручка: ${financials.totalSaleValue.toLocaleString('ru-RU')} ₽`],
        [`Маржинальность: ${financials.margin}%`],
        [`Риск дефицита: ${financials.atRiskValue.toLocaleString('ru-RU')} ₽`],
        [],
        ['📊 Статистика по статусам'],
        [`Нет в наличии: ${criticalCount}`],
        [`Мало: ${lowCount}`],
        [`Норма: ${normalCount}`],
        [`Переизбыток: ${overstockCount}`],
        [],
        ['📋 Детальный отчёт по остаткам'],
        []
      ]
      
      // 🔥 ИСПРАВЛЕНО: правильно типизируем данные для aoa_to_sheet
      const wsData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
      const finalData = [...summary, ...wsData]
      const finalWs = XLSX.utils.aoa_to_sheet(finalData)
      
      XLSX.utils.book_append_sheet(wb, finalWs, 'Аналитика')
      
      XLSX.writeFile(wb, `Analytics_${new Date().toISOString().slice(0,10)}.xlsx`)
      
    } catch (err: any) {
      console.error('❌ Ошибка Excel:', err)
      alert('❌ Ошибка создания Excel: ' + err.message)
    }
  }

  if (isLoading) return (
    <div className="p-6 flex justify-center items-center min-h-[400px]">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 🔝 ЗАГОЛОВОК И КНОПКИ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-indigo-600" /> Аналитика склада
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={period} 
            onChange={e => setPeriod(+e.target.value)} 
            className="p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
          >
            <option value={7}>📅 7 дней</option>
            <option value={30}>📅 30 дней</option>
            <option value={90}>📅 90 дней</option>
          </select>
          <button 
            onClick={() => window.location.reload()} 
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Обновить</span>
          </button>
        </div>
      </div>

      {/* 🔥 КНОПКИ ЭКСПОРТА */}
      {filteredStockReport.length > 0 && (
        <div className="flex flex-wrap gap-2 no-print">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <Printer className="w-4 h-4" /> Печать
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      )}

      {/* 💰 ФИНАНСОВЫЕ КАРТОЧКИ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Стоимость запасов</p>
              <p className="text-lg font-bold text-gray-900">{financials.totalPurchaseValue.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Потенциальная выручка</p>
              <p className="text-lg font-bold text-green-700">{financials.totalSaleValue.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-lg">
              <Percent className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Маржинальность</p>
              <p className="text-lg font-bold text-purple-700">{financials.margin}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Риск дефицита</p>
              <p className="text-lg font-bold text-red-700">{financials.atRiskValue.toLocaleString('ru-RU')} ₽</p>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 КАРТОЧКИ СТАТИСТИКИ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Всего товаров', value: stats?.summary?.total_products ?? 0, icon: Package, color: 'blue' },
          { label: 'Общий остаток', value: `${stats?.summary?.total_stock ?? 0} шт.`, icon: TrendingUp, color: 'indigo' },
          { label: 'Требуют пополнения', value: stats?.summary?.low_stock ?? 0, icon: AlertTriangle, color: 'red', highlight: (stats?.summary?.low_stock ?? 0) > 0 },
          { label: 'Документов', value: turnoverData.reduce((sum: number, d: any) => sum + (d.count ?? 0), 0), icon: FileText, color: 'gray' },
        ].map((stat, idx) => (
          <div 
            key={idx} 
            className={`bg-white p-4 rounded-xl border transition-all hover:shadow-md ${
              stat.highlight 
                ? 'border-red-300 bg-red-50/50' 
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${stat.highlight ? 'bg-red-100' : `bg-${stat.color}-50`}`}>
                <stat.icon className={`w-5 h-5 ${stat.highlight ? 'text-red-600' : `text-${stat.color}-600`}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.highlight ? 'text-red-700' : 'text-gray-900'}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 📈 СЕТКА ГРАФИКОВ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" /> Оборот документов по дням
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={turnoverData}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Area type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" /> Топ-5 товаров по обороту
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topProductsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="qty" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" /> Статусы заказов
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie 
                data={statusData} 
                dataKey="value" 
                nameKey="name" 
                cx="50%" 
                cy="50%" 
                outerRadius={80} 
                innerRadius={40}
                label={({ name, percent }: { name?: string; percent?: number }) => 
                  `${name ?? ''} ${percent ? (percent * 100).toFixed(0) : 0}%`
                }
                labelLine={false}
              >
                {statusData.map((_: any, index: number) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-600" /> Стоимость по категориям
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryValueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v/1000}к`} />
              <Tooltip 
                formatter={(value: any) => [`${Number(value).toLocaleString('ru-RU')} ₽`, '']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="purchase" name="Закупка" fill="#6366F1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sale" name="Продажа" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 🔧 КАРТОЧКИ СТАТУСОВ ОСТАТКОВ */}
      {hasRole(['admin', 'warehouse_manager']) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Нет в наличии', value: criticalCount, icon: AlertTriangle, color: 'red', highlight: criticalCount > 0 },
            { label: 'Мало', value: lowCount, icon: AlertTriangle, color: 'yellow', highlight: lowCount > 0 },
            { label: 'Норма', value: normalCount, icon: Package, color: 'green' },
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
                <div className={`p-2.5 rounded-lg ${stat.highlight ? `bg-${stat.color}-100` : `bg-${stat.color}-50`}`}>
                  <stat.icon className={`w-5 h-5 ${stat.highlight ? `text-${stat.color}-600` : `text-${stat.color}-500`}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.highlight ? `text-${stat.color}-700` : 'text-gray-900'}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 📋 ДЕТАЛЬНАЯ ТАБЛИЦА */}
      {hasRole(['admin', 'warehouse_manager']) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" /> Детальный отчёт по остаткам
              </h3>
            </div>
            
            <div className="space-y-3">
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
                <div className="flex flex-wrap gap-2 items-center">
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
                  {activeFiltersCount > 0 && (
                    <span className="text-xs text-gray-500 ml-auto">
                      Показано: {filteredStockReport.length} из {stockReport.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Товар</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Категория</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Остаток</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Мин./Макс.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStockReport.map((item: any, index: number) => {
                  const status = getItemStatus(item)
                  const style = statusStyles[status]
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-gray-700">{item.sku || item.product_sku || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{item.name || item.product_name || 'Без названия'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.category || item.product_category || '—'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-900">{item.quantity ?? item.qty ?? 0}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.min_stock ?? 0} / {item.max_stock ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filteredStockReport.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">Товары не найдены</p>
                      <p className="text-sm text-gray-400 mt-1">Попробуйте изменить фильтры</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Стили для печати */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .bg-white {
            background: white !important;
            border: 1px solid #ddd !important;
          }
          .shadow-sm {
            box-shadow: none !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          table th,
          table td {
            border: 1px solid #ddd;
            padding: 4px 8px;
            text-align: left;
          }
          table th {
            background-color: #f3f4f6 !important;
            font-weight: bold;
          }
          .bg-red-100 { background-color: #fee2e2 !important; }
          .bg-yellow-100 { background-color: #fef3c7 !important; }
          .bg-green-100 { background-color: #d1fae5 !important; }
          .bg-purple-100 { background-color: #ede9fe !important; }
          .text-red-700 { color: #b91c1c !important; }
          .text-yellow-700 { color: #92400e !important; }
          .text-green-700 { color: #065f46 !important; }
          .text-purple-700 { color: #5b21b6 !important; }
        }
      `}</style>
    </div>
  )
}