export default function AdminSettingsPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">⚙️ Настройки системы</h2>
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <p className="text-gray-600">Конфигурация склада, правила нумерации документов, параметры резервного копирования и интеграции.</p>
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded text-blue-700">
          ℹ️ Здесь будут храниться глобальные параметры WMS. Для ВКР реализована базовая структура модуля.
        </div>
      </div>
    </div>
  )
}