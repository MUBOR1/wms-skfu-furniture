import { useEffect, useState, useMemo } from 'react'
import { inventory, catalog } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { 
  ClipboardCheck, Plus, CheckCircle, AlertTriangle, Search, 
  X, Save, RotateCcw, Eye, Trash2, Package, XCircle, Filter
} from 'lucide-react'

// 🔧 ТИПЫ
type InventoryStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled'

interface InventoryRecord {
  product_id: number
  product_name: string
  sku: string
  category: string
  system_qty: number
  actual_qty: number
  diff: number
  comment?: string
}

interface InventoryAudit {
  id: number
  doc_number: string
  status: InventoryStatus
  created_at: string
  updated_at: string
  records: InventoryRecord[]
  created_by: string
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning'
}

// 🔧 ДЕФОЛТНЫЕ ДАННЫЕ
const MOCK_AUDITS: InventoryAudit[] = [
  { id: 1, doc_number: 'INV-2026-001', status: 'completed', created_at: '2026-06-08T10:00:00', updated_at: '2026-06-08T14:30:00', records: [{ product_id: 1, product_name: 'Стеллаж металлический', sku: 'SHF-001', category: 'Мебель', system_qty: 15, actual_qty: 14, diff: -1 }], created_by: 'Администратор' },
  { id: 2, doc_number: 'INV-2026-002', status: 'in_progress', created_at: '2026-06-09T08:00:00', updated_at: '2026-06-09T08:00:00', records: [{ product_id: 2, product_name: 'Кресло офисное', sku: 'CHR-ERG-002', category: 'Мебель', system_qty: 12, actual_qty: 12, diff: 0 }], created_by: 'Иванов С.П.' },
]

const STATUS_CONFIG: Record<InventoryStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-700', icon: ClipboardCheck },
  in_progress: { label: 'В процессе', color: 'bg-blue-100 text-blue-700', icon: RotateCcw },
  completed: { label: 'Завершена', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Отменена', color: 'bg-red-100 text-red-700', icon: X },
}

