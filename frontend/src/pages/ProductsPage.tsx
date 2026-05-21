import { useEffect, useState } from 'react'
import { catalog } from '../api/wms'
import { Plus, Search, Package } from 'lucide-react'

interface Product {
  id: number
  sku: string
  name: string
  category: string | null
  weight_kg: number
  min_stock: number
  max_stock: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', category: '', weight_kg: 0, min_stock: 0, max_stock: 100
  })

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const data = await catalog.products(search || undefined)
      setProducts(data as Product[])
    } catch (err) {
      console.error('Error loading products:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [search])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await catalog.createProduct(newProduct)
      setShowForm(false)
      setNewProduct({ sku: '', name: '', category: '', weight_kg: 0, min_stock: 0, max_stock: 100 })
      loadProducts()
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📦 Номенклатура</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Добавить товар
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-2 gap-4">
          <input placeholder="SKU *" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="p-2 border rounded" required />
          <input placeholder="Название *" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="p-2 border rounded" required />
          <input placeholder="Категория" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="p-2 border rounded" />
          <input type="number" placeholder="Вес (кг)" value={newProduct.weight_kg} onChange={e => setNewProduct({...newProduct, weight_kg: +e.target.value})} className="p-2 border rounded" />
          <input type="number" placeholder="Мин. остаток" value={newProduct.min_stock} onChange={e => setNewProduct({...newProduct, min_stock: +e.target.value})} className="p-2 border rounded" />
          <input type="number" placeholder="Макс. остаток" value={newProduct.max_stock} onChange={e => setNewProduct({...newProduct, max_stock: +e.target.value})} className="p-2 border rounded" />
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Сохранить</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">Отмена</button>
          </div>
        </form>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск по названию или SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Загрузка...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          Нет товаров. Добавьте первый!
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Название</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Категория</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Вес</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Остаток</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{p.sku}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category || '—'}</td>
                  <td className="px-4 py-3">{p.weight_kg} кг</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-sm">
                      {p.min_stock}–{p.max_stock}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}