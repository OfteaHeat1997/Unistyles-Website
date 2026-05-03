import { Link } from 'react-router-dom'

function Privacy() {
  return (
    <>
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>Privacy Policy</span>
        </div>
      </div>
      <section style={{ padding: '60px 0', maxWidth: '800px', margin: '0 auto', paddingLeft: '20px', paddingRight: '20px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '30px' }}>Privacy Policy</h1>
        <p style={{ color: 'var(--dark-warmth)', marginBottom: '15px' }}><em>Last updated: March 2026</em></p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>Information We Collect</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>When you create an account or place an order, we collect your name, email address, phone number, and delivery address. We also collect browsing data to improve your shopping experience.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>How We Use Your Information</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>Your information is used to process orders, send delivery updates via WhatsApp/email, and improve our services. We do not sell your personal data to third parties.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>Payment Security</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>Payment processing is handled by Sentoo, a licensed payment provider. We do not store credit card details on our servers.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>Cookies</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>We use essential cookies for cart functionality and authentication. No third-party tracking cookies are used.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>Your Rights</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>You can request access to, correction of, or deletion of your personal data at any time by contacting us.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>Contact</h3>
        <p style={{ lineHeight: '1.8' }}>For privacy-related questions: <a href="mailto:info@unistylescuracao.com" style={{ color: 'var(--muted-gold)' }}>info@unistylescuracao.com</a></p>
      </section>
    </>
  )
}

export default Privacy
