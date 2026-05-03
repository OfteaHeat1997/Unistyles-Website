import { useState } from 'react'
import { Link } from 'react-router-dom'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <section style={{ padding: '60px 0', background: 'var(--cream-bg)', minHeight: '70vh' }}>
        <div style={{ maxWidth: '450px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ background: 'var(--white)', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <i className="fas fa-envelope-open-text" style={{ fontSize: '48px', color: 'var(--muted-gold)', marginBottom: '20px' }}></i>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '15px' }}>
              Check Your Email
            </h2>
            <p style={{ color: 'var(--dark-warmth)', marginBottom: '25px', lineHeight: '1.6' }}>
              If an account exists for <strong>{email}</strong>, we've sent password reset instructions.
              Check your inbox and spam folder.
            </p>
            <Link to="/login" className="btn-shop" style={{ display: 'inline-block', padding: '12px 30px' }}>
              Back to Login
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={{ padding: '60px 0', background: 'var(--cream-bg)', minHeight: '70vh' }}>
      <div style={{ maxWidth: '450px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ background: 'var(--white)', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', textAlign: 'center', marginBottom: '10px' }}>
            Reset Password
          </h1>
          <p style={{ textAlign: 'center', color: 'var(--dark-warmth)', marginBottom: '30px', fontSize: '14px' }}>
            Enter your email and we'll send you a link to reset your password
          </p>

          {error && (
            <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '12px', borderRadius: '5px', marginBottom: '20px', fontSize: '14px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                style={{ width: '100%', padding: '14px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '14px' }}
              />
            </div>

            <button
              type="submit"
              className="btn-shop"
              disabled={loading}
              style={{ width: '100%', padding: '15px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div style={{ marginTop: '25px', textAlign: 'center' }}>
            <Link to="/login" style={{ fontSize: '14px', color: 'var(--muted-gold)' }}>
              <i className="fas fa-arrow-left" style={{ marginRight: '6px' }}></i>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ForgotPassword
