// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

// API helper for making requests
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  }

  try {
    const response = await fetch(url, config)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong')
    }

    return data
  } catch (error) {
    console.error('API Error:', error)
    throw error
  }
}

// API methods
export const api = {
  // Products
  getProducts: (category) => request(`/products${category ? `?category=${category}` : ''}`),
  getProduct: (id) => request(`/products/${id}`),

  // Categories
  getCategories: () => request('/categories'),

  // Cart
  getCart: () => request('/cart'),
  addToCart: (productId, quantity, size, color) =>
    request('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, size, color })
    }),
  updateCartItem: (itemId, quantity) =>
    request(`/cart/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity })
    }),
  removeFromCart: (itemId) =>
    request(`/cart/${itemId}`, { method: 'DELETE' }),

  // Orders
  createOrder: (orderData) =>
    request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    }),
  getOrder: (id) => request(`/orders/${id}`),

  // Auth
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  register: (userData) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),

  // Newsletter
  subscribe: (email) =>
    request('/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email })
    })
}

export default api
