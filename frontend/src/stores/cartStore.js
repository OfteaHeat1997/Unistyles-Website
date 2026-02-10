// Simple cart state management
// Can be upgraded to Zustand or Redux later

let cart = []
let listeners = []

export const cartStore = {
  getCart: () => cart,

  getItemCount: () => cart.reduce((total, item) => total + item.quantity, 0),

  getTotal: () => cart.reduce((total, item) => total + (item.price * item.quantity), 0),

  addItem: (product, quantity = 1, size = '', color = '') => {
    const existingIndex = cart.findIndex(
      item => item.id === product.id && item.size === size && item.color === color
    )

    if (existingIndex >= 0) {
      cart[existingIndex].quantity += quantity
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        ref: product.ref,
        price: product.price,
        image: product.image,
        size,
        color,
        quantity
      })
    }

    cartStore.notify()
    cartStore.saveToStorage()
  },

  updateQuantity: (itemId, quantity) => {
    const item = cart.find(item => item.id === itemId)
    if (item) {
      item.quantity = Math.max(0, quantity)
      if (item.quantity === 0) {
        cart = cart.filter(i => i.id !== itemId)
      }
      cartStore.notify()
      cartStore.saveToStorage()
    }
  },

  removeItem: (itemId) => {
    cart = cart.filter(item => item.id !== itemId)
    cartStore.notify()
    cartStore.saveToStorage()
  },

  clearCart: () => {
    cart = []
    cartStore.notify()
    cartStore.saveToStorage()
  },

  subscribe: (listener) => {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter(l => l !== listener)
    }
  },

  notify: () => {
    listeners.forEach(listener => listener(cart))
  },

  saveToStorage: () => {
    try {
      localStorage.setItem('unistyles_cart', JSON.stringify(cart))
    } catch (e) {
      console.error('Failed to save cart:', e)
    }
  },

  loadFromStorage: () => {
    try {
      const saved = localStorage.getItem('unistyles_cart')
      if (saved) {
        cart = JSON.parse(saved)
        cartStore.notify()
      }
    } catch (e) {
      console.error('Failed to load cart:', e)
    }
  }
}

// Load cart from storage on init
cartStore.loadFromStorage()

export default cartStore
