// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { auth, getToken } from '../api/wms' // 🔥 ДОБАВЛЯЕМ getToken

export type UserRole = 'admin' | 'warehouse_manager' | 'warehouse_worker' | 'client'

export interface User {
  id: number
  login: string
  role: UserRole
  full_name?: string | null
  is_active?: boolean
}

export interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isLoading: boolean
  hasRole: (roles: UserRole[]) => boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// 🔥 КЛЮЧИ ДЛЯ ХРАНЕНИЯ
const SESSION_KEY = 'wms_auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 🔥 ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ДАННЫХ ПОЛЬЗОВАТЕЛЯ
  const refreshUser = async () => {
    try {
      const tokenFromStorage = getToken()
      if (!tokenFromStorage) {
        console.warn('⚠️ Нет токена для обновления пользователя')
        return
      }
      
      const userData = await auth.me()
      console.log('✅ Данные пользователя обновлены:', userData)
      
      const userObj = {
        id: userData.id,
        login: userData.login,
        role: userData.role as UserRole,
        full_name: userData.full_name,
        is_active: userData.is_active
      }
      
      setUser(userObj)
      // Обновляем в sessionStorage
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...parsed, user: userObj }))
      }
    } catch (error) {
      console.error('❌ Ошибка обновления пользователя:', error)
      if (error instanceof Error && error.message.includes('401')) {
        logout()
      }
    }
  }

  useEffect(() => {
    const loadAuth = async () => {
      try {
        console.log('🔍 Проверка авторизации...')
        
        // 🔥 ПРОВЕРЯЕМ sessionStorage
        const saved = sessionStorage.getItem(SESSION_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.token) {
            console.log('✅ Найден токен в sessionStorage')
            setToken(parsed.token)
            setUser(parsed.user || null)
            
            // 🔥 ПРОВЕРЯЕМ, ЧТО ТОКЕН ВАЛИДЕН
            try {
              await auth.me()
              console.log('✅ Токен валиден')
            } catch (error) {
              console.warn('⚠️ Токен невалиден, разлогиниваем')
              sessionStorage.removeItem(SESSION_KEY)
              setToken(null)
              setUser(null)
            }
          } else {
            console.warn('⚠️ В sessionStorage нет токена')
          }
        } else {
          console.log('ℹ️ Токен не найден')
        }
      } catch (e) {
        console.error('❌ Ошибка загрузки авторизации:', e)
        sessionStorage.removeItem(SESSION_KEY)
      } finally {
        setIsLoading(false)
      }
    }

    loadAuth()
  }, [])

  const login = (newToken: string, newUser: User) => {
    console.log('🔐 Сохранение токена в sessionStorage через контекст')
    setToken(newToken)
    setUser(newUser)
    // 🔥 СОХРАНЯЕМ В sessionStorage
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: newToken, user: newUser }))
    
    // Проверяем, что сохранилось
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      console.log('✅ Токен сохранен:', parsed.token ? 'да' : 'нет')
      console.log('✅ Пользователь сохранен:', parsed.user ? 'да' : 'нет')
    }
  }

  const logout = () => {
    console.log('🚪 Выход из системы')
    setToken(null)
    setUser(null)
    // 🔥 ОЧИЩАЕМ ВСЁ
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('wms_token')
    localStorage.removeItem('wms_user')
    localStorage.removeItem('cart_items')
    sessionStorage.removeItem('order_form_data')
    localStorage.removeItem('sidebar_collapsed')
    localStorage.removeItem('orders_management_visible')
  }

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user?.role) return false
    return roles.includes(user.role)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, hasRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}