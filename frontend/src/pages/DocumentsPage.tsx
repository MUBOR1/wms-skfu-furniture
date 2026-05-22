import { useEffect, useState } from 'react'
import { documents, catalog } from '../api/wms'
import { FileText, Plus, CheckCircle, Clock, XCircle } from 'lucide-react'

// 🔧 Исправленный интерфейс: created_at может быть null
interface DocItem {
  id: number
  doc_number: string
  type: 'receive' | 'ship' | 'move' | 'adjust'
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string | null  // ← ДОБАВЛЕНО: | null
  comment: string | null
}

// 🔧 Утилита для безопасного форматирования даты
const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return '—' // Если дата невалидна
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return '—'
  }
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
  const [docs, setDocs] = useState<DocItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newDoc, setNewDoc] = useState({ type: 'receive' as const, comment: '' })
  const [docItems, setDocItems] = useState<{ product_id: number; quantity: number }[]>([])

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || docItems.length === 0) return
    
    setIsSubmitting(true)
    try {
      const res = await documents.create({ 
        doc_number: '', 
        type: newDoc.type, 
        comment: newDoc.comment, 
        items: docItems 
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

  const handleComplete = async (id: number) => {
    if (!confirm('Провести документ? Остатки будут обновлены.')) return
    try {
      await documents.complete(id)
      await loadDocs()
      alert('✅ Документ успешно проведён')
    } catch (err: any) { alert('❌ ' + (err.message || 'Ошибка')) }
  }

  const addDocItem = () => setDocItems(prev => [...prev, { product_id: products[0]?.id || 1, quantity: 1 }])
  const updateDocItem = (idx: number, field: string, value: any) => {
    setDocItems(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📄 Складские документы</h2>
        <button onClick={() => { setShowForm(!showForm); if(!showForm) loadProducts() }} 
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
          <Plus className="w-4 h-4" /> {showForm ? 'Отмена' : 'Создать документ'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select value={newDoc.type} onChange={e => setNewDoc({...newDoc, type: e.target.value as any})} 
                    className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
              <option value="receive">📥 Приёмка</option>
              <option value="ship">📤 Отгрузка</option>
              <option value="move">🔄 Перемещение</option>
              <option value="adjust">⚙️ Корректировка</option>
            </select>
            <input placeholder="Комментарий" value={newDoc.comment} onChange={e => setNewDoc({...newDoc, comment: e.target.value})} 
                   className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700">Позиции документа</h4>
              <button type="button" onClick={addDocItem} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Добавить позицию</button>
            </div>
            {docItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select value={item.product_id} onChange={e => updateDocItem(idx, 'product_id', +e.target.value)} 
                        className="p-2 border border-gray-300 rounded-lg flex-1 focus:ring-2 focus:ring-indigo-500 outline-none">
                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
                <input type="number" min="1" value={item.quantity} onChange={e => updateDocItem(idx, 'quantity', +e.target.value)} 
                       className="p-2 border border-gray-300 rounded-lg w-24 focus:ring-2 focus:ring-indigo-500 outline-none" required />
                <button type="button" onClick={() => setDocItems(prev => prev.filter((_, i) => i !== idx))} 
                        className="text-red-500 hover:text-red-700 p-2">✕</button>
              </div>
            ))}
            {docItems.length === 0 && <p className="text-sm text-gray-400 py-2 text-center">Нажмите «+ Добавить позицию»</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSubmitting || docItems.length === 0} 
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">
              {isSubmitting ? 'Создание...' : 'Создать документ'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} 
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {docs.map((doc) => {
                const status = statusConfig[doc.status] || statusConfig.draft
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{doc.doc_number}</td>
                    <td className="px-4 py-3">{typeLabels[doc.type] || doc.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                        <status.icon className="w-3 h-3" /> {status.label}
                      </span>
                    </td>
                    {/* 🔧 ИСПРАВЛЕНО: используем безопасную функцию formatDate */}
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(doc.created_at)}</td>
                    <td className="px-4 py-3">
                      {doc.status === 'draft' && (
                        <button onClick={() => handleComplete(doc.id)} 
                                className="text-green-600 hover:text-green-800 text-sm font-medium hover:underline">
                          Провести
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}