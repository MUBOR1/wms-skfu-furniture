import { useEffect, useState } from 'react'
import { catalog, catalogExport, catalogImport } from '../api/wms'
import { Plus, Search, Package, Download, Upload } from 'lucide-react'

// 👇 ОБНОВЛЕННЫЙ ИНТЕРФЕЙС С ЦЕНАМИ
interface Product {
  id: number
  sku: string
  name: string
  category: string | null
  weight_kg: number
  min_stock: number
  max_stock: number
  purchase_price: number // 👈 Добавлено
  sale_price: number     // 👈 Добавлено
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  
  // 👇 ОБНОВЛЕННОЕ СОСТОЯНИЕ ФОРМЫ
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', category: '', weight_kg: 0, 
    min_stock: 0, max_stock: 100,
    purchase_price: 0, // 👈 Добавлено
    sale_price: 0      // 👈 Добавлено
  })

  const [isImporting, setIsImporting] = useState(false)

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const data = await catalog.products(search || undefined)
      setProducts(Array.isArray(data) ? data : [])
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
      setNewProduct({ sku: '', name: '', category: '', weight_kg: 0, min_stock: 0, max_stock: 100, purchase_price: 0, sale_price: 0 })
      loadProducts()
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const res = await catalogImport(file)
      if (res.status === 'success') {
        alert(`✅ Импорт завершён:\n🆕 Создано: ${res.created}\n🔄 Обновлено: ${res.updated}`)
        loadProducts()
      } else {
        alert(`⚠️ Импорт завершён с ошибками:\n${res.errors?.join('\n') || 'Неизвестная ошибка'}`)
      }
    } catch (err: any) {
      alert('❌ Ошибка импорта: ' + err.message)
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 🔹 Шапка */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-7 h-7 text-indigo-600" /> Номенклатура
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={catalogExport} className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
            <Download className="w-4 h-4 text-green-600" /> Экспорт CSV
          </button>
          <label className={`flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors cursor-pointer ${isImporting ? 'opacity-50 cursor-wait' : ''}`}>
            <Upload className="w-4 h-4 text-blue-600" /> {isImporting ? 'Загрузка...' : 'Импорт CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={isImporting} />
          </label>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> {showForm ? 'Отмена' : 'Добавить товар'}
          </button>
        </div>
      </div>

      {/* 🔹 Форма создания товара */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-5 bg-white rounded-lg border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">SKU *</label>
            <input placeholder="Например: SKU-001" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Название *</label>
            <input placeholder="Например: Стул офисный" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Категория</label>
            <input placeholder="Мебель, Фурнитура..." value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Вес (кг)</label>
            <input type="number" step="0.1" min="0" placeholder="0.0" value={newProduct.weight_kg || ''} onChange={e => setNewProduct({...newProduct, weight_kg: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          {/* 👇 ДОБАВЛЕНЫ ПОЛЯ ЦЕН */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">💰 Цена закупки (₽)</label>
            <input type="number" step="0.01" min="0" placeholder="0.00" value={newProduct.purchase_price || ''} onChange={e => setNewProduct({...newProduct, purchase_price: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">💰 Цена продажи (₽)</label>
            <input type="number" step="0.01" min="0" placeholder="0.00" value={newProduct.sale_price || ''} onChange={e => setNewProduct({...newProduct, sale_price: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Мин. остаток</label>
            <input type="number" min="0" placeholder="10" value={newProduct.min_stock || ''} onChange={e => setNewProduct({...newProduct, min_stock: parseInt(e.target.value) || 0})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Макс. остаток</label>
            <input type="number" min="0" placeholder="100" value={newProduct.max_stock || ''} onChange={e => setNewProduct({...newProduct, max_stock: parseInt(e.target.value) || 0})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-3 flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium transition-colors">💾 Сохранить товар</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">Отмена</button>
          </div>
        </form>
      )}

      {/* 🔹 Поиск */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder="Поиск по названию или SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
      </div>

      {/* 🔹 Таблица товаров */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
          <p className="text-gray-500">Загрузка номенклатуры...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 mb-4">Товары не найдены.</p>
          <button onClick={() => setShowForm(true)} className="text-indigo-600 hover:underline font-medium">Добавить первый товар</button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Название</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Закупка</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Продажа</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Остаток</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{p.sku}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.purchase_price?.toFixed(2) || '0.00'} ₽</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-700">{p.sale_price?.toFixed(2) || '0.00'} ₽</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                      {p.min_stock} – {p.max_stock}
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