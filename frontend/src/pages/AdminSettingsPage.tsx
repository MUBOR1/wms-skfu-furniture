import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  Settings, Shield, Database, Bell, Globe, 
  Save, RefreshCw, CheckCircle, AlertTriangle, 
  Users, FileText, Package, Moon, Sun, Monitor
} from 'lucide-react'

// 🔧 ИНТЕРФЕЙС НАСТРОЕК
interface SystemSettings {
  // Общие
  siteName: string
  timezone: string
  dateFormat: string
  language: string
  theme: 'light' | 'dark' | 'auto'
  
  // Склад
  autoReserve: boolean
  lowStockAlert: boolean
  lowStockThreshold: number
  allowNegativeStock: boolean
  autoGenerateSku: boolean
  skuPrefix: string
  
  // Документы
  autoNumbering: boolean
  docNumberPrefix: string
  requireApproval: boolean
  autoCompleteOnShip: boolean
  
  // Уведомления
  emailNotifications: boolean
  stockAlerts: boolean
  orderAlerts: boolean
  dailyReport: boolean
  
  // Безопасность
  sessionTimeout: number
  require2FA: boolean
  passwordExpiry: number
  maxLoginAttempts: number
  
  // Бэкапы
  autoBackup: boolean
  backupFrequency: string
  backupRetention: number
  backupLocation: string
}

// 🔧 ДЕФОЛТНЫЕ НАСТРОЙКИ
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
  
  sessionTimeout: 30,
  require2FA: false,
  passwordExpiry: 90,
  maxLoginAttempts: 5,
  
  autoBackup: true,
  backupFrequency: 'daily',
  backupRetention: 30,
  backupLocation: 'local'
}

