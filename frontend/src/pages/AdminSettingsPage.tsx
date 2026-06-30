import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  Settings, Shield, Database, Bell, Globe, 
  Save, RefreshCw, CheckCircle, AlertTriangle, 
  Users, FileText, Package, Moon, Sun, Monitor,
  Download, Upload, Clock, Trash2, Server
} from 'lucide-react'

// ============================================
// 🔧 ИНТЕРФЕЙСЫ
// ============================================

interface SystemSettings {
  siteName: string
  timezone: string
  dateFormat: string
  language: string
  theme: 'light' | 'dark' | 'auto'
  autoReserve: boolean
  lowStockAlert: boolean
  lowStockThreshold: number
  allowNegativeStock: boolean
  autoGenerateSku: boolean
  skuPrefix: string
  autoNumbering: boolean
  docNumberPrefix: string
  requireApproval: boolean
  autoCompleteOnShip: boolean
  emailNotifications: boolean
  stockAlerts: boolean
  orderAlerts: boolean
  dailyReport: boolean
  notificationEmail: string
  sessionTimeout: number
  require2FA: boolean
  passwordExpiry: number
  maxLoginAttempts: number
  autoBackup: boolean
  backupFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly'
  backupRetention: number
  backupLocation: 'local' | 'cloud' | 'ftp'
}

const DEFAULT_SETTINGS: SystemSettings = {
  siteName: 'WMS Мебель СК',
  timezone: 'Europe/Moscow',
  dateFormat: 'DD.MM.YYYY',
  language: 'ru',
  theme: 'light',
  autoReserve: true,
  lowStockAlert: true,
  lowStockThreshold: 10,
  allowNegativeStock: false,
  autoGenerateSku: true,
  skuPrefix: 'ITEM',
  autoNumbering: true,
  docNumberPrefix: 'DOC',
  requireApproval: false,
  autoCompleteOnShip: true,
  emailNotifications: true,
  stockAlerts: true,
  orderAlerts: true,
  dailyReport: false,
  notificationEmail: 'admin@wms-skfu.ru',
  sessionTimeout: 30,
  require2FA: false,
  passwordExpiry: 90,
  maxLoginAttempts: 5,
  autoBackup: true,
  backupFrequency: 'daily',
  backupRetention: 30,
  backupLocation: 'local'
}

interface BackupFile {
  filename: string
  size: string
  created_at: string
}

// ============================================
// 🔧 ГЛАВНЫЙ КОМПОНЕНТ
// ============================================

