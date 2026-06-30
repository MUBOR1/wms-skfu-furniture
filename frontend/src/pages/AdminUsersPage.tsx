import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  Users, UserPlus, Search, Edit2, Trash2, CheckCircle, XCircle, 
  Shield, X, Save, AlertTriangle, Eye, EyeOff,
  RefreshCw
} from 'lucide-react'

// ============================================
// 🔧 ИНТЕРФЕЙСЫ
// ============================================

type UserRole = 'admin' | 'warehouse_manager' | 'warehouse_worker' | 'client'

interface User {
  id: number
  login: string
  full_name: string
  email?: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at?: string
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning'
}

// ============================================
// 🔧 КОНФИГУРАЦИЯ РОЛЕЙ
// ============================================

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: React.ElementType }> = {
  admin: { label: 'Администратор', color: 'bg-red-100 text-red-700', icon: Shield },
  warehouse_manager: { label: 'Менеджер склада', color: 'bg-blue-100 text-blue-700', icon: Users },
  warehouse_worker: { label: 'Кладовщик', color: 'bg-green-100 text-green-700', icon: Users },
  client: { label: 'Клиент', color: 'bg-purple-100 text-purple-700', icon: Users },
}

// ============================================
// 🔧 ГЛАВНЫЙ КОМПОНЕНТ
// ============================================

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    login: '',
    full_name: '',
    password: '',
    role: 'warehouse_worker' as UserRole,
    is_active: true
  })

  // ============================================
  // 🔧 ПОЛУЧЕНИЕ ТОКЕНА
  // ============================================

  const getToken = () => {
    const authData = sessionStorage.getItem('wms_auth')
    if (authData) {
      try {
        const parsed = JSON.parse(authData)
        if (parsed.token) return parsed.token
      } catch (e) {}
    }
    return localStorage.getItem('wms_token') || null
  }

  // ============================================
  // 📥 ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ ИЗ БЭКЕНДА
  // ============================================

  const loadUsers = async () => {
    setLoading(true)
    try {
      const token = getToken()
      if (!token) {
        console.warn('⚠️ Нет токена для загрузки пользователей')
        setLoading(false)
        return
      }

      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.users) {
          setUsers(data.users)
        }
      } else if (response.status === 401) {
        console.error('❌ 401 - Неавторизован')
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки пользователей:', error)
      addToast('Ошибка загрузки пользователей', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // ============================================
  // 🔧 ФИЛЬТРАЦИЯ
  // ============================================

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = search === '' || 
        u.full_name.toLowerCase().includes(search.toLowerCase()) || 
        u.login.toLowerCase().includes(search.toLowerCase())
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'active' ? u.is_active === true : u.is_active === false)
      return matchSearch && matchRole && matchStatus
    })
  }, [users, search, roleFilter, statusFilter])

  // ============================================
  // 📊 СТАТИСТИКА
  // ============================================

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.is_active).length,
    admins: users.filter(u => u.role === 'admin').length,
    inactive: users.filter(u => !u.is_active).length,
  }), [users])

  // ============================================
  // 🔔 УВЕДОМЛЕНИЯ
  // ============================================

  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // ============================================
  // ✏️ ОТКРЫТИЕ МОДАЛКИ
  // ============================================

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        login: user.login,
        full_name: user.full_name,
        password: '',
        role: user.role,
        is_active: user.is_active
      })
    } else {
      setEditingUser(null)
      setFormData({
        login: '',
        full_name: '',
        password: '',
        role: 'warehouse_worker',
        is_active: true
      })
    }
    setShowModal(true)
  }

  // ============================================
  // 💾 СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЯ (РЕАЛЬНЫЙ API)
  // ============================================

  const handleSave = async () => {
    // Валидация
    if (!formData.login || !formData.full_name) {
      addToast('Заполните логин и ФИО', 'error')
      return
    }
    if (!editingUser && !formData.password) {
      addToast('Укажите пароль для нового пользователя', 'error')
      return
    }
    if (formData.password && formData.password.length < 6) {
      addToast('Пароль должен быть минимум 6 символов', 'error')
      return
    }

    setIsSaving(true)

    try {
      const token = getToken()
      if (!token) {
        addToast('Ошибка авторизации', 'error')
        setIsSaving(false)
        return
      }

      let url = '/api/admin/users'
      let method = 'POST'
      let body: any = {
        login: formData.login,
        full_name: formData.full_name,
        role: formData.role,
        is_active: formData.is_active
      }

      if (editingUser) {
        url = `/api/admin/users/${editingUser.id}`
        method = 'PUT'
        body = {
          full_name: formData.full_name,
          role: formData.role,
          is_active: formData.is_active
        }
        if (formData.password) {
          body.password = formData.password
        }
      } else {
        body.password = formData.password
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        await loadUsers()
        addToast(editingUser ? 'Пользователь обновлён' : 'Пользователь создан')
        setShowModal(false)
      } else {
        const error = await response.json()
        addToast(error.detail || 'Ошибка сохранения', 'error')
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error)
      addToast('Ошибка соединения с сервером', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ============================================
  // 🗑️ УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ (РЕАЛЬНЫЙ API)
  // ============================================

  const handleDelete = async (id: number) => {
    if (currentUser?.id === id) {
      addToast('Нельзя удалить самого себя', 'warning')
      return
    }

    try {
      const token = getToken()
      if (!token) {
        addToast('Ошибка авторизации', 'error')
        return
      }

      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        await loadUsers()
        addToast('Пользователь удалён')
      } else {
        const error = await response.json()
        addToast(error.detail || 'Ошибка удаления', 'error')
      }
    } catch (error) {
      console.error('❌ Ошибка удаления:', error)
      addToast('Ошибка соединения с сервером', 'error')
    }
    setDeleteConfirm(null)
  }

  // ============================================
  // 🔄 ПЕРЕКЛЮЧЕНИЕ СТАТУСА (РЕАЛЬНЫЙ API)
  // ============================================

  const toggleStatus = async (id: number) => {
    if (currentUser?.id === id) {
      addToast('Нельзя изменить свой статус', 'warning')
      return
    }

    const user = users.find(u => u.id === id)
    if (!user) return

    try {
      const token = getToken()
      if (!token) {
        addToast('Ошибка авторизации', 'error')
        return
      }

      const response = await fetch(`/api/admin/users/${id}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !user.is_active })
      })

      if (response.ok) {
        await loadUsers()
        addToast(user.is_active ? 'Пользователь деактивирован' : 'Пользователь активирован')
      } else {
        const error = await response.json()
        addToast(error.detail || 'Ошибка изменения статуса', 'error')
      }
    } catch (error) {
      console.error('❌ Ошибка изменения статуса:', error)
      addToast('Ошибка соединения с сервером', 'error')
    }
  }

  // ============================================
  // 📅 ФОРМАТИРОВАНИЕ ДАТ
  // ============================================

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
  }

  // ============================================
  // 🖥️ РЕНДЕР
  // ============================================

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Заголовок */}
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

      {/* Карточки статистики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} value={stats.total} label="Всего пользователей" color="blue" />
        <StatCard icon={<CheckCircle className="w-5 h-5 text-green-600" />} value={stats.active} label="Активных" color="green" />
        <StatCard icon={<Shield className="w-5 h-5 text-red-600" />} value={stats.admins} label="Администраторов" color="red" />
        <StatCard icon={<XCircle className="w-5 h-5 text-gray-600" />} value={stats.inactive} label="Неактивных" color="gray" />
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Поиск по логину или ФИО..." 
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
            <option value="warehouse_manager">Менеджер склада</option>
            <option value="warehouse_worker">Кладовщик</option>
            <option value="client">Клиент</option>
          </select>
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm"
          >
            <option value="all">Все статусы</option>
            <option value="active">Активен</option>
            <option value="inactive">Неактивен</option>
          </select>
        </div>
      </div>

      {/* Таблица пользователей */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Пользователь</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Логин</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Роль</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Создан</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map(u => {
                const isSelf = currentUser?.id === u.id
                const RoleIcon = ROLE_CONFIG[u.role]?.icon || Users
                const roleLabel = ROLE_CONFIG[u.role]?.label || u.role
                const roleColor = ROLE_CONFIG[u.role]?.color || 'bg-gray-100 text-gray-700'
                
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                          {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 flex items-center gap-2">
                            {u.full_name}
                            {isSelf && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Вы</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-600">{u.login}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleColor}`}>
                        <RoleIcon className="w-3.5 h-3.5" />
                        {roleLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => toggleStatus(u.id)}
                        disabled={isSelf}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          u.is_active 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } ${isSelf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={isSelf ? 'Нельзя изменить свой статус' : u.is_active ? 'Деактивировать' : 'Активировать'}
                      >
                        {u.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {u.is_active ? 'Активен' : 'Неактивен'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.created_at)}</td>
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

      {/* Модалка создания/редактирования */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
              {/* Логин */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Логин *</label>
                <input 
                  type="text" 
                  value={formData.login}
                  onChange={e => setFormData({...formData, login: e.target.value})}
                  disabled={!!editingUser}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${editingUser ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="ivanov"
                />
                {editingUser && <p className="text-xs text-gray-400 mt-1">Логин нельзя изменить</p>}
              </div>

              {/* ФИО */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ФИО *</label>
                <input 
                  type="text" 
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Иванов Иван Иванович"
                />
              </div>

              {/* Пароль */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingUser ? 'Новый пароль (оставьте пустым для сохранения)' : 'Пароль *'}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder={editingUser ? 'Оставьте пустым' : 'Минимум 6 символов'}
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
              
              {/* Роль и статус */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
                  <select 
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="warehouse_worker">Кладовщик</option>
                    <option value="warehouse_manager">Менеджер склада</option>
                    <option value="admin">Администратор</option>
                    <option value="client">Клиент</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                  <select 
                    value={formData.is_active ? 'active' : 'inactive'}
                    onChange={e => setFormData({...formData, is_active: e.target.value === 'active'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="active">Активен</option>
                    <option value="inactive">Неактивен</option>
                  </select>
                </div>
              </div>
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

      {/* Подтверждение удаления */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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

      {/* Уведомления */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
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

// ============================================
// 📊 КОМПОНЕНТ КАРТОЧКИ СТАТИСТИКИ
// ============================================

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