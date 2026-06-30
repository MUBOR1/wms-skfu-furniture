// pages/ProductsPage.tsx
import { useEffect, useState, useMemo } from 'react'
import { catalog, catalogExport, catalogImport, bulkDeleteProducts, request } from '../api/wms'
import { Plus, Search, Package, Download, Upload, Edit2, Trash2, X, Save, FolderPlus, FolderMinus, ChevronDown, Archive, Heart, Image as ImageIcon, Star, Camera } from 'lucide-react'

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

interface LocalCategory {
  name: string
  product_count: number
}

interface ProductImage {
  id: number
  image_url: string
  is_main: boolean
  order: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<LocalCategory[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productImages, setProductImages] = useState<ProductImage[]>([])
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', category: '', weight_kg: 0, 
    min_stock: 0, max_stock: 100,
    purchase_price: 0, sale_price: 0
  })

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<LocalCategory | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isDeletingProduct, setIsDeletingProduct] = useState<number | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showDeleteMenu, setShowDeleteMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const [showBulkDeleteMenu, setShowBulkDeleteMenu] = useState(false)
  
  const [favorites, setFavorites] = useState<Set<number>>(new Set())

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
      
      if (Array.isArray(cats) && cats.length > 0) {
        if (typeof cats[0] === 'string') {
          const converted = (cats as string[]).map(name => ({ name, product_count: 0 }))
          setCategories(prev => {
            const existing = new Set(prev.map(c => c.name.toLowerCase()))
            const merged = [...prev]
            for (const c of converted) {
              if (!existing.has(c.name.toLowerCase())) merged.push(c)
            }
            return merged
          })
        } else {
          const converted = (cats as { name: string; product_count?: number }[]).map(c => ({
            name: c.name, product_count: c.product_count || 0
          }))
          setCategories(prev => {
            const existing = new Set(prev.map(c => c.name.toLowerCase()))
            const merged = [...prev]
            for (const c of converted) {
              if (!existing.has(c.name.toLowerCase())) merged.push(c)
            }
            return merged
          })
        }
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const loadFavorites = async () => {
    try {
      const favs = await catalog.favorites() || []
      const favIds = new Set<number>(favs.map((f: { id: number }) => f.id))
      setFavorites(favIds)
    } catch (err) {
      console.error('Error loading favorites:', err)
    }
  }

  // 🔥 ЗАГРУЗКА ФОТО ТОВАРА
  const loadProductImages = async (productId: number) => {
    try {
      const images = await request<ProductImage[]>(`/catalog/products/${productId}/images`)
      setProductImages(images || [])
    } catch (err) {
      console.error('Error loading images:', err)
    }
  }

  // 🔥 ЗАГРУЗКА ФОТО ПРИ ОТКРЫТИИ МОДАЛКИ
  useEffect(() => {
    if (editingProduct) {
      loadProductImages(editingProduct.id)
    } else {
      setProductImages([])
    }
  }, [editingProduct])

  useEffect(() => { 
    loadProducts()
    loadCategories()
    loadFavorites()
  }, [search, selectedCategory])

  // 🔥 ЗАГРУЗКА ФОТО
  const handleUploadImages = async (files: FileList) => {
    if (!editingProduct) return
    
    setIsUploadingImages(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach(file => {
        formData.append('files', file)
      })
      
      const response = await fetch(`/api/catalog/products/${editingProduct.id}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('wms_token')}`
        },
        body: formData
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Ошибка загрузки')
      }
      
      await response.json()
      await loadProductImages(editingProduct.id)
      alert('✅ Фото загружены')
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    } finally {
      setIsUploadingImages(false)
    }
  }

  // 🔥 УДАЛЕНИЕ ФОТО
  const handleDeleteImage = async (imageId: number) => {
    if (!confirm('Удалить фото?')) return
    try {
      await request(`/catalog/products/images/${imageId}`, { method: 'DELETE' })
      await loadProductImages(editingProduct!.id)
      alert('✅ Фото удалено')
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    }
  }

  // 🔥 УСТАНОВКА ГЛАВНОГО ФОТО
  const handleSetMainImage = async (imageId: number) => {
    try {
      await request(`/catalog/products/images/${imageId}/set-main`, { method: 'POST' })
      await loadProductImages(editingProduct!.id)
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    }
  }

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(p => 
      p.sku?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    )
  }, [products, search])

  const toggleProductSelection = (id: number) => {
    setSelectedProducts(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id])
  }

  const selectAllProducts = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id))
    }
  }

  const toggleFavorite = async (productId: number) => {
    try {
      await catalog.toggleFavorite(productId)
      setFavorites(prev => {
        const next = new Set(prev)
        if (next.has(productId)) next.delete(productId)
        else next.add(productId)
        return next
      })
    } catch (err) {
      console.error('Error toggling favorite:', err)
    }
  }

  const handleDelete = async (id: number, name: string, hard: boolean) => {
    const warning = hard 
      ? `🔥 ВЫ УВЕРЕНЫ, что хотите УДАЛИТЬ НАВСЕГДА товар "${name}"?\n\nЭто действие НЕЛЬЗЯ ОТМЕНИТЬ!`
      : `️ Вы хотите отправить товар "${name}" в архив?`
    
    const confirmed = window.confirm(warning)
    if (!confirmed) return
    
    setIsDeletingProduct(id)
    try {
      await catalog.deleteProduct(id, hard)
      loadProducts()
      loadCategories()
      alert(hard ? '✅ Товар полностью удалён' : '✅ Товар отправлен в архив')
    } catch (err: any) {
      if (err.message?.includes('dependencies') || err.message?.includes('зависимости')) {
        alert('❌ Нельзя удалить: товар используется в заказах или остатках.')
      } else {
        alert('❌ Ошибка: ' + (err.message || err.detail))
      }
    } finally {
      setIsDeletingProduct(null)
      setShowDeleteMenu(null)
    }
  }

  const handleBulkDelete = async (hard: boolean) => {
    if (selectedProducts.length === 0) return
    
    const warning = hard
      ? `🔥 ВЫ УВЕРЕНЫ, что хотите УДАЛИТЬ НАВСЕГДА ${selectedProducts.length} товар(ов)?\n\nЭто действие НЕЛЬЗЯ ОТМЕНИТЬ!`
      : `️ Вы хотите отправить ${selectedProducts.length} товар(ов) в архив?`
    
    const confirmed = window.confirm(warning)
    if (!confirmed) return

    try {
      const result = await bulkDeleteProducts(selectedProducts, hard)
      setSelectedProducts([])
      loadProducts()
      loadCategories()
      
      const msg = hard ? 'полностью удалено' : 'отправлено в архив'
      alert(`✅ ${result.success} товар(ов) ${msg}\n⚠️ Ошибок: ${result.errors}`)
    } catch (err: any) {
      alert('❌ Ошибка: ' + (err.message || err.detail))
    } finally {
      setShowBulkDeleteMenu(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await catalog.createProduct(newProduct)
      setShowForm(false)
      setNewProduct({ sku: '', name: '', category: '', weight_kg: 0, min_stock: 0, max_stock: 100, purchase_price: 0, sale_price: 0 })
      loadProducts(); loadCategories()
    } catch (err: any) { alert('❌ Ошибка: ' + err.message) }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    try {
      await catalog.updateProduct(editingProduct.id, {
        sku: editingProduct.sku, name: editingProduct.name, category: editingProduct.category,
        min_stock: editingProduct.min_stock, max_stock: editingProduct.max_stock,
        purchase_price: editingProduct.purchase_price, sale_price: editingProduct.sale_price
      })
      setEditingProduct(null); loadProducts(); loadCategories()
    } catch (err: any) { alert('❌ Ошибка: ' + err.message) }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    const trimmedName = newCategoryName.trim()
    try {
      await catalog.createCategory(trimmedName)
      setCategories(prev => {
        if (prev.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) return prev
        return [...prev, { name: trimmedName, product_count: 0 }]
      })
      setNewCategoryName(''); setShowCategoryModal(false); loadCategories()
      alert('✅ Категория создана.')
    } catch {
      setCategories(prev => {
        if (prev.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) return prev
        return [...prev, { name: trimmedName, product_count: 0 }]
      })
      setNewCategoryName(''); setShowCategoryModal(false)
      alert('ℹ️ Категория добавлена локально.')
    }
  }

  const handleUpdateCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return
    try {
      await catalog.updateCategory(oldName, newName.trim())
      loadCategories(); loadProducts(); setEditingCategory(null)
      alert('✅ Категория обновлена')
    } catch {
      setCategories(prev => prev.map(c => c.name === oldName ? { ...c, name: newName.trim() } : c))
      setEditingCategory(null); alert('✅ Категория обновлена (локально)')
    }
  }

  const handleDeleteCategory = async (name: string) => {
    const productsInCategory = products.filter(p => p.category === name).length
    if (productsInCategory > 0 && !confirm(`⚠️ В категории "${name}" есть ${productsInCategory} товар(ов).\nПродолжить?`)) return
    try {
      await catalog.deleteCategory(name); loadCategories(); loadProducts(); alert('✅ Категория удалена')
    } catch { setCategories(prev => prev.filter(c => c.name !== name)); alert('✅ Категория удалена (локально)') }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setIsImporting(true)
    try {
      const res = await catalogImport(file)
      if (res.status === 'success') {
        alert(`✅ Импорт завершён:\n Создано: ${res.created}\n Обновлено: ${res.updated}`)
        loadProducts(); loadCategories()
      } else { alert(`⚠️ Импорт завершён с ошибками:\n${res.errors?.join('\n') || 'Неизвестная ошибка'}`) }
    } catch (err: any) { alert('❌ Ошибка импорта: ' + err.message) }
    finally { setIsImporting(false); e.target.value = '' }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 🔝 ШАПКА */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-7 h-7 text-indigo-600" /> Номенклатура
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCategoryModal(true)} className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
            <FolderPlus className="w-4 h-4 text-purple-600" /> <span className="hidden sm:inline">Категории</span>
          </button>
          
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors">
              <Download className="w-4 h-4 text-green-600" /> <span className="hidden sm:inline">Экспорт</span> <ChevronDown className="w-4 h-4" />
            </button>
            {showExportMenu && (<>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 animate-in fade-in zoom-in-95">
                <button onClick={() => { catalogExport('csv'); setShowExportMenu(false) }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100">
                  <span className="text-lg">📄</span> CSV
                </button>
                <button onClick={() => { catalogExport('xlsx'); setShowExportMenu(false) }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <span className="text-lg">📊</span> Excel (XLSX)
                </button>
              </div>
            </>)}
          </div>
          
          <label className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-blue-600" /> <span className="hidden sm:inline">Импорт</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} disabled={isImporting} />
          </label>
          
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Добавить</span>
          </button>
        </div>
      </div>

      {/* 🔽 ПАНЕЛЬ МАССОВЫХ ДЕЙСТВИЙ */}
      {selectedProducts.length > 0 && (
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
          <span className="text-sm text-indigo-700 font-medium">✅ Выбрано: <strong>{selectedProducts.length}</strong> товар(ов)</span>
          <div className="flex gap-2 relative">
            <div className="relative">
              <button onClick={() => setShowBulkDeleteMenu(!showBulkDeleteMenu)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors">
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Удалить выбранные</span> <ChevronDown className="w-4 h-4" />
              </button>
              {showBulkDeleteMenu && (<>
                <div className="fixed inset-0 z-10" onClick={() => setShowBulkDeleteMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 animate-in fade-in zoom-in-95">
                  <button onClick={() => { handleBulkDelete(false); setShowBulkDeleteMenu(false) }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100">
                    <Archive className="w-4 h-4 text-orange-600" /> 📦 В архив
                  </button>
                  <button onClick={() => { handleBulkDelete(true); setShowBulkDeleteMenu(false) }} className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600">
                    <Trash2 className="w-4 h-4" /> 🔥 Удалить навсегда
                  </button>
                </div>
              </>)}
            </div>
            <button onClick={() => setSelectedProducts([])} className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2 font-medium transition-colors">Отмена</button>
          </div>
        </div>
      )}

      {/* 🗂️ МОДАЛКА КАТЕГОРИЙ */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                <FolderPlus className="w-5 h-5 text-purple-600" /> Управление категориями
              </h3>
              <button onClick={() => { setShowCategoryModal(false); setEditingCategory(null); setNewCategoryName('') }} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Новая категория..." 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  className="flex-1 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" 
                  onKeyDown={e => e.key === 'Enter' && handleCreateCategory()} 
                />
                <button 
                  onClick={handleCreateCategory} 
                  disabled={!newCategoryName.trim()} 
                  className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Нет категорий</p>
                ) : (
                  categories.map(({ name, product_count }, idx) => (
                    <div key={`${name}-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                      {editingCategory?.name === name ? (
                        <div className="flex-1 flex gap-2">
                          <input 
                            type="text" 
                            defaultValue={name} 
                            className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm" 
                            onBlur={e => handleUpdateCategory(name, e.target.value)} 
                            onKeyDown={e => { if (e.key === 'Enter') handleUpdateCategory(name, e.currentTarget.value); if (e.key === 'Escape') setEditingCategory(null); }} 
                            autoFocus 
                          />
                          <button onClick={() => setEditingCategory(null)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900">{name}</span>
                            {product_count > 0 && <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">({product_count} тов.)</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => setEditingCategory({ name, product_count })} 
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                              title="Переименовать"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCategory(name)} 
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                              title="Удалить категорию"
                            >
                              <FolderMinus className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onClick={() => { setShowCategoryModal(false); setEditingCategory(null); setNewCategoryName('') }} 
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ФОРМА СОЗДАНИЯ */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-6 bg-white rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">SKU *</label>
            <input value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Название *</label>
            <input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Категория</label>
            <div className="flex gap-1">
              <input list="category-list" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="flex-1 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              <button type="button" onClick={() => setShowCategoryModal(true)} className="px-3 py-2.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors">
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>
            <datalist id="category-list">{categories.map((c, idx) => <option key={`${c.name}-${idx}`} value={c.name} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">💰 Закупка (₽)</label>
            <input type="number" step="0.01" min="0" value={newProduct.purchase_price || ''} onChange={e => setNewProduct({...newProduct, purchase_price: parseFloat(e.target.value) || 0})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">💰 Продажа (₽)</label>
            <input type="number" step="0.01" min="0" value={newProduct.sale_price || ''} onChange={e => setNewProduct({...newProduct, sale_price: parseFloat(e.target.value) || 0})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Вес (кг)</label>
            <input type="number" step="0.1" min="0" value={newProduct.weight_kg || ''} onChange={e => setNewProduct({...newProduct, weight_kg: parseFloat(e.target.value) || 0})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Мин. остаток</label>
            <input type="number" min="0" value={newProduct.min_stock || ''} onChange={e => setNewProduct({...newProduct, min_stock: parseInt(e.target.value) || 0})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Макс. остаток</label>
            <input type="number" min="0" value={newProduct.max_stock || ''} onChange={e => setNewProduct({...newProduct, max_stock: parseInt(e.target.value) || 0})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-3 flex gap-3 pt-4 border-t border-gray-200">
            <button type="submit" className="flex-1 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> 💾 Сохранить
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* ФИЛЬТРЫ */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Поиск по SKU, названию или категории..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
          />
        </div>
        <select 
          value={selectedCategory} 
          onChange={e => setSelectedCategory(e.target.value)} 
          className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm font-medium"
        >
          <option value="">Все категории</option>
          {categories.map((c, idx) => <option key={`${c.name}-${idx}`} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* 📊 ТАБЛИЦА */}
      {isLoading ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 mx-auto mb-3 border-t-transparent"></div>
          <p className="text-gray-500 text-sm">Загрузка товаров...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Товары не найдены.</p>
          <p className="text-sm text-gray-400 mt-1">Добавьте новый товар или измените фильтры</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-12">
                  <input type="checkbox" checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0} onChange={selectAllProducts} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-12">№</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Название</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Закупка</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Продажа</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Диапазон</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((p, idx) => (
                <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${selectedProducts.includes(p.id) ? 'bg-indigo-50/50' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={() => toggleProductSelection(p.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4" />
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500 font-mono">{idx + 1}.</td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">{p.sku}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.purchase_price?.toFixed(2)} ₽</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-700">{p.sale_price?.toFixed(2)} ₽</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.min_stock} – {p.max_stock}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => toggleFavorite(p.id)} 
                        className={`p-2 rounded-lg transition-colors ${
                          favorites.has(p.id) 
                            ? 'text-red-600 bg-red-50' 
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={favorites.has(p.id) ? 'Убрать из избранного' : 'Добавить в избранное'}
                      >
                        <Heart className={`w-4 h-4 ${favorites.has(p.id) ? 'fill-current' : ''}`} />
                      </button>
                      
                      <button 
                        onClick={() => setEditingProduct(p)} 
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                        title="Редактировать"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      
                      <div className="relative inline-block">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowDeleteMenu({ id: p.id, x: e.currentTarget.getBoundingClientRect().right, y: e.currentTarget.getBoundingClientRect().bottom }) }}
                          disabled={isDeletingProduct === p.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Удалить"
                        >
                          {isDeletingProduct === p.id ? (
                            <div className="animate-spin w-4 h-4 border-2 border-red-600 rounded-full border-t-transparent" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                        
                        {showDeleteMenu?.id === p.id && (<>
                          <div className="fixed inset-0 z-10" onClick={() => setShowDeleteMenu(null)} />
                          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 animate-in fade-in zoom-in-95">
                            <button 
                              onClick={() => handleDelete(p.id, p.name, false)} 
                              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 transition-colors"
                            >
                              <Archive className="w-4 h-4 text-orange-600" /> 📦 В архив
                            </button>
                            <button 
                              onClick={() => handleDelete(p.id, p.name, true)} 
                              className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" /> 🔥 Удалить навсегда
                            </button>
                          </div>
                        </>)}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* МОДАЛКА РЕДАКТИРОВАНИЯ С ФОТО */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in overflow-y-auto">
          <form onSubmit={handleUpdate} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-600" /> Редактировать товар
              </h3>
              <button type="button" onClick={() => setEditingProduct(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 🔥 ФОТО ТОВАРА */}
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                Фото товара
              </h4>
              
              {/* Список фото */}
              <div className="flex flex-wrap gap-3 mb-4">
                {productImages.length === 0 ? (
                  <div className="text-sm text-gray-400 flex items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg">
                    Нет фото
                  </div>
                ) : (
                  productImages.map(img => (
                    <div key={img.id} className="relative group">
                      <img 
                        src={`http://localhost:8000${img.image_url}`}
                        alt="Товар"
                        className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                      />
                      {img.is_main && (
                        <div className="absolute top-0 left-0 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded-tl-lg rounded-br-lg font-bold flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-current" /> Главное
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                        <button 
                          type="button"
                          onClick={() => handleSetMainImage(img.id)}
                          className="p-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                          title="Сделать главным"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteImage(img.id)}
                          className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Загрузка фото */}
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                  <Camera className="w-4 h-4" />
                  Загрузить фото
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleUploadImages(e.target.files)
                      }
                    }}
                    disabled={isUploadingImages}
                  />
                </label>
                {isUploadingImages && <span className="ml-3 text-sm text-gray-500">Загрузка...</span>}
                <p className="text-xs text-gray-400 mt-2">Можно загрузить несколько фото одновременно</p>
              </div>
            </div>

            {/* Основные поля */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">SKU *</label>
                <input value={editingProduct.sku} onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Название *</label>
                <input value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Категория</label>
                <div className="flex gap-1">
                  <input list="edit-category-list" value={editingProduct.category || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="flex-1 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  <button type="button" onClick={() => setShowCategoryModal(true)} className="px-3 py-2.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors">
                    <FolderPlus className="w-4 h-4" />
                  </button>
                </div>
                <datalist id="edit-category-list">{categories.map((c, idx) => <option key={`${c.name}-${idx}`} value={c.name} />)}</datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">💰 Закупка</label>
                <input type="number" step="0.01" min="0" value={editingProduct.purchase_price || ''} onChange={e => setEditingProduct({...editingProduct, purchase_price: parseFloat(e.target.value) || 0})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">💰 Продажа</label>
                <input type="number" step="0.01" min="0" value={editingProduct.sale_price || ''} onChange={e => setEditingProduct({...editingProduct, sale_price: parseFloat(e.target.value) || 0})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Мин. остаток</label>
                <input type="number" min="0" value={editingProduct.min_stock || ''} onChange={e => setEditingProduct({...editingProduct, min_stock: parseInt(e.target.value) || 0})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Макс. остаток</label>
                <input type="number" min="0" value={editingProduct.max_stock || ''} onChange={e => setEditingProduct({...editingProduct, max_stock: parseInt(e.target.value) || 0})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
              <button type="submit" className="flex-1 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Сохранить изменения
              </button>
              <button type="button" onClick={() => setEditingProduct(null)} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}