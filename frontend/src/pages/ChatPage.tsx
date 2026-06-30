// src/pages/ChatPage.tsx
import { useEffect, useState, useRef } from 'react'
import { request } from '../api/wms'
import { useAuth } from '../context/AuthContext'
import { Send, MessageSquare, User, Clock, CheckCheck } from 'lucide-react'

interface Message {
  id: number
  user_id: number
  user_name: string
  user_role: string
  message: string
  is_client_message: boolean
  is_read: boolean
  created_at: string
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAdmin = user?.role === 'admin' || user?.role === 'warehouse_manager'

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMessages = async () => {
    try {
      const data = await request<Message[]>('/chat/messages?limit=100')
      setMessages(data || [])
      await request('/chat/mark-read', { method: 'POST' })
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    try {
      await request('/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          message: newMessage,
          is_client_message: user?.role === 'client'
        })
      })
      setNewMessage('')
      await loadMessages()
    } catch (err: any) {
      alert('❌ Ошибка отправки: ' + err.message)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isOutgoing = (msg: Message) => {
    if (isAdmin) {
      return !msg.is_client_message
    } else {
      return msg.is_client_message
    }
  }

  const getSenderName = (msg: Message) => {
    if (isAdmin) {
      return msg.is_client_message ? msg.user_name || 'Клиент' : 'Вы'
    } else {
      return msg.is_client_message ? 'Вы' : msg.user_name || 'Поддержка'
    }
  }

  const getMessageStyle = (msg: Message) => {
    const outgoing = isOutgoing(msg)
    if (outgoing) {
      return 'bg-indigo-600 text-white rounded-br-none'
    } else {
      return 'bg-gray-200 text-gray-800 rounded-bl-none'
    }
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Чат поддержки</h2>
            <p className="text-xs text-gray-500">
              {isAdmin ? 'Отвечайте клиентам' : 'Задайте вопрос менеджеру'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            {isAdmin ? '🟢 В сети' : '🟢 Онлайн'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="w-16 h-16 mb-3 text-gray-300" />
            <p className="text-lg font-medium">Нет сообщений</p>
            <p className="text-sm">Напишите что-нибудь, чтобы начать диалог</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const outgoing = isOutgoing(msg)
            const showUser = idx === 0 || messages[idx-1]?.user_id !== msg.user_id
            const senderName = getSenderName(msg)
            
            return (
              <div key={msg.id} className="flex flex-col">
                {showUser && (
                  <div className={`flex items-center gap-2 text-xs text-gray-500 mb-1 ${outgoing ? 'justify-end' : 'justify-start'}`}>
                    <User className="w-3 h-3" />
                    <span className="font-medium">
                      {senderName}
                      {!outgoing && msg.user_role && (
                        <span className="text-gray-400 ml-1">({msg.user_role})</span>
                      )}
                    </span>
                    <Clock className="w-3 h-3 ml-2" />
                    <span>{new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                
                <div className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-lg shadow-sm ${getMessageStyle(msg)}`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${outgoing ? 'text-indigo-200' : 'text-gray-500'}`}>
                      {outgoing && msg.is_read && <CheckCheck className="w-3 h-3" />}
                      <span className="text-[10px] opacity-70">
                        {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-white shrink-0">
        <div className="flex gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isAdmin ? "Введите ответ клиенту..." : "Введите ваше сообщение..."}
            rows={2}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          />
          <button
            onClick={sendMessage}
            disabled={isSending || !newMessage.trim()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed self-end flex items-center gap-2 font-medium transition-colors"
          >
            <Send className="w-5 h-5" />
            Отправить
          </button>
        </div>
      </div>
    </div>
  )
}