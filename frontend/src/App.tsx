import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import ProductsPage from './pages/ProductsPage'
import ReportPage from './pages/ReportPage'

// Заглушки для остальных страниц
const Placeholder = ({ title }: { title: string }) => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
    <p className="mt-2 text-gray-500">Модуль в разработке. Для демо используйте Swagger API: <code className="bg-gray-100 px-2 py-1 rounded">/docs</code></p>
  </div>
)

// Защита маршрутов
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth()
  if (isLoading) return <div className="p-8">Загрузка...</div>
  if (!token) return <Navigate to="/login" replace />
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  )
}

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><Placeholder title="📊 Дашборд" /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Placeholder title="📄 Складские документы" /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Placeholder title="🔍 Инвентаризация" /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}