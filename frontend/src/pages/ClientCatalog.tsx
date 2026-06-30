// src/pages/ClientCatalog.tsx
import { useEffect, useState } from 'react'
import { request } from '../api/wms'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { ShoppingBag, Search, SlidersHorizontal, Star, Heart, Package, ChevronLeft } from 'lucide-react'

interface Product {
  id: number
  sku: string
  name: string
  category: string | null
  description: string | null
  sale_price: number
  quantity: number
  rating: number
  reviews_count: number
  images?: string[]
  image_url?: string | null
}

interface CatalogResponse {
  products: Product[]
  total: number
  page: number
  pages: number
}

export default function ClientCatalog() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addToCart, getTotalItems, items } = useCart()
  
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{name: string, count: number}[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cartCount, setCartCount] = useState(getTotalItems())
  const [addingProducts, setAddingProducts] = useState<Set<number>>(new Set())
  
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    in_stock: searchParams.get('in_stock') === 'true',
    sort: searchParams.get('sort') || 'popular',
    page: 1
  })
  
  const [showFilters, setShowFilters] = useState(false)
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [totalPages, setTotalPages] = useState(1)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadProducts()
    loadCategories()
    loadFavorites()
    setCartCount(getTotalItems())
  }, [filters.search, filters.category, filters.sort, filters.in_stock, filters.page])

  // 🔥 ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ URL ИЗОБРАЖЕНИЯ
  const getImageUrl = (product: Product): string | null => {
    // Сначала проверяем images (массив)
    if (product.images && product.images.length > 0) {
      const img = product.images[0]
      if (img.startsWith('http')) return img
      if (img.startsWith('/')) return `http://localhost:8000${img}`
      return `http://localhost:8000/${img}`
    }
    // Потом проверяем image_url (одиночное)
    if (product.image_url) {
      const img = product.image_url
      if (img.startsWith('http')) return img
      if (img.startsWith('/')) return `http://localhost:8000${img}`
      return `http://localhost:8000/${img}`
    }
    return null
  }

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.category) params.append('category', filters.category)
      if (filters.min_price) params.append('min_price', filters.min_price)
      if (filters.max_price) params.append('max_price', filters.max_price)
      if (filters.in_stock) params.append('in_stock', 'true')
      params.append('sort', filters.sort)
      params.append('page', String(filters.page))
      params.append('limit', '20')

      const response = await request<CatalogResponse>(`/client/catalog?${params.toString()}`)
      
      console.log('📦 Загружены товары:', response.products)
      response.products.forEach(p => {
        console.log(`📸 ${p.name}: images=${p.images?.length || 0}, image_url=${p.image_url || 'нет'}`)
      })
      
      setProducts(response.products || [])
      setTotalPages(response.pages || 1)
      setImageErrors(new Set())
    } catch (err) {
      console.error('Error loading products:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const data = await request<{name: string, count: number}[]>('/client/categories')
      setCategories(data)
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const loadFavorites = async () => {
    try {
      const favs = await request<{id: number}[]>('/client/favorites')
      setFavorites(new Set(favs.map(f => f.id)))
    } catch (err) {
      console.error('Error loading favorites:', err)
    }
  }

  const toggleFavorite = async (productId: number) => {
    try {
      await request(`/client/favorites/${productId}`, { method: 'POST' })
      setFavorites(prev => {
        const next = new Set(prev)
        if (next.has(productId)) next.delete(productId)
        else next.add(productId)
        return next
      })
    } catch (err: any) {
      console.error('Error toggling favorite:', err)
      alert('❌ Ошибка: ' + (err.message || 'Не удалось добавить в избранное'))
    }
  }

  const handleAddToCart = async (product: Product) => {
    if (product.quantity === 0) {
      alert('❌ Товар временно отсутствует на складе')
      return
    }

    if (addingProducts.has(product.id)) {
      return
    }

    const existingItem = items.find(item => item.product_id === product.id)
    const currentQuantity = existingItem?.quantity || 0
    
    if (currentQuantity >= product.quantity) {
      alert(`❌ На складе осталось только ${product.quantity} шт.`)
      return
    }

    setAddingProducts(prev => new Set(prev).add(product.id))

    try {
      addToCart(product, 1)
      
      await request('/client/cart', {
        method: 'POST',
        body: JSON.stringify({
          product_id: product.id,
          quantity: 1
        })
      })
      
      setCartCount(prev => prev + 1)
      
      console.log(`✅ Добавлен ${product.name}`)
    } catch (err: any) {
      console.error('Error adding to cart:', err)
      alert('❌ Ошибка: ' + (err.message || 'Не удалось добавить товар'))
    } finally {
      setAddingProducts(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
    
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, String(value))
    else params.delete(key)
    params.delete('page')
    navigate(`/client/catalog?${params.toString()}`, { replace: true })
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setFilters(prev => ({ ...prev, page }))
    
    const params = new URLSearchParams(searchParams)
    params.set('page', String(page))
    navigate(`/client/catalog?${params.toString()}`, { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Назад
          </button>

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-indigo-600" />
              Каталог товаров
            </h1>
            
            {cartCount > 0 && (
              <button 
                onClick={() => navigate('/client/cart')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2"
              >
                🛒 В корзине: {cartCount} шт.
              </button>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию, SKU или категории..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-lg border font-medium flex items-center gap-2 ${
                showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
              Фильтры
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Категория</label>
                  <select
                    value={filters.category}
                    onChange={(e) => updateFilter('category', e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">Все категории</option>
                    {categories.map(cat => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name} ({cat.count})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Мин. цена</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.min_price}
                    onChange={(e) => updateFilter('min_price', e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Макс. цена</label>
                  <input
                    type="number"
                    placeholder="100000"
                    value={filters.max_price}
                    onChange={(e) => updateFilter('max_price', e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.in_stock}
                      onChange={(e) => updateFilter('in_stock', e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="font-medium text-gray-700">Только в наличии</span>
                  </label>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <select
                  value={filters.sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="popular">По популярности</option>
                  <option value="price_asc">По цене: сначала дешёвые</option>
                  <option value="price_desc">По цене: сначала дорогие</option>
                  <option value="new">По новизне</option>
                  <option value="rating">По рейтингу</option>
                </select>
                
                <button
                  onClick={() => {
                    setFilters({ search: '', category: '', min_price: '', max_price: '', in_stock: false, sort: 'popular', page: 1 })
                    navigate('/client/catalog')
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Сбросить фильтры
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 mx-auto mb-4 border-t-transparent" />
            <p className="text-gray-500">Загрузка товаров...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium text-lg">Товары не найдены</p>
            <p className="text-sm text-gray-400 mt-1">Попробуйте изменить фильтры</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map(product => {
                const isAdding = addingProducts.has(product.id)
                const existingItem = items.find(item => item.product_id === product.id)
                const inCartQuantity = existingItem?.quantity || 0
                const isAtMaxStock = inCartQuantity >= product.quantity
                const hasError = imageErrors.has(product.id)
                const imageUrl = getImageUrl(product)

                return (
                  <div 
                    key={product.id} 
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all overflow-hidden group"
                  >
                    {/* 🔥 КАРТИНКА С ФОТО */}
                    <div 
                      className="relative aspect-square bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center cursor-pointer overflow-hidden"
                      onClick={() => navigate(`/client/product/${product.id}`)}
                    >
                      {imageUrl && !hasError ? (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={() => {
                            console.warn(`⚠️ Ошибка загрузки фото для ${product.name}: ${imageUrl}`)
                            setImageErrors(prev => new Set(prev).add(product.id))
                          }}
                          loading="lazy"
                        />
                      ) : (
                        <Package className="w-16 h-16 text-indigo-300 group-hover:scale-110 transition-transform" />
                      )}
                      
                      {product.quantity === 0 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-bold text-sm bg-red-600 px-3 py-1 rounded-full">
                            Нет в наличии
                          </span>
                        </div>
                      )}
                      {inCartQuantity > 0 && (
                        <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {inCartQuantity} в корзине
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 font-mono mb-1">{product.sku}</div>
                          <h3 
                            className="font-bold text-gray-900 mb-2 line-clamp-2 cursor-pointer hover:text-indigo-600"
                            onClick={() => navigate(`/client/product/${product.id}`)}
                          >
                            {product.name}
                          </h3>
                          {product.category && (
                            <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mb-2">
                              {product.category}
                            </span>
                          )}
                        </div>
                        
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
                          className={`p-1.5 rounded-full transition-colors ${
                            favorites.has(product.id) 
                              ? 'text-red-600 bg-red-50' 
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <Heart className={`w-5 h-5 ${favorites.has(product.id) ? 'fill-current' : ''}`} />
                        </button>
                      </div>

                      {product.reviews_count > 0 && (
                        <div className="flex items-center gap-1 mb-3">
                          <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-4 h-4 ${i < Math.round(product.rating) ? 'fill-current' : ''}`} 
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">({product.reviews_count})</span>
                        </div>
                      )}

                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-2xl font-bold text-indigo-600">
                            {product.sale_price.toLocaleString('ru-RU')} ₽
                          </div>
                          <div className="text-xs text-gray-500">
                            {product.quantity} шт. на складе
                          </div>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddToCart(product) }}
                          disabled={product.quantity === 0 || isAdding || isAtMaxStock}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                            product.quantity > 0 && !isAtMaxStock
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {isAdding ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          ) : isAtMaxStock ? (
                            'Максимум'
                          ) : (
                            <>
                              <ShoppingBag className="w-4 h-4" />
                              <span className="hidden sm:inline">В корзину</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2 items-center">
                <button
                  onClick={() => goToPage(filters.page - 1)}
                  disabled={filters.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  ← Назад
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Страница {filters.page} из {totalPages}
                </span>
                <button
                  onClick={() => goToPage(filters.page + 1)}
                  disabled={filters.page >= totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Вперёд →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}