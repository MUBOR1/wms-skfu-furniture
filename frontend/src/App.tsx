// src/App.tsx
import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
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
import ClientHomePage from './pages/ClientHomePage'
import ClientCatalog from './pages/ClientCatalog'
import ProductDetail from './pages/ProductDetail'
import ClientCart from './pages/ClientCart'
import ClientProfile from './pages/ClientProfile'
import ClientFavorites from './pages/ClientFavorites'
import SupportChat from './components/SupportChat'
import OrdersPage from './pages/OrdersPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AuditPage from './pages/AuditPage'
import ArchivePage from './pages/ArchivePage'
import ScrollToTop from './components/ScrollToTop'
import ChatPage from './pages/ChatPage'

// 🔧 КОМПОНЕНТ-ОБЁРТКА ДЛЯ КЛИЕНТСКИХ СТРАНИЦ (с чатом)
function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SupportChat />
    </>
  )
}

// 🔧 КОМПОНЕНТ-ОБЁРТКА С САЙДБАРОМ (для админ/склад)
function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    return saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const { user, isLoading, refreshUser } = useAuth()

  // 🔥 ДОБАВЛЯЕМ: Обновляем данные пользователя при загрузке
  useEffect(() => {
    if (user) {
      refreshUser()
    }
  }, [])

  // 🔥 ДОБАВЛЯЕМ: Проверяем авторизацию при монтировании
  useEffect(() => {
    const checkAuth = async () => {
      const token = sessionStorage.getItem('wms_auth') || localStorage.getItem('wms_token')
      if (token && !user) {
        try {
          await refreshUser()
        } catch (error) {
          console.error('❌ Ошибка проверки авторизации:', error)
        }
      }
    }
    checkAuth()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  const isClient = user?.role === 'client'

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Сайдбар виден для всех, кроме страницы логина */}
      <div className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        />
      </div>
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Routes>
          {/* 🔐 Публичные маршруты */}
          <Route path="/login" element={<LoginPage />} />

          {/* 👤 Клиентские маршруты */}
          <Route path="/client" element={
            <ProtectedRoute roles={['client', 'admin', 'warehouse_manager', 'warehouse_worker']}>
              <ClientLayout>
                <ClientHomePage />
              </ClientLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/client/catalog" element={
            <ProtectedRoute roles={['client', 'admin', 'warehouse_manager', 'warehouse_worker']}>
              <ClientLayout>
                <ClientCatalog />
              </ClientLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/client/product/:id" element={
            <ProtectedRoute roles={['client', 'admin', 'warehouse_manager', 'warehouse_worker']}>
              <ClientLayout>
                <ProductDetail />
              </ClientLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/chat" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />

          <Route path="/client/cart" element={
            <ProtectedRoute roles={['client', 'admin', 'warehouse_manager', 'warehouse_worker']}>
              <ClientLayout>
                <ClientCart />
              </ClientLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/client/profile" element={
            <ProtectedRoute roles={['client', 'admin', 'warehouse_manager', 'warehouse_worker']}>
              <ClientLayout>
                <ClientProfile />
              </ClientLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/client/favorites" element={
            <ProtectedRoute roles={['client', 'admin', 'warehouse_manager', 'warehouse_worker']}>
              <ClientLayout>
                <ClientFavorites />
              </ClientLayout>
            </ProtectedRoute>
          } />

          {/* ============================================ */}
          {/* 🔧 АДМИН / МЕНЕДЖЕР / КЛАДОВЩИК - общие маршруты */}
          {/* ============================================ */}
          
          <Route path="/dashboard" element={
            <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
              <DashboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/products" element={
            <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
              <ProductsPage />
            </ProtectedRoute>
          } />
          
          {/* ✅ ИСПРАВЛЕНО: добавлена роль warehouse_worker для кладовщика */}
          <Route path="/orders" element={
            <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
              <OrdersPage />
            </ProtectedRoute>
          } />
          
          {/* ✅ ИСПРАВЛЕНО: добавлена роль warehouse_worker для кладовщика */}
          <Route path="/documents" element={
            <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
              <DocumentsPage />
            </ProtectedRoute>
          } />
          
          {/* ✅ ИСПРАВЛЕНО: добавлена роль warehouse_worker для кладовщика */}
          <Route path="/inventory" element={
            <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
              <InventoryPage />
            </ProtectedRoute>
          } />
          
          <Route path="/report" element={
            <ProtectedRoute roles={['admin', 'warehouse_manager', 'warehouse_worker']}>
              <ReportPage />
            </ProtectedRoute>
          } />
          
          {/* ============================================ */}
          {/* 🔒 ТОЛЬКО ДЛЯ АДМИН И МЕНЕДЖЕР (НЕ ДЛЯ КЛАДОВЩИКА) */}
          {/* ============================================ */}
          
          <Route path="/archive" element={
            <ProtectedRoute roles={['admin', 'warehouse_manager']}>
              <ArchivePage />
            </ProtectedRoute>
          } />
          
          <Route path="/analytics" element={
            <ProtectedRoute roles={['admin', 'warehouse_manager']}>
              <AnalyticsPage />
            </ProtectedRoute>
          } />
          
          <Route path="/audit" element={
            <ProtectedRoute roles={['admin', 'warehouse_manager', 'client']}>
              <AuditPage />
            </ProtectedRoute>
          } />
          
          {/* ============================================ */}
          {/* 🔒 ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА */}
          {/* ============================================ */}
          
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

          {/* 🔄 Редирект */}
          <Route path="/" element={
            <Navigate to={isClient ? "/client" : "/dashboard"} replace />
          } />
        </Routes>
        <ScrollToTop />
      </main>
    </div>
  )
}

// 🔧 ГЛАВНЫЙ КОМПОНЕНТ
export default function App() {
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'

  // 🔥 ДОБАВЛЯЕМ: Очистка при размонтировании
  useEffect(() => {
    return () => {
      // Очищаем только если это страница логина
      if (isLoginPage) {
        console.log('🧹 Очистка при переходе на страницу логина')
      }
    }
  }, [isLoginPage])

  return (
    <AuthProvider>
      <CartProvider>
        {isLoginPage ? (
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        ) : (
          <AppLayout />
        )}
      </CartProvider>
    </AuthProvider>
  )
}