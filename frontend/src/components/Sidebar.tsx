// src/components/Sidebar.tsx
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  LayoutDashboard, Archive, Package, FileText, ClipboardCheck, 
  BarChart3, Users, Settings, LogOut, History as HistoryIcon, 
  ChevronLeft, ChevronRight, ShoppingBag, ShoppingCart, 
  User, Heart, MessageSquare
} from 'lucide-react'
import NotificationBell from './NotificationBell'
import { useEffect, useState } from 'react'
import { request } from '../api/wms'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { logout, user, hasRole } = useAuth()
  const navigate = useNavigate()
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  // 🔥 ОПРЕДЕЛЯЕМ РОЛИ
  const isAdmin = hasRole(['admin'])
  const isManager = hasRole(['warehouse_manager'])
  const isWorker = hasRole(['warehouse_worker'])
  const isClient = hasRole(['client'])
  
  // 🔥 КЛАДОВЩИК = worker (без прав менеджера)
  const isWorkerOnly = isWorker && !isManager && !isAdmin

  const handleLogout = () => { 
    logout() 
    navigate('/login') 
  }

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const data = await request<{ unread_count: number }>('/chat/unread-count')
        setUnreadChatCount(data.unread_count || 0)
      } catch (err) {
        console.error('Error loading unread count:', err)
      }
    }
    
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 10000)
    return () => clearInterval(interval)
  }, [])

  const NavItem = ({ to, icon: Icon, label, badge }: { to: string; icon: any; label: string; badge?: number }) => (
    <NavLink 
      to={to} 
      className={({ isActive }) => `
        flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200
        ${isActive 
          ? 'bg-indigo-50 text-indigo-700 font-medium' 
          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
        }
        ${isCollapsed ? 'justify-center' : ''}
      `}
      title={isCollapsed ? label : undefined}
    >
      <div className="relative">
        <Icon className="w-5 h-5 flex-shrink-0" />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <span className="whitespace-nowrap overflow-hidden transition-opacity duration-200">
          {label}
        </span>
      )}
    </NavLink>
  )

  return (
    <>
      {!isCollapsed && (
        <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={onToggle} />
      )}
      
      <aside 
        className={`
          fixed left-0 top-0 h-full bg-white border-r border-gray-200 
          flex flex-col shadow-sm z-40
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-64'}
        `}
      >
        <div className={`p-4 border-b border-gray-200 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap">🏭 WMS SKFU</h1>
                </div>
                <div className="flex-shrink-0 ml-2">
                  <NotificationBell />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">
                {user?.full_name || user?.login} • <span className="font-medium text-indigo-600 uppercase">{user?.role}</span>
              </p>
            </div>
          )}
          <button 
            onClick={onToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700 flex-shrink-0"
            title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
          
          {/* 👤 КЛИЕНТ */}
          {isClient && (
            <>
              <NavItem to="/client/profile" icon={User} label="Профиль" />
              <NavItem to="/client" icon={ShoppingBag} label="Главная" />
              <NavItem to="/client/catalog" icon={Package} label="Каталог" />
              <NavItem to="/client/favorites" icon={Heart} label="Избранное" />
              <NavItem to="/client/cart" icon={ShoppingCart} label="Корзина" />
              <NavItem to="/chat" icon={MessageSquare} label="Чат" badge={unreadChatCount} />
            </>
          )}

          {/* 👷 КЛАДОВЩИК (только worker) - без Дашборда и Чата */}
          {isWorkerOnly && (
            <>
              <NavItem to="/products" icon={Package} label="Номенклатура" />
              <NavItem to="/orders" icon={FileText} label="Заказы" />
              <NavItem to="/documents" icon={FileText} label="Складские документы" />
              <NavItem to="/inventory" icon={ClipboardCheck} label="Инвентаризация" />
              <NavItem to="/report" icon={BarChart3} label="Отчёты" />
            </>
          )}

          {/* 👔 МЕНЕДЖЕР СКЛАДА */}
          {isManager && !isAdmin && (
            <>
              <NavItem to="/dashboard" icon={LayoutDashboard} label="Дашборд" />
              <NavItem to="/products" icon={Package} label="Номенклатура" />
              <NavItem to="/archive" icon={Archive} label="Архив" />
              <NavItem to="/orders" icon={FileText} label="Заказы" />
              <NavItem to="/documents" icon={FileText} label="Складские документы" />
              <NavItem to="/inventory" icon={ClipboardCheck} label="Инвентаризация" />
              <NavItem to="/report" icon={BarChart3} label="Отчёты" />
              <NavItem to="/analytics" icon={BarChart3} label="Аналитика" />
              <NavItem to="/audit" icon={HistoryIcon} label="Журнал действий" />
              <NavItem to="/chat" icon={MessageSquare} label="Чат" badge={unreadChatCount} />
            </>
          )}

          {/* 👑 АДМИНИСТРАТОР */}
          {isAdmin && (
            <>
              <NavItem to="/dashboard" icon={LayoutDashboard} label="Дашборд" />
              <NavItem to="/products" icon={Package} label="Номенклатура" />
              <NavItem to="/archive" icon={Archive} label="Архив" />
              <NavItem to="/orders" icon={FileText} label="Заказы" />
              <NavItem to="/documents" icon={FileText} label="Складские документы" />
              <NavItem to="/inventory" icon={ClipboardCheck} label="Инвентаризация" />
              <NavItem to="/report" icon={BarChart3} label="Отчёты" />
              <NavItem to="/analytics" icon={BarChart3} label="Аналитика" />
              <NavItem to="/audit" icon={HistoryIcon} label="Журнал действий" />
              <NavItem to="/chat" icon={MessageSquare} label="Чат" badge={unreadChatCount} />
              
              {!isCollapsed && (
                <div className="pt-4 pb-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Администрирование
                </div>
              )}
              <NavItem to="/admin/users" icon={Users} label="Пользователи" />
              <NavItem to="/admin/settings" icon={Settings} label="Настройки" />
            </>
          )}

        </nav>

        <div className="p-3 border-t border-gray-200">
          <button 
            onClick={handleLogout} 
            className={`
              flex items-center gap-3 px-3 py-3 w-full text-left text-red-600 
              hover:bg-red-50 rounded-lg transition-all duration-200
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title={isCollapsed ? 'Выйти' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap font-medium">Выйти</span>}
          </button>
        </div>
      </aside>
    </>
  )
}