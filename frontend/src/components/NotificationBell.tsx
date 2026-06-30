// src/components/NotificationBell.tsx
import { useState, useEffect, useRef } from 'react'
import { Bell, X, CheckCircle, Truck, AlertCircle, ShoppingBag, Trash2 } from 'lucide-react'
import { request } from '../api/wms'
import { useNavigate } from 'react-router-dom'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  link?: string
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadNotifications = async () => {
    try {
      setIsLoading(true)
      const data = await request<Notification[]>('/notifications/')
      setNotifications(data || [])
      const unread = data?.filter(n => !n.is_read).length || 0
      setUnreadCount(unread)
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
    intervalRef.current = setInterval(loadNotifications, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const markAsRead = async (id: number) => {
    try {
      await request(`/notifications/${id}/read`, { method: 'POST' })
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  const markAllRead = async () => {
    try {
      await request('/notifications/mark-all-read', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  const deleteNotification = async (id: number) => {
    try {
      await request(`/notifications/${id}`, { method: 'DELETE' })
      setNotifications(prev => prev.filter(n => n.id !== id))
      const unread = notifications.filter(n => n.id !== id && !n.is_read).length
      setUnreadCount(unread)
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  const deleteAllNotifications = async () => {
    if (!confirm('Удалить все уведомления?')) return
    try {
      await request('/notifications/', { method: 'DELETE' })
      setNotifications([])
      setUnreadCount(0)
    } catch (err) {
      console.error('Error deleting all notifications:', err)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    setIsOpen(false)
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } catch {
      return dateStr
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag className="w-5 h-5 text-blue-500" />
      case 'shipment': return <Truck className="w-5 h-5 text-green-500" />
      case 'alert': return <AlertCircle className="w-5 h-5 text-red-500" />
      default: return <CheckCircle className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998]"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="fixed top-0 right-0 h-full w-[420px] max-w-[90vw] bg-white shadow-2xl z-[9999] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-indigo-600 text-white shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Уведомления
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-indigo-200 hover:text-white font-medium"
                  >
                    Все прочитаны
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={deleteAllNotifications}
                    className="text-xs text-red-200 hover:text-white font-medium"
                  >
                    🗑️ Удалить все
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="p-1 hover:bg-indigo-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-indigo-600 rounded-full border-t-transparent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Нет уведомлений</p>
                  <p className="text-sm">Все спокойно</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl mb-3 transition-all cursor-pointer hover:shadow-md relative group ${
                      !n.is_read ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white border border-gray-200'
                    }`}
                    onMouseEnter={() => setHoveredId(n.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 pr-6">
                          {n.title}
                        </div>
                        <div className="text-sm text-gray-600 mt-1 break-words">
                          {n.message}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          {formatTime(n.created_at)}
                        </div>
                      </div>
                      {!n.is_read && (
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    
                    {hoveredId === n.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotification(n.id)
                        }}
                        className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 border-t border-gray-200 text-center bg-gray-50 shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Закрыть
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}