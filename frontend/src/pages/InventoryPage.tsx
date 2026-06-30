import { useEffect, useState, useMemo } from 'react'
import { inventory, catalog, request } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { 
  ClipboardCheck, Plus, CheckCircle, AlertTriangle, Search, 
  X, Save, RotateCcw, Eye, Trash2, Package, XCircle
} from 'lucide-react'

type InventoryStatus = 'draft' | 'completed'

interface InventoryRecord {
  product_id: number
  product_name: string
  sku: string
  category: string
  planned_qty: number
  actual_qty: number
  diff: number
  comment?: string
}

interface InventoryAudit {
  id: number
  doc_number: string
  status: InventoryStatus
  created_at: string
  operator_id: number
  category?: string
  comment?: string
  records?: InventoryRecord[]
}

const STATUS_CONFIG: Record<InventoryStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-700', icon: ClipboardCheck },
  completed: { label: 'Завершена', color: 'bg-green-100 text-green-700', icon: CheckCircle },
}

export default function InventoryPage() {
  const { } = useAuth()
  const [audits, setAudits] = useState<InventoryAudit[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [toasts, setToasts] = useState<{id: number; message: string; type: 'success' | 'error' | 'warning'}[]>([])
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  
  const [productSearch, setProductSearch] = useState('')
  const [modalCategoryFilter, setModalCategoryFilter] = useState<string>('all')
  
  const [showModal, setShowModal] = useState(false)
  const [editingAudit, setEditingAudit] = useState<InventoryAudit | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    doc_number: '',
    records: [] as InventoryRecord[]
  })

  const addToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  // 🔥 ЗАГРУЗКА ДАННЫХ
  useEffect(() => {
    const load = async () => {
      try {
        const auditsRes = await inventory.list()
        const auditsList = Array.isArray(auditsRes) ? auditsRes : []
        setAudits(auditsList)
        
        const productsRes = await catalog.products()
        const productsList = Array.isArray(productsRes) ? productsRes : []
        setProducts(productsList)
        
        const uniqueCategories = [...new Set(productsList.map(p => p.category).filter(Boolean))] as string[]
        setCategories(uniqueCategories)
        
      } catch (err) {
        console.error('Inventory load error:', err)
      }
    }
    load()
  }, [])

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
    return filtered
  }, [audits, search, statusFilter])

  const stats = useMemo(() => ({
    total: audits.length,
    inProgress: audits.filter(a => a.status === 'draft').length,
    completed: audits.filter(a => a.status === 'completed').length,
    discrepancies: 0
  }), [audits])

  // 🔥 СОЗДАНИЕ ИНВЕНТАРИЗАЦИИ
  const createInventory = async () => {
    try {
      const newAudit: any = await request('/inventory/', {
        method: 'POST',
        body: JSON.stringify({
          doc_number: formData.doc_number || undefined,
          category: 'Общая',
          comment: 'Создано через интерфейс'
        })
      })
      
      if (newAudit && newAudit.id) {
        // Добавляем записи
        for (const record of formData.records) {
          await request(`/inventory/${newAudit.id}/records`, {
            method: 'POST',
            body: JSON.stringify({
              product_id: record.product_id,
              actual_qty: record.actual_qty,
              cell_id: 1,
              comment: record.comment || ''
            })
          })
        }
        
        // Обновляем список
        const updatedAudits = await inventory.list()
        setAudits(Array.isArray(updatedAudits) ? updatedAudits : [])
        
        addToast('Инвентаризация создана', 'success')
        setShowModal(false)
        setEditingAudit(null)
        setFormData({ doc_number: '', records: [] })
      }
      
    } catch (err: any) {
      console.error('Error creating inventory:', err)
      addToast('Ошибка создания: ' + err.message, 'error')
    }
  }

  // 🔥 ЗАВЕРШЕНИЕ ИНВЕНТАРИЗАЦИИ
  const completeInventory = async (inventoryId: number) => {
    if (!confirm('Завершить инвентаризацию? Остатки будут обновлены.')) return
    
    try {
      await request(`/inventory/${inventoryId}/complete`, {
        method: 'POST'
      })
      
      const updatedAudits = await inventory.list()
      setAudits(Array.isArray(updatedAudits) ? updatedAudits : [])
      
      addToast('✅ Инвентаризация завершена! Остатки обновлены.', 'success')
      setShowModal(false)
      setEditingAudit(null)
      setFormData({ doc_number: '', records: [] })
      
    } catch (err: any) {
      console.error('Error completing inventory:', err)
      addToast('Ошибка завершения: ' + err.message, 'error')
    }
  }

  // 🔥 ОТКРЫТИЕ МОДАЛКИ
  const openModal = async (audit?: InventoryAudit) => {
    if (audit) {
      setEditingAudit(audit)
      
      // Загружаем записи
      try {
        const records: any = await request(`/inventory/${audit.id}/records`)
        setFormData({
          doc_number: audit.doc_number,
          records: (records || []).map((r: any) => ({
            product_id: r.product_id,
            product_name: r.product_name || 'Товар',
            sku: r.product_sku || '',
            category: '',
            planned_qty: r.planned_qty || 0,
            actual_qty: r.actual_qty || 0,
            diff: r.diff || 0,
            comment: r.comment || ''
          }))
        })
      } catch (err) {
        console.error('Error loading records:', err)
      }
    } else {
      setEditingAudit(null)
      setFormData({ doc_number: '', records: [] })
    }
    setShowModal(true)
    setModalCategoryFilter('all')
    setProductSearch('')
  }

  // 🔥 ДОБАВЛЕНИЕ ТОВАРА В ФОРМУ
  const addProductToForm = (product: any) => {
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
        planned_qty: product.quantity || 0,
        actual_qty: product.quantity || 0,
        diff: 0
      }]
    }))
    addToast(`Товар "${product.name}" добавлен`, 'success')
  }

  // 🔥 ОБНОВЛЕНИЕ ЗАПИСИ
  const updateRecord = (idx: number, field: keyof InventoryRecord, value: any) => {
    setFormData(prev => {
      const updated = [...prev.records]
      updated[idx] = { ...updated[idx], [field]: value }
      
      if (field === 'actual_qty') {
        updated[idx].diff = (parseInt(value) || 0) - updated[idx].planned_qty
      }
      
      return { ...prev, records: updated }
    })
  }

  const removeRecord = (idx: number) => {
    setFormData(prev => ({ ...prev, records: prev.records.filter((_, i) => i !== idx) }))
  }

  // 🔥 СОХРАНЕНИЕ (ЧЕРНОВИК)
  const handleSave = async () => {
    if (formData.records.length === 0) {
      addToast('Добавьте хотя бы одну позицию', 'error')
      return
    }

    setIsSaving(true)
    try {
      if (editingAudit) {
        // Обновляем существующую
        for (const record of formData.records) {
          await request(`/inventory/${editingAudit.id}/records`, {
            method: 'POST',
            body: JSON.stringify({
              product_id: record.product_id,
              actual_qty: record.actual_qty,
              cell_id: 1,
              comment: record.comment || ''
            })
          })
        }
        addToast('Записи сохранены', 'success')
        const updatedAudits = await inventory.list()
        setAudits(Array.isArray(updatedAudits) ? updatedAudits : [])
      } else {
        // Создаём новую
        await createInventory()
      }
      
    } catch (err: any) {
      addToast('Ошибка сохранения: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-indigo-600" />
            Инвентаризация
          </h1>
          <p className="text-gray-500 mt-1">Сверка фактических остатков с системными данными</p>
        </div>
        <button 
          onClick={() => openModal()}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input 
            type="text" 
            placeholder="Поиск по номеру..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value as InventoryStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
          >
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="completed">Завершена</option>
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

      {/* Таблица */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">№ Ведомости</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Создана</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAudits.map(audit => {
                const StatusIcon = STATUS_CONFIG[audit.status as InventoryStatus]?.icon || ClipboardCheck
                const statusLabel = STATUS_CONFIG[audit.status as InventoryStatus]?.label || audit.status
                const statusColor = STATUS_CONFIG[audit.status as InventoryStatus]?.color || 'bg-gray-100 text-gray-700'
                
                return (
                  <tr key={audit.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{audit.doc_number}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(audit.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => openModal(audit)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Просмотреть"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {audit.status === 'draft' && (
                          <button 
                            onClick={() => completeInventory(audit.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Завершить"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredAudits.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    <ClipboardCheck className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">Ведомости не найдены</p>
                    <p className="text-sm text-gray-400 mt-1">Создайте новую инвентаризацию</p>
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {editingAudit ? `Ведомость ${editingAudit.doc_number}` : 'Новая инвентаризация'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
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
                          onClick={() => addProductToForm(product)}
                          disabled={isAlreadyAdded}
                          className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                            isAlreadyAdded 
                              ? 'bg-gray-100 cursor-not-allowed opacity-60' 
                              : 'bg-white hover:bg-indigo-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Package className={`w-4 h-4 ${isAlreadyAdded ? 'text-gray-400' : 'text-indigo-600'}`} />
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
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <Plus className="w-5 h-5 text-gray-400" />
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
                <h4 className="font-semibold text-gray-900 mb-3">Позиции для пересчёта ({formData.records.length})</h4>

                {formData.records.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Выберите товары из списка выше</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
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
                              <p className="font-medium text-gray-900 truncate max-w-[200px]">{rec.product_name}</p>
                              <p className="text-xs text-gray-400">{rec.sku} • {rec.category}</p>
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-medium text-gray-900">{rec.planned_qty}</td>
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
                              <button onClick={() => removeRecord(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving || formData.records.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                <Save className="w-4 h-4" /> {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              {editingAudit && (
                <button 
                  onClick={() => completeInventory(editingAudit.id)}
                  disabled={formData.records.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> Завершить
                </button>
              )}
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