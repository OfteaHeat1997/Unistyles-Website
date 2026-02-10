function Contact() {
  return (
    <>
      {/* Hero */}
      <section className="hero" style={{ minHeight: '250px', padding: '50px 0' }}>
        <div className="hero-content" style={{ gridTemplateColumns: '1fr', textAlign: 'center' }}>
          <div className="hero-text" style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '42px' }}>Contact Us</h1>
            <p style={{ maxWidth: '600px', margin: '0 auto' }}>
              We'd love to hear from you! Reach out via WhatsApp for the fastest response.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section style={{ padding: '80px 0', background: 'var(--white)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px' }}>
          {/* Contact Info */}
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', marginBottom: '25px', color: 'var(--dark)' }}>
              Get in Touch
            </h2>
            <p style={{ marginBottom: '30px', color: 'var(--charcoal)', lineHeight: '1.8' }}>
              The fastest way to reach us is via WhatsApp. We respond within minutes during business hours!
            </p>

            <div style={{ marginBottom: '25px' }}>
              <a
                href="https://wa.me/59990000425?text=Hola!%20I%20have%20a%20question"
                className="btn-whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: 0, display: 'inline-flex' }}
              >
                <i className="fab fa-whatsapp"></i>
                Chat on WhatsApp
              </a>
            </div>

            <div style={{ borderTop: '1px solid #eee', paddingTop: '25px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <div style={{ width: '45px', height: '45px', background: 'var(--cream-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-phone" style={{ color: 'var(--muted-gold)' }}></i>
                </div>
                <div>
                  <p style={{ fontWeight: '600', color: 'var(--dark)', marginBottom: '2px' }}>Phone</p>
                  <a href="tel:+59990000425" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>+5999 000-0425</a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <div style={{ width: '45px', height: '45px', background: 'var(--cream-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-envelope" style={{ color: 'var(--muted-gold)' }}></i>
                </div>
                <div>
                  <p style={{ fontWeight: '600', color: 'var(--dark)', marginBottom: '2px' }}>Email</p>
                  <a href="mailto:info@unistylescuracao.com" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>info@unistylescuracao.com</a>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '45px', height: '45px', background: 'var(--cream-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-map-marker-alt" style={{ color: 'var(--muted-gold)' }}></i>
                </div>
                <div>
                  <p style={{ fontWeight: '600', color: 'var(--dark)', marginBottom: '2px' }}>Location</p>
                  <span style={{ color: 'var(--charcoal)' }}>Curacao, Caribbean</span>
                </div>
              </div>
            </div>

            {/* Social */}
            <div style={{ marginTop: '30px' }}>
              <p style={{ fontWeight: '600', marginBottom: '15px', color: 'var(--dark)' }}>Follow Us</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <a href="#" style={{ width: '40px', height: '40px', background: 'var(--dark)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)' }}>
                  <i className="fab fa-instagram"></i>
                </a>
                <a href="#" style={{ width: '40px', height: '40px', background: 'var(--dark)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)' }}>
                  <i className="fab fa-facebook-f"></i>
                </a>
                <a href="#" style={{ width: '40px', height: '40px', background: 'var(--dark)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)' }}>
                  <i className="fab fa-tiktok"></i>
                </a>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', marginBottom: '25px', color: 'var(--dark)' }}>
              Send a Message
            </h2>
            <form onSubmit={(e) => e.preventDefault()}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Name</label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '14px' }}
                  placeholder="Your name"
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Email</label>
                <input
                  type="email"
                  style={{ width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '14px' }}
                  placeholder="Your email"
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Message</label>
                <textarea
                  style={{ width: '100%', padding: '14px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '14px', minHeight: '150px', resize: 'vertical' }}
                  placeholder="How can we help you?"
                ></textarea>
              </div>
              <button type="submit" className="btn-shop" style={{ width: '100%' }}>
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  )
}

export default Contact
