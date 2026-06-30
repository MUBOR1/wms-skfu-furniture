// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: string[]
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
    </div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'client' ? '/client' : '/dashboard'} replace />
  }

  return <>{children}</>
}