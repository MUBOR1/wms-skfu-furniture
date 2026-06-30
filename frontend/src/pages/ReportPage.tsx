import { useEffect, useState, useMemo, useRef } from 'react'
import { catalog, analytics } from '../api/wms'
import { 
  Package, TrendingUp, AlertTriangle, CheckCircle, Search, 
  XCircle as XIcon, RefreshCw, Eye, X, 
  Printer, FileDown, FileSpreadsheet, Filter, BarChart3,
  DollarSign
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

type ReportType = 'stock' | 'turnover' | 'critical' | 'value'

const reportTypes: { value: ReportType; label: string; icon: React.ElementType }[] = [
  { value: 'stock', label: 'Текущие остатки', icon: Package },
  { value: 'turnover', label: 'Оборачиваемость товаров', icon: TrendingUp },
  { value: 'critical', label: 'Критические остатки', icon: AlertTriangle },
  { value: 'value', label: 'Стоимость запасов', icon: DollarSign },
]

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
  const tableRef = useRef<HTMLDivElement>(null)
  
  const [reportType, setReportType] = useState<ReportType>('stock')
  const [report, setReport] = useState<any[]>([])
  const [reportTotal, setReportTotal] = useState<number | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null)

  const [period, setPeriod] = useState<string>('30')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [stockDetails, setStockDetails] = useState<any[]>([])
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await catalog.categories()
        const cats = new Set<string>()
        if (Array.isArray(data)) {
          data.forEach((c: any) => { 
            if (c.name) cats.add(c.name) 
          })
        }
        setCategories(Array.from(cats).sort())
      } catch (err) {
        console.error('Error loading categories:', err)
      }
    }
    loadCategories()
  }, [])

  const generateReport = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      let data: any[] = []
      let total: number | null = null

      console.log(`📊 Генерация отчёта: ${reportType}`)

      switch (reportType) {
        case 'stock':
          data = await analytics.stockReport() as any[]
          break
        case 'turnover':
          data = await analytics.turnoverReport(period, categoryFilter === 'all' ? undefined : categoryFilter) as any[]
          break
        case 'critical':
          data = await analytics.criticalReport(categoryFilter === 'all' ? undefined : categoryFilter) as any[]
          break
        case 'value':
          const result = await analytics.valueReport(categoryFilter === 'all' ? undefined : categoryFilter) as any
          data = result.items || []
          total = result.total_value || 0
          break
      }

      setReport(Array.isArray(data) ? data : [])
      setReportTotal(total)
      setLastGenerated(new Date())
    } catch (err: any) {
      console.error('❌ Report error:', err)
      setError('Не удалось загрузить данные: ' + err.message)
    } finally {
      setIsGenerating(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    generateReport()
  }, [])

  useEffect(() => {
    if (!isLoading) {
      generateReport()
    }
  }, [reportType, period, categoryFilter, statusFilter])

  const getItemStatus = (item: any): string => {
    const qty = item.quantity || item.stock_qty || 0
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
      filtered = filtered.filter(item => 
        item.sku?.toLowerCase().includes(q) || 
        item.name?.toLowerCase().includes(q)
      )
    }
    
    if (statusFilter !== 'all' && reportType !== 'turnover' && reportType !== 'value') {
      filtered = filtered.filter(item => getItemStatus(item) === statusFilter)
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(i => i.category === categoryFilter)
    }
    
    if (reportType === 'stock' || reportType === 'critical') {
      const priority: Record<string, number> = { critical: 0, low: 1, overstock: 2, normal: 3 }
      filtered.sort((a, b) => priority[getItemStatus(a)] - priority[getItemStatus(b)])
    }
    
    return filtered
  }, [report, searchQuery, statusFilter, categoryFilter, reportType])

  const resetFilters = () => { 
    setSearchQuery('')
    setStatusFilter('all')
    setCategoryFilter('all')
  }
  
  const activeFiltersCount = [
    searchQuery.trim(),
    statusFilter !== 'all',
    categoryFilter !== 'all'
  ].filter(Boolean).length

  const totalItems = filteredReport.reduce((sum, item) => sum + (item.quantity || item.stock_qty || 0), 0)
  const criticalCount = filteredReport.filter(i => getItemStatus(i) === 'critical').length
  const lowCount = filteredReport.filter(i => getItemStatus(i) === 'low').length

  const handlePrint = () => {
    window.print()
  }

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      
      const typeLabels: Record<ReportType, string> = {
        stock: 'Отчёт по текущим остаткам',
        turnover: 'Отчёт по оборачиваемости товаров',
        critical: 'Отчёт по критическим остаткам',
        value: 'Отчёт по стоимости запасов'
      }
      
      doc.setFontSize(16)
      doc.text(typeLabels[reportType], pageWidth / 2, 15, { align: 'center' })
      
      doc.setFontSize(10)
      doc.text(`Дата: ${new Date().toLocaleString()}`, pageWidth / 2, 22, { align: 'center' })
      
      if (reportType === 'value' && reportTotal !== null) {
        doc.text(`Общая стоимость: ${reportTotal.toLocaleString()} ₽`, pageWidth / 2, 29, { align: 'center' })
      }
      
      let headers: string[] = []
      let rows: any[] = []
      
      switch (reportType) {
        case 'stock':
          headers = ['№', 'SKU', 'Наименование', 'Категория', 'Остаток', 'Мин./Макс.', 'Статус']
          rows = filteredReport.map((item, idx) => [
            `${idx + 1}`,
            item.sku || '—',
            item.name || '—',
            item.category || '—',
            `${item.quantity || 0}`,
            `${item.min_stock || 0}/${item.max_stock || 0}`,
            getItemStatus(item) === 'critical' ? 'Нет в наличии' :
            getItemStatus(item) === 'low' ? 'Мало' :
            getItemStatus(item) === 'overstock' ? 'Переизбыток' : 'Норма'
          ])
          break
        case 'turnover':
          headers = ['№', 'SKU', 'Наименование', 'Категория', 'Цена', 'Остаток', 'Продано', 'Оборач.']
          rows = filteredReport.map((item, idx) => [
            `${idx + 1}`,
            item.sku || '—',
            item.name || '—',
            item.category || '—',
            `${item.sale_price || 0} ₽`,
            `${item.stock_qty || 0}`,
            `${item.sold_qty || 0}`,
            `${item.turnover || 0}`
          ])
          break
        case 'critical':
          headers = ['№', 'SKU', 'Наименование', 'Категория', 'Остаток', 'Мин./Макс.', 'Статус']
          rows = filteredReport.map((item, idx) => [
            `${idx + 1}`,
            item.sku || '—',
            item.name || '—',
            item.category || '—',
            `${item.stock_qty || 0}`,
            `${item.min_stock || 0}/${item.max_stock || 0}`,
            item.status === 'critical' ? 'Нет в наличии' :
            item.status === 'low' ? 'Мало' : 'Переизбыток'
          ])
          break
        case 'value':
          headers = ['№', 'SKU', 'Наименование', 'Категория', 'Остаток', 'Закупка', 'Продажа', 'Стоимость']
          rows = filteredReport.map((item, idx) => [
            `${idx + 1}`,
            item.sku || '—',
            item.name || '—',
            item.category || '—',
            `${item.stock_qty || 0}`,
            `${item.purchase_price || 0} ₽`,
            `${item.sale_price || 0} ₽`,
            `${item.purchase_value || 0} ₽`
          ])
          break
      }
      
      // @ts-ignore
      doc.autoTable({
        head: [headers],
        body: rows,
        startY: 35,
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
          2: { cellWidth: 40 },
          3: { cellWidth: 25 },
          4: { cellWidth: 18 },
          5: { cellWidth: 22 },
          6: { cellWidth: 25 },
          7: { cellWidth: 25 }
        },
        margin: { top: 35, bottom: 20 }
      })
      
      const typeNames: Record<ReportType, string> = {
        stock: 'Ostatki',
        turnover: 'Oborachivaemost',
        critical: 'Kriticheskie',
        value: 'Stoimost'
      }
      doc.save(`Report_${typeNames[reportType]}_${new Date().toISOString().slice(0,10)}.pdf`)
      
    } catch (err: any) {
      console.error('❌ Ошибка PDF:', err)
      alert('❌ Ошибка создания PDF: ' + err.message)
    }
  }

  const handleExportExcel = () => {
    try {
      let rows: any[] = []
      
      switch (reportType) {
        case 'stock':
          rows = filteredReport.map(item => ({
            'SKU': item.sku || '—',
            'Наименование': item.name || '—',
            'Категория': item.category || '—',
            'Остаток': item.quantity || 0,
            'Мин.': item.min_stock || 0,
            'Макс.': item.max_stock || 0,
            'Статус': getItemStatus(item) === 'critical' ? 'Нет в наличии' :
                      getItemStatus(item) === 'low' ? 'Мало' :
                      getItemStatus(item) === 'overstock' ? 'Переизбыток' : 'Норма'
          }))
          break
        case 'turnover':
          rows = filteredReport.map(item => ({
            'SKU': item.sku || '—',
            'Наименование': item.name || '—',
            'Категория': item.category || '—',
            'Цена': item.sale_price || 0,
            'Остаток': item.stock_qty || 0,
            'Продано': item.sold_qty || 0,
            'Оборачиваемость': item.turnover || 0
          }))
          break
        case 'critical':
          rows = filteredReport.map(item => ({
            'SKU': item.sku || '—',
            'Наименование': item.name || '—',
            'Категория': item.category || '—',
            'Остаток': item.stock_qty || 0,
            'Мин.': item.min_stock || 0,
            'Макс.': item.max_stock || 0,
            'Статус': item.status === 'critical' ? 'Нет в наличии' :
                      item.status === 'low' ? 'Мало' : 'Переизбыток'
          }))
          break
        case 'value':
          rows = filteredReport.map(item => ({
            'SKU': item.sku || '—',
            'Наименование': item.name || '—',
            'Категория': item.category || '—',
            'Остаток': item.stock_qty || 0,
            'Закупка': item.purchase_price || 0,
            'Продажа': item.sale_price || 0,
            'Стоимость закупки': item.purchase_value || 0,
            'Стоимость продажи': item.sale_value || 0
          }))
          break
      }
      
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }))
      
      XLSX.utils.book_append_sheet(wb, ws, 'Отчёт')
      
      const typeNames: Record<ReportType, string> = {
        stock: 'Ostatki',
        turnover: 'Oborachivaemost',
        critical: 'Kriticheskie',
        value: 'Stoimost'
      }
      XLSX.writeFile(wb, `Report_${typeNames[reportType]}_${new Date().toISOString().slice(0,10)}.xlsx`)
      
    } catch (err: any) {
      console.error('❌ Ошибка Excel:', err)
      alert('❌ Ошибка создания Excel: ' + err.message)
    }
  }

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

  const getTableRow = (item: any) => {
    switch (reportType) {
      case 'stock':
        return {
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          col1: item.quantity || 0,
          col2: `${item.min_stock || 0} / ${item.max_stock || 0}`,
          status: getItemStatus(item)
        }
      case 'turnover':
        return {
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          col1: item.sale_price || 0,
          col2: item.stock_qty || 0,
          col3: item.sold_qty || 0,
          col4: item.turnover || 0,
          status: 'normal'
        }
      case 'critical':
        return {
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          col1: item.stock_qty || 0,
          col2: `${item.min_stock || 0} / ${item.max_stock || 0}`,
          status: item.status || getItemStatus(item)
        }
      case 'value':
        return {
          id: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          col1: item.stock_qty || 0,
          col2: item.purchase_price || 0,
          col3: item.sale_price || 0,
          col4: item.purchase_value || 0,
          status: 'normal'
        }
      default:
        return null
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6 no-print">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-indigo-600" /> Отчёты
        </h2>
        <button 
          onClick={generateReport}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Генерация...' : 'Сформировать отчёт'}
        </button>
      </div>

      {/* Выбор типа отчёта */}
      <div className="mb-6 no-print">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {reportTypes.map((type) => {
            const Icon = type.icon
            const isActive = reportType === type.value
            return (
              <button
                key={type.value}
                onClick={() => setReportType(type.value)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`} />
                  <span className={`font-medium ${isActive ? 'text-indigo-700' : 'text-gray-700'}`}>
                    {type.label}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Фильтры */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm no-print">
        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" /> Параметры отчёта
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {reportType === 'turnover' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Период</label>
              <select 
                value={period} 
                onChange={e => setPeriod(e.target.value)} 
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="7">За 7 дней</option>
                <option value="14">За 14 дней</option>
                <option value="30">За 30 дней</option>
                <option value="60">За 60 дней</option>
                <option value="90">За 90 дней</option>
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Категория</label>
            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)} 
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="all">Все категории</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {(reportType === 'stock' || reportType === 'critical') && (
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Статус</label>
              <select 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)} 
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Поиск</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="SKU или название..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
              />
            </div>
          </div>
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

      {lastGenerated && (
        <div className="mb-4 text-sm text-gray-400 no-print">
          📅 Последнее обновление: {lastGenerated.toLocaleString()}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Статистика */}
      {(reportType === 'stock' || reportType === 'critical') && filteredReport.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 no-print">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Всего позиций</p>
                <p className="text-xl font-bold text-gray-900">{filteredReport.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-50">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Общий остаток</p>
                <p className="text-xl font-bold text-gray-900">{totalItems} шт.</p>
              </div>
            </div>
          </div>
          <div className={`bg-white p-4 rounded-xl border ${criticalCount > 0 ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${criticalCount > 0 ? 'bg-red-100' : 'bg-red-50'}`}>
                <AlertTriangle className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-600' : 'text-red-500'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Нет в наличии</p>
                <p className={`text-xl font-bold ${criticalCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                  {criticalCount}
                </p>
              </div>
            </div>
          </div>
          <div className={`bg-white p-4 rounded-xl border ${lowCount > 0 ? 'border-yellow-300 bg-yellow-50/50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${lowCount > 0 ? 'bg-yellow-100' : 'bg-yellow-50'}`}>
                <AlertTriangle className={`w-5 h-5 ${lowCount > 0 ? 'text-yellow-600' : 'text-yellow-500'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Мало</p>
                <p className={`text-xl font-bold ${lowCount > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>
                  {lowCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Общая стоимость */}
      {reportType === 'value' && reportTotal !== null && filteredReport.length > 0 && (
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl no-print">
          <div className="flex items-center justify-between">
            <span className="font-medium text-indigo-700">Общая стоимость запасов:</span>
            <span className="text-2xl font-bold text-indigo-700">{reportTotal.toLocaleString()} ₽</span>
          </div>
        </div>
      )}

      {/* Кнопки экспорта */}
      {filteredReport.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 no-print">
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

      {/* Таблица */}
      <div ref={tableRef}>
        {isLoading || isGenerating ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 mx-auto mb-3 border-t-transparent"></div>
            <p className="text-gray-500 text-sm">
              {isGenerating ? 'Генерация отчёта...' : 'Загрузка данных...'}
            </p>
          </div>
        ) : filteredReport.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Данные не найдены</p>
            <p className="text-sm text-gray-400 mt-1">Измените параметры фильтрации</p>
            {activeFiltersCount > 0 && (
              <button onClick={resetFilters} className="mt-3 text-sm text-indigo-600 hover:underline font-medium">
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-12">№</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Наименование</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Категория</th>
                    {reportType === 'stock' && (
                      <>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Остаток</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Мин./Макс.</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                      </>
                    )}
                    {reportType === 'turnover' && (
                      <>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Цена</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Остаток</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Продано</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Оборачиваемость</th>
                      </>
                    )}
                    {reportType === 'critical' && (
                      <>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Остаток</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Мин./Макс.</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                      </>
                    )}
                    {reportType === 'value' && (
                      <>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Остаток</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Закупка</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Продажа</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Стоимость</th>
                      </>
                    )}
                    {(reportType === 'stock' || reportType === 'critical') && (
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-16">Детали</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredReport.map((item, idx) => {
                    const row = getTableRow(item)
                    if (!row) return null
                    
                    const status = row.status || 'normal'
                    const style = statusStyles[status] || statusStyles.normal
                    const StatusIcon = style.icon
                    
                    return (
                      <tr key={`${item.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">{idx + 1}.</td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-700">{row.sku || '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.name || 'Без названия'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{row.category || '—'}</td>
                        
                        {reportType === 'stock' && (
                          <>
                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.col1}</td>
                            <td className="px-4 py-3 text-center text-sm text-gray-500">{row.col2}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {style.label}
                              </span>
                            </td>
                          </>
                        )}
                        
                        {reportType === 'turnover' && (
                          <>
                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.col1} ₽</td>
                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.col2}</td>
                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.col3}</td>
                            <td className="px-4 py-3 text-center font-bold text-indigo-600">{row.col4}</td>
                          </>
                        )}
                        
                        {reportType === 'critical' && (
                          <>
                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.col1}</td>
                            <td className="px-4 py-3 text-center text-sm text-gray-500">{row.col2}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {style.label}
                              </span>
                            </td>
                          </>
                        )}
                        
                        {reportType === 'value' && (
                          <>
                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.col1}</td>
                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.col2} ₽</td>
                            <td className="px-4 py-3 text-center font-semibold text-gray-900">{row.col3} ₽</td>
                            <td className="px-4 py-3 text-center font-bold text-indigo-600">{row.col4} ₽</td>
                          </>
                        )}
                        
                        {(reportType === 'stock' || reportType === 'critical') && (
                          <td className="px-4 py-3 text-center">
                            <button 
                              onClick={() => handleViewDetails(item.id)} 
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Посмотреть места хранения"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
              Показано {filteredReport.length} записей
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно: места хранения */}
      {selectedProductId !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
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

      {/* Стили для печати */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .report-content {
            padding: 20px;
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
            color: #1f2937 !important;
          }
          table td {
            color: #1f2937 !important;
          }
          .bg-red-100 { background-color: #fee2e2 !important; }
          .bg-yellow-100 { background-color: #fef3c7 !important; }
          .bg-green-100 { background-color: #d1fae5 !important; }
          .bg-purple-100 { background-color: #ede9fe !important; }
          .text-red-700 { color: #b91c1c !important; }
          .text-yellow-700 { color: #92400e !important; }
          .text-green-700 { color: #065f46 !important; }
          .text-purple-700 { color: #5b21b6 !important; }
          .text-gray-900 { color: #111827 !important; }
          .text-gray-700 { color: #374151 !important; }
          .text-gray-500 { color: #6b7280 !important; }
          .text-indigo-600 { color: #4f46e5 !important; }
        }
      `}</style>
    </div>
  )
}