import { useEffect, useState } from 'react'
import { catalog, catalogExport, catalogImport } from '../api/wms'
import { Plus, Search, Package, Download, Upload, Edit2, Trash2, X, Save } from 'lucide-react'

interface Product {
  id: number
  sku: string
  name: string
  category: string | null
  weight_kg: number
  min_stock: number
  max_stock: number
  purchase_price: number
  sale_price: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', category: '', weight_kg: 0, 
    min_stock: 0, max_stock: 100,
    purchase_price: 0, sale_price: 0
  })

  const [isImporting, setIsImporting] = useState(false)

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const data = await catalog.products(search || undefined)
      let filtered = Array.isArray(data) ? data : []
      if (selectedCategory) {
        filtered = filtered.filter(p => p.category === selectedCategory)
      }
      setProducts(filtered)
    } catch (err) {
      console.error('Error loading products:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const cats = await catalog.categories()
      setCategories(Array.isArray(cats) ? cats : [])
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  useEffect(() => { 
    loadProducts()
    loadCategories()
  }, [search, selectedCategory])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await catalog.createProduct(newProduct)
      setShowForm(false)
      setNewProduct({ sku: '', name: '', category: '', weight_kg: 0, min_stock: 0, max_stock: 100, purchase_price: 0, sale_price: 0 })
      loadProducts()
      loadCategories() // Обновить список категорий, если добавили новую
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    try {
      await catalog.updateProduct(editingProduct.id, {
        sku: editingProduct.sku,
        name: editingProduct.name,
        category: editingProduct.category,
        min_stock: editingProduct.min_stock,
        max_stock: editingProduct.max_stock,
        purchase_price: editingProduct.purchase_price,
        sale_price: editingProduct.sale_price
      })
      setEditingProduct(null)
      loadProducts()
      loadCategories()
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) return
    try {
      await catalog.deleteProduct(id)
      loadProducts()
      loadCategories()
    } catch (err: any) {
      alert(' Ошибка: ' + err.message)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    try {
      const res = await catalogImport(file)
      if (res.status === 'success') {
        alert(`✅ Импорт завершён:\n Создано: ${res.created}\n Обновлено: ${res.updated}`)
        loadProducts()
        loadCategories()
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
      {/* Шапка */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-7 h-7 text-indigo-600" /> Номенклатура
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={catalogExport} className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <Download className="w-4 h-4 text-green-600" /> Экспорт
          </button>
          <label className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium cursor-pointer">
            <Upload className="w-4 h-4 text-blue-600" /> Импорт
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={isImporting} />
          </label>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
      </div>

      {/* Форма создания */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-5 bg-white rounded-lg border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">SKU *</label>
            <input value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Название *</label>
            <input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Категория</label>
            <input list="category-list" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
            <datalist id="category-list">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">💰 Закупка (₽)</label>
            <input type="number" step="0.01" min="0" value={newProduct.purchase_price || ''} onChange={e => setNewProduct({...newProduct, purchase_price: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">💰 Продажа (₽)</label>
            <input type="number" step="0.01" min="0" value={newProduct.sale_price || ''} onChange={e => setNewProduct({...newProduct, sale_price: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Вес (кг)</label>
            <input type="number" step="0.1" min="0" value={newProduct.weight_kg || ''} onChange={e => setNewProduct({...newProduct, weight_kg: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Мин. остаток</label>
            <input type="number" min="0" value={newProduct.min_stock || ''} onChange={e => setNewProduct({...newProduct, min_stock: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Макс. остаток</label>
            <input type="number" min="0" value={newProduct.max_stock || ''} onChange={e => setNewProduct({...newProduct, max_stock: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-3 flex gap-3 pt-2">
            <button type="submit" className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium">💾 Сохранить</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Отмена</button>
          </div>
        </form>
      )}

      {/* Фильтры */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
          <option value="">Все категории</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Таблица */}
      {isLoading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Товары не найдены.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Название</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Закупка</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Продажа</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Диапазон</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{p.sku}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-sm">{p.purchase_price?.toFixed(2)} ₽</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-700">{p.sale_price?.toFixed(2)} ₽</td>
                  <td className="px-4 py-3 text-sm">{p.min_stock} – {p.max_stock}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditingProduct(p)} className="text-blue-600 hover:text-blue-800 p-1"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 p-1 ml-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно редактирования */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form onSubmit={handleUpdate} className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">️ Редактировать товар</h3>
              <button type="button" onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">SKU</label>
                <input value={editingProduct.sku} onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Название</label>
                <input value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Категория</label>
                <input list="edit-category-list" value={editingProduct.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
                <datalist id="edit-category-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">💰 Закупка</label>
                <input type="number" step="0.01" min="0" value={editingProduct.purchase_price || ''} onChange={e => setEditingProduct({...editingProduct, purchase_price: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">💰 Продажа</label>
                <input type="number" step="0.01" min="0" value={editingProduct.sale_price || ''} onChange={e => setEditingProduct({...editingProduct, sale_price: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Мин. остаток</label>
                <input type="number" min="0" value={editingProduct.min_stock || ''} onChange={e => setEditingProduct({...editingProduct, min_stock: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Макс. остаток</label>
                <input type="number" min="0" value={editingProduct.max_stock || ''} onChange={e => setEditingProduct({...editingProduct, max_stock: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t">
              <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Сохранить изменения
              </button>
              <button type="button" onClick={() => setEditingProduct(null)} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Отмена</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}