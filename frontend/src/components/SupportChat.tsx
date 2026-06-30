// src/components/SupportChat.tsx
import { useState, useEffect, useRef } from 'react'
import { request } from '../api/wms'
import { MessageSquare, X, Send, AlertCircle, Phone } from 'lucide-react'

interface Message {
  id: number
  message: string
  is_client_message: boolean
  created_at: string
}

export default function SupportChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadMessages()
      const interval = setInterval(loadMessages, 5000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    try {
      const data = await request<Message[]>('/chat/messages?limit=50')
      setMessages(data || [])
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    setIsLoading(true)
    try {
      await request('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          message: newMessage,
          is_client_message: true
        })
      })
      setNewMessage('')
      await loadMessages()
    } catch (err: any) {
      alert('❌ Ошибка отправки: ' + (err.message || 'Не удалось отправить'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 hover:scale-110 transition-all z-50"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col max-h-[600px]">
          {/* Заголовок с номером телефона */}
          <div className="p-4 bg-indigo-600 text-white rounded-t-xl flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <span className="font-bold">Поддержка</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-indigo-200 mt-0.5">
                <Phone className="w-3 h-3" />
                <span>8-800-555-01-02</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-indigo-700 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Нет сообщений</p>
                <p className="text-sm">Напишите нам, мы ответим soon!</p>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.is_client_message ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-lg break-words ${
                      msg.is_client_message
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-white border border-gray-200 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-xs mt-1 ${msg.is_client_message ? 'text-indigo-200' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('ru-RU', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Поле ввода */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
            <div className="flex gap-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Введите сообщение..."
                rows={2}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !newMessage.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}