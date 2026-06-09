import { useEffect, useState, useMemo } from 'react'
import { documents, catalog, analytics } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { 
  FileText, Plus, CheckCircle, Clock, XCircle, Eye, Edit2, Trash2, X, Save, 
  Search, Filter, Calendar, XCircle as XIcon, RotateCcw
} from 'lucide-react'

const formatTime = (date: string | null | undefined): string => {
  if (!date) return '—'
  try { return new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

const formatDateKey = (date: string | null | undefined): string => {
  if (!date) return 'Неизвестно'
  try { return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return 'Неизвестно' }
}

interface DocItem {
  id: number
  doc_number: string
  type: 'receive' | 'ship' | 'transfer' | 'adjust'
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string | null
  comment: string | null
  items?: any[]
}

interface Cell {
  id: number
  code: string
  zone_id: number
}

interface StockDetail {
  cell_code: string
  quantity: number
}

const typeLabels: Record<string, string> = {
  receive: '📥 Приёмка', ship: '📤 Отгрузка', transfer: '🔄 Перемещение', adjust: '⚙️ Корректировка'
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-700', icon: Clock },
  in_progress: { label: 'В работе', color: 'bg-blue-100 text-blue-700', icon: Clock },
  completed: { label: 'Проведён', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const documentTypes = [
  { value: 'all', label: 'Все типы' },
  { value: 'receive', label: '📥 Приёмка' },
  { value: 'ship', label: '📤 Отгрузка' },
  { value: 'transfer', label: '🔄 Перемещение' },
  { value: 'adjust', label: '⚙️ Корректировка' },
]

const statusFilterOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'draft', label: 'Черновик' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Проведён' },
  { value: 'cancelled', label: 'Отменён' },
]

export default function DocumentsPage() {
  const { hasRole } = useAuth()
  const [docs, setDocs] = useState<DocItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [cells, setCells] = useState<Cell[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [stockByProduct, setStockByProduct] = useState<Record<number, StockDetail[]>>({})
  
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newDoc, setNewDoc] = useState({ type: 'receive', comment: '' }) 
  const [docItems, setDocItems] = useState<Array<{ 
    product_id: number; quantity: number; from_cell_id?: number; to_cell_id?: number 
  }>>([])
  
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)
  const [editingDoc, setEditingDoc] = useState<any | null>(null)
  const [editItems, setEditItems] = useState<any[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const [productSearch, setProductSearch] = useState('')
  const [productCategory, setProductCategory] = useState<string>('all')

  const loadDocs = async () => {
    try {
      const data = await documents.list()
      setDocs(Array.isArray(data) ? data : [])
    } catch (err) { console.error(err) }
  }
  
  const loadProducts = async () => {
    try {
      const data = await catalog.products()
      setProducts(Array.isArray(data) ? data : [])
      
      const stockPromises = data.map(async (p: any) => {
        try {
          const stockData = await analytics.stockDetails(p.id)
          if (Array.isArray(stockData) && stockData.length > 0) {
            setStockByProduct(prev => ({ ...prev, [p.id]: stockData }))
          }
        } catch (err) {
          console.error(`Ошибка загрузки остатков для ${p.sku}:`, err)
        }
      })
      await Promise.all(stockPromises)
    } catch (err) { 
      console.error(err) 
    }
  }
  
  const loadCells = async () => {
    try {
      const data = await catalog.cells()
      setCells(Array.isArray(data) ? data : [])
    } catch (err) { console.error(err) }
  }

  useEffect(() => { 
    Promise.all([loadDocs(), loadProducts(), loadCells()]).finally(() => setIsLoading(false))
  }, [])

  // 🔧 ЗАГРУЗКА СОХРАНЁННОЙ ФОРМЫ
  useEffect(() => {
    const savedForm = sessionStorage.getItem('document_form_data')
    if (savedForm) {
      try {
        const parsed = JSON.parse(savedForm)
        if (parsed.comment || parsed.items?.length > 0 || parsed.type) {
          setNewDoc({ type: parsed.type || 'receive', comment: parsed.comment || '' })
          setDocItems(parsed.items || [])
        }
      } catch (e) {
        console.error('Ошибка загрузки формы:', e)
      }
    }
  }, [])

  // 🔧 СОХРАНЕНИЕ ФОРМЫ
  useEffect(() => {
    if (newDoc.comment || docItems.length > 0) {
      sessionStorage.setItem('document_form_data', JSON.stringify({
        type: newDoc.type,
        comment: newDoc.comment,
        items: docItems
      }))
    } else {
      sessionStorage.removeItem('document_form_data')
    }
  }, [newDoc, docItems])

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

  const filteredAndGroupedDocs = useMemo(() => {
    let filtered = [...docs]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(d => d.doc_number?.toLowerCase().includes(q))
    }
    if (typeFilter !== 'all') filtered = filtered.filter(d => d.type === typeFilter)
    if (statusFilter !== 'all') filtered = filtered.filter(d => d.status === statusFilter)
    if (dateFrom) {
      const from = new Date(dateFrom)
      filtered = filtered.filter(d => d.created_at && new Date(d.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      filtered = filtered.filter(d => d.created_at && new Date(d.created_at) <= to)
    }
    filtered.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
      return dateB - dateA
    })
    const grouped: Record<string, DocItem[]> = {}
    for (const doc of filtered) {
      const dateKey = formatDateKey(doc.created_at)
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(doc)
    }
    return grouped
  }, [docs, searchQuery, typeFilter, statusFilter, dateFrom, dateTo])

  const resetFilters = () => { 
    setSearchQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
  }
  
  const activeFiltersCount = [
    searchQuery.trim(),
    typeFilter !== 'all',
    statusFilter !== 'all',
    dateFrom,
    dateTo
  ].filter(Boolean).length

  const getErrorMessage = (err: any): string => {
    console.error('🔴 Full error:', err)
    if (typeof err === 'string') return err
    if (err?.message) return err.message
    if (err?.detail) return typeof err.detail === 'object' ? JSON.stringify(err.detail) : err.detail
    if (err?.response?.data?.detail) return err.response.data.detail
    return 'Неизвестная ошибка. Проверьте консоль (F12)'
  }

  const handleViewDetails = async (id: number) => {
    setIsDetailsLoading(true)
    setSelectedDoc({ id, items: [] })
    try {
      const res = await documents.getDoc(id)
      setSelectedDoc(res)
    } catch (err) {
      console.error(err)
      setSelectedDoc(null)
    } finally {
      setIsDetailsLoading(false)
    }
  }

  const handleEdit = async (id: number) => {
    try {
      const doc = await documents.getDoc(id) as any
      setEditingDoc({ id, type: doc.type, comment: doc.comment || '' })
      setEditItems(doc.items || [])
      setShowForm(false)
      setSelectedDoc(null)
    } catch (err) {
      alert('❌ Ошибка загрузки документа: ' + getErrorMessage(err))
    }
  }

  const handleCancel = async (id: number) => {
    if (!confirm('Отменить документ? Это действие нельзя отменить.')) return
    try {
      const token = localStorage.getItem('wms_token')
      const response = await fetch(`/api/documents/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'cancelled' })
      })
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: 'Ошибка сервера' }))
        throw new Error(errData.detail || 'Ошибка отмены')
      }
      
      await loadDocs()
      alert('✅ Документ отменён')
    } catch (err: any) {
      alert('❌ ' + getErrorMessage(err))
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ВНИМАНИЕ: Документ будет удалён БЕЗВОЗВРАТНО! Продолжить?')) return
    try {
      await documents.delete(id)
      await loadDocs()
      alert('✅ Документ удалён')
    } catch (err: any) {
      alert('❌ ' + getErrorMessage(err))
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || docItems.length === 0) return
    setIsSubmitting(true)
    try {
      const res = await documents.create({ 
        doc_number: '', type: newDoc.type, comment: newDoc.comment, items: docItems 
      }) as any
      setShowForm(false)
      setNewDoc({ type: 'receive', comment: '' })
      setDocItems([])
      sessionStorage.removeItem('document_form_data')
      await loadDocs()
      alert(`✅ Документ создан: ${res.doc_number}`)
    } catch (err: any) {
      alert('❌ ' + getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDoc || editItems.length === 0) return
    setIsSubmitting(true)
    try {
      await documents.update(editingDoc.id, {
        type: editingDoc.type,
        comment: editingDoc.comment,
        items: editItems
      })
      setEditingDoc(null)
      setEditItems([])
      await loadDocs()
      alert('✅ Документ обновлён')
    } catch (err: any) {
      alert('❌ ' + getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleComplete = async (id: number) => {
    if (!confirm('Провести документ? Остатки будут обновлены.')) return
    try {
      await documents.complete(id)
      await loadDocs()
      alert('✅ Документ успешно проведён')
    } catch (err: any) { 
      alert('❌ ' + getErrorMessage(err)) 
    }
  }

  const getDefaultCells = (docType: string) => {
    if (docType === 'receive') {
      const receivingCell = cells.find(c => c.code.toUpperCase().includes('REC')) || cells[0]
      return { from_cell_id: undefined, to_cell_id: receivingCell?.id }
    } else if (docType === 'ship') {
      return { from_cell_id: cells[0]?.id, to_cell_id: undefined }
    } else if (docType === 'transfer') {
      return { from_cell_id: cells[0]?.id, to_cell_id: cells[1]?.id }
    } else if (docType === 'adjust') {
      return { from_cell_id: undefined, to_cell_id: cells[0]?.id }
    }
    return { from_cell_id: undefined, to_cell_id: undefined }
  }
  
  const updateDocItem = (idx: number, field: string, value: any) => {
    setDocItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u })
  }
  
  const updateEditItem = (idx: number, field: string, value: any) => {
    setEditItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u })
  }

  const currentType = (editingDoc || newDoc).type
  const getCellById = (id: number | null | undefined) => {
    if (!id) return null
    return cells.find(c => c.id === id)
  }

  const getTotalQuantity = (productId: number): number => {
    const stock = stockByProduct[productId]
    if (!stock || stock.length === 0) return 0
    return stock.reduce((sum, s) => sum + s.quantity, 0)
  }

  // 🔧 ФУНКЦИЯ ОЧИСТКИ ФОРМЫ
  const clearDocumentForm = () => {
    if (docItems.length > 0 || newDoc.comment) {
      if (confirm('Очистить форму документа? Все добавленные позиции будут удалены.')) {
        setNewDoc({ type: 'receive', comment: '' })
        setDocItems([])
        sessionStorage.removeItem('document_form_data')
      }
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 🔝 ЗАГОЛОВОК И КНОПКИ */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">📄 Складские документы</h2>
        <div className="flex items-center gap-2">
          {hasRole(['admin', 'warehouse_manager']) && (
            <>
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
              <button onClick={() => { 
                setShowForm(!showForm)
                setEditingDoc(null)
                if(!showForm) { loadProducts(); loadCells() } 
              }} 
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
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
              <Filter className="w-4 h-4" /> Фильтры документов
            </h4>
            <button onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <XIcon className="w-3 h-3" /> Сбросить
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Поиск по номеру..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              {documentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              {statusFilterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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
          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {searchQuery && <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">Поиск: "{searchQuery}"<button onClick={() => setSearchQuery('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button></span>}
              {typeFilter !== 'all' && <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">Тип: {documentTypes.find(t => t.value === typeFilter)?.label}<button onClick={() => setTypeFilter('all')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button></span>}
              {statusFilter !== 'all' && <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">Статус: {statusFilterOptions.find(o => o.value === statusFilter)?.label}<button onClick={() => setStatusFilter('all')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button></span>}
              {dateFrom && <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">От: {dateFrom}<button onClick={() => setDateFrom('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button></span>}
              {dateTo && <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">До: {dateTo}<button onClick={() => setDateTo('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button></span>}
            </div>
          )}
        </div>
      )}

      {/* Форма создания/редактирования */}
      {(showForm || editingDoc) && (
        <form onSubmit={editingDoc ? handleUpdate : handleCreate} 
              className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{editingDoc ? '✏️ Редактирование' : '➕ Создание'} документа</h3>
            <button 
              type="button"
              onClick={clearDocumentForm}
              className="text-sm text-red-600 hover:text-red-800 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              title="Очистить всю форму"
            >
              <RotateCcw className="w-4 h-4" />
              Очистить всё
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select value={currentType} onChange={e => {
                const newType = e.target.value
                if (editingDoc) setEditingDoc({...editingDoc, type: newType})
                else { setNewDoc({...newDoc, type: newType}); setDocItems([]) }
              }} 
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
              <option value="receive">📥 Приёмка</option>
              <option value="ship">📤 Отгрузка</option>
              <option value="transfer">🔄 Перемещение</option>
              <option value="adjust">⚙️ Корректировка</option>
            </select>
            <input placeholder="Комментарий" value={(editingDoc || newDoc).comment} 
              onChange={e => editingDoc ? setEditingDoc({...editingDoc, comment: e.target.value}) : setNewDoc({...newDoc, comment: e.target.value})} 
              className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          
          <div className={`p-3 rounded-lg text-sm border ${
            currentType === 'receive' ? 'bg-green-50 border-green-200 text-green-800' :
            currentType === 'ship' ? 'bg-red-50 border-red-200 text-red-800' :
            currentType === 'transfer' ? 'bg-blue-50 border-blue-200 text-blue-800' :
            'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            {currentType === 'receive' && '📥 Приёмка: товар поступает на склад.'}
            {currentType === 'ship' && '📤 Отгрузка: товар уходит со склада.'}
            {currentType === 'transfer' && '🔄 Перемещение: товар переезжает между ячейками.'}
            {currentType === 'adjust' && '⚙️ Корректировка: ручное изменение остатков.'}
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-700 mb-3">Позиции документа</h4>
            
            {/* 🔍 ПОИСК И ФИЛЬТР ТОВАРОВ */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Поиск по SKU или названию..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <select value={productCategory} onChange={e => setProductCategory(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="all">Все категории</option>
                  {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              
              {/* 🔽 ВЫПАДАЮЩИЙ СПИСОК */}
              {filteredProducts.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                  {filteredProducts.map(p => {
                    const totalQty = getTotalQuantity(p.id)
                    const minStock = p.min_stock || 0
                    const maxStock = p.max_stock || 0
                    const isLow = totalQty > 0 && totalQty < minStock
                    const isCritical = totalQty === 0
                    
                    return (
                      <div key={p.id} className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                        onClick={() => {
                          const alreadyExists = (editingDoc ? editItems : docItems).find(item => item.product_id === p.id)
                          if (alreadyExists) { alert('⚠️ Товар уже добавлен'); return }
                          const baseItem = { product_id: p.id, quantity: 1, ...getDefaultCells(currentType) }
                          if (editingDoc) setEditItems(prev => [...prev, baseItem])
                          else setDocItems(prev => [...prev, baseItem])
                          setProductSearch('')
                        }}>
                        <div className="flex-1">
                          <span className="font-mono text-xs text-gray-500">{p.sku}</span>
                          <span className="ml-2 font-medium text-sm">{p.name}</span>
                          {p.category && <span className="ml-2 text-xs text-gray-400">({p.category})</span>}
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${isCritical ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-600'}`}>
                            {totalQty} шт.
                          </div>
                          <div className="text-xs text-gray-400">
                            {minStock} / {maxStock}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            {/* 📦 ПОЗИЦИИ ДОКУМЕНТА - КРАСИВЫЙ СПИСОК */}
            {(editingDoc ? editItems : docItems).map((item, idx) => {
              const product = products.find(p => p.id === item.product_id)
              const totalQty = getTotalQuantity(item.product_id)
              const minStock = product?.min_stock || 0
              const maxStock = product?.max_stock || 0
              const isLow = totalQty > 0 && totalQty < minStock
              const isOverstock = maxStock > 0 && totalQty > maxStock 
              const isCritical = totalQty === 0
              
              return (
                <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow mb-4">
                  {/* 📦 Информация о товаре */}
                  <div className="flex-1 min-w-[180px]">
                    <div className="text-sm font-semibold text-gray-900 truncate">{product?.name || `Товар #${item.product_id}`}</div>
                    <div className="text-xs text-gray-500 font-mono">{product?.sku}</div>
                  </div>

                  {/* 🔢 Количество */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={currentType === 'adjust' ? undefined : 1}
                      placeholder={currentType === 'adjust' ? "± Кол-во" : "Кол-во"}
                      value={item.quantity}
                      onChange={e => editingDoc ? updateEditItem(idx, 'quantity', +e.target.value) : updateDocItem(idx, 'quantity', +e.target.value)}
                      className={`w-20 px-2 py-2 border rounded-lg text-sm text-center font-medium focus:ring-2 focus:ring-indigo-500 outline-none ${isCritical ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300'}`}
                      required
                    />
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      isCritical ? 'bg-red-100 text-red-700' : 
                      isLow ? 'bg-yellow-100 text-yellow-700' : 
                      isOverstock ? 'bg-purple-100 text-purple-700' :  // ← Новый цвет
                      'bg-green-100 text-green-700'
                    }`}>
                      {totalQty} шт.
                    </span>
                  </div>

                  {/* 📍 Из ячейки */}
                  {(currentType === 'ship' || currentType === 'transfer') && (
                    <div className="w-32">
                      <select 
                        value={item.from_cell_id || ''} 
                        onChange={e => editingDoc ? updateEditItem(idx, 'from_cell_id', +e.target.value || undefined) : updateDocItem(idx, 'from_cell_id', +e.target.value || undefined)} 
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      >
                        <option value="">📤 Из</option>
                        {cells.map((c: Cell) => {
                          const stockList = stockByProduct[item.product_id] || []
                          const stock = stockList.find(s => s.cell_code === c.code)
                          const qty = stock ? stock.quantity : 0
                          return (
                            <option key={c.id} value={c.id}>
                              {qty > 0 ? `🟢 ${c.code}` : `⚪ ${c.code}`}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  )}
                  
                  {/* 📍 В ячейку */}
                  {(currentType === 'receive' || currentType === 'transfer' || currentType === 'adjust') && (
                    <div className="w-32">
                      <select 
                        value={item.to_cell_id || ''} 
                        onChange={e => editingDoc ? updateEditItem(idx, 'to_cell_id', +e.target.value || undefined) : updateDocItem(idx, 'to_cell_id', +e.target.value || undefined)} 
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      >
                        <option value="">📥 В</option>
                        {cells.map((c: Cell) => {
                          const stockList = stockByProduct[item.product_id] || []
                          const stock = stockList.find(s => s.cell_code === c.code)
                          const qty = stock ? stock.quantity : 0
                          return (
                            <option key={c.id} value={c.id}>
                              {qty > 0 ? `🟢 ${c.code}` : `⚪ ${c.code}`}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  )}

                  {/* 👁️ КНОПКА ИНФО - ВЕРНУЛ */}
                  {(currentType === 'ship' || currentType === 'transfer' || currentType === 'adjust') && product && (
                    <button 
                      type="button"
                      onClick={() => {
                        const totalQty = getTotalQuantity(item.product_id)
                        const minStock = product.min_stock || 0
                        const maxStock = product.max_stock || 0
                        const stock = stockByProduct[item.product_id] || []
                        
                        let message = `📍 Информация о товаре:\n\n`
                        message += `📦 ${product.name}\n`
                        message += `🔖 ${product.sku}\n\n`
                        message += `📊 Общий остаток: ${totalQty} шт.\n`
                        message += `📌 Мин: ${minStock}\n`
                        message += `📌 Макс: ${maxStock}\n\n`
                        
                        if (stock.length > 0) {
                          message += `📍 Места хранения:\n`
                          stock.forEach(s => {
                            message += `  • ${s.cell_code}: ${s.quantity} шт.\n`
                          })
                        } else {
                          message += `⚠️ Товар не размещён на складе`
                        }
                        
                        message += `\n\n${totalQty < minStock ? '⚠️ Требуется пополнение!' : totalQty > maxStock ? '📦 Переизбыток!' : '✅ Норма'}`
                        
                        alert(message)
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                      title="Показать информацию"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  )}

                  {/* ❌ Удалить */}
                  <button
                    type="button"
                    onClick={() => editingDoc ? setEditItems(prev => prev.filter((_, i) => i !== idx)) : setDocItems(prev => prev.filter((_, i) => i !== idx))}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Удалить позицию"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )
            })}
            
            {(editingDoc ? editItems : docItems).length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-300">
                Кликните на товар в списке выше для добавления
              </div>
            )}
          </div>
          
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSubmitting || (editingDoc ? editItems : docItems).length === 0} className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {isSubmitting ? 'Сохранение...' : (editingDoc ? 'Сохранить изменения' : 'Создать документ')}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingDoc(null); setDocItems([]); setEditItems([]) }} className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium">Отмена</button>
          </div>
        </form>
      )}

      {/* 📋 СПИСОК ДОКУМЕНТОВ */}
      {isLoading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 mx-auto"></div></div>
      ) : Object.keys(filteredAndGroupedDocs).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Документы не найдены.</p>
          {activeFiltersCount > 0 && <button onClick={resetFilters} className="mt-2 text-sm text-indigo-600 hover:underline">Сбросить фильтры</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(filteredAndGroupedDocs).map(([dateKey, dayDocs]) => (
            <div key={dateKey}>
              {/* 🔵 СИНЯЯ ПОЛОСКА ДАТЫ (как в заказах) */}
              <div className="sticky top-0 z-10 bg-indigo-50/95 backdrop-blur-sm px-4 py-2.5 border-b-2 border-indigo-200 flex items-center gap-2 rounded-t-lg">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">{dateKey}</h3>
                <span className="text-xs text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-full font-medium">
                  {dayDocs.length} {dayDocs.length === 1 ? 'документ' : dayDocs.length < 5 ? 'документа' : 'документов'}
                </span>
              </div>
              
              <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-12">№</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">№ документа</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Тип</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Время</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Инфо</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dayDocs.map((doc, idx) => {
                      const status = statusConfig[doc.status] || statusConfig.draft
                      const isDraft = doc.status === 'draft'
                      return (
                        <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">{idx + 1}.</td>
                          <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{doc.doc_number}</td>
                          <td className="px-4 py-3 text-sm">{typeLabels[doc.type] || doc.type}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              <status.icon className="w-3 h-3" /> {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatTime(doc.created_at)}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleViewDetails(doc.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Посмотреть содержимое">
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {isDraft && hasRole(['admin', 'warehouse_manager']) && (
                                <>
                                  <button onClick={() => handleEdit(doc.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Редактировать"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleCancel(doc.id)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Отменить"><XCircle className="w-4 h-4" /></button>
                                  <button onClick={() => handleDelete(doc.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Удалить"><Trash2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleComplete(doc.id)} className="ml-1 text-green-700 hover:text-green-900 text-xs font-medium hover:underline px-2 py-1">Провести</button>
                                </>
                              )}
                              {!isDraft && <span className="text-gray-400 text-xs">—</span>}
                            </div>
                          </td>
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

      {/* Модальное окно просмотра */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">{typeLabels[selectedDoc.type] || 'Документ'}: {selectedDoc.doc_number}</h3>
                <p className="text-xs text-gray-500 mt-1">Статус: <span className="font-medium">{statusConfig[selectedDoc.status]?.label}</span></p>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {isDetailsLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent"></div></div>
              ) : (
                <div className="space-y-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="px-4 py-2.5 text-left rounded-l-lg">Товар</th>
                        <th className="px-4 py-2.5 text-center">Кол-во</th>
                        <th className="px-4 py-2.5 text-right rounded-r-lg">Примечание</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedDoc.items?.map((item: any, idx: number) => {
                        const fromCell = getCellById(item.from_cell_id)
                        const toCell = getCellById(item.to_cell_id)
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{item.product_name || `Товар #${item.product_id}`}<div className="text-xs text-gray-400 font-mono">{item.product_sku || ''}</div></td>
                            <td className="px-4 py-3 text-center font-semibold text-indigo-600">{item.quantity} шт.</td>
                            <td className="px-4 py-3 text-right text-xs text-gray-500">
                              {fromCell && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">📤 {fromCell.code}</span>}
                              {toCell && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg ml-1">📥 {toCell.code}</span>}
                            </td>
                          </tr>
                        )
                      })}
                      {(!selectedDoc.items || selectedDoc.items.length === 0) && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Нет позиций</td></tr>}
                    </tbody>
                  </table>
                  {selectedDoc.comment && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                      💬 Комментарий: {selectedDoc.comment}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button onClick={() => setSelectedDoc(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}