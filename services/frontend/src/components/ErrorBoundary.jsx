import { Component } from 'react'
import { Link } from 'react-router-dom'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          minHeight: '40vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--cream-bg)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            <i className="fas fa-exclamation-triangle" style={{ color: 'var(--muted-gold)' }}></i>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '10px' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--dark-warmth)', marginBottom: '25px', maxWidth: '400px' }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              className="btn-shop"
              style={{ padding: '12px 30px' }}
            >
              Refresh Page
            </button>
            <Link to="/" className="btn-outline" style={{ padding: '12px 30px' }}
              onClick={() => this.setState({ hasError: false, error: null })}>
              Go Home
            </Link>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
