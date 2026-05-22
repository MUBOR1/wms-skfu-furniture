import { useEffect, useState } from 'react'
import { orders, catalog,  } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { Plus, CheckCircle, Clock, Truck, XCircle, Package, FileText } from 'lucide-react'

interface Order {
  id: number
  order_number: string
  client_id: number
  status: string
  total_amount: number
  comment: string | null
  created_at: string
  shipment_doc_id?: number | null
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  processing: { label: 'В обработке', color: 'bg-blue-100 text-blue-700', icon: Package },
  shipped: { label: 'Отгружен', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700', icon: XCircle },
}

export default function OrdersPage() {
  const { hasRole } = useAuth()
  const [ordersList, setOrdersList] = useState<Order[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newOrder, setNewOrder] = useState({ comment: '', items: [] as { product_id: number; quantity: number; unit_price: number }[] })

  useEffect(() => {
    const load = async () => {
      try {
        const [resOrders, resProducts] = await Promise.all([orders.list(), catalog.products()])
        setOrdersList(Array.isArray(resOrders) ? resOrders : [])
        setProducts(Array.isArray(resProducts) ? resProducts : [])
      } catch (err) { console.error(err) }
      finally { setIsLoading(false) }
    }
    load()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || newOrder.items.length === 0) return
    setIsSubmitting(true)
    try {
      const res = await orders.create({ comment: newOrder.comment, items: newOrder.items }) as any
      setShowForm(false)
      setNewOrder({ comment: '', items: [] })
      setOrdersList(prev => [res, ...prev])
      alert(`✅ Заказ создан: ${res.order_number}`)
    } catch (err: any) { alert('❌ ' + (err.message || 'Ошибка')) }
    finally { setIsSubmitting(false) }
  }

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await orders.updateStatus(id, status)
      setOrdersList(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    } catch (err: any) { alert('❌ ' + (err.message)) }
  }

  // 🔗 НОВАЯ ФУНКЦИЯ: Создание отгрузки из заказа
  const handleCreateShipment = async (orderId: number) => {
  try {
    const res = await orders.createShipment(orderId)  // ← ИСПРАВЛЕНО: используем экспортированный метод
    alert(`✅ ${res.message}\n📄 Документ: ${res.doc_number}`)
    setOrdersList(prev => prev.map(o => 
      o.id === orderId ? { ...o, shipment_doc_id: res.document_id } : o
    ))
  } catch (err: any) {
    alert('❌ Ошибка: ' + (err.message || 'Не удалось создать отгрузку'))
  }
}

  const addItem = () => setNewOrder(prev => ({ ...prev, items: [...prev.items, { product_id: products[0]?.id || 1, quantity: 1, unit_price: 0 }] }))
  const updateItem = (idx: number, field: string, val: any) => {
    const updated = [...newOrder.items]
    updated[idx] = { ...updated[idx], [field]: val }
    setNewOrder({ ...newOrder, items: updated })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📦 Заказы клиентов</h2>
        {hasRole(['admin', 'warehouse_manager']) && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> {showForm ? 'Отмена' : 'Создать заказ'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Комментарий" value={newOrder.comment} onChange={e => setNewOrder({...newOrder, comment: e.target.value})} className="p-2 border rounded focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between mb-2"><h4 className="font-medium">Позиции заказа</h4><button type="button" onClick={addItem} className="text-sm text-indigo-600 hover:underline">+ Добавить товар</button></div>
            {newOrder.items.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', +e.target.value)} className="p-2 border rounded flex-1">
                  {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
                <input type="number" min="1" placeholder="Кол-во" value={item.quantity} onChange={e => updateItem(idx, 'quantity', +e.target.value)} className="p-2 border rounded w-24" required />
                <input type="number" min="0" step="0.01" placeholder="Цена" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', +e.target.value)} className="p-2 border rounded w-32" required />
                <button type="button" onClick={() => setNewOrder(prev => ({...prev, items: prev.items.filter((_, i) => i !== idx)}))} className="text-red-500">✕</button>
              </div>
            ))}
            {newOrder.items.length === 0 && <p className="text-sm text-gray-400 py-2 text-center">Добавьте позиции</p>}
          </div>
          <button type="submit" disabled={isSubmitting || newOrder.items.length === 0} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">Создать заказ</button>
        </form>
      )}

      {isLoading ? <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent mx-auto"></div></div> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">№ Заказа</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Сумма</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Отгрузка</th>
                {hasRole(['admin', 'warehouse_manager']) && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Управление</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {ordersList.map(order => {
                const st = statusConfig[order.status] || statusConfig.pending
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm font-medium">{order.order_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3 font-medium">{order.total_amount.toLocaleString('ru-RU')} ₽</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${st.color}`}>
                        <st.icon className="w-3 h-3" /> {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.shipment_doc_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          <FileText className="w-3 h-3" /> Создана
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    {hasRole(['admin', 'warehouse_manager']) && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2 items-center">
                          <select 
                            value={order.status} 
                            onChange={e => handleStatusChange(order.id, e.target.value)} 
                            className="p-1 border rounded text-sm"
                          >
                            {Object.keys(statusConfig).map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
                          </select>
                          
                          {/* 🔗 КНОПКА СОЗДАНИЯ ОТГРУЗКИ */}
                          {!order.shipment_doc_id && (order.status === 'pending' || order.status === 'processing') && (
                            <button
                              onClick={() => handleCreateShipment(order.id)}
                              className="px-2 py-1 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 transition flex items-center gap-1"
                              title="Создать документ отгрузки"
                            >
                              <FileText className="w-3 h-3" /> Отгрузка
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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