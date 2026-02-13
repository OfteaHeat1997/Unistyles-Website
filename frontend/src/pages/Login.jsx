import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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
            <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px', borderRadius: '5px', marginBottom: '20px', fontSize: '14px' }}>
              {error}
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
              <a href="#" style={{ fontSize: '13px', color: 'var(--muted-gold)' }}>Forgot password?</a>
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
              href="https://wa.me/59990000425?text=Hi!%20I%20need%20help%20with%20my%20account"
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
