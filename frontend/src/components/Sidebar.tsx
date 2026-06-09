import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  LayoutDashboard, Archive, Package, FileText, ClipboardCheck, 
  BarChart3, Users, Settings, LogOut, History as HistoryIcon, 
  ChevronLeft, ChevronRight 
} from 'lucide-react'

// 🔧 ИНТЕРФЕЙС ПРОПСОВ
interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { logout, user, hasRole } = useAuth()
  const navigate = useNavigate()

  const isWorkerOrAbove = hasRole(['admin', 'warehouse_manager', 'warehouse_worker'])
  const isManagerOrAdmin = hasRole(['admin', 'warehouse_manager'])
  const isAdmin = hasRole(['admin'])

  const handleLogout = () => { logout(); navigate('/login') }

  // 🔧 Вспомогательный компонент для пунктов меню
  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
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
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!isCollapsed && (
        <span className="whitespace-nowrap overflow-hidden transition-opacity duration-200">
          {label}
        </span>
      )}
    </NavLink>
  )

  return (
    <>
      {/* 🔧 OVERLAY ДЛЯ МОБИЛЬНЫХ */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* 🔧 САЙДБАР: фиксированный */}
      <aside 
        className={`
          fixed left-0 top-0 h-full bg-white border-r border-gray-200 
          flex flex-col shadow-sm z-40
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16' : 'w-64'}
        `}
      >
        {/* 🔧 ЗАГОЛОВОК + КНОПКА */}
        <div className={`p-4 border-b border-gray-200 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-gray-900">🏭 WMS SKFU</h1>
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
        
        {/* 🔧 МЕНЮ */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Дашборд" />
          {isWorkerOrAbove && <NavItem to="/products" icon={Package} label="Номенклатура" />}
          {isManagerOrAdmin && <NavItem to="/archive" icon={Archive} label="Архив" />}
          {isWorkerOrAbove && <NavItem to="/orders" icon={FileText} label="Заказы" />}
          {isManagerOrAdmin && <NavItem to="/documents" icon={FileText} label="Документы" />}
          {isManagerOrAdmin && <NavItem to="/inventory" icon={ClipboardCheck} label="Инвентаризация" />}
          {isWorkerOrAbove && <NavItem to="/report" icon={BarChart3} label="Отчёты" />}
          {isWorkerOrAbove && <NavItem to="/analytics" icon={BarChart3} label="Аналитика" />}
          {isManagerOrAdmin && <NavItem to="/audit" icon={HistoryIcon} label="Журнал действий" />}
          
          {isAdmin && (
            <>
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

        {/* 🔧 ВЫХОД */}
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