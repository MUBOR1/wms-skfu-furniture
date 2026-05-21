import { useEffect, useState } from 'react'
import { inventory, catalog } from '../api/wms'
import { ClipboardCheck, Plus, CheckCircle } from 'lucide-react'

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newInv, setNewInv] = useState({ records: [] as { product_id: number; actual_qty: number }[] })

  useEffect(() => {
    catalog.products().then(data => setProducts(Array.isArray(data) ? data : [])).catch(console.error)
  }, [])

  const addRecord = () => {
    if (products.length === 0) return
    setNewInv(prev => ({
      ...prev,
      records: [...prev.records, { product_id: products[0].id, actual_qty: 0 }]
    }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || newInv.records.length === 0) return
    
    setIsSubmitting(true)
    try {
      const res = await inventory.create({ doc_number: '', records: newInv.records }) as any
      setShowForm(false)
      setNewInv({ records: [] })
      alert(`✅ Инвентаризация создана: ${res.doc_number}`)
    } catch (err: any) {
      alert('❌ ' + (err.message || 'Ошибка'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">🔍 Инвентаризация</h2>
        <button onClick={() => setShowForm(!showForm)} 
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all">
          <Plus className="w-4 h-4" /> {showForm ? 'Отмена' : 'Новая инвентаризация'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-700 mb-3">Позиции для пересчёта</h4>
            {newInv.records.map((rec, idx) => (
              <div key={idx} className="flex gap-2 mb-3 items-center p-3 bg-gray-50 rounded-lg">
                <select value={rec.product_id} onChange={e => {
                  setNewInv(prev => {
                    const updated = [...prev.records]
                    updated[idx].product_id = +e.target.value
                    return { ...prev, records: updated }
                  })
                }} className="p-2 border border-gray-300 rounded-lg flex-1 focus:ring-2 focus:ring-indigo-500 outline-none">
                  {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
                <input type="number" min="0" placeholder="Факт" value={rec.actual_qty} 
                       onChange={e => {
                         setNewInv(prev => {
                           const updated = [...prev.records]
                           updated[idx].actual_qty = +e.target.value
                           return { ...prev, records: updated }
                         })
                       }} className="p-2 border border-gray-300 rounded-lg w-24 focus:ring-2 focus:ring-indigo-500 outline-none" required />
                <button type="button" onClick={() => setNewInv(prev => ({ ...prev, records: prev.records.filter((_, i) => i !== idx) }))} 
                        className="text-red-500 hover:text-red-700 p-2">✕</button>
              </div>
            ))}
            {newInv.records.length === 0 && <p className="text-sm text-gray-400 py-2 text-center">Нажмите «+ Добавить товар»</p>}
            <button type="button" onClick={addRecord} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-4">+ Добавить товар</button>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={isSubmitting || newInv.records.length === 0} 
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">
              {isSubmitting ? 'Создание...' : 'Создать инвентаризацию'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} 
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
        <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-indigo-200" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Модуль инвентаризации</h3>
        <p className="text-gray-500 mb-4 max-w-2xl mx-auto">Создавайте ведомости, вводите фактические остатки. Система автоматически рассчитает расхождения и сформирует корректирующий документ.</p>
        <div className="flex justify-center gap-4 text-sm text-gray-600 flex-wrap">
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Авто-расчёт расхождений</div>
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-blue-500" /> Корректировка остатков</div>
        </div>
      </div>
    </div>
  )
}