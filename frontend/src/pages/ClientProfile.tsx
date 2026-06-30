// src/pages/ClientProfile.tsx
import { useEffect, useState } from 'react'
import { request } from '../api/wms'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  User, Package, Clock, CheckCircle, XCircle,
  Heart, Settings, LogOut, Trash2, ShoppingBag, Camera,
  RotateCcw, ChevronRight, X, Calendar, DollarSign,
  Truck, ShoppingCart, Eye
} from 'lucide-react'
import { useCart } from '../context/CartContext'

interface Order {
  id: number
  order_number: string
  status: string
  total_amount: number
  created_at: string
  items?: Array<{
    product_id: number
    quantity: number
    unit_price: number
    total_price: number
    product?: {
      name: string
      sku: string
    }
  }>
  delivery_method?: string
  delivery_address?: string
  comment?: string
}

interface FavoriteItem {
  id: number
  sku: string
  name: string
  category: string | null
  sale_price: number
  quantity: number
}

interface OrderDetail extends Order {
  items: Array<{
    product_id: number
    quantity: number
    unit_price: number
    total_price: number
    product?: {
      name: string
      sku: string
    }
  }>
  delivery_method?: string
  delivery_address?: string
  comment?: string
}

export default function ClientProfile() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { addToCart } = useCart()
  
  const [profile, setProfile] = useState<any>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [activeTab, setActiveTab] = useState<'orders' | 'favorites' | 'settings'>('orders')
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: ''
  })

  // 🔥 Модалка деталей заказа
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [isOrderLoading, setIsOrderLoading] = useState(false)

  // 🔥 Модалка причины отмены/возврата
  const [actionModal, setActionModal] = useState<{
    type: 'cancel' | 'return'
    orderId: number
    isOpen: boolean
  }>({ type: 'cancel', orderId: 0, isOpen: false })
  const [reasonText, setReasonText] = useState('')
  const [isActionSubmitting, setIsActionSubmitting] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (activeTab === 'favorites') {
      loadFavorites()
    }
  }, [activeTab])

  const loadProfile = async () => {
    try {
      console.log('🔄 Загрузка профиля...')
      const data = await request<any>('/client/profile')
      console.log('✅ Профиль загружен:', data)
      
      setProfile(data)
      setOrders(data.recent_orders || [])
      setFormData({
        full_name: data.user?.full_name || '',
        phone: data.profile?.phone || '',
        email: data.user?.email || data.user?.login || ''
      })
    } catch (err) {
      console.error('❌ Error loading profile:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadFavorites = async () => {
    try {
      const data = await request<FavoriteItem[]>('/client/favorites')
      setFavorites(data)
    } catch (err) {
      console.error('Error loading favorites:', err)
    }
  }

  const removeFromFavorites = async (productId: number) => {
    try {
      await request(`/client/favorites/${productId}`, { method: 'POST' })
      setFavorites((prev: FavoriteItem[]) => prev.filter(f => f.id !== productId))
    } catch (err) {
      console.error('Error removing favorite:', err)
    }
  }

  const handleAddToCart = (item: FavoriteItem) => {
    if (item.quantity > 0) {
      addToCart(item, 1)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('📤 Отправка данных профиля:', formData)
    
    try {
      const response = await fetch('/api/client/profile', {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('wms_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          phone: formData.phone,
          email: formData.email
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Ошибка обновления')
      }
      
      await loadProfile()
      setIsEditing(false)
      alert('✅ Профиль обновлён')
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log('📤 Загрузка фото:', file.name)

    if (file.size > 5 * 1024 * 1024) {
      alert('❌ Фото слишком большое. Максимум 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('❌ Загрузите изображение')
      return
    }

    try {
      const formDataPhoto = new FormData()
      formDataPhoto.append('file', file)

      const response = await fetch('/api/client/profile/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('wms_token')}`
        },
        body: formDataPhoto
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Ошибка загрузки фото')
      }

      const result = await response.json()
      console.log('✅ Фото загружено:', result)
      
      setProfile((prev: any) => ({
        ...prev,
        profile: {
          ...prev?.profile,
          avatar_url: result.avatar_url
        }
      }))
      
      alert('✅ Фото профиля обновлено')
    } catch (err: any) {
      console.error('❌ Ошибка загрузки:', err)
      alert('❌ Ошибка: ' + err.message)
    }
  }

  // 🔥 ОТКРЫТИЕ ДЕТАЛЕЙ ЗАКАЗА
  const openOrderDetails = async (orderId: number) => {
    setIsOrderLoading(true)
    setIsOrderModalOpen(true)
    try {
      const data = await request<OrderDetail>(`/orders/${orderId}`)
      setSelectedOrder(data)
    } catch (err) {
      console.error('Ошибка загрузки деталей:', err)
      alert('Не удалось загрузить детали заказа')
    } finally {
      setIsOrderLoading(false)
    }
  }

  // 🔥 ОТКРЫТИЕ МОДАЛКИ ПРИЧИНЫ
  const openActionModal = (type: 'cancel' | 'return', orderId: number) => {
    setActionModal({ type, orderId, isOpen: true })
    setReasonText('')
  }

  // 🔥 ОТПРАВКА ЗАПРОСА НА ОТМЕНУ (клиент → менеджер)
  const submitCancelRequest = async () => {
    if (!reasonText.trim()) {
      alert('Пожалуйста, укажите причину отмены')
      return
    }

    setIsActionSubmitting(true)
    try {
      await request(`/orders/${actionModal.orderId}/cancel-request`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reasonText.trim() })
      })
      alert('✅ Запрос на отмену отправлен! Ожидайте подтверждения менеджера.')
      setActionModal({ type: 'cancel', orderId: 0, isOpen: false })
      loadProfile()
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    } finally {
      setIsActionSubmitting(false)
    }
  }

  // 🔥 ОТПРАВКА ЗАПРОСА НА ВОЗВРАТ (клиент → менеджер)
  const submitReturnRequest = async () => {
    if (!reasonText.trim()) {
      alert('Пожалуйста, укажите причину возврата')
      return
    }

    setIsActionSubmitting(true)
    try {
      await request(`/orders/${actionModal.orderId}/return-request`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: reasonText.trim() })
      })
      alert('✅ Запрос на возврат отправлен! Ожидайте подтверждения менеджера.')
      setActionModal({ type: 'return', orderId: 0, isOpen: false })
      loadProfile()
    } catch (err: any) {
      alert('❌ Ошибка: ' + err.message)
    } finally {
      setIsActionSubmitting(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: any }> = {
      waiting_approval: { label: 'Ожидает подтверждения', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
      pending: { label: 'В обработке', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Package },
      processing: { label: 'Обрабатывается', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Package },
      shipped: { label: 'Отгружен', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck },
      delivered: { label: 'Доставлен', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
      cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
      returned: { label: 'Возвращён', color: 'bg-pink-100 text-pink-700 border-pink-200', icon: RotateCcw },
    }
    return configs[status] || configs.pending
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  const avatarUrl = profile?.profile?.avatar_url || null
  const displayName = profile?.user?.full_name || profile?.user?.login || 'Клиент'
  const displayEmail = profile?.user?.email || profile?.user?.login || 'Нет email'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-indigo-200">
                {avatarUrl ? (
                  <img 
                    src={`http://localhost:8000${avatarUrl}`}
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9IiM2MzY2ZjEiIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg=='
                    }}
                  />
                ) : (
                  <User className="w-8 h-8 text-indigo-600" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1 rounded-full hover:bg-indigo-700 transition-colors shadow-md cursor-pointer">
                <Camera className="w-3 h-3" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handlePhotoUpload} 
                />
              </label>
            </div>
            
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
              <p className="text-sm text-gray-500">{displayEmail}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {[
            { id: 'orders', label: 'Заказы', icon: ShoppingCart },
            { id: 'favorites', label: 'Избранное', icon: Heart },
            { id: 'settings', label: 'Настройки', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === 'orders' ? 'Заказы' : tab.id === 'favorites' ? '❤️' : '⚙️'}</span>
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Мои заказы</h2>
              <span className="text-sm text-gray-500">Всего: {orders.length}</span>
            </div>
            
            {orders.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium">У вас пока нет заказов</p>
                <button
                  onClick={() => navigate('/client/catalog')}
                  className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Перейти в каталог
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const status = getStatusConfig(order.status)
                  
                  // 🔥 ПРАВИЛЬНЫЕ УСЛОВИЯ ДЛЯ КНОПОК
                  const canCancel = ['waiting_approval', 'pending', 'processing'].includes(order.status)
                  const canReturn = order.status === 'delivered'
                  const isCancelled = order.status === 'cancelled'
                  const isReturned = order.status === 'returned'
                  const isShippedOrDelivered = ['shipped', 'delivered'].includes(order.status)
                  const hasCancelRequest = order.comment?.includes('[ЗАПРОС НА ОТМЕНУ]')
                  const hasReturnRequest = order.comment?.includes('[ЗАПРОС НА ВОЗВРАТ]')
                  
                  return (
                    <div 
                      key={order.id} 
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
                      onClick={() => openOrderDetails(order.id)}
                    >
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Левая часть */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium text-gray-700">
                              {order.order_number}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                              <status.icon className="w-3 h-3" />
                              {status.label}
                            </span>
                            {isReturned && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700 border-pink-200">
                                <RotateCcw className="w-3 h-3" />
                                Возвращён
                              </span>
                            )}
                            {hasCancelRequest && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                ⏳ Запрос на отмену
                              </span>
                            )}
                            {hasReturnRequest && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                ⏳ Запрос на возврат
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-4 flex-wrap text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {order.created_at ? new Date(order.created_at).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              }) : 'Дата не указана'}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-gray-900">
                              <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                              {order.total_amount.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                        </div>
                        
                        {/* Правая часть с кнопками */}
                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                          {/* Кнопка просмотра */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              openOrderDetails(order.id)
                            }}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Подробнее"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          {/* 🔥 КНОПКА ОТМЕНЫ — ТОЛЬКО ДО ОТГРУЗКИ */}
                          {canCancel && !isCancelled && !isReturned && !hasCancelRequest && !isShippedOrDelivered && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openActionModal('cancel', order.id)
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Отменить
                            </button>
                          )}
                          
                          {/* 🔥 КНОПКА ВОЗВРАТА — ТОЛЬКО ДЛЯ ДОСТАВЛЕННЫХ */}
                          {canReturn && !isReturned && !hasReturnRequest && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openActionModal('return', order.id)
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Вернуть
                            </button>
                          )}
                          
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Избранное</h2>
            {favorites.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 font-medium">Список избранного пуст</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {favorites.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400 font-mono">{item.sku}</div>
                        <h3 className="font-medium text-gray-900 truncate text-sm">{item.name}</h3>
                        {item.category && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-0.5 inline-block">{item.category}</span>}
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-bold text-indigo-600 text-sm">{item.sale_price.toLocaleString('ru-RU')} ₽</span>
                          <span className={`text-xs ${item.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.quantity > 0 ? `✓ ${item.quantity} шт.` : '✗ Нет в наличии'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => handleAddToCart(item)} 
                          disabled={item.quantity === 0} 
                          className={`p-1.5 rounded-lg transition-colors ${item.quantity > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => removeFromFavorites(item.id)} 
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Настройки профиля</h2>
            
            <form onSubmit={handleUpdateProfile} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ФИО</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  disabled={!isEditing}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Телефон</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!isEditing}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!isEditing}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-50"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                {isEditing ? (
                  <>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false)
                        loadProfile()
                      }}
                      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                    >
                      Отмена
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                  >
                    Редактировать
                  </button>
                )}
              </div>
            </form>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Выйти из аккаунта
            </button>
          </div>
        )}
      </main>

      {/* 👇 МОДАЛКА ДЕТАЛЕЙ ЗАКАЗА */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/80">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Детали заказа</h3>
                <p className="text-sm text-gray-500 font-mono">{selectedOrder?.order_number}</p>
              </div>
              <button 
                onClick={() => { setIsOrderModalOpen(false); setSelectedOrder(null) }}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {isOrderLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent" />
                </div>
              ) : selectedOrder ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusConfig(selectedOrder.status).color}`}>
                      {(() => {
                        const Icon = getStatusConfig(selectedOrder.status).icon
                        return <Icon className="w-4 h-4" />
                      })()}
                      {getStatusConfig(selectedOrder.status).label}
                    </span>
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Дата не указана'}
                    </span>
                  </div>

                  {selectedOrder.delivery_method && (
                    <div className="bg-gray-50 rounded-xl p-3 text-sm">
                      <span className="font-medium text-gray-700">🚚 Доставка:</span>
                      <span className="ml-2 text-gray-600">
                        {selectedOrder.delivery_method === 'pickup' ? 'Самовывоз' : 'Курьер'}
                        {selectedOrder.delivery_address && ` • ${selectedOrder.delivery_address}`}
                      </span>
                    </div>
                  )}

                  {selectedOrder.comment && (
                    <div className="bg-yellow-50 rounded-xl p-3 text-sm border border-yellow-200">
                      <span className="font-medium text-gray-700">💬 Комментарий:</span>
                      <span className="ml-2 text-gray-600 whitespace-pre-wrap">{selectedOrder.comment}</span>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Товары в заказе:</h4>
                    <div className="space-y-2">
                      {selectedOrder.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                          <div>
                            <div className="font-medium text-gray-900">
                              {item.product?.name || `Товар #${item.product_id}`}
                            </div>
                            {item.product?.sku && (
                              <div className="text-xs text-gray-400 font-mono">{item.product.sku}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">{item.quantity} шт. × {item.unit_price.toLocaleString()} ₽</div>
                            <div className="font-semibold text-indigo-600">{item.total_price.toLocaleString()} ₽</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                    <span className="text-gray-600">Итого:</span>
                    <span className="text-2xl font-bold text-indigo-600">
                      {selectedOrder.total_amount.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50/80 flex justify-end">
              <button 
                onClick={() => { setIsOrderModalOpen(false); setSelectedOrder(null) }}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👇 МОДАЛКА ПРИЧИНЫ ОТМЕНЫ/ВОЗВРАТА */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  {actionModal.type === 'cancel' ? (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      Отмена заказа
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-5 h-5 text-orange-600" />
                      Возврат заказа
                    </>
                  )}
                </h3>
                <button
                  onClick={() => setActionModal({ type: 'cancel', orderId: 0, isOpen: false })}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {actionModal.type === 'cancel' ? 'Причина отмены' : 'Причина возврата'}
                </label>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder={actionModal.type === 'cancel' 
                    ? 'Например: передумал, ошибка в заказе...' 
                    : 'Например: товар не подошёл, брак...'}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setActionModal({ type: 'cancel', orderId: 0, isOpen: false })}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={actionModal.type === 'cancel' ? submitCancelRequest : submitReturnRequest}
                  disabled={isActionSubmitting}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                    actionModal.type === 'cancel' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-orange-600 hover:bg-orange-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isActionSubmitting ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent" />
                  ) : (
                    actionModal.type === 'cancel' ? 'Отправить запрос' : 'Отправить запрос'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}