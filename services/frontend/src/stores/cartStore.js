// Cart state management with backend synchronization
// Provides optimistic updates for fast UI with eventual backend consistency.
// A cart line is identified by product + variant (+ size/colour for
// products without variants): see lineKey().

import * as cartService from '../services/cartService'

let cart = []
let listeners = []
let syncInProgress = false
let syncQueue = []

export function lineKey(item) {
  return [item.id, item.variantId || '', item.size || '', item.color || ''].join('|')
}

function findLine(keyOrId) {
  return cart.find(item => lineKey(item) === keyOrId) || cart.find(item => item.id === keyOrId)
}

export const cartStore = {
  getCart: () => cart,

  getItemCount: () => cart.reduce((total, item) => total + item.quantity, 0),

  // Display estimate only — the checkout quote from the server is authoritative
  getTotal: () => cart.reduce((total, item) => total + (item.price * item.quantity), 0),

  // Sync cart with backend
  syncWithBackend: async () => {
    if (syncInProgress) return

    try {
      syncInProgress = true
      const data = await cartService.fetchCart()

      // An empty answer from a failed request must not wipe the local cart
      if (data._failed) return

      cart = (data.items || []).map(item => ({
        id: item.productId,
        variantId: item.variantId || null,
        name: item.name,
        ref: item.ref,
        price: item.price,
        image: item.image,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        stockQuantity: item.stockQuantity
      }))

      cartStore.notify()
      cartStore.saveToStorage()
    } catch (error) {
      console.error('Failed to sync cart with backend:', error)
    } finally {
      syncInProgress = false
      cartStore.processQueue()
    }
  },

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

  /**
   * @param {object} product
   * @param {number} quantity
   * @param {string} size
   * @param {string} color
   * @param {object|null} variant - { id, size, color, sku, price } when the product sells by variant
   */
  addItem: async (product, quantity = 1, size = '', color = '', variant = null) => {
    const line = {
      id: product.id,
      variantId: variant?.id || null,
      name: product.name,
      ref: variant?.sku || product.ref,
      price: variant?.price ?? product.price,
      image: product.image,
      size: variant?.size || size || '',
      color: variant?.color || color || '',
      quantity
    }
    const existing = cart.find(item => lineKey(item) === lineKey(line))

    if (existing) {
      existing.quantity += quantity
    } else {
      cart.push(line)
    }

    cartStore.notify()
    cartStore.saveToStorage()

    try {
      await cartService.addToCart(product.id, quantity, line.size || null, line.color || null, line.variantId)
      return { ok: true }
    } catch (error) {
      console.error('Failed to sync add to cart:', error)
      // Stock / validation errors: undo the optimistic line
      const current = cart.find(item => lineKey(item) === lineKey(line))
      if (current) {
        current.quantity -= quantity
        if (current.quantity <= 0) cart = cart.filter(i => i !== current)
        cartStore.notify()
        cartStore.saveToStorage()
      }
      return { ok: false, error: error.message }
    }
  },

  updateQuantity: async (keyOrId, quantity) => {
    const item = findLine(keyOrId)
    if (!item) return

    const oldQuantity = item.quantity

    if (quantity <= 0) {
      cart = cart.filter(i => i !== item)
    } else {
      item.quantity = quantity
    }

    cartStore.notify()
    cartStore.saveToStorage()

    try {
      if (quantity <= 0) {
        await cartService.removeFromCart(item.id, item.size || null, item.color || null, item.variantId)
      } else {
        await cartService.updateCartItem(item.id, quantity, item.size || null, item.color || null, item.variantId)
      }
    } catch (error) {
      console.error('Failed to sync quantity update:', error)
      if (quantity > 0) {
        item.quantity = oldQuantity
        cartStore.notify()
        cartStore.saveToStorage()
      }
    }
  },

  removeItem: async (keyOrId) => {
    const item = findLine(keyOrId)
    if (!item) return
    const index = cart.indexOf(item)

    cart = cart.filter(i => i !== item)
    cartStore.notify()
    cartStore.saveToStorage()

    try {
      await cartService.removeFromCart(item.id, item.size || null, item.color || null, item.variantId)
    } catch (error) {
      console.error('Failed to sync remove from cart:', error)
      cart.splice(index, 0, item)
      cartStore.notify()
      cartStore.saveToStorage()
    }
  },

  clearCart: async () => {
    cart = []
    cartStore.notify()
    cartStore.saveToStorage()

    try {
      await cartService.clearCart()
    } catch (error) {
      console.error('Failed to sync clear cart:', error)
    }
  },

  // Merge guest cart after login
  mergeGuestCart: async () => {
    try {
      await cartService.mergeCart()
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
    const snapshot = [...cart]
    listeners.forEach(listener => listener(snapshot))
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
        cart = JSON.parse(saved).map(item => ({ variantId: null, ...item }))
        cartStore.notify()
      }
    } catch (e) {
      console.error('Failed to load cart:', e)
    }
  },

  initialize: async () => {
    cartStore.loadFromStorage()
    try {
      await cartStore.syncWithBackend()
    } catch {
      console.warn('Using local cart - backend unavailable')
    }
  }
}

cartStore.loadFromStorage()

cartStore.syncWithBackend().catch(() => {
  console.warn('Initial cart sync failed - using local cart')
})

export default cartStore
