/**
 * Cart API Service for Unistyles Curacao
 *
 * Handles all cart-related API calls with support for both
 * guest users (using X-Cart-Id header) and authenticated users.
 */

const API_URL = '/api'

// Get or create cart ID for guest users
function getCartId() {
  let cartId = localStorage.getItem('cart_id')
  if (!cartId) {
    cartId = crypto.randomUUID ? crypto.randomUUID() :
      'cart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('cart_id', cartId)
  }
  return cartId
}

// Build headers for API requests
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  }

  const token = localStorage.getItem('token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else {
    headers['X-Cart-Id'] = getCartId()
  }

  return headers
}

// Safely parse JSON response
async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Server returned non-JSON response')
  }
  return response.json()
}

/**
 * Fetch cart items from the backend
 */
export async function fetchCart() {
  try {
    const response = await fetch(`${API_URL}/cart`, {
      method: 'GET',
      headers: getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch cart: ${response.status}`)
    }

    const data = await parseJsonResponse(response)

    // Store cart ID from response if provided (for new guests)
    const newCartId = response.headers.get('X-Cart-Id')
    if (newCartId) {
      localStorage.setItem('cart_id', newCartId)
    }

    return data
  } catch (error) {
    console.warn('Cart fetch failed, using empty cart:', error.message)
    return { items: [], itemCount: 0, subtotal: 0 }
  }
}

/**
 * Add an item to the cart
 */
export async function addToCart(productId, quantity = 1, size = null, color = null) {
  const response = await fetch(`${API_URL}/cart/add`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      productId,
      quantity,
      size,
      color
    })
  })

  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}))
    throw new Error(error.error || `Failed to add to cart: ${response.status}`)
  }

  const data = await parseJsonResponse(response)

  // Store cart ID from response if provided
  const newCartId = response.headers.get('X-Cart-Id')
  if (newCartId) {
    localStorage.setItem('cart_id', newCartId)
  }

  return data
}

/**
 * Update item quantity in the cart
 */
export async function updateCartItem(productId, quantity, size = null, color = null) {
  const response = await fetch(`${API_URL}/cart/update`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({
      productId,
      quantity,
      size,
      color
    })
  })

  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}))
    throw new Error(error.error || `Failed to update cart: ${response.status}`)
  }

  return parseJsonResponse(response)
}

/**
 * Remove an item from the cart
 */
export async function removeFromCart(productId, size = null, color = null) {
  const params = new URLSearchParams()
  if (size) params.append('size', size)
  if (color) params.append('color', color)

  const url = `${API_URL}/cart/remove/${productId}${params.toString() ? '?' + params.toString() : ''}`

  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders()
  })

  if (!response.ok) {
    const error = await parseJsonResponse(response).catch(() => ({}))
    throw new Error(error.error || `Failed to remove from cart: ${response.status}`)
  }

  return parseJsonResponse(response)
}

/**
 * Clear the entire cart
 */
export async function clearCart() {
  try {
    const response = await fetch(`${API_URL}/cart/clear`, {
      method: 'DELETE',
      headers: getHeaders()
    })

    if (!response.ok) {
      throw new Error(`Failed to clear cart: ${response.status}`)
    }

    return parseJsonResponse(response)
  } catch (error) {
    console.warn('Cart clear failed:', error.message)
    return { items: [], itemCount: 0, subtotal: 0 }
  }
}

/**
 * Merge guest cart into user cart after login
 */
export async function mergeCart() {
  const guestCartId = localStorage.getItem('cart_id')
  const token = localStorage.getItem('token')

  if (!guestCartId || !token) {
    return null
  }

  try {
    const response = await fetch(`${API_URL}/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        guestCartId
      })
    })

    if (!response.ok) {
      console.warn('Failed to merge cart:', response.status)
      return null
    }

    // Clear guest cart ID after successful merge
    localStorage.removeItem('cart_id')

    return parseJsonResponse(response)
  } catch (error) {
    console.warn('Cart merge failed:', error.message)
    return null
  }
}

/**
 * Get the current cart ID (for guest users)
 */
export function getCurrentCartId() {
  return localStorage.getItem('cart_id')
}

/**
 * Clear the cart ID (used on logout)
 */
export function clearCartId() {
  localStorage.removeItem('cart_id')
}

export default {
  fetchCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeCart,
  getCurrentCartId,
  clearCartId
}
