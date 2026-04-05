import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAccountHelpUrl } from '../utils/whatsapp'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, error: authError, clearError } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  // Clear auth errors on mount
  useEffect(() => {
    clearError()
  }, [clearError])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('') // Clear error on input change
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(formData.email, formData.password)

      if (!result.success) {
        setError(result.error)
      } else {
        // Navigate to previous page or home
        const from = location.state?.from?.pathname || '/'
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ padding: '60px 0', background: 'var(--cream-bg)', minHeight: '70vh' }}>
      <div style={{ maxWidth: '450px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ background: 'var(--white)', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', textAlign: 'center', marginBottom: '10px' }}>
            Welcome Back
          </h1>
          <p style={{ textAlign: 'center', color: 'var(--dark-warmth)', marginBottom: '30px' }}>
            Sign in to your account
          </p>

          {error && (
            <div style={{ background: error.includes('verify') ? '#FFF3E0' : 'var(--error-bg)', color: error.includes('verify') ? '#E65100' : 'var(--error)', padding: '12px', borderRadius: '5px', marginBottom: '20px', fontSize: '14px' }}>
              {error}
              {error.includes('verify') && (
                <button onClick={async () => {
                  try {
                    await fetch('/api/auth/resend-verification', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: formData.email })
                    })
                    setError('Verification email resent! Check your inbox.')
                  } catch { setError('Failed to resend. Try again later.') }
                }} style={{ display: 'block', marginTop: '8px', background: 'none', border: 'none', color: '#E65100', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', padding: 0 }}>
                  Resend verification email
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '14px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
                placeholder="your@email.com"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '14px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
                placeholder="Your password"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input type="checkbox" />
                Remember me
              </label>
              <Link to="/forgot-password" style={{ fontSize: '13px', color: 'var(--muted-gold)' }}>Forgot password?</Link>
            </div>

            <button
              type="submit"
              className="btn-shop"
              disabled={loading}
              style={{ width: '100%', padding: '15px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '25px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--charcoal)' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--muted-gold)', fontWeight: '500' }}>Create one</Link>
            </p>
          </div>

          <div style={{ marginTop: '25px', paddingTop: '25px', borderTop: '1px solid var(--border-light)' }}>
            <a
              href={getAccountHelpUrl()}
              className="btn-whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              style={{ width: '100%', justifyContent: 'center', marginLeft: 0 }}
            >
              <i className="fab fa-whatsapp"></i>
              Need help? Contact us
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Login
