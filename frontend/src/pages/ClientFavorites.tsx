// src/pages/ClientFavorites.tsx
import { useEffect, useState } from 'react'
import { request } from '../api/wms'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { Heart, ShoppingBag, Package, Trash2, ChevronLeft } from 'lucide-react'

interface FavoriteItem {
  id: number
  sku: string
  name: string
  category: string | null
  sale_price: number
  quantity: number
}

export default function ClientFavorites() {
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    try {
      const data = await request<FavoriteItem[]>('/client/favorites')
      setFavorites(data)
    } catch (err) {
      console.error('Error loading favorites:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const removeFromFavorites = async (productId: number) => {
    try {
      await request(`/client/favorites/${productId}`, { method: 'POST' })
      setFavorites(prev => prev.filter(f => f.id !== productId))
    } catch (err) {
      console.error('Error removing favorite:', err)
    }
  }

  const handleAddToCart = (item: FavoriteItem) => {
    if (item.quantity > 0) {
      addToCart(item, 1)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Heart className="w-7 h-7 text-red-600" />
          Избранное
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Назад</span>
        </button>

        {favorites.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium text-lg">Список избранного пуст</p>
            <button
              onClick={() => navigate('/client/catalog')}
              className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Перейти в каталог
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {favorites.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4 hover:shadow-md transition-shadow">
                {/* Image */}
                <div 
                  className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer flex-shrink-0"
                  onClick={() => navigate(`/client/product/${item.id}`)}
                >
                  <Package className="w-10 h-10 text-gray-300" />
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="text-xs text-gray-500 font-mono">{item.sku}</div>
                  <h3 
                    className="font-bold text-gray-900 cursor-pointer hover:text-indigo-600"
                    onClick={() => navigate(`/client/product/${item.id}`)}
                  >
                    {item.name}
                  </h3>
                  {item.category && (
                    <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mt-1">
                      {item.category}
                    </span>
                  )}
                  <div className="mt-2 flex items-center gap-4">
                    <div className="text-lg font-bold text-indigo-600">
                      {item.sale_price.toLocaleString('ru-RU')} ₽
                    </div>
                    <div className={`text-sm ${item.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.quantity > 0 ? `✓ В наличии: ${item.quantity} шт.` : '✗ Нет в наличии'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 justify-center">
                  <button
                    onClick={() => handleAddToCart(item)}
                    disabled={item.quantity === 0}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      item.quantity > 0
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    В корзину
                  </button>
                  <button
                    onClick={() => removeFromFavorites(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Удалить из избранного"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}