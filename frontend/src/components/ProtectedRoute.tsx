import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../context/AuthContext'  // ← FIXED

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: UserRole[]
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { token, isLoading, hasRole } = useAuth()

  if (isLoading) return <div className="p-8 flex items-center justify-center h-screen">Загрузка системы...</div>
  if (!token) return <Navigate to="/login" replace />
  
  if (roles && !hasRole(roles)) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-screen bg-gray-50">
        <h2 className="text-2xl font-bold text-red-600 mb-2">🚫 Доступ запрещён</h2>
        <p className="text-gray-600">У вас недостаточно прав для просмотра этой страницы.</p>
        <button onClick={() => window.history.back()} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Вернуться назад</button>
      </div>
    )
  }

  return <>{children}</>
}