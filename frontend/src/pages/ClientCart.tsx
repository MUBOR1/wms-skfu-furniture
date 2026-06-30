// src/pages/ClientCart.tsx
import { useEffect, useState } from 'react'
import { request } from '../api/wms'
import { useCart } from '../context/CartContext'
import { useNavigate } from 'react-router-dom'
import { 
  Trash2, Minus, Plus, ShoppingBag, MapPin, Truck, CreditCard, 
  CheckCircle, ChevronDown, ChevronLeft
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface CartItem {
  cart_item_id: number
  product_id: number
  sku: string
  name: string
  sale_price: number
  quantity: number
  available: number
  item_total: number
}

interface PickupPoint {
  id: number
  name: string
  address: string
  lat: number
  lon: number
  work_hours: string
  distance?: number
}

interface ProfileData {
  user: {
    id: number
    login: string
    full_name: string | null
    email: string
  }
  profile: {
    phone: string | null
    avatar_url: string | null
  }
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lon], map.getZoom())
  }, [lat, lon, map])
  return null
}

export default function ClientCart() {
  const navigate = useNavigate()
  const { updateQuantity, removeFromCart, clearCart, getTotalPrice, items } = useCart()
  
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedPickup, setSelectedPickup] = useState<PickupPoint | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([])
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'courier'>('pickup')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [orderComment, setOrderComment] = useState('')  // 👈 НОВОЕ СОСТОЯНИЕ

  useEffect(() => {
    syncCartWithBackend()
    loadPickupPoints()
    loadProfile()
  }, [])

  // 🔥 ЗАГРУЗКА ПРОФИЛЯ
  const loadProfile = async () => {
    try {
      const data = await request<ProfileData>('/client/profile')
      setProfile(data)
    } catch (err) {
      console.error('Error loading profile:', err)
    }
  }

  // 🔥 СИНХРОНИЗАЦИЯ КОРЗИНЫ
  const syncCartWithBackend = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    setError(null)
    
    try {
      console.log('🔄 Синхронизация корзины...')
      console.log('📦 Локальные товары:', items)
      
      const backendData = await request<{ items: CartItem[]; total: number }>('/client/cart')
      console.log('📦 Товары на бэкенде:', backendData.items)
      
      const backendProductIds = new Set(backendData.items.map(item => item.product_id))
      const localProductIds = new Set(items.map(item => item.product_id))
      
      for (const localItem of items) {
        if (!backendProductIds.has(localItem.product_id)) {
          console.log(`⬆️ Отправка на бэкенд: ${localItem.name} (${localItem.quantity} шт.)`)
          await request('/client/cart', {
            method: 'POST',
            body: JSON.stringify({
              product_id: localItem.product_id,
              quantity: localItem.quantity
            })
          })
        } else {
          const backendItem = backendData.items.find(
            item => item.product_id === localItem.product_id
          )
          if (backendItem && backendItem.quantity !== localItem.quantity) {
            console.log(`🔄 Обновление количества: ${localItem.name} ${backendItem.quantity} → ${localItem.quantity}`)
            await request('/client/cart', {
              method: 'PUT',
              body: JSON.stringify({
                product_id: localItem.product_id,
                quantity: localItem.quantity
              })
            })
          }
        }
      }
      
      for (const backendItem of backendData.items) {
        if (!localProductIds.has(backendItem.product_id)) {
          console.log(`⬇️ Удаление с бэкенда: ${backendItem.name}`)
          await request(`/client/cart/${backendItem.product_id}`, {
            method: 'DELETE'
          })
        }
      }
      
      await loadCart()
      console.log('✅ Синхронизация завершена')
    } catch (err: any) {
      console.error('❌ Ошибка синхронизации:', err)
      setError(err.message || 'Ошибка синхронизации корзины')
      await loadCart()
    } finally {
      setIsSyncing(false)
    }
  }

  const loadCart = async () => {
    try {
      console.log('🔄 Загрузка корзины...')
      const data = await request<{ items: CartItem[]; total: number }>('/client/cart')
      console.log('✅ Данные корзины:', data)
      setCartItems(data.items || [])
    } catch (err: any) {
      console.error('❌ Ошибка загрузки корзины:', err)
      setError(err.message || 'Не удалось загрузить корзину')
    } finally {
      setIsLoading(false)
    }
  }

  const loadPickupPoints = async () => {
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords
            const points = await request<PickupPoint[]>(
              `/client/pickup-points?lat=${latitude}&lon=${longitude}`
            )
            setPickupPoints(points)
          },
          async () => {
            const points = await request<PickupPoint[]>('/client/pickup-points')
            setPickupPoints(points)
          }
        )
      } else {
        const points = await request<PickupPoint[]>('/client/pickup-points')
        setPickupPoints(points)
      }
    } catch (err) {
      console.error('Error loading pickup points:', err)
    }
  }

  const handleRemoveItem = async (productId: number) => {
    console.log(`🗑️ Удаление товара product_id=${productId}`)
    try {
      await request(`/client/cart/${productId}`, { 
        method: 'DELETE' 
      })
      removeFromCart(productId)
      await loadCart()
      console.log(`✅ Товар ${productId} удален`)
    } catch (err: any) {
      console.error('❌ Ошибка удаления:', err)
      alert('❌ Ошибка: ' + (err.message || 'Не удалось удалить товар'))
      await loadCart()
    }
  }

  const handleUpdateQuantity = async (productId: number, newQuantity: number) => {
    console.log(`🔄 Обновление количества: product_id=${productId}, newQuantity=${newQuantity}`)
    
    if (newQuantity < 1) {
      await handleRemoveItem(productId)
      return
    }
    
    try {
      await request('/client/cart', {
        method: 'PUT',
        body: JSON.stringify({
          product_id: productId,
          quantity: newQuantity
        })
      })
      updateQuantity(productId, newQuantity)
      await loadCart()
    } catch (err: any) {
      console.error('❌ Ошибка обновления количества:', err)
      alert('❌ Ошибка: ' + (err.message || 'Не удалось обновить количество'))
      await loadCart()
    }
  }

  const handleClearCart = async () => {
    if (!confirm('Вы уверены, что хотите очистить корзину?')) return
    
    try {
      await request('/client/cart', { method: 'DELETE' })
      clearCart()
      await loadCart()
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    }
  }

  // 🔥 ИСПРАВЛЕННЫЙ CHECKOUT С КОММЕНТАРИЕМ
  const handleCheckout = async () => {
    if (cartItems.length === 0) return
    if (deliveryMethod === 'pickup' && !selectedPickup) {
      alert('Выберите пункт выдачи')
      return
    }
    if (deliveryMethod === 'courier' && !deliveryAddress) {
      alert('Введите адрес доставки')
      return
    }

    setIsSubmitting(true)
    try {
      console.log('📤 Отправка заказа:', {
        delivery_method: deliveryMethod,
        delivery_address: deliveryAddress,
        pickup_point_id: selectedPickup?.id,
        client_phone: profile?.profile?.phone || '',
        client_email: profile?.user?.email || '',
        comment: orderComment
      })

      const res = await request('/client/cart/checkout', { 
        method: 'POST',
        body: JSON.stringify({
          delivery_method: deliveryMethod,
          delivery_address: deliveryAddress,
          pickup_point_id: selectedPickup?.id,
          client_phone: profile?.profile?.phone || '',
          client_email: profile?.user?.email || '',
          comment: orderComment  // 👈 ДОБАВЛЯЕМ КОММЕНТАРИЙ
        })
      }) as any
      
      console.log('✅ Заказ создан:', res)
      
      clearCart()
      alert(`✅ Заказ ${res.order_number} создан и отправлен на подтверждение!`)
      navigate('/client/profile')
    } catch (err: any) {
      console.error('❌ Ошибка:', err)
      alert('❌ Ошибка: ' + (err.message || 'Не удалось создать заказ'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || isSyncing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-500">{isSyncing ? 'Синхронизация...' : 'Загрузка...'}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ошибка загрузки</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => { setError(null); loadCart(); }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Повторить
          </button>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <ShoppingBag className="w-24 h-24 mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Корзина пуста</h2>
          <p className="text-gray-500 mb-6">Добавьте товары из каталога</p>
          <button
            onClick={() => navigate('/client/catalog')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            Перейти в каталог
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Назад</span>
          </button>
          
          <button
            onClick={handleClearCart}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            🗑️ Очистить корзину
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">🛒 Корзина</h1>

        {/* Cart Items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Товар</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Кол-во</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Цена</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Сумма</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cartItems.map(item => (
                  <tr key={item.cart_item_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500 font-mono">{item.sku}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                          disabled={item.quantity <= 0}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                          disabled={item.quantity >= item.available}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {item.sale_price.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-600">
                      {item.item_total.toLocaleString('ru-RU')} ₽
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.product_id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить товар"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-900">
                    Итого:
                  </td>
                  <td className="px-4 py-3 text-right text-2xl font-bold text-indigo-600">
                    {getTotalPrice().toLocaleString('ru-RU')} ₽
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Delivery Options */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🚚 Доставка</h3>
          
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setDeliveryMethod('pickup')}
              className={`flex-1 p-4 border rounded-lg text-left transition-all ${
                deliveryMethod === 'pickup'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin className={`w-5 h-5 ${deliveryMethod === 'pickup' ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div>
                  <div className="font-medium">Самовывоз</div>
                  <div className="text-sm text-gray-500">Бесплатно • Сегодня</div>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => setDeliveryMethod('courier')}
              className={`flex-1 p-4 border rounded-lg text-left transition-all ${
                deliveryMethod === 'courier'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <Truck className={`w-5 h-5 ${deliveryMethod === 'courier' ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div>
                  <div className="font-medium">Курьер</div>
                  <div className="text-sm text-gray-500">300 ₽ • Завтра</div>
                </div>
              </div>
            </button>
          </div>

          {deliveryMethod === 'pickup' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-700">Выберите пункт выдачи</h4>
                <button
                  onClick={() => setShowMap(!showMap)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  {showMap ? 'Скрыть карту' : 'Показать карту'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showMap ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showMap && pickupPoints.length > 0 && (
                <div className="mb-4 h-64 rounded-lg overflow-hidden border border-gray-200">
                  <MapContainer 
                    center={[pickupPoints[0].lat, pickupPoints[0].lon]} 
                    zoom={13} 
                    className="h-full w-full"
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap contributors'
                    />
                    {pickupPoints.map(point => (
                      <Marker 
                        key={point.id} 
                        position={[point.lat, point.lon]}
                        eventHandlers={{
                          click: () => setSelectedPickup(point)
                        }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <div className="font-bold">{point.name}</div>
                            <div>{point.address}</div>
                            <div className="text-gray-500">{point.work_hours}</div>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {selectedPickup && (
                      <Recenter lat={selectedPickup.lat} lon={selectedPickup.lon} />
                    )}
                  </MapContainer>
                </div>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pickupPoints.map(point => (
                  <label
                    key={point.id}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedPickup?.id === point.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pickup"
                      checked={selectedPickup?.id === point.id}
                      onChange={() => setSelectedPickup(point)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{point.name}</div>
                      <div className="text-sm text-gray-600">{point.address}</div>
                      <div className="text-xs text-gray-500">{point.work_hours}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {deliveryMethod === 'courier' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Адрес доставки</label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="г. Ставрополь, ул. Ленина, д. 1, кв. 1"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* 💬 Комментарий к заказу */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">💬 Комментарий к заказу</h3>
          <textarea
            value={orderComment}
            onChange={(e) => setOrderComment(e.target.value)}
            placeholder="Добавьте комментарий к заказу (необязательно)..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            rows={3}
          />
        </div>

        {/* Payment & Checkout */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">💳 Оплата</h3>
          
          <div className="space-y-3 mb-6">
            <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500">
              <input type="radio" name="payment" defaultChecked className="w-4 h-4" />
              <CreditCard className="w-5 h-5 text-gray-400" />
              <div>
                <div className="font-medium">Банковская карта</div>
                <div className="text-sm text-gray-500">Visa, Mastercard, МИР</div>
              </div>
            </label>
            
            <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500">
              <input type="radio" name="payment" className="w-4 h-4" />
              <div className="w-5 h-5 bg-green-100 rounded flex items-center justify-center text-green-600 text-xs font-bold">СБП</div>
              <div>
                <div className="font-medium">СБП</div>
                <div className="text-sm text-gray-500">Система быстрых платежей</div>
              </div>
            </label>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => navigate('/client/catalog')}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Продолжить покупки
            </button>
            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Обработка...
                </>
              ) : (
                <>
                  Оформить заказ
                  <CheckCircle className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}