/**
 * Authentication Context for Unistyles Curacao
 *
 * Provides user authentication state and methods throughout the app.
 */

import { apiUrl } from '../utils/api'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { cartStore } from '../stores/cartStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token')
        const savedUser = localStorage.getItem('user')

        if (token && savedUser) {
          // Validate token with backend
          const response = await fetch(apiUrl('/api/auth/me'), {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            setUser(data.user)
            // Update stored user data
            localStorage.setItem('user', JSON.stringify(data.user))
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setUser(null)
          }
        }
      } catch (err) {
        console.error('Auth initialization failed:', err)
        // Only an offline network error keeps the cached session; anything else
        // (HTML instead of JSON, 5xx) must not silently log the user in.
        const savedUser = err instanceof TypeError ? localStorage.getItem('user') : null
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser))
          } catch {
            localStorage.removeItem('user')
          }
        }
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  // Login function
  const login = useCallback(async (email, password) => {
    setError(null)

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      // Check for JSON response
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Store token and user
      localStorage.setItem('token', data.token)
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)

      // Merge guest cart with user cart
      await cartStore.mergeGuestCart()

      return { success: true, user: data.user }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }, [])

  // Register function
  const register = useCallback(async (userData) => {
    setError(null)

    try {
      const response = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })

      // Check for JSON response
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.errors?.[0]?.msg || 'Registration failed')
      }

      // Store token and user
      localStorage.setItem('token', data.token)
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)

      // Merge guest cart with user cart
      await cartStore.mergeGuestCart()

      return { success: true, user: data.user }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }, [])

  // Logout function
  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        // Call backend logout (optional, mainly for token blacklisting)
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(() => {}) // Ignore errors
      }
    } finally {
      // Clear local storage
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      setUser(null)
      setError(null)

      // Sync cart (will use guest cart now)
      await cartStore.syncWithBackend()
    }
  }, [])

  // Update user profile
  const updateProfile = useCallback(async (updates) => {
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(apiUrl('/api/users/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Profile update failed')
      }

      // Update stored user data
      const updatedUser = { ...user, ...data.user }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      setUser(updatedUser)

      return { success: true, user: updatedUser }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }, [user])

  // Refresh token
  const refreshToken = useCallback(async () => {
    try {
      const storedRefresh = localStorage.getItem('refreshToken')
      if (!storedRefresh) return false

      const response = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefresh })
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('token', data.token)
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
        return true
      }

      return false
    } catch {
      return false
    }
  }, [])

  // Clear error - memoized to prevent unnecessary re-renders
  const clearError = useCallback(() => setError(null), [])

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isDriver: user?.role === 'driver' || user?.role === 'admin',
    token: localStorage.getItem('token'),
    login,
    logout,
    register,
    updateProfile,
    refreshToken,
    clearError
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
