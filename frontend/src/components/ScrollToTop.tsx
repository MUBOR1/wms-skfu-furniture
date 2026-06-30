// src/components/ScrollToTop.tsx
import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.pageYOffset > 300)
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  if (!isVisible) return null

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-24 right-6 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-900 transition-all z-40"
      title="Наверх"
    >
      <ChevronUp className="w-6 h-6" />
    </button>
  )
}