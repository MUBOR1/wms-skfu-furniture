import { useEffect, useState, useMemo } from 'react'
import { audit, catalog, orders } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { 
  History, Filter, Calendar, X, RotateCcw, Clock, ChevronDown, ChevronUp,
  Package, FileText, ShoppingCart, ListChecks, Plus, Edit2, Trash2, 
  CheckCircle, Archive, Download, Upload, XCircle, RefreshCw, Eye, AlertCircle,
  MessageSquare
} from 'lucide-react'

interface AuditLog {
  id: number
  created_at: string
  user_id: number
  action: string
  entity_type: string
  entity_id: number
  old_value: string | null
  new_value: string | null
  comment?: string | null
}

interface EntityDetails {
  name?: string
  number?: string
  sku?: string
  status?: string
  total?: number
  items_count?: number
  [key: string]: any
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  product: Package,
  document: FileText,
  order: ShoppingCart,
  inventory: ListChecks,
  default: History
}

const actionConfig: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  CREATE: { label: 'Создан', color: 'bg-green-100 text-green-700 border-green-200', icon: Plus, description: 'Запись создана' },
  UPDATE: { label: 'Изменён', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Edit2, description: 'Внесены изменения' },
  DELETE: { label: 'Удалён', color: 'bg-red-100 text-red-700 border-red-200', icon: Trash2, description: 'Перемещён в архив' },
  PERMANENT_DELETE: { label: 'Уничтожен', color: 'bg-red-200 text-red-800 border-red-300', icon: Trash2, description: 'Полностью удалён из базы' },
  COMPLETE: { label: 'Проведён', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: CheckCircle, description: 'Документ проведён' },
  ARCHIVE: { label: 'Архивирован', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Archive, description: 'Перемещён в архив' },
  RESTORE: { label: 'Восстановлен', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: RotateCcw, description: 'Восстановлен из архива' },
  EXPORT: { label: 'Экспорт', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Download, description: 'Данные экспортированы' },
  IMPORT: { label: 'Импорт', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Upload, description: 'Данные импортированы' },
  CANCEL: { label: 'Отменён', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, description: 'Действие отменено' },
  STATUS_CHANGE: { label: 'Статус изменён', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: RefreshCw, description: 'Изменён статус' },
}

