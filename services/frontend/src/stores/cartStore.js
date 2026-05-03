// Cart state management with backend synchronization
// Provides optimistic updates for fast UI with eventual backend consistency

import * as cartService from '../services/cartService'

let cart = []
let listeners = []
let syncInProgress = false
let syncQueue = []

export const cartStore = {
  getCart: () => cart,

  getItemCount: () => cart.reduce((total, item) => total + item.quantity, 0),

  getTotal: () => cart.reduce((total, item) => total + (item.price * item.quantity), 0),

  // Sync cart with backend
  syncWithBackend: async () => {
    if (syncInProgress) return

    try {
      syncInProgress = true
      const data = await cartService.fetchCart()

      // Transform backend format to local format
      cart = (data.items || []).map(item => ({
        id: item.productId,
        name: item.name,
        ref: item.sku,
        price: item.price,
        image: item.image,
        size: item.size,
        color: item.color,
        quantity: item.quantity
      }))

      cartStore.notify()
      cartStore.saveToStorage()
    } catch (error) {
      console.error('Failed to sync cart with backend:', error)
      // Keep using local cart on error
    } finally {
      syncInProgress = false
      // Process any queued operations
      cartStore.processQueue()
    }
  },

  // Process queued operations after sync
  processQueue: async () => {
    while (syncQueue.length > 0) {
      const operation = syncQueue.shift()
      try {
        await operation()
      } catch (error) {
        console.error('Queued operation failed:', error)
      }
    }
  },

  addItem: async (product, quantity = 1, size = '', color = '') => {
    // Optimistic update
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

    // Sync with backend
    try {
      await cartService.addToCart(product.id, quantity, size || null, color || null)
    } catch (error) {
      console.error('Failed to sync add to cart:', error)
      // Revert on failure - re-sync from backend
      await cartStore.syncWithBackend()
    }
  },

  updateQuantity: async (itemId, quantity, size = '', color = '') => {
    const item = cart.find(
      item => item.id === itemId && item.size === size && item.color === color
    ) || cart.find(item => item.id === itemId)

    if (!item) return

    const oldQuantity = item.quantity

    // Optimistic update
    if (quantity <= 0) {
      cart = cart.filter(i => !(i.id === itemId && i.size === (size || item.size) && i.color === (color || item.color)))
    } else {
      item.quantity = quantity
    }

    cartStore.notify()
    cartStore.saveToStorage()

    // Sync with backend
    try {
      if (quantity <= 0) {
        await cartService.removeFromCart(itemId, size || item.size || null, color || item.color || null)
      } else {
        await cartService.updateCartItem(itemId, quantity, size || item.size || null, color || item.color || null)
      }
    } catch (error) {
      console.error('Failed to sync quantity update:', error)
      // Revert on failure
      if (item) {
        item.quantity = oldQuantity
        cartStore.notify()
        cartStore.saveToStorage()
      }
    }
  },

  removeItem: async (itemId, size = '', color = '') => {
    const itemIndex = cart.findIndex(
      item => item.id === itemId && (size === '' || item.size === size) && (color === '' || item.color === color)
    )

    if (itemIndex === -1) return

    const removedItem = cart[itemIndex]

    // Optimistic update
    cart = cart.filter((item, index) => index !== itemIndex)
    cartStore.notify()
    cartStore.saveToStorage()

    // Sync with backend
    try {
      await cartService.removeFromCart(itemId, removedItem.size || null, removedItem.color || null)
    } catch (error) {
      console.error('Failed to sync remove from cart:', error)
      // Revert on failure
      cart.splice(itemIndex, 0, removedItem)
      cartStore.notify()
      cartStore.saveToStorage()
    }
  },

  clearCart: async () => {
    const oldCart = [...cart]

    // Optimistic update
    cart = []
    cartStore.notify()
    cartStore.saveToStorage()

    // Sync with backend
    try {
      await cartService.clearCart()
    } catch (error) {
      console.error('Failed to sync clear cart:', error)
      // Revert on failure
      cart = oldCart
      cartStore.notify()
      cartStore.saveToStorage()
    }
  },

  // Merge guest cart after login
  mergeGuestCart: async () => {
    try {
      await cartService.mergeCart()
      // Refresh cart from backend after merge
      await cartStore.syncWithBackend()
    } catch (error) {
      console.error('Failed to merge guest cart:', error)
    }
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
  },

  // Initialize cart - load from storage and sync with backend
  initialize: async () => {
    cartStore.loadFromStorage()
    // Try to sync with backend (will fail gracefully if offline)
    try {
      await cartStore.syncWithBackend()
    } catch (error) {
      // Use local cart if backend unavailable
      console.warn('Using local cart - backend unavailable')
    }
  }
}

// Load cart from storage on init
cartStore.loadFromStorage()

// Try to sync with backend on init (non-blocking)
cartStore.syncWithBackend().catch(() => {
  console.warn('Initial cart sync failed - using local cart')
})

export default cartStore