export default function AdminSettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('general')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  // ============================================
  // 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const getToken = () => {
    const authData = sessionStorage.getItem('wms_auth')
    if (authData) {
      try {
        const parsed = JSON.parse(authData)
        if (parsed.token) return parsed.token
      } catch (e) {}
    }
    
    const token = localStorage.getItem('wms_token')
    if (token) {
      try {
        sessionStorage.setItem('wms_auth', JSON.stringify({ token, user: null }))
        localStorage.removeItem('wms_token')
      } catch (e) {}
      return token
    }
    
    return null
  }

  const applyTheme = (theme: string) => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    
    if (theme === 'dark') {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
    } else if (theme === 'light') {
      root.classList.add('light')
      root.setAttribute('data-theme', 'light')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark' : 'light')
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    }
    
    // Сохраняем тему в localStorage для persistence
    localStorage.setItem('theme', theme)
  }

  // ============================================
  // 📥 ЗАГРУЗКА ДАННЫХ
  // ============================================

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const token = getToken()
      if (!token) {
        setIsLoading(false)
        return
      }
      
      const response = await fetch('/api/admin/settings', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
          applyTheme(data.settings.theme || 'light')
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadBackups = async () => {
    try {
      const token = getToken()
      if (!token) return
      
      const response = await fetch('/api/admin/backup/list', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setBackups(data.backups || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки бэкапов:', error)
    }
  }

  useEffect(() => {
    loadSettings()
    loadBackups()
  }, [])

  // ============================================
  // 💾 НАСТРОЙКИ - СОХРАНЕНИЕ / СБРОС
  // ============================================

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    
    try {
      const token = getToken()
      if (!token) {
        setSaveError('Ошибка авторизации')
        setIsSaving(false)
        return
      }
      
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      })
      
      if (response.ok) {
        applyTheme(settings.theme)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 4000)
      } else {
        const error = await response.json()
        setSaveError(error.detail || 'Ошибка сохранения')
      }
    } catch (err) {
      setSaveError('Ошибка соединения с сервером')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('⚠️ Сбросить все настройки до значений по умолчанию?')) return
    
    try {
      const token = getToken()
      if (!token) {
        alert('❌ Ошибка авторизации')
        return
      }
      
      const response = await fetch('/api/admin/settings/reset', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
        applyTheme(data.settings.theme || 'light')
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (error) {
      alert('❌ Ошибка сброса настроек')
    }
  }

  // ============================================
  // 📤 ЭКСПОРТ / ИМПОРТ НАСТРОЕК
  // ============================================

  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wms_settings_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string)
        setSettings({ ...DEFAULT_SETTINGS, ...imported })
        applyTheme(imported.theme || 'light')
        alert('✅ Настройки импортированы')
      } catch {
        alert('❌ Ошибка чтения файла')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ============================================
  // 💾 БЭКАПЫ - ВСЕ ФУНКЦИИ
  // ============================================

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true)
    setSaveError(null)
    
    try {
      const token = getToken()
      if (!token) {
        setSaveError('❌ Ошибка авторизации')
        setIsCreatingBackup(false)
        return
      }
      
      const response = await fetch('/api/admin/backup/create', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        await loadBackups()
        alert(`✅ Бэкап создан: ${data.filename} (${data.size})`)
      } else {
        const error = await response.json()
        setSaveError(`❌ Ошибка: ${error.detail || 'Неизвестная ошибка'}`)
      }
    } catch (error) {
      console.error('Ошибка создания бэкапа:', error)
      setSaveError('❌ Ошибка соединения с сервером')
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const handleRestoreBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip,.json'
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      if (!confirm(`⚠️ Восстановить из бэкапа "${file.name}"?\n\nВсе текущие данные будут заменены!`)) return
      
      setIsRestoring(true)
      const formData = new FormData()
      formData.append('file', file)
      
      try {
        const token = getToken()
        if (!token) {
          alert('❌ Ошибка авторизации')
          setIsRestoring(false)
          return
        }
        
        const response = await fetch('/api/admin/backup/restore', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        })
        
        if (response.ok) {
          alert('✅ База данных восстановлена!\nСтраница будет перезагружена.')
          window.location.reload()
        } else {
          const error = await response.json()
          alert(`❌ Ошибка: ${error.detail || 'Неизвестная ошибка'}`)
        }
      } catch (error) {
        alert('⚠️ Ошибка соединения с сервером')
      } finally {
        setIsRestoring(false)
      }
    }
    input.click()
  }

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`🗑️ Удалить бэкап "${filename}"?`)) return
    
    try {
      const token = getToken()
      if (!token) {
        alert('❌ Ошибка авторизации')
        return
      }
      
      const response = await fetch(`/api/admin/backup/${filename}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        await loadBackups()
        alert('✅ Бэкап удалён')
      } else {
        const error = await response.json()
        alert(`❌ Ошибка: ${error.detail || 'Неизвестная ошибка'}`)
      }
    } catch (error) {
      alert('⚠️ Ошибка удаления')
    }
  }

  const handleDownloadBackup = async (filename: string) => {
    try {
      const token = getToken()
      if (!token) {
        alert('❌ Ошибка авторизации')
        return
      }
      
      const response = await fetch(`/api/admin/backup/download/${filename}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } else {
        const error = await response.json()
        alert(`❌ Ошибка: ${error.detail || 'Неизвестная ошибка'}`)
      }
    } catch (error) {
      alert('⚠️ Ошибка скачивания')
    }
  }

  // ============================================
  // 🎨 КОМПОНЕНТ ПЕРЕКЛЮЧАТЕЛЯ
  // ============================================

  const ToggleSwitch = ({ checked, onChange, label, description }: { 
    checked: boolean
    onChange: (v: boolean) => void
    label: string
    description?: string
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          checked={checked} 
          onChange={e => onChange(e.target.checked)} 
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
      </label>
    </div>
  )

  // ============================================
  // 📋 ВКЛАДКИ
  // ============================================

  const tabs = [
    { id: 'general', label: 'Общие', icon: Globe },
    { id: 'warehouse', label: 'Склад', icon: Package },
    { id: 'documents', label: 'Документы', icon: FileText },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
    { id: 'security', label: 'Безопасность', icon: Shield },
    { id: 'backups', label: 'Резервное копирование', icon: Database },
  ]

  // ============================================
  // 🖥️ РЕНДЕР
  // ============================================

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-indigo-600" />
            Настройки системы
          </h1>
          <p className="text-gray-500 mt-1">Управление конфигурацией WMS</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleExport} 
            className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" 
            title="Экспорт настроек"
          >
            <Download className="w-4 h-4 text-gray-600" />
          </button>
          <label 
            className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors" 
            title="Импорт настроек"
          >
            <Upload className="w-4 h-4 text-gray-600" />
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button 
            onClick={handleReset} 
            className="px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors"
          >
            Сбросить
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Сохранение...' : 'Применить'}
          </button>
        </div>
      </div>

      {/* Уведомления */}
      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm font-medium text-green-900">Настройки успешно сохранены</p>
        </div>
      )}

      {saveError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-sm font-medium text-red-900">{saveError}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Боковое меню */}
        <div className="lg:w-64 shrink-0">
          <nav className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </nav>
          
          <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{user?.full_name || 'Администратор'}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role || 'admin'}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Server className="w-4 h-4" />
              <span>WMS v2.0.0</span>
            </div>
          </div>
        </div>

        {/* Основной контент */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            
            {/* ОБЩИЕ НАСТРОЙКИ */}
            {activeTab === 'general' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-600" /> Общие настройки
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Название системы</label>
                    <input 
                      type="text" 
                      value={settings.siteName}
                      onChange={e => updateSetting('siteName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Часовой пояс</label>
                    <select 
                      value={settings.timezone}
                      onChange={e => updateSetting('timezone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="Europe/Moscow">Москва (UTC+3)</option>
                      <option value="Europe/Kaliningrad">Калининград (UTC+2)</option>
                      <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                      <option value="Asia/Novosibirsk">Новосибирск (UTC+7)</option>
                      <option value="Asia/Vladivostok">Владивосток (UTC+10)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Формат даты</label>
                    <select 
                      value={settings.dateFormat}
                      onChange={e => updateSetting('dateFormat', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="DD.MM.YYYY">ДД.ММ.ГГГГ</option>
                      <option value="MM/DD/YYYY">ММ/ДД/ГГГГ</option>
                      <option value="YYYY-MM-DD">ГГГГ-ММ-ДД</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Язык интерфейса</label>
                    <select 
                      value={settings.language}
                      onChange={e => updateSetting('language', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="ru">🇷🇺 Русский</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Тема оформления</label>
                    <div className="grid grid-cols-3 gap-2 max-w-md">
                      <button 
                        onClick={() => updateSetting('theme', 'light')} 
                        className={`p-3 rounded-lg border-2 transition-all ${
                          settings.theme === 'light' 
                            ? 'border-indigo-600 bg-indigo-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Sun className="w-5 h-5 mx-auto text-gray-600" />
                        <span className="text-xs block mt-1">Светлая</span>
                      </button>
                      <button 
                        onClick={() => updateSetting('theme', 'dark')} 
                        className={`p-3 rounded-lg border-2 transition-all ${
                          settings.theme === 'dark' 
                            ? 'border-indigo-600 bg-indigo-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Moon className="w-5 h-5 mx-auto text-gray-600" />
                        <span className="text-xs block mt-1">Темная</span>
                      </button>
                      <button 
                        onClick={() => updateSetting('theme', 'auto')} 
                        className={`p-3 rounded-lg border-2 transition-all ${
                          settings.theme === 'auto' 
                            ? 'border-indigo-600 bg-indigo-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Monitor className="w-5 h-5 mx-auto text-gray-600" />
                        <span className="text-xs block mt-1">Авто</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* НАСТРОЙКИ СКЛАДА */}
            {activeTab === 'warehouse' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-600" /> Настройки склада
                </h2>
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.autoReserve} 
                    onChange={v => updateSetting('autoReserve', v)} 
                    label="Автоматическое резервирование" 
                    description="Товар резервируется при создании заказа" 
                  />
                  <ToggleSwitch 
                    checked={settings.lowStockAlert} 
                    onChange={v => updateSetting('lowStockAlert', v)} 
                    label="Уведомления о низком остатке" 
                    description="Алерт когда остаток ниже порога" 
                  />
                  <ToggleSwitch 
                    checked={settings.allowNegativeStock} 
                    onChange={v => updateSetting('allowNegativeStock', v)} 
                    label="Разрешить отрицательные остатки" 
                    description="Не рекомендуется для точного учёта" 
                  />
                  <ToggleSwitch 
                    checked={settings.autoGenerateSku} 
                    onChange={v => updateSetting('autoGenerateSku', v)} 
                    label="Автогенерация артикулов" 
                    description="Система создаёт SKU для новых товаров" 
                  />
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Порог низкого остатка</label>
                    <input 
                      type="number" 
                      value={settings.lowStockThreshold}
                      onChange={e => updateSetting('lowStockThreshold', parseInt(e.target.value) || 0)}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">При остатке ниже этого значения товар считается "мало"</p>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Префикс артикула</label>
                    <input 
                      type="text" 
                      value={settings.skuPrefix}
                      onChange={e => updateSetting('skuPrefix', e.target.value.toUpperCase())}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                      placeholder="ITEM"
                    />
                    <p className="text-xs text-gray-500 mt-1">Например: ITEM-001, ITEM-002</p>
                  </div>
                </div>
              </div>
            )}

            {/* НАСТРОЙКИ ДОКУМЕНТОВ */}
            {activeTab === 'documents' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" /> Настройки документов
                </h2>
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.autoNumbering} 
                    onChange={v => updateSetting('autoNumbering', v)} 
                    label="Автонумерация" 
                    description="Система генерирует номера документов" 
                  />
                  <ToggleSwitch 
                    checked={settings.requireApproval} 
                    onChange={v => updateSetting('requireApproval', v)} 
                    label="Требовать утверждение" 
                    description="Документ требует подтверждения менеджером" 
                  />
                  <ToggleSwitch 
                    checked={settings.autoCompleteOnShip} 
                    onChange={v => updateSetting('autoCompleteOnShip', v)} 
                    label="Автопроведение при отгрузке" 
                    description="Документ проводится при отгрузке" 
                  />
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Префикс номера документа</label>
                    <input 
                      type="text" 
                      value={settings.docNumberPrefix}
                      onChange={e => updateSetting('docNumberPrefix', e.target.value.toUpperCase())}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                      placeholder="DOC"
                    />
                    <p className="text-xs text-gray-500 mt-1">Например: DOC-001, DOC-002</p>
                  </div>
                </div>
              </div>
            )}

            {/* УВЕДОМЛЕНИЯ */}
            {activeTab === 'notifications' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-600" /> Настройки уведомлений
                </h2>
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.emailNotifications} 
                    onChange={v => updateSetting('emailNotifications', v)} 
                    label="Email-уведомления" 
                    description="Отправлять уведомления на email" 
                  />
                  <ToggleSwitch 
                    checked={settings.stockAlerts} 
                    onChange={v => updateSetting('stockAlerts', v)} 
                    label="Уведомления об остатках" 
                    description="Алерты когда товар заканчивается" 
                  />
                  <ToggleSwitch 
                    checked={settings.orderAlerts} 
                    onChange={v => updateSetting('orderAlerts', v)} 
                    label="Уведомления о заказах" 
                    description="Оповещения о новых и изменённых заказах" 
                  />
                  <ToggleSwitch 
                    checked={settings.dailyReport} 
                    onChange={v => updateSetting('dailyReport', v)} 
                    label="Ежедневный отчет" 
                    description="Сводка за день на email" 
                  />
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email для уведомлений</label>
                    <input 
                      type="email" 
                      value={settings.notificationEmail} 
                      onChange={e => updateSetting('notificationEmail', e.target.value)}
                      className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* БЕЗОПАСНОСТЬ */}
            {activeTab === 'security' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" /> Настройки безопасности
                </h2>
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.require2FA} 
                    onChange={v => updateSetting('require2FA', v)} 
                    label="Двухфакторная аутентификация" 
                    description="Требовать код из приложения при входе" 
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Таймаут сессии (мин)</label>
                      <input 
                        type="number" 
                        value={settings.sessionTimeout} 
                        onChange={e => updateSetting('sessionTimeout', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Срок пароля (дни)</label>
                      <input 
                        type="number" 
                        value={settings.passwordExpiry} 
                        onChange={e => updateSetting('passwordExpiry', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Макс. попыток входа</label>
                      <input 
                        type="number" 
                        value={settings.maxLoginAttempts} 
                        onChange={e => updateSetting('maxLoginAttempts', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                      />
                    </div>
                  </div>
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-900">Политика безопасности</p>
                        <p className="text-sm text-yellow-800 mt-1">
                          При превышении лимита попыток входа аккаунт блокируется на 30 минут.
                          Рекомендуется включить двухфакторную аутентификацию для всех администраторов.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* РЕЗЕРВНОЕ КОПИРОВАНИЕ */}
            {activeTab === 'backups' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600" /> Резервное копирование
                </h2>
                
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.autoBackup} 
                    onChange={v => updateSetting('autoBackup', v)} 
                    label="Автоматическое резервное копирование" 
                    description="Система создаёт бэкапы по расписанию" 
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Частота</label>
                      <select 
                        value={settings.backupFrequency} 
                        onChange={e => updateSetting('backupFrequency', e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      >
                        <option value="hourly">⏱️ Каждый час</option>
                        <option value="daily">📅 Ежедневно</option>
                        <option value="weekly">📆 Еженедельно</option>
                        <option value="monthly">📊 Ежемесячно</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Хранить (дней)</label>
                      <input 
                        type="number" 
                        value={settings.backupRetention} 
                        onChange={e => updateSetting('backupRetention', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Место хранения</label>
                      <select 
                        value={settings.backupLocation} 
                        onChange={e => updateSetting('backupLocation', e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      >
                        <option value="local">💻 Локальный</option>
                        <option value="cloud">☁️ Облако</option>
                        <option value="ftp">📡 FTP</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button 
                      onClick={handleCreateBackup} 
                      disabled={isCreatingBackup}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-2 transition-colors"
                    >
                      {isCreatingBackup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                      {isCreatingBackup ? 'Создание...' : 'Создать бэкап'}
                    </button>
                    <button 
                      onClick={handleRestoreBackup}
                      disabled={isRestoring}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2 transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                      {isRestoring ? 'Восстановление...' : 'Восстановить'}
                    </button>
                  </div>
                  
                  {/* Список бэкапов */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">История бэкапов ({backups.length})</h4>
                    {backups.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>Нет созданных бэкапов</p>
                        <p className="text-sm text-gray-400 mt-1">Нажмите "Создать бэкап" чтобы создать первый</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {backups.map((backup, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-700 truncate">{backup.created_at}</span>
                              <span className="text-xs text-gray-500 flex-shrink-0">{backup.size}</span>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button 
                                onClick={() => handleDownloadBackup(backup.filename)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                                title="Скачать"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteBackup(backup.filename)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                                title="Удалить"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}