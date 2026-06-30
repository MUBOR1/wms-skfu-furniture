// pages/ProductDetail.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { request } from '../api/wms'
import { useCart } from '../context/CartContext'
import { 
  ShoppingCart, Heart, Star, Package, ChevronLeft, 
  MessageSquare, ThumbsUp, Upload, X, ZoomIn 
} from 'lucide-react'

interface Review {
  id: number
  user_name: string
  rating: number
  text: string | null
  photos: string[]
  is_verified: boolean
  created_at: string
  likes: number
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToCart, getTotalItems } = useCart()
  
  const [product, setProduct] = useState<any>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [isFavorited, setIsFavorited] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [newReview, setNewReview] = useState({ rating: 5, text: '', photos: [] as File[] })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (id) {
      loadProduct()
      loadReviews()
    }
  }, [id])

  // 🔥 ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ URL ИЗОБРАЖЕНИЯ
  const getImageUrl = (path: string | null | undefined): string | null => {
    if (!path) return null
    if (path.startsWith('http')) return path
    if (path.startsWith('/')) return `http://localhost:8000${path}`
    return `http://localhost:8000/${path}`
  }

  const loadProduct = async () => {
    try {
      const data = await request<any>(`/client/products/${id}`)
      setProduct(data)
      
      // 🔥 Устанавливаем главное фото
      if (data.images && data.images.length > 0) {
        setMainImage(data.images[0])
      } else if (data.image_url) {
        setMainImage(data.image_url)
      }
      
      const favs = await request<any[]>('/client/favorites')
      setIsFavorited(favs.some((f: any) => f.id === data.id))
    } catch (err) {
      console.error('Error loading product:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadReviews = async () => {
    try {
      const all = await request<Review[]>(`/client/products/${id}/reviews`)
      setReviews(all)
    } catch (err) {
      console.error('Error loading reviews:', err)
    }
  }

  const toggleFavorite = async () => {
    if (!id) return
    try {
      await request(`/client/favorites/${id}`, { method: 'POST' })
      setIsFavorited(!isFavorited)
    } catch (err: any) {
      console.error('Error toggling favorite:', err)
      alert('❌ Ошибка: ' + (err.message || 'Не удалось добавить в избранное'))
    }
  }

  const handleAddToCart = () => {
    if (product && product.quantity >= quantity) {
      addToCart(product, quantity)
      setQuantity(1)
    }
  }

  const handleLikeReview = async (reviewId: number) => {
    try {
      const res = await request<any>(`/client/reviews/${reviewId}/like`, { method: 'POST' })
      setReviews(prev => prev.map(r => 
        r.id === reviewId ? { ...r, likes: res.likes } : r
      ))
    } catch (err) {
      console.error('Error liking review:', err)
    }
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !newReview.text) return
    
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('product_id', id)
      formData.append('rating', String(newReview.rating))
      formData.append('text', newReview.text)
      
      newReview.photos.forEach((file) => {
        formData.append('files', file, file.name)
      })
      
      // 🔥 Получаем токен из sessionStorage
      const saved = sessionStorage.getItem('wms_auth')
      let token = null
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          token = parsed.token
        } catch {}
      }
      if (!token) {
        token = localStorage.getItem('wms_token')
      }
      
      const response = await fetch('/api/client/reviews', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Ошибка отправки')
      }
      
      setShowReviewForm(false)
      setNewReview({ rating: 5, text: '', photos: [] })
      
      await loadReviews()
      await loadProduct()
      
      alert('✅ Отзыв отправлен на модерацию')
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Товар не найден</p>
      </div>
    )
  }

  // 🔥 Получаем список изображений для отображения
  const productImages = product.images && product.images.length > 0 
    ? product.images 
    : product.image_url 
      ? [product.image_url] 
      : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="w-5 h-5" />
            Назад
          </button>
          
          {getTotalItems() > 0 && (
            <button 
              onClick={() => navigate('/client/cart')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700"
            >
              🛒 {getTotalItems()} шт.
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Product Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 🔥 Images с фото из БД */}
            <div className="space-y-4">
              {/* 🔥 ГЛАВНОЕ ФОТО - РАСТЯГИВАЕТСЯ НА ВСЮ КАРТОЧКУ */}
              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {mainImage && !imageError ? (
                  <img 
                    src={getImageUrl(mainImage) || ''}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <Package className="w-24 h-24 text-gray-300" />
                )}
              </div>
              
              {/* 🔥 МИНИАТЮРЫ */}
              {productImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {productImages.map((img: string, i: number) => {
                    const imgUrl = getImageUrl(img)
                    return (
                      <div 
                        key={i} 
                        className={`w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-indigo-500 overflow-hidden flex-shrink-0 transition-all ${
                          mainImage === img ? 'ring-2 ring-indigo-500' : ''
                        }`}
                        onClick={() => {
                          setMainImage(img)
                          setImageError(false)
                        }}
                      >
                        <img 
                          src={imgUrl || ''}
                          alt={`Фото ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiLz48Y2lyY2xlIGN4PSI5IiBjeT0iOSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgMTIgMTQgOSAxMSA0IDE2IDQgMjEiLz48L3N2Zz4='
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Details */}
            <div>
              <div className="text-sm text-gray-500 font-mono mb-2">{product.sku}</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">{product.name}</h1>
              
              {product.category && (
                <span className="inline-block text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full mb-4">
                  {product.category}
                </span>
              )}

              {product.description && (
                <p className="text-gray-600 mb-6">{product.description}</p>
              )}

              {/* Rating */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < Math.round(product.rating || 0) ? 'fill-current' : ''}`} />
                  ))}
                </div>
                <span className="text-gray-600">
                  {product.rating || 0} • {product.reviews_count || 0} отзывов
                </span>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="text-3xl font-bold text-indigo-600 mb-2">
                  {product.sale_price.toLocaleString('ru-RU')} ₽
                </div>
                <div className={`text-sm ${product.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {product.quantity > 0 ? `✓ В наличии: ${product.quantity} шт.` : '✗ Нет в наличии'}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Количество:</label>
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button 
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="px-3 py-2 hover:bg-gray-50"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 text-center border-0 focus:ring-0"
                      min={1}
                      max={product.quantity || 999}
                    />
                    <button 
                      onClick={() => setQuantity(q => Math.min(product.quantity || 999, q + 1))}
                      className="px-3 py-2 hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={product.quantity === 0}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                      product.quantity > 0
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    В корзину
                  </button>
                  
                  <button
                    onClick={toggleFavorite}
                    className={`relative z-10 p-3 rounded-lg border transition-colors ${
                      isFavorited 
                        ? 'border-red-200 bg-red-50 text-red-600' 
                        : 'border-gray-300 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Отзывы ({reviews.length})</h2>
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <MessageSquare className="w-5 h-5" />
              Написать отзыв
            </button>
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <form onSubmit={handleReviewSubmit} className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Оценка</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setNewReview(prev => ({ ...prev, rating }))}
                      className={`p-1 ${newReview.rating >= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
              
              <textarea
                placeholder="Ваш отзыв..."
                value={newReview.text}
                onChange={(e) => setNewReview(prev => ({ ...prev, text: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
                rows={4}
              />
              
              {/* Photo Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Фото (до 5)</label>
                <div className="flex flex-wrap gap-2">
                  {newReview.photos.map((file, idx) => (
                    <div key={idx} className="relative">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="" 
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setNewReview(prev => ({
                          ...prev,
                          photos: prev.photos.filter((_, i) => i !== idx)
                        }))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {newReview.photos.length < 5 && (
                    <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-indigo-500">
                      <Upload className="w-6 h-6 text-gray-400" />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          setNewReview(prev => ({
                            ...prev,
                            photos: [...prev.photos, ...files].slice(0, 5)
                          }))
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || !newReview.text}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Отправка...' : 'Отправить'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          {/* Reviews List */}
          <div className="space-y-6">
            {reviews.map(review => (
              <div key={review.id} className="border-b border-gray-200 pb-6 last:border-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{review.user_name}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : ''}`} />
                        ))}
                      </div>
                      {review.is_verified && (
                        <span className="text-green-600">✓ Проверенная покупка</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(review.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                
                {review.text && (
                  <p className="mt-3 text-gray-700">{review.text}</p>
                )}
                
                {/* 🔥 Фото с превью и кликабельные */}
                {review.photos && review.photos.length > 0 && (
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {review.photos.map((photo, idx) => {
                      if (!photo) return null
                      const imgSrc = getImageUrl(photo) || ''
                      return (
                        <div 
                          key={idx}
                          className="relative group cursor-pointer"
                          onClick={() => setSelectedPhoto(photo)}
                        >
                          <img 
                            src={imgSrc}
                            alt={`Фото отзыва ${idx + 1}`}
                            className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:border-indigo-500 transition-all hover:shadow-md"
                            onError={(e) => {
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjkuNSIgY3k9IjkuNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgMTIgMTQgOSAxMSA0IDE2IDQgMjEiLz48L3N2Zz4='
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-all flex items-center justify-center">
                            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                
                <button
                  onClick={() => handleLikeReview(review.id)}
                  className="mt-3 flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600"
                >
                  <ThumbsUp className="w-4 h-4" />
                  {review.likes}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 🔥 Модалка для просмотра фото */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img 
              src={getImageUrl(selectedPhoto) || ''}
              alt="Полноразмерное фото"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIi8+PGNpcmNsZSBjeD0iOS41IiBjeT0iOS41IiByPSIxLjUiLz48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCAxMiAxNCA5IDExIDQgMTYgNCAyMSIvPjwvc3ZnPg=='
              }}
            />
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors p-2"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}