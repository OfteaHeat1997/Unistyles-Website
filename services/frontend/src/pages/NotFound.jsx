import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <section style={{ padding: '100px 0', background: 'var(--cream-bg)', textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '120px', color: 'var(--muted-gold)', marginBottom: '20px' }}>404</h1>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '15px', color: 'var(--dark)' }}>Page Not Found</h2>
        <p style={{ color: 'var(--charcoal)', marginBottom: '30px' }}>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn-shop">Back to Home</Link>
      </div>
    </section>
  )
}

export default NotFound
