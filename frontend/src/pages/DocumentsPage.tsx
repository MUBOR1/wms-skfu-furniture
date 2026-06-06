import { useEffect, useState, useMemo } from 'react'
import { documents, catalog } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { 
  FileText, Plus, CheckCircle, Clock, XCircle, Eye, Edit2, Trash2, X, Save, 
  Search, Filter, Calendar, XCircle as XIcon 
} from 'lucide-react'

// 🔧 Форматирование даты для отображения в таблице (время)
const formatTime = (date: string | null | undefined): string => {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

// 🔧 Форматирование даты для группировки (ключ)
const formatDateKey = (date: string | null | undefined): string => {
  if (!date) return 'Неизвестно'
  try {
    return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return 'Неизвестно' }
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

const typeLabels: Record<string, string> = {
  receive: '📥 Приёмка', 
  ship: '📤 Отгрузка', 
  transfer: '🔄 Перемещение',
  adjust: '⚙️ Корректировка'
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-700', icon: Clock },
  in_progress: { label: 'В работе', color: 'bg-blue-100 text-blue-700', icon: Clock },
  completed: { label: 'Проведён', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700', icon: XCircle },
}

// Список типов для фильтра
const documentTypes = [
  { value: 'all', label: 'Все типы' },
  { value: 'receive', label: '📥 Приёмка' },
  { value: 'ship', label: '📤 Отгрузка' },
  { value: 'transfer', label: '🔄 Перемещение' },
  { value: 'adjust', label: '⚙️ Корректировка' },
]

export default function DocumentsPage() {
  const { hasRole } = useAuth()
  const [docs, setDocs] = useState<DocItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [cells, setCells] = useState<Cell[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Состояния формы
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newDoc, setNewDoc] = useState({ type: 'receive', comment: '' }) 
  const [docItems, setDocItems] = useState<Array<{ 
    product_id: number; quantity: number; from_cell_id?: number; to_cell_id?: number 
  }>>([])
  
  // Для просмотра и редактирования
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)
  const [editingDoc, setEditingDoc] = useState<any | null>(null)
  const [editItems, setEditItems] = useState<any[]>([])

  // 🔍 ФИЛЬТРЫ И ПОИСК
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

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
    } catch (err) { console.error(err) }
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

  // 🔧 ФИЛЬТРАЦИЯ И ГРУППИРОВКА
  const filteredAndGroupedDocs = useMemo(() => {
    let filtered = [...docs]
    
    // Поиск по номеру
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(d => d.doc_number?.toLowerCase().includes(q))
    }
    
    // Фильтр по типу
    if (typeFilter !== 'all') {
      filtered = filtered.filter(d => d.type === typeFilter)
    }
    
    // Фильтр по датам
    if (dateFrom) {
      const from = new Date(dateFrom)
      filtered = filtered.filter(d => d.created_at && new Date(d.created_at) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      filtered = filtered.filter(d => d.created_at && new Date(d.created_at) <= to)
    }
    
    // Сортировка: новые сверху
    filtered.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
      return dateB - dateA
    })
    
    // Группировка по датам
    const grouped: Record<string, DocItem[]> = {}
    for (const doc of filtered) {
      const dateKey = formatDateKey(doc.created_at)
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(doc)
    }
    
    return grouped
  }, [docs, searchQuery, typeFilter, dateFrom, dateTo])

  // Сброс фильтров
  const resetFilters = () => {
    setSearchQuery('')
    setTypeFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const activeFiltersCount = [
    searchQuery.trim(),
    typeFilter !== 'all',
    dateFrom,
    dateTo
  ].filter(Boolean).length

  // 🔧 Вспомогательная функция для безопасного отображения ошибок
  const getErrorMessage = (err: any): string => {
    console.error('🔴 Full error:', err)
    if (typeof err === 'string') return err
    if (err?.message) return err.message
    if (err?.detail) {
      return typeof err.detail === 'object' ? JSON.stringify(err.detail) : err.detail
    }
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

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) return
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
    }
    else if (docType === 'ship') {
      return { from_cell_id: cells[0]?.id, to_cell_id: undefined }
    }
    else if (docType === 'transfer') {
      return { from_cell_id: cells[0]?.id, to_cell_id: cells[1]?.id }
    }
    else if (docType === 'adjust') {
      return { from_cell_id: undefined, to_cell_id: cells[0]?.id }
    }
    return { from_cell_id: undefined, to_cell_id: undefined }
  }

  const addDocItem = () => {
    const baseItem = { product_id: products[0]?.id || 1, quantity: 1, ...getDefaultCells(newDoc.type) }
    setDocItems(prev => [...prev, baseItem])
  }
  
  const addEditItem = () => {
    const baseItem = { product_id: products[0]?.id || 1, quantity: 1, ...getDefaultCells(editingDoc?.type) }
    setEditItems(prev => [...prev, baseItem])
  }
  
  const updateDocItem = (idx: number, field: string, value: any) => {
    setDocItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u })
  }
  
  const updateEditItem = (idx: number, field: string, value: any) => {
    setEditItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u })
  }

  const currentType = (editingDoc || newDoc).type

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 🔝 ЗАГОЛОВОК И КНОПКИ */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">📄 Складские документы</h2>
        
        <div className="flex items-center gap-2">
          {hasRole(['admin', 'warehouse_manager']) && (
            <>
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
              
              {/* ➕ Создать документ */}
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Поиск по номеру */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по номеру..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            
            {/* Фильтр по типу */}
            <select 
              value={typeFilter} 
              onChange={e => setTypeFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {documentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            
            {/* Дата от */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
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
              />
            </div>
          </div>
          
          {/* Теги активных фильтров */}
          {(searchQuery || typeFilter !== 'all' || dateFrom || dateTo) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  Поиск: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
              {typeFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  Тип: {documentTypes.find(t => t.value === typeFilter)?.label}
                  <button onClick={() => setTypeFilter('all')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  От: {dateFrom}
                  <button onClick={() => setDateFrom('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                  До: {dateTo}
                  <button onClick={() => setDateTo('')} className="hover:text-red-500"><XIcon className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Форма создания/редактирования */}
      {(showForm || editingDoc) && (
        <form onSubmit={editingDoc ? handleUpdate : handleCreate} 
              className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <h3 className="font-bold text-lg">{editingDoc ? '✏️ Редактирование' : '➕ Создание'} документа</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select 
              value={currentType} 
              onChange={e => {
                const newType = e.target.value
                if (editingDoc) {
                  setEditingDoc({...editingDoc, type: newType})
                } else {
                  setNewDoc({...newDoc, type: newType})
                  setDocItems([])
                }
              }} 
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="receive">📥 Приёмка</option>
              <option value="ship">📤 Отгрузка</option>
              <option value="transfer">🔄 Перемещение</option>
              <option value="adjust">⚙️ Корректировка</option>
            </select>
            <input 
              placeholder="Комментарий" 
              value={(editingDoc || newDoc).comment} 
              onChange={e => editingDoc 
                ? setEditingDoc({...editingDoc, comment: e.target.value}) 
                : setNewDoc({...newDoc, comment: e.target.value})} 
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
            />
          </div>
          
          <div className={`p-3 rounded-lg text-sm border ${
            currentType === 'receive' ? 'bg-green-50 border-green-200 text-green-800' :
            currentType === 'ship' ? 'bg-red-50 border-red-200 text-red-800' :
            currentType === 'transfer' ? 'bg-blue-50 border-blue-200 text-blue-800' :
            'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            {currentType === 'receive' && '📥 Приёмка: товар поступает на склад. Укажите ячейку, куда разместить товар (по умолчанию: зона приёмки).'}
            {currentType === 'ship' && '📤 Отгрузка: товар уходит со склада. Укажите ячейку, из которой списать товар.'}
            {currentType === 'transfer' && '🔄 Перемещение: товар переезжает между ячейками. Укажите ОБЕ ячейки — откуда и куда.'}
            {currentType === 'adjust' && '⚙️ Корректировка: ручное изменение остатков. Положительное число = оприходование, отрицательное = списание.'}
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700">Позиции документа</h4>
              <button type="button" onClick={editingDoc ? addEditItem : addDocItem} 
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Добавить позицию</button>
            </div>
            
            {(editingDoc ? editItems : docItems).map((item, idx) => (
              <div key={idx} className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
                  <select 
                    value={item.product_id} 
                    onChange={e => editingDoc 
                      ? updateEditItem(idx, 'product_id', +e.target.value) 
                      : updateDocItem(idx, 'product_id', +e.target.value)} 
                    className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                  </select>
                  
                  <input 
                    type="number" 
                    placeholder={currentType === 'adjust' ? "Кол-во (- для списания)" : "Кол-во"} 
                    value={item.quantity} 
                    onChange={e => editingDoc 
                      ? updateEditItem(idx, 'quantity', +e.target.value) 
                      : updateDocItem(idx, 'quantity', +e.target.value)} 
                    className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none" 
                    required 
                  />
                  
                  {(currentType === 'ship' || currentType === 'transfer') && (
                    <select 
                      value={item.from_cell_id || ''} 
                      onChange={e => editingDoc 
                        ? updateEditItem(idx, 'from_cell_id', +e.target.value || undefined) 
                        : updateDocItem(idx, 'from_cell_id', +e.target.value || undefined)} 
                      className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">📤 Из ячейки</option>
                      {cells.map((c: Cell) => <option key={c.id} value={c.id}>📍 {c.code}</option>)}
                    </select>
                  )}
                  
                  {(currentType === 'receive' || currentType === 'transfer' || currentType === 'adjust') && (
                    <select 
                      value={item.to_cell_id || ''} 
                      onChange={e => editingDoc 
                        ? updateEditItem(idx, 'to_cell_id', +e.target.value || undefined) 
                        : updateDocItem(idx, 'to_cell_id', +e.target.value || undefined)} 
                      className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">📥 В ячейку</option>
                      {cells.map((c: Cell) => <option key={c.id} value={c.id}>📍 {c.code}</option>)}
                    </select>
                  )}
                  
                  <button type="button" onClick={() => editingDoc 
                    ? setEditItems(prev => prev.filter((_, i) => i !== idx)) 
                    : setDocItems(prev => prev.filter((_, i) => i !== idx))} 
                          className="text-red-500 hover:text-red-700 p-2 self-center">✕</button>
                </div>
              </div>
            ))}
            
            {(editingDoc ? editItems : docItems).length === 0 && (
              <p className="text-sm text-gray-400 py-2 text-center">
                Нажмите «+ Добавить позицию» чтобы добавить товар в документ
              </p>
            )}
          </div>
          
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSubmitting || (editingDoc ? editItems : docItems).length === 0} 
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {isSubmitting ? 'Сохранение...' : (editingDoc ? 'Сохранить изменения' : 'Создать документ')}
            </button>
            <button type="button" onClick={() => { 
              setShowForm(false); setEditingDoc(null); setDocItems([]); setEditItems([])
            }} 
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* 📋 СПИСОК ДОКУМЕНТОВ С ГРУППИРОВКОЙ */}
      {isLoading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></div>
      ) : Object.keys(filteredAndGroupedDocs).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Документы не найдены. Попробуйте изменить фильтры.</p>
          {activeFiltersCount > 0 && (
            <button onClick={resetFilters} className="mt-2 text-sm text-indigo-600 hover:underline">Сбросить фильтры</button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(filteredAndGroupedDocs).map(([dateKey, dayDocs]) => (
            <div key={dateKey}>
              {/* 🗓️ ЗАГОЛОВОК ДАТЫ */}
              <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-700">{dateKey}</h3>
                <span className="text-xs text-gray-400">({dayDocs.length} {dayDocs.length === 1 ? 'документ' : dayDocs.length < 5 ? 'документа' : 'документов'})</span>
              </div>
              
              {/* 📄 ТАБЛИЦА ЗА ДЕНЬ */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                          <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">
                            {idx + 1}.
                          </td>
                          <td className="px-4 py-3 font-mono text-sm font-medium">{doc.doc_number}</td>
                          <td className="px-4 py-3">{typeLabels[doc.type] || doc.type}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${status.color}`}>
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
                                  <button onClick={() => handleEdit(doc.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Редактировать">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDelete(doc.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Удалить">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleComplete(doc.id)} className="ml-2 text-green-600 hover:text-green-800 text-xs font-medium hover:underline px-2 py-1">
                                    Провести
                                  </button>
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
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  {typeLabels[selectedDoc.type] || 'Документ'}: {selectedDoc.doc_number}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Статус: <span className="font-medium">{statusConfig[selectedDoc.status]?.label}</span></p>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {isDetailsLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent"></div></div>
              ) : (
                <div className="space-y-4">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="px-4 py-2 text-left rounded-l-md">Товар</th>
                        <th className="px-4 py-2 text-center">Кол-во</th>
                        <th className="px-4 py-2 text-right rounded-r-md">Примечание</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedDoc.items?.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">
                            {item.product?.name || item.product_name || `Товар #${item.product_id}`}
                            <div className="text-xs text-gray-400 font-mono">{item.product?.sku || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-indigo-600">{item.quantity} шт.</td>
                          <td className="px-4 py-3 text-right text-xs text-gray-500">
                            {item.from_cell_id && <span>Из: {item.from_cell_id} </span>}
                            {item.to_cell_id && <span>В: {item.to_cell_id}</span>}
                          </td>
                        </tr>
                      ))}
                      {(!selectedDoc.items || selectedDoc.items.length === 0) && (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Нет позиций</td></tr>
                      )}
                    </tbody>
                  </table>
                  {selectedDoc.comment && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      💬 Комментарий: {selectedDoc.comment}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setSelectedDoc(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}