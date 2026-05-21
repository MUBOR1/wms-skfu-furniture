import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Package, FileText, ClipboardCheck, BarChart3, Users, Settings, LogOut } from 'lucide-react'

export default function Sidebar() {
  const { logout, user, hasRole } = useAuth()
  const navigate = useNavigate()

  const isWorkerOrAbove = hasRole(['admin', 'warehouse_manager', 'warehouse_worker'])
  const isManagerOrAdmin = hasRole(['admin', 'warehouse_manager'])
  const isAdmin = hasRole(['admin'])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">🏭 WMS Мебель СК</h1>
        <p className="text-xs text-gray-500 mt-1 truncate">
          {user?.full_name || user?.login} • <span className="font-medium text-indigo-600 uppercase">{user?.role}</span>
        </p>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavLink to="/dashboard" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
          <LayoutDashboard className="w-5 h-5" /> Дашборд
        </NavLink>

        {isWorkerOrAbove && (
          <NavLink to="/products" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
            <Package className="w-5 h-5" /> Номенклатура
          </NavLink>
        )}

        {isWorkerOrAbove && (
          <NavLink to="/orders" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
            <FileText className="w-5 h-5" /> Заказы
          </NavLink>
        )}

        {isManagerOrAdmin && (
          <NavLink to="/documents" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
            <FileText className="w-5 h-5" /> Документы
          </NavLink>
        )}

        {isManagerOrAdmin && (
          <NavLink to="/inventory" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
            <ClipboardCheck className="w-5 h-5" /> Инвентаризация
          </NavLink>
        )}

        {isWorkerOrAbove && (
          <NavLink to="/report" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
            <BarChart3 className="w-5 h-5" /> Отчёты
          </NavLink>
        )}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Администрирование</div>
            <NavLink to="/admin/users" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
              <Users className="w-5 h-5" /> Пользователи
            </NavLink>
            <NavLink to="/admin/settings" className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
              <Settings className="w-5 h-5" /> Настройки
            </NavLink>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
          <LogOut className="w-5 h-5" /> Выйти из системы
        </button>
      </div>
    </div>
  )
}