export default function AdminSettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('general')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)

  // 🔧 ЗАГРУЗКА НАСТРОЕК ИЗ LOCALSTORAGE
  useEffect(() => {
    const saved = localStorage.getItem('wms_settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      } catch (e) {
        console.error('Ошибка загрузки настроек:', e)
      }
    }
    
    // 🔧 ПРИМЕНЕНИЕ ТЕМЫ ПРИ ЗАГРУЗКЕ
    applyTheme(settings.theme)
  }, [])

  // 🔧 СОХРАНЕНИЕ НАСТРОЕК
  const handleSave = async () => {
    setIsSaving(true)
    
    try {
      // Сохраняем в localStorage
      localStorage.setItem('wms_settings', JSON.stringify(settings))
      
      // Применяем тему
      applyTheme(settings.theme)
      
      // Имитация задержки
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Ошибка сохранения:', err)
      alert('❌ Не удалось сохранить настройки')
    } finally {
      setIsSaving(false)
    }
  }

  // 🔧 ПРИМЕНЕНИЕ ТЕМЫ
  const applyTheme = (theme: string) => {
    const root = document.documentElement
    
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // Авто - проверяем системные настройки
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }

  //  СБРОС НАСТРОЕК
  const handleReset = () => {
    if (confirm('Сбросить все настройки до значений по умолчанию?')) {
      setSettings(DEFAULT_SETTINGS)
      localStorage.removeItem('wms_settings')
      applyTheme('light')
    }
  }

  // 🔧 ОБНОВЛЕНИЕ НАСТРОЙКИ
  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // 🔧 ЭКСПОРТ НАСТРОЕК
  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wms_settings_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  //  ИМПОРТ НАСТРОЕК
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string)
        setSettings({ ...DEFAULT_SETTINGS, ...imported })
        alert('✅ Настройки успешно импортированы')
      } catch (err) {
        alert('❌ Ошибка чтения файла')
      }
    }
    reader.readAsText(file)
  }

  // 🔧 СОЗДАНИЕ БЭКАПА ВРУЧНУЮ
  const handleCreateBackup = () => {
    alert(' Создание резервной копии...\n\nВ реальной системе здесь был бы запрос к API для создания дампа базы данных.')
  }

  // Компонент переключателя
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

  // Вкладки
  const tabs = [
    { id: 'general', label: 'Общие', icon: Globe },
    { id: 'warehouse', label: 'Склад', icon: Package },
    { id: 'documents', label: 'Документы', icon: FileText },
    { id: 'notifications', label: 'Уведомления', icon: Bell },
    { id: 'security', label: 'Безопасность', icon: Shield },
    { id: 'backups', label: 'Бэкапы', icon: Database },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 🔝 ЗАГОЛОВОК */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-indigo-600" />
            Настройки системы
          </h1>
          <p className="text-gray-500 mt-1">Управление конфигурацией WMS и параметрами склада</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Экспорт/Импорт */}
          <button 
            onClick={handleExport}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Экспорт настроек"
          >
            <Save className="w-4 h-4 text-gray-600" />
          </button>
          <label className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer" title="Импорт настроек">
            <RefreshCw className="w-4 h-4 text-gray-600" />
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          
          {/* Сброс */}
          <button 
            onClick={handleReset}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-600 transition-colors"
          >
            Сбросить
          </button>
          
          {/* Сохранить */}
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* УВЕДОМЛЕНИЕ ОБ УСПЕШНОМ СОХРАНЕНИИ */}
      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-900">Настройки успешно сохранены</p>
            <p className="text-xs text-green-700">Изменения применены к системе</p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/*  БОКОВОЕ МЕНЮ */}
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
          
          {/* Информация о пользователе */}
          <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{user?.full_name || 'Администратор'}</p>
                <p className="text-xs text-gray-500">{user?.role || 'admin'}</p>
              </div>
            </div>
          </div>
        </div>

        {/*  ОСНОВНОЙ КОНТЕНТ */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            
            {/* ОБЩИЕ НАСТРОЙКИ */}
            {activeTab === 'general' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-600" />
                  Общие настройки
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Название системы</label>
                      <input 
                        type="text" 
                        value={settings.siteName}
                        onChange={e => updateSetting('siteName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Часовой пояс</label>
                      <select 
                        value={settings.timezone}
                        onChange={e => updateSetting('timezone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      >
                        <option value="Europe/Moscow">🕐 Москва (UTC+3)</option>
                        <option value="Europe/Kaliningrad">🕐 Калининград (UTC+2)</option>
                        <option value="Asia/Yekaterinburg"> Екатеринбург (UTC+5)</option>
                        <option value="Asia/Novosibirsk"> Новосибирск (UTC+7)</option>
                        <option value="Asia/Vladivostok"> Владивосток (UTC+10)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Формат даты</label>
                      <select 
                        value={settings.dateFormat}
                        onChange={e => updateSetting('dateFormat', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      >
                        <option value="DD.MM.YYYY">ДД.ММ.ГГГГ (09.06.2026)</option>
                        <option value="MM/DD/YYYY">ММ/ДД/ГГГГ (06/09/2026)</option>
                        <option value="YYYY-MM-DD">ГГГГ-ММ-ДД (2026-06-09)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Язык интерфейса</label>
                      <select 
                        value={settings.language}
                        onChange={e => updateSetting('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      >
                        <option value="ru">🇷🇺 Русский</option>
                        <option value="en">🇧 English</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Тема оформления</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button 
                          onClick={() => updateSetting('theme', 'light')}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                            settings.theme === 'light' 
                              ? 'border-indigo-600 bg-indigo-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Sun className="w-5 h-5 text-gray-600" />
                          <span className="text-xs font-medium">Светлая</span>
                        </button>
                        <button 
                          onClick={() => updateSetting('theme', 'dark')}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                            settings.theme === 'dark' 
                              ? 'border-indigo-600 bg-indigo-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Moon className="w-5 h-5 text-gray-600" />
                          <span className="text-xs font-medium">Темная</span>
                        </button>
                        <button 
                          onClick={() => updateSetting('theme', 'auto')}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                            settings.theme === 'auto' 
                              ? 'border-indigo-600 bg-indigo-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Monitor className="w-5 h-5 text-gray-600" />
                          <span className="text-xs font-medium">Авто</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* НАСТРОЙКИ СКЛАДА */}
            {activeTab === 'warehouse' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-600" />
                  Настройки склада
                </h2>
                
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.autoReserve} 
                    onChange={v => updateSetting('autoReserve', v)} 
                    label="Автоматическое резервирование товара"
                    description="Товар резервируется при создании заказа"
                  />
                  <ToggleSwitch 
                    checked={settings.lowStockAlert} 
                    onChange={v => updateSetting('lowStockAlert', v)} 
                    label="Уведомления о низком остатке"
                    description="Отправлять алерт когда остаток ниже порога"
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
                    description="Система автоматически создаёт SKU для новых товаров"
                  />
                  
                  <div className="pt-4 border-t border-gray-200 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Порог низкого остатка</label>
                        <input 
                          type="number" 
                          value={settings.lowStockThreshold}
                          onChange={e => updateSetting('lowStockThreshold', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">При остатке ниже этого значения товар считается "мало"</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Префикс артикула</label>
                        <input 
                          type="text" 
                          value={settings.skuPrefix}
                          onChange={e => updateSetting('skuPrefix', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="ITEM"
                        />
                        <p className="text-xs text-gray-500 mt-1">Например: ITEM-001, ITEM-002</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* НАСТРОЙКИ ДОКУМЕНТОВ */}
            {activeTab === 'documents' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Настройки документов
                </h2>
                
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.autoNumbering} 
                    onChange={v => updateSetting('autoNumbering', v)} 
                    label="Автонумерация документов"
                    description="Система автоматически генерирует номера документов"
                  />
                  <ToggleSwitch 
                    checked={settings.requireApproval} 
                    onChange={v => updateSetting('requireApproval', v)} 
                    label="Требовать утверждение документов"
                    description="Документ требует подтверждения менеджером"
                  />
                  <ToggleSwitch 
                    checked={settings.autoCompleteOnShip} 
                    onChange={v => updateSetting('autoCompleteOnShip', v)} 
                    label="Автопроведение при отгрузке"
                    description="Документ автоматически проводится при отгрузке"
                  />
                  
                  <div className="pt-4 border-t border-gray-200 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Префикс номера документа</label>
                      <input 
                        type="text" 
                        value={settings.docNumberPrefix}
                        onChange={e => updateSetting('docNumberPrefix', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="DOC"
                      />
                      <p className="text-xs text-gray-500 mt-1">Например: DOC-001, DOC-002</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* УВЕДОМЛЕНИЯ */}
            {activeTab === 'notifications' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  Настройки уведомлений
                </h2>
                
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.emailNotifications} 
                    onChange={v => updateSetting('emailNotifications', v)} 
                    label="Email-уведомления"
                    description="Отправлять уведомления на email администратора"
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
                    label="Ежедневный отчет на email"
                    description="Сводка за день: заказы, остатки, документы"
                  />
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl">
                  <div className="flex items-start gap-3">
                    <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Email для уведомлений</p>
                      <p className="text-sm text-blue-700 mt-1">admin@wms-skfu.ru</p>
                      <button className="text-xs text-blue-600 hover:text-blue-800 mt-2 underline">Изменить email</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* БЕЗОПАСНОСТЬ */}
            {activeTab === 'security' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  Настройки безопасности
                </h2>
                
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.require2FA} 
                    onChange={v => updateSetting('require2FA', v)} 
                    label="Двухфакторная аутентификация"
                    description="Требовать код из приложения при входе"
                  />
                  
                  <div className="pt-4 border-t border-gray-200 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Срок действия пароля (дни)</label>
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

            {/* БЭКАПЫ */}
            {activeTab === 'backups' && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600" />
                  Настройки резервного копирования
                </h2>
                
                <div className="max-w-2xl">
                  <ToggleSwitch 
                    checked={settings.autoBackup} 
                    onChange={v => updateSetting('autoBackup', v)} 
                    label="Автоматическое резервное копирование"
                    description="Система автоматически создаёт бэкапы по расписанию"
                  />
                  
                  <div className="pt-4 border-t border-gray-200 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Частота бэкапов</label>
                        <select 
                          value={settings.backupFrequency}
                          onChange={e => updateSetting('backupFrequency', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                          <option value="hourly">Каждый час</option>
                          <option value="daily">Ежедневно</option>
                          <option value="weekly">Еженедельно</option>
                          <option value="monthly">Ежемесячно</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Хранить бэкапы (дней)</label>
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
                          onChange={e => updateSetting('backupLocation', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                          <option value="local">️ Локальный сервер</option>
                          <option value="cloud">☁️ Облако (AWS S3)</option>
                          <option value="ftp">📡 FTP-сервер</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-900">Последний бэкап</p>
                          <p className="text-sm text-green-700 mt-1">09.06.2026 в 03:00 • Размер: 45.2 MB • Статус: Успешно</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleCreateBackup}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-medium transition-colors"
                      >
                        Создать сейчас
                      </button>
                    </div>
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