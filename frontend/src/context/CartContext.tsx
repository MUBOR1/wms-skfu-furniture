// src/context/CartContext.tsx
import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface CartItem {
  product_id: number
  sku: string
  name: string
  quantity: number
  sale_price: number
  category?: string
  available?: number
}

interface CartContextType {
  items: CartItem[]
  addToCart: (product: any, quantity?: number) => void
  removeFromCart: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
  getItemQuantity: (productId: number) => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    // 🔥 ИСПОЛЬЗУЕМ sessionStorage ВМЕСТО localStorage
    const saved = sessionStorage.getItem('cart_items')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })

  useEffect(() => {
    // 🔥 СОХРАНЯЕМ В sessionStorage
    sessionStorage.setItem('cart_items', JSON.stringify(items))
  }, [items])

  const addToCart = (product: any, quantity: number = 1) => {
    setItems(prev => {
      const existing = prev.find(item => item.product_id === product.id)
      
      if (existing) {
        const maxAvailable = product.quantity || existing.available || 999
        const newQuantity = Math.min(existing.quantity + quantity, maxAvailable)
        
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: newQuantity, available: maxAvailable }
            : item
        )
      }
      
      return [...prev, {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        quantity: Math.min(quantity, product.quantity || 999),
        sale_price: product.sale_price,
        category: product.category,
        available: product.quantity || 999
      }]
    })
  }

  const removeFromCart = (productId: number) => {
    setItems(prev => prev.filter(item => item.product_id !== productId))
  }

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    
    setItems(prev =>
      prev.map(item => {
        if (item.product_id === productId) {
          const maxAvailable = item.available || 999
          const safeQuantity = Math.min(quantity, maxAvailable)
          return { ...item, quantity: safeQuantity }
        }
        return item
      })
    )
  }

  const clearCart = () => {
    setItems([])
  }

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }

  const getTotalPrice = () => {
    return items.reduce((sum, item) => sum + (item.sale_price * item.quantity), 0)
  }

  const getItemQuantity = (productId: number) => {
    const item = items.find(i => i.product_id === productId)
    return item?.quantity || 0
  }

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalItems,
      getTotalPrice,
      getItemQuantity
    }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}