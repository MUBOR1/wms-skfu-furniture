import { useEffect, useState } from 'react'
import { audit } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { History, Filter, User as UserIcon } from 'lucide-react'

export default function AuditPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const params: any = {}
        if (filter) params.entity_type = filter
        const res = await audit.logs(params)
        setLogs(Array.isArray(res) ? res : [])
      } catch (e) { 
        console.error('Audit load error:', e) 
      } finally { 
        setIsLoading(false) 
      }
    }
    load()
  }, [filter])

  const actionColors: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-700 border-green-200',
    UPDATE: 'bg-blue-100 text-blue-700 border-blue-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200',
    COMPLETE: 'bg-purple-100 text-purple-700 border-purple-200'
  }

  const formatValue = (val: string | null) => {
    if (!val) return '—'
    try {
      const parsed = JSON.parse(val)
      return Object.entries(parsed).slice(0, 3).map(([k, v]: any) => `${k}:${v}`).join(', ')
    } catch {
      return val.slice(0, 50) + (val.length > 50 ? '...' : '')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-6 h-6 text-indigo-600" /> Журнал действий
        </h2>
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
          <Filter className="w-4 h-4 text-gray-500" />
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)} 
            className="border-none outline-none text-sm bg-transparent cursor-pointer"
          >
            <option value="">Все действия</option>
            <option value="product">Номенклатура</option>
            <option value="document">Документы</option>
            <option value="order">Заказы</option>
            <option value="inventory">Инвентаризация</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent mx-auto"></div>
          <p className="text-gray-500 mt-3">Загрузка журнала...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Пользователь</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Действие</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Сущность</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Изменения</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('ru-RU', { 
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-gray-400" />
                    {log.user_id === user?.id ? 'Вы' : `#${log.user_id}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${actionColors[log.action] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{log.entity_type}</td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-600">#{log.entity_id}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                    <div className="space-y-1">
                      {log.old_value && (
                        <p className="text-red-600 line-through opacity-70">− {formatValue(log.old_value)}</p>
                      )}
                      {log.new_value && (
                        <p className="text-green-600">+ {formatValue(log.new_value)}</p>
                      )}
                      {!log.old_value && !log.new_value && <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                      <History className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">Записей не найдено</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {filter ? `По фильтру "${filter}"` : 'Совершите действие (создайте товар/документ), и оно появится здесь'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}