import { useState, useEffect } from 'react'
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
import OrdersPage from './pages/OrdersPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AuditPage from './pages/AuditPage'
import ArchivePage from './pages/ArchivePage'
import ScrollToTop from './components/ScrollToTop'

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      
      <Route path="/products" element={
        <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
          <ProductsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/archive" element={
        <ProtectedRoute roles={['admin', 'warehouse_manager']}>
          <ArchivePage />
        </ProtectedRoute>
      } />
      
      <Route path="/documents" element={
        <ProtectedRoute roles={['admin', 'warehouse_manager']}>
          <DocumentsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/inventory" element={
        <ProtectedRoute roles={['admin', 'warehouse_manager']}>
          <InventoryPage />
        </ProtectedRoute>
      } />
      
      <Route path="/report" element={
        <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
          <ReportPage />
        </ProtectedRoute>
      } />
      
      <Route path="/orders" element={
        <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
          <OrdersPage />
        </ProtectedRoute>
      } />
      
      <Route path="/analytics" element={
        <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
          <AnalyticsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/audit" element={
        <ProtectedRoute roles={['admin', 'warehouse_manager']}>
          <AuditPage />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/users" element={
        <ProtectedRoute roles={['admin']}>
          <AdminUsersPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute roles={['admin']}>
          <AdminSettingsPage />
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  // 🔧 СОСТОЯНИЕ СВЁРТЫВАНИЯ (с загрузкой из localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    return saved === 'true'
  })

  // 🔧 Сохраняем предпочтение при изменении
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-gray-50">
        
        <div className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          />
        </div>
        
        <main 
          className={`
            flex-1 overflow-y-auto transition-all duration-300 ease-in-out
            ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}
          `}
        >
          <AppContent />
          <ScrollToTop />  {/* 🔧 ДОБАВЬ СЮДА */}
        </main>
        
      </div>
    </AuthProvider>
  )
}