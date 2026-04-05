import { Link } from 'react-router-dom'

function Terms() {
  return (
    <>
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>Terms & Conditions</span>
        </div>
      </div>
      <section style={{ padding: '60px 0', maxWidth: '800px', margin: '0 auto', paddingLeft: '20px', paddingRight: '20px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '30px' }}>Terms & Conditions</h1>
        <p style={{ color: 'var(--dark-warmth)', marginBottom: '15px' }}><em>Last updated: March 2026</em></p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>1. General</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>These terms govern your use of the Unistyles Curacao website and purchases made through it. By using our website, you agree to these terms.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>2. Products & Pricing</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>All prices are in XCG (Caribbean Guilder). We strive for accuracy but reserve the right to correct pricing errors. Product images are representative; actual items may vary slightly.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>3. Orders & Payment</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>Orders are confirmed upon receipt of payment or confirmation of Cash on Delivery. We accept Sentoo, bank transfer, and cash on delivery. All transactions are processed securely.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>4. Delivery</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>Delivery is available throughout Curacao. Free delivery on orders over XCG 80. Delivery times are estimates and not guaranteed. See our <Link to="/shipping" style={{ color: 'var(--muted-gold)' }}>Shipping Info</Link> page for details.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>5. Returns & Exchanges</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>Returns are accepted within 7 days of delivery for unused items in original packaging. Contact us via WhatsApp to initiate a return. Perfumes and personal care items are non-returnable for hygiene reasons.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>6. Privacy</h3>
        <p style={{ lineHeight: '1.8', marginBottom: '15px' }}>Your personal information is handled according to our <Link to="/privacy" style={{ color: 'var(--muted-gold)' }}>Privacy Policy</Link>.</p>

        <h3 style={{ marginTop: '30px', marginBottom: '10px' }}>7. Contact</h3>
        <p style={{ lineHeight: '1.8' }}>For questions about these terms, contact us at <a href="mailto:info@unistylescuracao.com" style={{ color: 'var(--muted-gold)' }}>info@unistylescuracao.com</a> or via WhatsApp at +5999 673 6285.</p>
      </section>
    </>
  )
}

export default Terms
