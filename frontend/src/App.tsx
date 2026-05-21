import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import ReportPage from './pages/ReportPage'
import DocumentsPage from './pages/DocumentsPage'
import InventoryPage from './pages/InventoryPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminSettingsPage from './pages/AdminSettingsPage'

// ... остальной код App.tsx без изменений ...

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}><ProductsPage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute roles={['admin', 'warehouse_manager']}><DocumentsPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute roles={['admin', 'warehouse_manager']}><InventoryPage /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}><ReportPage /></ProtectedRoute>} />
      
      {/* Администрирование (только admin) */}
      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><AdminSettingsPage /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar показывается только если пользователь авторизован */}
        <Routes>
          <Route path="/login" element={null} />
          <Route path="/*" element={<Sidebar />} />
        </Routes>
        <main className="flex-1 overflow-y-auto">
          <AppContent />
        </main>
      </div>
    </AuthProvider>
  )
}