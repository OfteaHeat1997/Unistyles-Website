import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getGeneralQuestionUrl } from '../utils/whatsapp'

const faqs = [
  { q: 'How do I place an order?', a: 'Browse our products, add items to your cart, and proceed to checkout. You can also order directly via WhatsApp by clicking the WhatsApp button on any product.' },
  { q: 'What payment methods do you accept?', a: 'We accept Cash on Delivery (COD), Sentoo (bank, Visa/Mastercard, iDEAL), and direct bank transfer to our MCB account.' },
  { q: 'How much is delivery?', a: 'Delivery is FREE on orders over XCG 80. For smaller orders, delivery fees range from XCG 0-10 depending on your location in Curacao.' },
  { q: 'How long does delivery take?', a: 'Most orders within Willemstad are delivered within 1-2 business days. Outer areas (Banda Abou, Banda Ariba) may take 2-3 business days.' },
  { q: 'Can I return a product?', a: 'Yes, unused items in original packaging can be returned within 7 days. Perfumes and personal care items are non-returnable for hygiene reasons. Contact us via WhatsApp to arrange a return.' },
  { q: 'Are the products authentic?', a: 'Yes! All our products are 100% authentic, sourced directly from Colombian brands like Leonisa, L\'Bel, Esika, Yanbal, and Cyzone.' },
  { q: 'How do I track my order?', a: 'You\'ll receive order updates via WhatsApp. You can also check your order status in your account profile or contact us with your order number.' },
  { q: 'Do you have a physical store?', a: 'We are an online-only store based in Curacao, offering home delivery across the island.' },
  { q: 'How do I find my bra size?', a: 'Check our size guide on any bra product page. If you\'re unsure, contact us via WhatsApp and we\'ll help you find the perfect fit!' },
  { q: 'Can I cancel my order?', a: 'Orders can be cancelled if they haven\'t been shipped yet. Contact us via WhatsApp as soon as possible to request a cancellation.' }
]

function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <>
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>FAQ</span>
        </div>
      </div>
      <section style={{ padding: '60px 0', maxWidth: '800px', margin: '0 auto', paddingLeft: '20px', paddingRight: '20px' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '10px', textAlign: 'center' }}>
          Frequently Asked Questions
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--dark-warmth)', marginBottom: '40px' }}>
          Find answers to common questions about ordering, delivery, and returns
        </p>

        <div>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border-light)', marginBottom: '0' }}>
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                style={{
                  width: '100%', textAlign: 'left', padding: '20px 0', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '15px', fontWeight: '500', color: 'var(--dark)'
                }}
              >
                {faq.q}
                <i className={`fas fa-chevron-${openIndex === i ? 'up' : 'down'}`} style={{ color: 'var(--muted-gold)', fontSize: '12px', flexShrink: 0, marginLeft: '15px' }}></i>
              </button>
              {openIndex === i && (
                <p style={{ padding: '0 0 20px', lineHeight: '1.8', color: 'var(--charcoal)', fontSize: '14px' }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '50px', padding: '30px', background: 'var(--cream-bg)', borderRadius: '10px' }}>
          <h3 style={{ marginBottom: '10px' }}>Still have questions?</h3>
          <p style={{ color: 'var(--dark-warmth)', marginBottom: '20px' }}>Our team is happy to help via WhatsApp</p>
          <a href={getGeneralQuestionUrl()} className="btn-whatsapp" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex' }}>
            <i className="fab fa-whatsapp"></i> Chat with Us
          </a>
        </div>
      </section>
    </>
  )
}

export default FAQ
