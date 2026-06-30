// pages/ClientHomePage.tsx - Главная страница клиента
import { useEffect, useState } from 'react'
import { request } from '../api/wms'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { 
  ShoppingCart, Heart, Search, MapPin, Package, ShoppingBag, Star 
} from 'lucide-react'

interface Product {
  id: number
  sku: string
  name: string
  category: string | null
  sale_price: number
  quantity: number
  rating?: number
  reviews_count?: number
}

interface HomepageData {
  categories: { name: string; count: number }[]
  popular: Product[]
  new: Product[]
}

export default function ClientHomePage() {
  const navigate = useNavigate()
  const { addToCart, getTotalItems } = useCart()
  const [categories, setCategories] = useState<{name: string, count: number}[]>([])
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [newProducts, setNewProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadHomepageData()
    loadFavorites()
  }, [])

  const loadHomepageData = async () => {
    setIsLoading(true)
    try {
      const data = await request<HomepageData>('/client/homepage')
      setCategories(data.categories || [])
      setPopularProducts(data.popular || [])
      setNewProducts(data.new || [])
    } catch (err) {
      console.error('Error loading homepage:', err)
    } finally {
      setIsLoading(false)
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

  const toggleFavorite = async (productId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await request(`/client/favorites/${productId}`, { method: 'POST' })
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

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    if (product.quantity > 0) {
      addToCart(product, 1)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/client/catalog?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <button 
              onClick={() => navigate('/client')} 
              className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              🏪 WMS SKFU
            </button>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск товаров..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </form>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                <MapPin className="w-5 h-5" />
                <span className="hidden md:inline font-medium">Ставрополь</span>
              </button>
              
              <button 
                onClick={() => navigate('/client/favorites')}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              >
                <Heart className="w-6 h-6" />
              </button>
              
              <button 
                onClick={() => navigate('/client/cart')}
                className="relative p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              >
                <ShoppingCart className="w-6 h-6" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {getTotalItems()}
                  </span>
                )}
              </button>
              
              <button 
                onClick={() => navigate('/client/profile')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-all shadow-sm hover:shadow-md"
              >
                Профиль
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CATEGORIES GRID */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span>📂</span> Категории товаров
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => navigate(`/client/catalog?category=${encodeURIComponent(cat.name)}`)}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all text-center group hover:-translate-y-1"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">📦</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{cat.name}</h3>
              <p className="text-sm text-gray-500">{cat.count} товаров</p>
            </button>
          ))}
        </div>
      </section>

      {/* POPULAR PRODUCTS */}
      <section className="max-w-7xl mx-auto px-4 py-8 bg-white rounded-2xl shadow-sm my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🔥</span> Популярные товары
          </h2>
          <button 
            onClick={() => navigate('/client/catalog?sort=popular')}
            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center gap-1 hover:gap-2 transition-all"
          >
            Смотреть все <span>→</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {popularProducts.slice(0, 10).map(product => (
            <ProductCard 
              key={product.id} 
              product={product}
              isFavorite={favorites.has(product.id)}
              onToggleFavorite={(e) => toggleFavorite(product.id, e)}
              onAddToCart={(e) => handleAddToCart(product, e)}
            />
          ))}
        </div>
      </section>

      {/* NEW PRODUCTS */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>✨</span> Новинки
          </h2>
          <button 
            onClick={() => navigate('/client/catalog?sort=new')}
            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center gap-1 hover:gap-2 transition-all"
          >
            Смотреть все <span>→</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {newProducts.slice(0, 10).map(product => (
            <ProductCard 
              key={product.id} 
              product={product}
              isFavorite={favorites.has(product.id)}
              onToggleFavorite={(e) => toggleFavorite(product.id, e)}
              onAddToCart={(e) => handleAddToCart(product, e)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

// 🔧 Компонент карточки товара (как в каталоге)
function ProductCard({ 
  product, 
  isFavorite, 
  onToggleFavorite, 
  onAddToCart 
}: { 
  product: Product
  isFavorite: boolean
  onToggleFavorite: (e: React.MouseEvent) => void
  onAddToCart: (e: React.MouseEvent) => void
}) {
  const navigate = useNavigate()

  return (
    <div 
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group hover:-translate-y-1 cursor-pointer"
      onClick={() => navigate(`/client/product/${product.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-square bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center overflow-hidden">
        <Package className="w-16 h-16 text-indigo-300 group-hover:scale-110 transition-transform duration-300" />
        {product.quantity === 0 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
            <span className="text-white font-bold text-sm bg-red-600 px-3 py-1.5 rounded-full shadow-lg">
              Нет в наличии
            </span>
          </div>
        )}
        {/* Favorite Button */}
        <button
          onClick={onToggleFavorite}
          className={`absolute top-3 right-3 p-2 rounded-full transition-all duration-200 shadow-md hover:scale-110 ${
            isFavorite 
              ? 'bg-red-500 text-white' 
              : 'bg-white text-gray-400 hover:text-red-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="text-xs text-gray-500 font-mono mb-1">{product.sku}</div>
        <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 h-12 hover:text-indigo-600 transition-colors">
          {product.name}
        </h3>
        {product.category && (
          <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mb-3 font-medium">
            {product.category}
          </span>
        )}

        {/* Rating */}
        {product.reviews_count && product.reviews_count > 0 && (
          <div className="flex items-center gap-1 mb-3">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${i < Math.round(product.rating || 0) ? 'fill-current' : ''}`} 
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-1">({product.reviews_count})</span>
          </div>
        )}

        {/* Price & Actions */}
        <div className="flex items-end justify-between gap-2 mt-3">
          <div>
            <div className="text-2xl font-bold text-indigo-600">
              {product.sale_price.toLocaleString('ru-RU')} ₽
            </div>
            <div className={`text-xs font-medium ${product.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {product.quantity > 0 ? `✓ ${product.quantity} шт.` : '✗ Нет в наличии'}
            </div>
          </div>

          <button
            onClick={onAddToCart}
            disabled={product.quantity === 0}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all duration-200 ${
              product.quantity > 0
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:scale-105'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs">В корзину</span>
          </button>
        </div>
      </div>
    </div>
  )
}