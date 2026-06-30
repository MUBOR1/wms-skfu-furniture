// src/components/ProductCard.tsx
import { Link } from 'react-router-dom'
import { ShoppingCart, Heart } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ProductCardProps {
  id: number
  sku: string
  name: string
  category: string | null
  sale_price: number
  stock_quantity?: number
  image_url?: string | null
  isFavorite?: boolean
  onToggleFavorite?: (id: number) => void
  onAddToCart?: (id: number) => void
}

export default function ProductCard({
  id,
  sku,
  name,
  category,
  sale_price,
  stock_quantity = 0,
  image_url,
  isFavorite = false,
  onToggleFavorite,
  onAddToCart
}: ProductCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageSrc, setImageSrc] = useState<string>('')

  useEffect(() => {
    // 🔥 ФОРМИРУЕМ URL ДЛЯ ИЗОБРАЖЕНИЯ
    if (image_url) {
      if (image_url.startsWith('http')) {
        setImageSrc(image_url)
      } else if (image_url.startsWith('/')) {
        setImageSrc(`http://localhost:8000${image_url}`)
      } else {
        setImageSrc(`http://localhost:8000/${image_url}`)
      }
    } else {
      // 🔥 ПЫТАЕМСЯ ЗАГРУЗИТЬ ИЗОБРАЖЕНИЕ ПО УМОЛЧАНИЮ
      setImageSrc(`http://localhost:8000/api/catalog/products/${id}/image`)
    }
  }, [id, image_url])

  const handleImageError = () => {
    console.warn(`⚠️ Не удалось загрузить изображение для товара ${id}`)
    setImageError(true)
  }

  const inStock = stock_quantity > 0

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
      {/* 🔥 ИЗОБРАЖЕНИЕ - РАСТЯГИВАЕТСЯ НА ВСЮ КАРТОЧКУ */}
      <Link to={`/client/product/${id}`} className="block aspect-square bg-gray-100 overflow-hidden relative">
        {!imageError && imageSrc ? (
          <img
            src={imageSrc}
            alt={name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="text-5xl mb-2">📦</div>
              <span className="text-xs text-gray-400">Нет фото</span>
            </div>
          </div>
        )}
        
        {/* 🔥 БЕЙДЖ "НЕТ В НАЛИЧИИ" */}
        {!inStock && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            Нет в наличии
          </div>
        )}
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <Link to={`/client/product/${id}`} className="flex-1">
          <h3 className="font-medium text-gray-900 hover:text-indigo-600 transition-colors line-clamp-1 text-sm">
            {name}
          </h3>
          <p className="text-xs text-gray-400 mb-1">{sku}</p>
          {category && (
            <p className="text-xs text-gray-400 mb-2">{category}</p>
          )}
          <p className="text-lg font-bold text-indigo-600">
            {sale_price.toLocaleString()} ₽
          </p>
          <p className={`text-xs ${inStock ? 'text-green-600' : 'text-red-500'}`}>
            {inStock ? `✅ ${stock_quantity} шт.` : '❌ Нет в наличии'}
          </p>
        </Link>

        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => onToggleFavorite?.(id)}
            className={`p-2 rounded-lg transition-colors ${
              isFavorite 
                ? 'bg-red-50 text-red-500 hover:bg-red-100' 
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          
          <button
            onClick={() => onAddToCart?.(id)}
            disabled={!inStock}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
              inStock
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{inStock ? 'В корзину' : 'Нет'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}