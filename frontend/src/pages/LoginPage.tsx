import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, saveToken } from '../api/wms' // 🔥 ДОБАВЛЯЕМ saveToken
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../context/AuthContext'
import { Package, Lock, User } from 'lucide-react'

export default function LoginPage() {
  const [login, setLogin] = useState('admin')
  const [password, setPassword] = useState('strong_password_123')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login: authLogin } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      console.log('🔐 Попытка входа:', login)
      
      // 1. Логинимся
      const response = await auth.login({ login, password })
      const token = response.access_token
      console.log('✅ Получен токен:', token.substring(0, 30) + '...')
      
      // 🔥🔥🔥 ВАЖНО: СОХРАНЯЕМ ТОКЕН СРАЗУ!
      saveToken(token)
      console.log('💾 Токен сохранен в sessionStorage')
      
      // Проверяем, что сохранилось
      const saved = sessionStorage.getItem('wms_auth')
      if (saved) {
        const parsed = JSON.parse(saved)
        console.log('✅ Проверка: токен в sessionStorage есть:', parsed.token ? 'да' : 'нет')
      }
      
      // 2. Получаем данные пользователя
      console.log('🔄 Запрашиваем данные пользователя...')
      const userData = await auth.me()
      console.log('✅ Получены данные пользователя:', userData)
      
      // 3. Сохраняем пользователя в контекст
      authLogin(token, {
        id: userData.id,
        login: userData.login,
        role: userData.role as UserRole,
        full_name: userData.full_name,
        is_active: userData.is_active
      })
      
      // 4. Перенаправляем в зависимости от роли
      if (userData.role === 'client') {
        navigate('/client')
      } else {
        navigate('/dashboard')
      }
      
    } catch (err: any) {
      console.error('❌ Ошибка входа:', err)
      setError(err.message || 'Ошибка входа')
      // Очищаем все при ошибке
      localStorage.removeItem('wms_token')
      localStorage.removeItem('wms_user')
      sessionStorage.removeItem('wms_auth')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
            <Package className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">WMS</h1>
          <p className="text-gray-500">Учебный прототип ВКР • СКФУ</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Логин</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Пароль</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 disabled:opacity-50 transition-colors font-medium"
          >
            {isLoading ? 'Вход...' : 'Войти в систему'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Для демо используйте: admin / strong_password_123
        </p>
      </div>
    </div>
  )
}