import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const { register, isAuthenticated, clearError } = useAuth()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
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

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const result = await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      })

      if (!result.success) {
        setError(result.error)
      } else {
        // Navigate to previous page or home
        const from = location.state?.from?.pathname || '/'
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ padding: '60px 0', background: 'var(--cream-bg)', minHeight: '70vh' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ background: 'var(--white)', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', textAlign: 'center', marginBottom: '10px' }}>
            Create Account
          </h1>
          <p style={{ textAlign: 'center', color: 'var(--dark-warmth)', marginBottom: '30px' }}>
            Join Unistyles for exclusive offers
          </p>

          {error && (
            <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px', borderRadius: '5px', marginBottom: '20px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '14px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '14px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Email *</label>
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
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Phone (WhatsApp)</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                style={{ width: '100%', padding: '14px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
                placeholder="+5999 XXX XXXX"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '14px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
                placeholder="At least 8 characters"
              />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '14px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '25px', fontSize: '13px' }}>
              <input type="checkbox" required style={{ marginTop: '3px' }} />
              <span>I agree to the <Link to="/terms" style={{ color: 'var(--muted-gold)' }}>Terms of Service</Link> and <Link to="/privacy" style={{ color: 'var(--muted-gold)' }}>Privacy Policy</Link></span>
            </label>

            <button
              type="submit"
              className="btn-shop"
              disabled={loading}
              style={{ width: '100%', padding: '15px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: '25px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--charcoal)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--muted-gold)', fontWeight: '500' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Register
