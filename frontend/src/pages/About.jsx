import { Link } from 'react-router-dom'

function About() {
  return (
    <>
      {/* Hero */}
      <section className="hero" style={{ minHeight: '300px', padding: '60px 0' }}>
        <div className="hero-content" style={{ gridTemplateColumns: '1fr', textAlign: 'center' }}>
          <div className="hero-text" style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '48px' }}>About Unistyles</h1>
            <p style={{ maxWidth: '600px', margin: '0 auto' }}>
              Bringing the best of Colombian fashion and beauty to Curacao since 2020.
            </p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="welcome">
        <div className="welcome-content">
          <div className="welcome-image">
            <img src="/images/welcome-img.jpg" alt="Unistyles Story" />
          </div>
          <div className="welcome-text">
            <h2>Our Story</h2>
            <p>
              Unistyles was born from a passion to bring high-quality Colombian products to the beautiful island of Curacao.
              We noticed that many women on the island were looking for authentic Colombian lingerie, beauty products,
              and accessories that combine quality, style, and affordability.
            </p>
            <p>
              Today, we proudly offer a curated selection from Colombia's most beloved brands including Leonisa,
              L'Bel, Esika, Cyzone, and Yanbal. Each product is carefully selected to meet the needs of our
              Caribbean customers.
            </p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="trust-section">
        <div className="trust-content">
          <div className="trust-header">
            <h2>Why Choose Us?</h2>
            <p>We're committed to providing the best shopping experience in Curacao</p>
          </div>
          <div className="trust-grid">
            <div className="trust-card">
              <div className="trust-icon">
                <i className="fas fa-check-circle"></i>
              </div>
              <h4>100% Authentic</h4>
              <p>All our products are genuine, imported directly from authorized Colombian distributors.</p>
            </div>
            <div className="trust-card">
              <div className="trust-icon">
                <i className="fas fa-truck"></i>
              </div>
              <h4>Local Delivery</h4>
              <p>We deliver personally to your door anywhere in Curacao. Free shipping on orders over Fl. 80.</p>
            </div>
            <div className="trust-card">
              <div className="trust-icon">
                <i className="fas fa-comments"></i>
              </div>
              <h4>Personal Service</h4>
              <p>Order via WhatsApp and get personal assistance with sizing, colors, and recommendations.</p>
            </div>
            <div className="trust-card">
              <div className="trust-icon">
                <i className="fas fa-undo"></i>
              </div>
              <h4>Easy Returns</h4>
              <p>Not satisfied? Return within 7 days for a full refund or exchange. No questions asked.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="newsletter" style={{ background: 'var(--dark)', color: 'var(--white)' }}>
        <h3 style={{ color: 'var(--white)' }}>Ready to Shop?</h3>
        <p style={{ color: 'rgba(255,255,255,0.8)' }}>Browse our collection or contact us for personal assistance</p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/bras" className="btn-shop" style={{ background: 'var(--white)', color: 'var(--dark)', border: 'none' }}>
            Shop Now
          </Link>
          <a
            href="https://wa.me/59990000425?text=Hola!%20I'm%20interested%20in%20your%20products"
            className="btn-whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 0 }}
          >
            <i className="fab fa-whatsapp"></i>
            Contact Us
          </a>
        </div>
      </section>
    </>
  )
}

export default About
