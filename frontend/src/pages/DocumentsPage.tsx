import { useEffect, useState } from 'react'
import { documents, catalog } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { FileText, Plus, CheckCircle, Clock, XCircle, Eye, Edit2, Trash2, X, Save } from 'lucide-react'

// 🔧 Утилита для безопасного форматирования даты
const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return '—'
  }
}

interface DocItem {
  id: number
  doc_number: string
  type: 'receive' | 'ship' | 'move' | 'adjust'
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string | null
  comment: string | null
  items?: any[]
}

const typeLabels: Record<string, string> = {
  receive: '📥 Приёмка', ship: '📤 Отгрузка', move: '🔄 Перемещение', adjust: '⚙️ Корректировка'
}
const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-700', icon: Clock },
  in_progress: { label: 'В работе', color: 'bg-blue-100 text-blue-700', icon: Clock },
  completed: { label: 'Проведён', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700', icon: XCircle },
}

export default function DocumentsPage() {
  const { hasRole } = useAuth() // ← ИСПРАВЛЕНО: используем hasRole
  const [docs, setDocs] = useState<DocItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newDoc, setNewDoc] = useState({ type: 'receive' as const, comment: '' })
  const [docItems, setDocItems] = useState<{ product_id: number; quantity: number }[]>([])
  
  // Для просмотра деталей
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)
  const [isDetailsLoading, setIsDetailsLoading] = useState(false)
  
  // 👇 Для редактирования
  const [editingDoc, setEditingDoc] = useState<any | null>(null)
  const [editItems, setEditItems] = useState<any[]>([])

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

  useEffect(() => { 
    Promise.all([loadDocs(), loadProducts()]).finally(() => setIsLoading(false))
  }, [])

  // 👇 ФУНКЦИЯ ЗАГРУЗКИ ДЕТАЛЕЙ ДОКУМЕНТА
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

  // 👇 ФУНКЦИЯ РЕДАКТИРОВАНИЯ
 const handleEdit = async (id: number) => {
  try {
    // 👇 Быстрый тип-каст без импорта DocumentDetails
    const doc = await documents.getDoc(id) as {
      id: number
      type: string
      comment: string | null
      items: any[]
    }
    setEditingDoc({ id, type: doc.type, comment: doc.comment || '' })
    setEditItems(doc.items || [])
    setShowForm(false)
    setSelectedDoc(null)
  } catch (err) {
    alert('❌ Ошибка загрузки документа')
  }
}

  // 👇 ФУНКЦИЯ УДАЛЕНИЯ
  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) return
    try {
      await documents.delete(id)
      await loadDocs()
      alert('✅ Документ удалён')
    } catch (err: any) {
      alert('❌ ' + err.message)
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
      alert('❌ ' + (err.message || 'Ошибка при создании'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // 👇 ФУНКЦИЯ ОБНОВЛЕНИЯ ДОКУМЕНТА
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
      alert('❌ ' + (err.message || 'Ошибка при обновлении'))
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
    } catch (err: any) { alert('❌ ' + (err.message || 'Ошибка')) }
  }

  const addDocItem = () => setDocItems(prev => [...prev, { product_id: products[0]?.id || 1, quantity: 1 }])
  const addEditItem = () => setEditItems(prev => [...prev, { product_id: products[0]?.id || 1, quantity: 1 }])
  
  const updateDocItem = (idx: number, field: string, value: any) => {
    setDocItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u })
  }
  const updateEditItem = (idx: number, field: string, value: any) => {
    setEditItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📄 Складские документы</h2>
        {hasRole(['admin', 'warehouse_manager']) && (
          <button onClick={() => { setShowForm(!showForm); setEditingDoc(null); if(!showForm) loadProducts() }} 
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
            <Plus className="w-4 h-4" /> {showForm ? 'Отмена' : 'Создать документ'}
          </button>
        )}
      </div>

      {/* Форма создания/редактирования */}
      {(showForm || editingDoc) && (
        <form onSubmit={editingDoc ? handleUpdate : handleCreate} 
              className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <h3 className="font-bold text-lg">{editingDoc ? '✏️ Редактирование' : '➕ Создание'} документа</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select 
              value={(editingDoc || newDoc).type} 
              onChange={e => editingDoc 
                ? setEditingDoc({...editingDoc, type: e.target.value as any}) 
                : setNewDoc({...newDoc, type: e.target.value as any})} 
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="receive">📥 Приёмка</option>
              <option value="ship">📤 Отгрузка</option>
              <option value="move">🔄 Перемещение</option>
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
          
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700">Позиции документа</h4>
              <button type="button" onClick={editingDoc ? addEditItem : addDocItem} 
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Добавить позицию</button>
            </div>
            {(editingDoc ? editItems : docItems).map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select value={item.product_id} 
                        onChange={e => editingDoc 
                          ? updateEditItem(idx, 'product_id', +e.target.value) 
                          : updateDocItem(idx, 'product_id', +e.target.value)} 
                        className="p-2 border border-gray-300 rounded-lg flex-1 focus:ring-2 focus:ring-indigo-500 outline-none">
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
                <input type="number" min="1" value={item.quantity} 
                       onChange={e => editingDoc 
                         ? updateEditItem(idx, 'quantity', +e.target.value) 
                         : updateDocItem(idx, 'quantity', +e.target.value)} 
                       className="p-2 border border-gray-300 rounded-lg w-24 focus:ring-2 focus:ring-indigo-500 outline-none" required />
                <button type="button" onClick={() => editingDoc 
                  ? setEditItems(prev => prev.filter((_, i) => i !== idx)) 
                  : setDocItems(prev => prev.filter((_, i) => i !== idx))} 
                        className="text-red-500 hover:text-red-700 p-2">✕</button>
              </div>
            ))}
            {(editingDoc ? editItems : docItems).length === 0 && <p className="text-sm text-gray-400 py-2 text-center">Нажмите «+ Добавить позицию»</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSubmitting || (editingDoc ? editItems : docItems).length === 0} 
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {isSubmitting ? 'Сохранение...' : (editingDoc ? 'Сохранить изменения' : 'Создать документ')}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingDoc(null); setDocItems([]); setEditItems([]) }} 
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
              Отмена
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Нет документов. Создайте первый!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">№ документа</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Тип</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Дата</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Инфо</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {docs.map((doc) => {
                const status = statusConfig[doc.status] || statusConfig.draft
                const isDraft = doc.status === 'draft'
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{doc.doc_number}</td>
                    <td className="px-4 py-3">{typeLabels[doc.type] || doc.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                        <status.icon className="w-3 h-3" /> {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(doc.created_at)}</td>
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