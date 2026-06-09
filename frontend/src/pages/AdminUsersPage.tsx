import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  Users, UserPlus, Search, Edit2, Trash2, CheckCircle, XCircle, 
  Shield, Mail, X, Save, AlertTriangle, Eye, EyeOff,
  RefreshCw
} from 'lucide-react'

//  ИНТЕРФЕЙСЫ
type UserRole = 'admin' | 'manager' | 'worker' | 'viewer'
type UserStatus = 'active' | 'inactive'

interface User {
  id: number
  fullName: string
  email: string
  role: UserRole
  status: UserStatus
  lastLogin: string | null
  createdAt: string
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning'
}

// 🔧 ДЕФОЛТНЫЕ ДАННЫЕ
const DEFAULT_USERS: User[] = [
  { id: 1, fullName: 'Администратор Системы', email: 'admin@wms-skfu.ru', role: 'admin', status: 'active', lastLogin: '2026-06-09T08:00:00', createdAt: '2026-01-15T10:00:00' },
  { id: 2, fullName: 'Иванов Сергей Петрович', email: 'ivanov@wms-skfu.ru', role: 'manager', status: 'active', lastLogin: '2026-06-08T14:30:00', createdAt: '2026-02-20T09:00:00' },
  { id: 3, fullName: 'Петрова Анна Михайловна', email: 'petrova@wms-skfu.ru', role: 'worker', status: 'active', lastLogin: '2026-06-09T07:15:00', createdAt: '2026-03-10T11:00:00' },
  { id: 4, fullName: 'Сидоров Дмитрий Алексеевич', email: 'sidorov@wms-skfu.ru', role: 'worker', status: 'inactive', lastLogin: '2026-05-20T16:45:00', createdAt: '2026-04-05T14:00:00' },
  { id: 5, fullName: 'Козлова Елена Викторовна', email: 'kozlova@wms-skfu.ru', role: 'viewer', status: 'active', lastLogin: '2026-06-07T10:00:00', createdAt: '2026-05-12T08:30:00' },
]

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: 'Администратор', color: 'bg-red-100 text-red-700', icon: Shield },
  manager: { label: 'Менеджер', color: 'bg-blue-100 text-blue-700', icon: Users },
  worker: { label: 'Кладовщик', color: 'bg-green-100 text-green-700', icon: Users },
  viewer: { label: 'Наблюдатель', color: 'bg-gray-100 text-gray-700', icon: Eye },
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all')
  
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'worker' as UserRole,
    status: 'active' as UserStatus,
    password: ''
  })

  // 🔧 ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ
  useEffect(() => {
    const saved = localStorage.getItem('wms_users')
    if (saved) {
      try {
        setUsers(JSON.parse(saved))
      } catch {
        setUsers(DEFAULT_USERS)
        localStorage.setItem('wms_users', JSON.stringify(DEFAULT_USERS))
      }
    } else {
      setUsers(DEFAULT_USERS)
      localStorage.setItem('wms_users', JSON.stringify(DEFAULT_USERS))
    }
  }, [])

  // 🔧 СОХРАНЕНИЕ В LOCALSTORAGE
  useEffect(() => {
    if (users.length > 0) {
      localStorage.setItem('wms_users', JSON.stringify(users))
    }
  }, [users])

  // 🔧 ФИЛЬТРАЦИЯ
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = search === '' || 
        u.fullName.toLowerCase().includes(search.toLowerCase()) || 
        u.email.toLowerCase().includes(search.toLowerCase())
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      const matchStatus = statusFilter === 'all' || u.status === statusFilter
      return matchSearch && matchRole && matchStatus
    })
  }, [users, search, roleFilter, statusFilter])

  // 🔧 СТАТИСТИКА
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    admins: users.filter(u => u.role === 'admin').length,
    inactive: users.filter(u => u.status === 'inactive').length,
  }), [users])

  // 🔧 УВЕДОМЛЕНИЯ
  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  // 🔧 ОТКРЫТИЕ МОДАЛКИ
  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        password: ''
      })
    } else {
      setEditingUser(null)
      setFormData({ fullName: '', email: '', role: 'worker', status: 'active', password: '' })
    }
    setShowModal(true)
  }

  // 🔧 СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЯ
  const handleSave = async () => {
    if (!formData.fullName || !formData.email) {
      addToast('Заполните обязательные поля', 'error')
      return
    }
    if (!editingUser && !formData.password) {
      addToast('Укажите пароль для нового пользователя', 'error')
      return
    }

    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 600)) // Имитация запроса

    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        status: formData.status
      } : u))
      addToast('Пользователь обновлён')
    } else {
      const newUser: User = {
        id: Math.max(0, ...users.map(u => u.id)) + 1,
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        lastLogin: null,
        createdAt: new Date().toISOString()
      }
      setUsers(prev => [...prev, newUser])
      addToast('Пользователь создан')
    }
    
    setIsSaving(false)
    setShowModal(false)
  }

  // 🔧 УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
  const handleDelete = (id: number) => {
    if (currentUser?.id === id) {
      addToast('Нельзя удалить самого себя', 'warning')
      return
    }
    setUsers(prev => prev.filter(u => u.id !== id))
    setDeleteConfirm(null)
    addToast('Пользователь удалён')
  }

  // 🔧 ПЕРЕКЛЮЧЕНИЕ СТАТУСА
  const toggleStatus = (id: number) => {
    if (currentUser?.id === id) {
      addToast('Нельзя изменить статус своей учётной записи', 'warning')
      return
    }
    setUsers(prev => prev.map(u => u.id === id ? {
      ...u,
      status: u.status === 'active' ? 'inactive' : 'active'
    } : u))
    addToast('Статус изменён')
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Никогда'
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/*  ЗАГОЛОВОК */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Управление пользователями
          </h1>
          <p className="text-gray-500 mt-1">Создание, редактирование и управление доступом сотрудников WMS</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Добавить пользователя
        </button>
      </div>

      {/*  КАРТОЧКИ СТАТИСТИКИ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} value={stats.total} label="Всего пользователей" color="blue" />
        <StatCard icon={<CheckCircle className="w-5 h-5 text-green-600" />} value={stats.active} label="Активных" color="green" />
        <StatCard icon={<Shield className="w-5 h-5 text-red-600" />} value={stats.admins} label="Администраторов" color="red" />
        <StatCard icon={<XCircle className="w-5 h-5 text-gray-600" />} value={stats.inactive} label="Неактивных" color="gray" />
      </div>

      {/* 🔍 ФИЛЬТРЫ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Поиск по ФИО или email..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
          <select 
            value={roleFilter} 
            onChange={e => setRoleFilter(e.target.value as UserRole | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
          >
            <option value="all">Все роли</option>
            <option value="admin">Администратор</option>
            <option value="manager">Менеджер</option>
            <option value="worker">Кладовщик</option>
            <option value="viewer">Наблюдатель</option>
          </select>
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value as UserStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
          >
            <option value="all">Все статусы</option>
            <option value="active">Активен</option>
            <option value="inactive">Неактивен</option>
          </select>
        </div>
      </div>

      {/* 📋 ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Пользователь</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Роль</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Последний вход</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Создан</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map(u => {
                const isSelf = currentUser?.id === u.id
                const RoleIcon = ROLE_CONFIG[u.role].icon
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                          {u.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 flex items-center gap-2">
                            {u.fullName}
                            {isSelf && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Вы</span>}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_CONFIG[u.role].color}`}>
                        <RoleIcon className="w-3.5 h-3.5" />
                        {ROLE_CONFIG[u.role].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => toggleStatus(u.id)}
                        disabled={isSelf}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          u.status === 'active' 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } ${isSelf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={isSelf ? 'Нельзя изменить свой статус' : u.status === 'active' ? 'Деактивировать' : 'Активировать'}
                      >
                        {u.status === 'active' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {u.status === 'active' ? 'Активен' : 'Неактивен'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(u.lastLogin)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openModal(u)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => !isSelf && setDeleteConfirm(u.id)}
                          disabled={isSelf}
                          className={`p-2 rounded-lg transition-colors ${isSelf ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                          title={isSelf ? 'Нельзя удалить себя' : 'Удалить'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">Пользователи не найдены</p>
                    <p className="text-sm text-gray-400 mt-1">Попробуйте изменить фильтры или добавьте нового пользователя</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ️ МОДАЛКА СОЗДАНИЯ/РЕДАКТИРОВАНИЯ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {editingUser ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <UserPlus className="w-5 h-5 text-indigo-600" />}
                {editingUser ? 'Редактирование пользователя' : 'Новый пользователь'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ФИО *</label>
                <input 
                  type="text" 
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="user@wms-skfu.ru"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Пароль *</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Минимум 6 символов"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
                  <select 
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="viewer">Наблюдатель</option>
                    <option value="worker">Кладовщик</option>
                    <option value="manager">Менеджер</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as UserStatus})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="active">Активен</option>
                    <option value="inactive">Неактивен</option>
                  </select>
                </div>
              </div>

              {editingUser && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  ️ При редактировании пароль не меняется. Для сброса пароля обратитесь к администратору БД.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Сохранение...' : (editingUser ? 'Сохранить' : 'Создать')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ️ ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Удалить пользователя?</h3>
            <p className="text-gray-600 mb-6">Это действие нельзя отменить. Все данные пользователя будут удалены из системы.</p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-medium transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔔 УВЕДОМЛЕНИЯ */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right-4 ${
              toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
              toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
             toast.type === 'error' ? <XCircle className="w-4 h-4" /> :
             <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Компонент карточки статистики
function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  const colorMap: Record<string, string> = { 
    blue: 'bg-blue-50 text-blue-600 border-blue-200', 
    green: 'bg-green-50 text-green-600 border-green-200', 
    red: 'bg-red-50 text-red-600 border-red-200', 
    gray: 'bg-gray-50 text-gray-600 border-gray-200' 
  }
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg border ${colorMap[color]}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600 font-medium mt-1">{label}</p>
    </div>
  )
}