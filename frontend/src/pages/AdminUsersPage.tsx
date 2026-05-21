export default function AdminUsersPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">👥 Управление пользователями</h2>
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-600 mb-4">Модуль администрирования учётных записей, назначения ролей и управления доступом к модулям WMS.</p>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          ⚠️ Функция находится в разработке. Для демо используйте регистрацию пользователей через Swagger API (<code>POST /api/auth/register</code>).
        </div>
      </div>
    </div>
  )
}