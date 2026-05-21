import { useEffect, useState } from 'react'
import { inventory } from '../api/wms'
import { Package, TrendingUp } from 'lucide-react'

interface StockItem {
  product_sku: string
  product_name: string
  quantity: number
}

export default function ReportPage() {
  const [report, setReport] = useState<StockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await inventory.report()
        setReport(data as StockItem[])
      } catch (err) {
        console.error('Error loading report:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const totalItems = report.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Отчёт по складским остаткам</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Всего позиций</p>
              <p className="text-2xl font-bold">{report.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Общий остаток</p>
              <p className="text-2xl font-bold">{totalItems} шт.</p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Загрузка данных...</div>
      ) : report.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Нет данных об остатках</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Товар</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Остаток</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{item.product_sku}</td>
                  <td className="px-4 py-3 font-medium">{item.product_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      item.quantity < 10 ? 'bg-red-50 text-red-700' :
                      item.quantity < 50 ? 'bg-yellow-50 text-yellow-700' :
                      'bg-green-50 text-green-700'
                    }`}>
                      {item.quantity} шт.
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}