export default function InventoryPage() {
  const { user } = useAuth()
  const [audits, setAudits] = useState<InventoryAudit[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  
  // Фильтры таблицы
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  
  // Поиск товаров в модалке
  const [productSearch, setProductSearch] = useState('')
  const [modalCategoryFilter, setModalCategoryFilter] = useState<string>('all')
  
  // Модалка
  const [showModal, setShowModal] = useState(false)
  const [editingAudit, setEditingAudit] = useState<InventoryAudit | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Форма
  const [formData, setFormData] = useState({
    doc_number: '',
    records: [] as InventoryRecord[]
  })

  // 🔧 УВЕДОМЛЕНИЯ
  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  // 🔧 КОРРЕКТИРОВКА ОСТАТКОВ (без API, только имитация)
  const applyInventoryCorrections = async (records: InventoryRecord[]) => {
    const corrections = records.filter(r => r.diff !== 0)
    
    if (corrections.length === 0) {
      addToast('Нет расхождений, корректировка не требуется', 'success')
      return { successCount: 0, errorCount: 0 }
    }

    let successCount = 0

    for (const record of corrections) {
      // Имитация корректировки (без реального API)
      console.log(`${record.diff > 0 ? '➕ Добавление' : '➖ Списание'} ${record.product_name}: ${Math.abs(record.diff)} шт.`)
      
      // Обновляем локальный остаток
      setProducts(prev => prev.map(p => 
        p.id === record.product_id 
          ? { ...p, quantity: record.actual_qty }
          : p
      ))
      
      addToast(`${record.diff > 0 ? '➕' : '➖'} ${record.product_name}: ${Math.abs(record.diff)} шт.`, 'success')
      successCount++
    }
    
    return { successCount, errorCount: 0 }
  }

  // 🔧 ЗАГРУЗКА ДАННЫХ
  useEffect(() => {
    const load = async () => {
      try {
        const [auditsRes, productsRes] = await Promise.all([
          inventory.list().catch(() => MOCK_AUDITS),
          catalog.products()
        ])
        
        const savedAudits = localStorage.getItem('wms_inventory_audits')
        if (savedAudits) {
          try {
            setAudits(JSON.parse(savedAudits))
          } catch {
            setAudits(Array.isArray(auditsRes) ? auditsRes : MOCK_AUDITS)
          }
        } else {
          setAudits(Array.isArray(auditsRes) ? auditsRes : MOCK_AUDITS)
        }
        
        const productsList = Array.isArray(productsRes) ? productsRes : []
        setProducts(productsList)
        
        const uniqueCategories = [...new Set(productsList.map(p => p.category).filter(Boolean))] as string[]
        setCategories(uniqueCategories)
        
      } catch (err) {
        console.error('Inventory load error:', err)
        const saved = localStorage.getItem('wms_inventory_audits')
        setAudits(saved ? JSON.parse(saved) : MOCK_AUDITS)
      }
    }
    load()
  }, [])

  // 🔧 АВТОСОХРАНЕНИЕ
  useEffect(() => {
    if (audits.length > 0) {
      localStorage.setItem('wms_inventory_audits', JSON.stringify(audits))
    }
  }, [audits])

  // 🔧 ФИЛЬТР ТОВАРОВ В МОДАЛКЕ
  const filteredProducts = useMemo(() => {
    let filtered = products
    
    if (productSearch) {
      const searchLower = productSearch.toLowerCase()
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchLower) || 
        p.sku?.toLowerCase().includes(searchLower)
      )
    }
    
    if (modalCategoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === modalCategoryFilter)
    }
    
    return filtered
  }, [products, productSearch, modalCategoryFilter])

  // 🔧 ФИЛЬТРАЦИЯ ТАБЛИЦЫ
  const filteredAudits = useMemo(() => {
    let filtered = audits
    
    if (search) {
      filtered = filtered.filter(a => 
        a.doc_number.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter)
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(a => 
        a.records?.some(r => r.category === categoryFilter)
      )
    }
    
    return filtered
  }, [audits, search, statusFilter, categoryFilter])

  // 🔧 СТАТИСТИКА
  const stats = useMemo(() => ({
    total: audits.length,
    inProgress: audits.filter(a => a.status === 'in_progress').length,
    completed: audits.filter(a => a.status === 'completed').length,
    discrepancies: audits.reduce((sum, a) => {
      if (!a.records || !Array.isArray(a.records)) return sum
      return sum + a.records.filter(r => r.diff !== 0).length
    }, 0)
  }), [audits])

  // 🔧 ДОБАВИТЬ ТОВАР
  const addSpecificProduct = (product: any) => {
    const exists = formData.records.some(r => r.product_id === product.id)
    if (exists) {
      addToast('Товар уже добавлен', 'warning')
      return
    }
    
    setFormData(prev => ({
      ...prev,
      records: [...prev.records, {
        product_id: product.id,
        product_name: product.name || '',
        sku: product.sku || '',
        category: product.category || 'Без категории',
        system_qty: product.quantity || 0,
        actual_qty: product.quantity || 0,
        diff: 0
      }]
    }))
    
    addToast(`Товар "${product.name}" добавлен`, 'success')
  }

  // 🔧 ОБНОВИТЬ ЗАПИСЬ
  const updateRecord = (idx: number, field: keyof InventoryRecord, value: any) => {
    setFormData(prev => {
      const updated = [...prev.records]
      updated[idx] = { ...updated[idx], [field]: value }
      
      if (field === 'actual_qty' || field === 'product_id') {
        if (field === 'product_id') {
          const product = products.find(p => p.id === value)
          if (product) {
            updated[idx].product_name = product.name || ''
            updated[idx].sku = product.sku || ''
            updated[idx].category = product.category || 'Без категории'
            updated[idx].system_qty = product.quantity || 0
          }
        }
        const actualQty = parseInt(String(updated[idx].actual_qty)) || 0
        updated[idx].diff = actualQty - updated[idx].system_qty
      }
      
      return { ...prev, records: updated }
    })
  }

  // 🔧 УДАЛИТЬ ЗАПИСЬ
  const removeRecord = (idx: number) => {
    setFormData(prev => ({ ...prev, records: prev.records.filter((_, i) => i !== idx) }))
    addToast('Позиция удалена', 'warning')
  }

  // 🔧 СОХРАНЕНИЕ
  const handleSave = async (newStatus: InventoryStatus) => {
    if (formData.records.length === 0) {
      addToast('Добавьте хотя бы одну позицию', 'error')
      return
    }

    setIsSaving(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const newAudit: InventoryAudit = {
        id: editingAudit?.id || Math.max(0, ...audits.map(a => a.id), 0) + 1,
        doc_number: formData.doc_number || `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
        status: newStatus,
        created_at: editingAudit?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        records: formData.records,
        created_by: user?.full_name || user?.login || 'Администратор'
      }

      // 🔧 ЕСЛИ ЗАВЕРШАЕМ - ПРИМЕНЯЕМ КОРРЕКТИРОВКУ
      if (newStatus === 'completed') {
        const { successCount, errorCount } = await applyInventoryCorrections(formData.records)
        
        if (errorCount > 0) {
          addToast(`⚠️ Частичная корректировка: ${successCount} успешно, ${errorCount} ошибок`, 'warning')
        } else if (successCount > 0) {
          addToast(`✅ Корректировка завершена: изменено ${successCount} позиций`, 'success')
        }
      }

      if (editingAudit) {
        setAudits(prev => prev.map(a => a.id === editingAudit.id ? newAudit : a))
        addToast('Ведомость обновлена')
      } else {
        setAudits(prev => [newAudit, ...prev])
        addToast(newStatus === 'completed' ? 'Инвентаризация завершена, остатки скорректированы' : 'Ведомость сохранена')
      }
      
      setShowModal(false)
      setEditingAudit(null)
      setFormData({ doc_number: '', records: [] })
      setModalCategoryFilter('all')
      setProductSearch('')
      
    } catch (err) {
      addToast('Ошибка сохранения', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // 🔧 СМЕНА СТАТУСА
  const updateStatus = async (id: number, newStatus: InventoryStatus) => {
    setAudits(prev => prev.map(a => a.id === id ? { ...a, status: newStatus, updated_at: new Date().toISOString() } : a))
    addToast(`Статус изменён на "${STATUS_CONFIG[newStatus].label}"`)
  }

  // 🔧 УДАЛЕНИЕ
  const deleteAudit = (id: number) => {
    if (confirm('Удалить ведомость? Это действие нельзя отменить.')) {
      setAudits(prev => prev.filter(a => a.id !== id))
      addToast('Ведомость удалена')
    }
  }

  // 🔧 СБРОС ФИЛЬТРОВ
  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setCategoryFilter('all')
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const activeFiltersCount = [search, statusFilter !== 'all', categoryFilter !== 'all'].filter(Boolean).length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-indigo-600" />
            Инвентаризация
          </h1>
          <p className="text-gray-500 mt-1">Сверка фактических остатков с системными данными и корректировка расхождений</p>
        </div>
        <button 
          onClick={() => {
            setEditingAudit(null)
            setFormData({ doc_number: '', records: [] })
            setModalCategoryFilter('all')
            setProductSearch('')
            setShowModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Новая инвентаризация
        </button>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardCheck className="w-5 h-5 text-blue-600" />} value={stats.total} label="Всего ведомостей" color="blue" />
        <StatCard icon={<RotateCcw className="w-5 h-5 text-yellow-600" />} value={stats.inProgress} label="В процессе" color="yellow" />
        <StatCard icon={<CheckCircle className="w-5 h-5 text-green-600" />} value={stats.completed} label="Завершено" color="green" />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-red-600" />} value={stats.discrepancies} label="Расхождений" color="red" />
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <h4 className="font-medium text-gray-700 text-sm">Фильтры</h4>
          </div>
          {activeFiltersCount > 0 && (
            <button onClick={resetFilters} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline">
              Сбросить все ({activeFiltersCount})
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Поиск по номеру ведомости..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
          
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value as InventoryStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
          >
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="in_progress">В процессе</option>
            <option value="completed">Завершена</option>
            <option value="cancelled">Отменена</option>
          </select>
          
          <select 
            value={categoryFilter} 
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
          >
            <option value="all">Все категории</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Таблица ведомостей */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">№ Ведомости</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Позиций</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Расхождения</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Создана</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAudits.map(audit => {
                const StatusIcon = STATUS_CONFIG[audit.status].icon
                const discrepancies = audit.records?.filter(r => r.diff !== 0).length || 0
                const categoriesList = [...new Set(audit.records?.map(r => r.category).filter(Boolean))].join(', ')
                
                return (
                  <tr key={audit.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{audit.doc_number}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[audit.status].color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {STATUS_CONFIG[audit.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={categoriesList}>
                      {categoriesList || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{audit.records?.length || 0} шт.</td>
                    <td className="px-4 py-3">
                      {discrepancies > 0 ? (
                        <span className="text-red-600 font-medium text-sm flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> {discrepancies}
                        </span>
                      ) : (
                        <span className="text-green-600 font-medium text-sm flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> 0
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(audit.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            setEditingAudit(audit)
                            setFormData({ doc_number: audit.doc_number, records: audit.records || [] })
                            setShowModal(true)
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Просмотреть"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {audit.status === 'draft' && (
                          <button onClick={() => updateStatus(audit.id, 'in_progress')} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="Начать">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {audit.status === 'in_progress' && (
                          <button onClick={() => updateStatus(audit.id, 'completed')} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Завершить">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {(audit.status === 'draft' || audit.status === 'in_progress') && (
                          <button onClick={() => updateStatus(audit.id, 'cancelled')} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Отменить">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {audit.status === 'draft' && (
                          <button onClick={() => deleteAudit(audit.id)} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Удалить">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredAudits.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">Ведомости не найдены</p>
                    <p className="text-sm text-gray-400 mt-1">Создайте новую инвентаризацию для начала сверки</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модалка */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {editingAudit ? <Eye className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                {editingAudit ? `Ведомость ${editingAudit.doc_number}` : 'Новая инвентаризация'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Основная информация */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Номер ведомости</label>
                  <input 
                    type="text" 
                    value={formData.doc_number}
                    onChange={e => setFormData({...formData, doc_number: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="INV-2026-XXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ответственный</label>
                  <input 
                    type="text" 
                    value={user?.full_name || user?.login || 'Администратор'}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Поиск товаров */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Добавить товар</label>
                <div className="flex gap-3 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Поиск по SKU или названию..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <select 
                    value={modalCategoryFilter}
                    onChange={e => setModalCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="all">Все категории</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(product => {
                      const isAlreadyAdded = formData.records.some(r => r.product_id === product.id)
                      return (
                        <button
                          key={product.id}
                          onClick={() => addSpecificProduct(product)}
                          disabled={isAlreadyAdded}
                          className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                            isAlreadyAdded 
                              ? 'bg-gray-100 cursor-not-allowed opacity-60' 
                              : 'bg-white hover:bg-indigo-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isAlreadyAdded ? 'bg-gray-200' : 'bg-indigo-100'
                            }`}>
                              <Package className={`w-4 h-4 ${isAlreadyAdded ? 'text-gray-400' : 'text-indigo-600'}`} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-900">{product.name}</p>
                              <div className="flex gap-3 text-xs text-gray-500">
                                <span>{product.sku}</span>
                                <span>•</span>
                                <span>{product.category || 'Без категории'}</span>
                                <span>•</span>
                                <span>Остаток: {product.quantity || 0} шт.</span>
                              </div>
                            </div>
                          </div>
                          {isAlreadyAdded ? (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          ) : (
                            <Plus className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )}
                        </button>
                      )
                    })
                  ) : (
                    <p className="text-center text-gray-500 text-sm py-6">Товары не найдены</p>
                  )}
                </div>
              </div>

              {/* Таблица добавленных товаров */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Позиции для пересчёта ({formData.records.length})</h4>
                </div>

                {formData.records.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Выберите товары из списка выше для сверки остатков</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 rounded-lg">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Товар</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 w-24">Система</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 w-28">Факт</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 w-20">Разница</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Комментарий</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-600 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {formData.records.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-900 truncate max-w-[200px]" title={rec.product_name}>
                                {rec.product_name}
                              </p>
                              <p className="text-xs text-gray-400">{rec.sku} • {rec.category}</p>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="font-mono font-medium text-gray-900">{rec.system_qty}</span>
                              <span className="text-xs text-gray-400 ml-0.5">шт.</span>
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="number" 
                                min="0"
                                value={rec.actual_qty}
                                onChange={e => updateRecord(idx, 'actual_qty', parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-sm font-bold w-full ${
                                rec.diff > 0 ? 'bg-green-100 text-green-700' :
                                rec.diff < 0 ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {rec.diff > 0 ? `+${rec.diff}` : rec.diff}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                placeholder="—"
                                value={rec.comment || ''}
                                onChange={e => updateRecord(idx, 'comment', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => removeRecord(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Сводка */}
              {formData.records.length > 0 && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-indigo-900">Итого по ведомости</p>
                    <p className="text-xs text-indigo-700">Позиций: {formData.records.length} • Расхождений: {formData.records.filter(r => r.diff !== 0).length}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-lg ${
                      formData.records.filter(r => r.diff !== 0).length === 0 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {formData.records.filter(r => r.diff !== 0).length === 0 ? '✅ Всё сходится' : `⚠️ ${formData.records.filter(r => r.diff !== 0).length} расхождений`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={() => handleSave('draft')}
                disabled={isSaving || formData.records.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium transition-colors"
              >
                <Save className="w-4 h-4" /> Сохранить черновик
              </button>
              <button 
                onClick={() => handleSave('completed')}
                disabled={isSaving || formData.records.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> {isSaving ? 'Завершение...' : 'Завершить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Уведомления */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-4 ${
              toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
              toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
             toast.type === 'error' ? <XCircle className="w-4 h-4" /> :
             <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Компонент карточки статистики
function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  const colorMap: Record<string, string> = { 
    blue: 'bg-blue-50 text-blue-600 border-blue-200', 
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200', 
    green: 'bg-green-50 text-green-600 border-green-200', 
    red: 'bg-red-50 text-red-600 border-red-200' 
  }
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg border ${colorMap[color]}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600 font-medium mt-1">{label}</p>
    </div>
  )
}