import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  // Показываем кнопку, когда прокрутили больше 300px
  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 300)
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  // Плавная прокрутка наверх
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className="
            fixed bottom-8 right-8 z-50
            p-3 bg-indigo-600 text-white rounded-full 
            shadow-lg hover:bg-indigo-700 
            transform transition-all duration-300 
            hover:scale-110 hover:shadow-xl
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
          "
          title="Прокрутить наверх"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
      )}
    </>
  )
}