export default function AuditPage() {
  const { user, logout } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [entityDetails, setEntityDetails] = useState<Record<string, EntityDetails>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showEntityDetails, setShowEntityDetails] = useState<number | null>(null)
  const [authError, setAuthError] = useState(false)

  const [entityFilter, setEntityFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setAuthError(false)
      try {
        const params: any = {}
        if (entityFilter) params.entity_type = entityFilter
        
        const res = await audit.logs(params)
        const logsData = Array.isArray(res) ? res : []
        setLogs(logsData)
        
        const details: Record<string, EntityDetails> = {}
        const uniqueEntities = new Set<string>()
        
        logsData.forEach((log: AuditLog) => {
          const key = `${log.entity_type}_${log.entity_id}`
          if (!uniqueEntities.has(key)) {
            uniqueEntities.add(key)
            loadEntityDetails(log.entity_type, log.entity_id, details)
          }
        })
        
        setEntityDetails(details)
      } catch (err: any) {
        console.error('Audit load error:', err)
        if (err.status === 401 || err.message?.includes('401')) {
          setAuthError(true)
        } else {
          console.error('Не удалось загрузить журнал:', err)
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [entityFilter])

  const loadEntityDetails = async (type: string, id: number, details: Record<string, EntityDetails>) => {
    try {
      const key = `${type}_${id}`
      if (type === 'order') {
        const order: any = await orders.get(id)
        details[key] = {
          ...order,
          name: `Заказ ${order.order_number}`,
          number: order.order_number,
          status: order.status,
          total: order.total_amount,
          items_count: order.items?.length || 0,
          comment: order.comment
        }
      } else if (type === 'product') {
        const products = await catalog.products()
        const product: any = products.find((p: any) => p.id === id)
        if (product) {
          details[key] = {
            ...product,
            name: `${product.name} (${product.sku})`,
            sku: product.sku,
            category: product.category,
            price: product.sale_price
          }
        }
      } else if (type === 'document') {
        details[key] = { name: `Документ #${id}` }
      }
    } catch (e) {
      console.error(`Error loading ${type} ${id}:`, e)
    }
  }

  const filteredLogs = useMemo(() => {
    let result = [...logs]
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      result = result.filter(log => new Date(log.created_at) >= fromDate)
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter(log => new Date(log.created_at) <= toDate)
    }
    
    return result
  }, [logs, dateFrom, dateTo])

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Record<string, AuditLog[]>> = {}
    
    filteredLogs.forEach(log => {
      const dateStr = new Date(log.created_at).toLocaleDateString('ru-RU', { 
        day: '2-digit', month: '2-digit', year: 'numeric' 
      })
      const entityKey = `${log.entity_type}_${log.entity_id}`
      
      if (!groups[dateStr]) groups[dateStr] = {}
      if (!groups[dateStr][entityKey]) groups[dateStr][entityKey] = []
      groups[dateStr][entityKey].push(log)
    })
    
    const sortedDates = Object.keys(groups).sort((a, b) => {
      const dateA = new Date(a.split('.').reverse().join('-'))
      const dateB = new Date(b.split('.').reverse().join('-'))
      return dateB.getTime() - dateA.getTime()
    })
    
    sortedDates.forEach(date => {
      Object.values(groups[date]).forEach(entityLogs => {
        entityLogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      })
    })
    
    return { sortedDates, groups }
  }, [filteredLogs])

  const resetFilters = () => {
    setEntityFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const activeFiltersCount = [entityFilter, dateFrom, dateTo].filter(Boolean).length

  const formatDetailed = (val: string | null, action: string) => {
    const isDelete = action === 'DELETE' || action === 'PERMANENT_DELETE'
    const isCreate = action === 'CREATE'
    
    if (!val) {
      if (isDelete) return <span className="text-gray-400 italic">Удалено</span>
      if (isCreate) return <span className="text-gray-400 italic">Создано</span>
      return <span className="text-gray-400 italic">Нет данных</span>
    }
    
    try {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val
      if (typeof parsed === 'object' && parsed !== null) {
        const importantFields = ['name', 'sku', 'order_number', 'total', 'status', 'quantity', 'doc_number', 'type']
        const fieldsToShow = Object.entries(parsed).filter(([key]) => importantFields.includes(key))
        
        if (fieldsToShow.length === 0) {
          const otherFields = Object.entries(parsed).filter(([key]) => 
            !['id', 'created_at', 'updated_at', 'user_id'].includes(key)
          )
          return (
            <div className="space-y-1">
              {otherFields.slice(0, 5).map(([key, value]) => (
                <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-0 text-sm">
                  <span className="text-gray-600 font-medium capitalize">{getLabelForKey(key)}:</span>
                  <span className="text-gray-800 text-right break-all font-mono text-xs ml-2">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          )
        }
        
        return (
          <div className="space-y-1">
            {fieldsToShow.map(([key, value]) => (
              <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-0 text-sm">
                <span className="text-gray-600 font-medium capitalize">{getLabelForKey(key)}:</span>
                <span className="text-gray-800 text-right break-all font-mono text-xs ml-2">{formatValue(value)}</span>
              </div>
            ))}
          </div>
        )
      }
      return <span className="text-gray-800">{String(val)}</span>
    } catch {
      return <span className="text-gray-800">{val}</span>
    }
  }

  const getLabelForKey = (key: string): string => {
    const labels: Record<string, string> = {
      name: 'Название', sku: 'Артикул', order_number: '№ заказа', total: 'Сумма',
      status: 'Статус', quantity: 'Количество', doc_number: '№ документа', type: 'Тип',
      category: 'Категория', price: 'Цена', sale_price: 'Цена продажи',
      purchase_price: 'Цена закупки', comment: 'Комментарий', items_count: 'Позиций'
    }
    return labels[key] || key
  }

  const formatValue = (value: any): string => {
    if (typeof value === 'number') return value.toLocaleString('ru-RU')
    return String(value)
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', { 
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  if (authError) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Сессия истекла</h2>
          <p className="text-red-600 mb-6">Пожалуйста, войдите в систему заново, чтобы продолжить работу с журналом.</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => logout()} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2">
              <History className="w-4 h-4" /> Выйти
            </button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 font-medium">
              Перезагрузить
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-7 h-7 text-indigo-600" /> Журнал действий
        </h2>
        <button 
          onClick={() => window.location.reload()} 
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> <span className="hidden sm:inline">Обновить</span>
        </button>
      </div>

      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" /> Фильтры журнала
          </h4>
          {activeFiltersCount > 0 && (
            <button onClick={resetFilters} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline transition-colors">
              Сбросить все
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select 
            value={entityFilter} 
            onChange={e => setEntityFilter(e.target.value)} 
            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer"
          >
            <option value="">Все сущности</option>
            <option value="product">📦 Номенклатура</option>
            <option value="document">📄 Документы</option>
            <option value="order">🛒 Заказы</option>
            <option value="inventory">📋 Инвентаризация</option>
          </select>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {entityFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium">Сущность: {entityFilter}<button onClick={() => setEntityFilter('')} className="hover:text-red-500"><X className="w-3 h-3" /></button></span>}
            {dateFrom && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium">От: {dateFrom}<button onClick={() => setDateFrom('')} className="hover:text-red-500"><X className="w-3 h-3" /></button></span>}
            {dateTo && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium">До: {dateTo}<button onClick={() => setDateTo('')} className="hover:text-red-500"><X className="w-3 h-3" /></button></span>}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 mx-auto mb-3 border-t-transparent"></div>
          <p className="text-gray-500 text-sm">Загрузка журнала...</p>
        </div>
      ) : groupedByDate.sortedDates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">Записей не найдено</p>
          <p className="text-sm text-gray-400 mt-1">
            {activeFiltersCount > 0 ? 'Попробуйте изменить фильтры' : 'Совершите действие в системе'}
          </p>
          {activeFiltersCount > 0 && <button onClick={resetFilters} className="mt-3 text-sm text-indigo-600 hover:underline font-medium">Сбросить фильтры</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.sortedDates.map(dateStr => {
            const entities = groupedByDate.groups[dateStr]
            const totalActions = Object.values(entities).reduce((sum, entityLogs) => sum + entityLogs.length, 0)
            
            return (
              <div key={dateStr}>
                <div className="sticky top-0 z-10 bg-indigo-50/95 backdrop-blur-sm px-4 py-2.5 border-b-2 border-indigo-200 flex items-center gap-2 rounded-t-lg">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-semibold text-indigo-900">{dateStr}</h3>
                  <span className="text-xs text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-full font-medium">
                    {totalActions} {totalActions === 1 ? 'действие' : totalActions < 5 ? 'действия' : 'действий'}
                  </span>
                </div>

                <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-sm space-y-4 p-4">
                  {Object.entries(entities).map(([entityKey, entityLogs]) => {
                    const firstLog = entityLogs[0]
                    const lastLog = entityLogs[entityLogs.length - 1]
                    const EntityIcon = ENTITY_ICONS[firstLog.entity_type] || ENTITY_ICONS.default
                    const currentAction = actionConfig[lastLog.action] || actionConfig.UPDATE
                    const details = entityDetails[entityKey]
                    
                    return (
                      <div key={entityKey} className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2.5 bg-indigo-100 rounded-lg">
                              <EntityIcon className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-gray-900 capitalize text-lg truncate">
                                  {details?.name || `${firstLog.entity_type} #${firstLog.entity_id}`}
                                </h3>
                                {details && (
                                  <button 
                                    onClick={() => setShowEntityDetails(showEntityDetails === firstLog.entity_id ? null : firstLog.entity_id)}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    title="Показать подробности"
                                  >
                                    <Eye className="w-4 h-4 text-gray-500" />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                                <Clock className="w-3 h-3" /> 
                                {entityLogs.length} {entityLogs.length === 1 ? 'действие' : entityLogs.length < 5 ? 'действия' : 'действий'} • 
                                Обновлено: {formatDateTime(lastLog.created_at)}
                                {details?.status && <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">{details.status}</span>}
                                {details?.total && <span className="font-mono text-green-700">{details.total.toLocaleString('ru-RU')} ₽</span>}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 shrink-0 ${currentAction.color}`}>
                            <currentAction.icon className="w-3.5 h-3.5" />
                            {currentAction.label}
                          </span>
                        </div>

                        {showEntityDetails === firstLog.entity_id && details && (
                          <div className="p-4 bg-indigo-50/30 border-b border-gray-100 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              {Object.entries(details).filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k)).slice(0, 8).map(([key, value]) => (
                                <div key={key} className="bg-white p-2 rounded border border-gray-200">
                                  <span className="text-xs text-gray-500 block">{getLabelForKey(key)}:</span>
                                  <span className="font-medium text-gray-900">{formatValue(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="p-4">
                          <div className="relative">
                            <div className="absolute left-5 top-3 bottom-3 w-0.5 bg-gray-200" />
                            
                            <div className="space-y-0">
                              {entityLogs.map((log) => {
                                const action = actionConfig[log.action] || actionConfig.UPDATE
                                const isExpanded = expandedId === log.id
                                const isDelete = log.action === 'DELETE' || log.action === 'PERMANENT_DELETE'
                                const isCreate = log.action === 'CREATE'
                                
                                return (
                                  <div key={log.id} className="relative flex gap-4 pb-4 last:pb-0">
                                    <div className="flex flex-col items-center z-10 shrink-0">
                                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center bg-white shadow-sm ${action.color.split(' ')[0].replace('bg-', 'border-')}`}>
                                        <action.icon className="w-4 h-4" />
                                      </div>
                                    </div>

                                    <div className="flex-1 bg-gray-50/50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                                      <div 
                                        className="p-3 cursor-pointer"
                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${action.color}`}>
                                                {action.label}
                                              </span>
                                              <span className="text-xs text-gray-500 font-mono">{formatTime(log.created_at)}</span>
                                              {log.comment && (
                                                <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
                                                  <MessageSquare className="w-3 h-3" />
                                                  {log.comment}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-sm text-gray-700">
                                              Пользователь: <span className="font-medium">{log.user_id === user?.id ? 'Вы' : `#${log.user_id}`}</span>
                                            </p>
                                            {action.description && (
                                              <p className="text-xs text-gray-500 mt-1">{action.description}</p>
                                            )}
                                          </div>
                                          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isExpanded && (
                                          <div className="mt-3 pt-3 border-t border-gray-200 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              <div className={`p-3 rounded-lg border ${isCreate ? 'bg-gray-100 border-gray-200' : 'bg-white border-red-100'}`}>
                                                <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${isCreate ? 'text-gray-600' : 'text-red-700'}`}>
                                                  {isCreate ? <AlertCircle className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                                                  {isCreate ? 'Создано с нуля' : '🔻 Было (до изменения)'}
                                                </p>
                                                {isCreate ? (
                                                  <p className="text-sm text-gray-600 italic">Запись создана</p>
                                                ) : (
                                                  formatDetailed(log.old_value, log.action)
                                                )}
                                              </div>
                                              
                                              <div className={`p-3 rounded-lg border ${isDelete ? 'bg-gray-100 border-gray-200' : 'bg-white border-green-100'}`}>
                                                <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${isDelete ? 'text-gray-600' : 'text-green-700'}`}>
                                                  {isDelete ? <XCircle className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                  {isDelete ? '🗑️ Удалено' : '✅ Стало (после изменения)'}
                                                </p>
                                                {isDelete ? (
                                                  <p className="text-sm text-gray-600 italic">Запись удалена из системы</p>
                                                ) : (
                                                  formatDetailed(log.new_value, log.action)
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}