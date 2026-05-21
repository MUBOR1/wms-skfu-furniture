import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Package, ClipboardList, FileText, LogOut, LayoutDashboard, ClipboardCheck } from 'lucide-react'

const menuItems = [
  { to: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/products', label: 'Товары', icon: Package },
  { to: '/documents', label: 'Документы', icon: FileText },
  { to: '/inventory', label: 'Инвентаризация', icon: ClipboardCheck },
  { to: '/report', label: 'Отчёт по остаткам', icon: ClipboardList },
]

export default function Sidebar() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">🏭 WMS Мебель СК</h1>
        <p className="text-sm text-gray-500 mt-1">{user?.login} • {user?.role}</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-700 font-medium' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Выйти
        </button>
      </div>
    </div>
  )
}