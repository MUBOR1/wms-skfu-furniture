import { useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState('Проверка связи...')

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setStatus(`✅ ${data.status} (${data.service})`))
      .catch(() => setStatus('❌ Backend недоступен'))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-2">🏭 WMS Фабрики мебели СК</h1>
        <p className="text-gray-500 mb-4">Учебный прототип ВКР • СКФУ</p>
        <div className="bg-gray-100 rounded-lg p-4 text-sm font-mono">
          Статус: <span className={status.includes('✅') ? 'text-green-600' : 'text-red-600'}>{status}</span>
        </div>
        <p className="mt-4 text-xs text-gray-400">Ожидание Шага 2: Подключение БД и миграции</p>
      </div>
    </div>
  )
}

export default App