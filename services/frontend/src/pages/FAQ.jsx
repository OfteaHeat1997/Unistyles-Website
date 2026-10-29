import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getGeneralQuestionUrl } from '../utils/whatsapp'
import { useCheckoutOptions, formatXCG } from '../hooks/useCheckoutOptions'

// Delivery, payment and returns answers are built from /api/checkout/options so the FAQ
// always says exactly what the checkout charges (DEC-001, BUS-CAT-07).
function buildFaqs(options) {
  const threshold = options ? formatXCG(options.freeDeliveryThreshold) : null
  const zones = options?.deliveryZones || []
  const zoneFees = zones.map(z => `${z.name} ${formatXCG(z.fee)}${z.neighborhoods.length ? ` (${z.neighborhoods.join(', ')})` : ''}`).join('; ')
  const payments = (options?.paymentMethods || []).map(m => m.name).join(', ')
  const panties = options?.returnPolicy?.panties

  return [
    { q: 'How do I place an order?', a: 'Browse our products, choose your size and colour, add them to your cart and go to checkout. You can also order directly via WhatsApp by clicking the WhatsApp button on any product.' },
    { q: 'What payment methods do you accept?', a: payments ? `We currently accept: ${payments}.` : 'Payment options are shown at checkout.' },
    {
      q: 'How much is delivery?',
      a: threshold
        ? `Delivery is FREE when your products add up to ${threshold} or more (exactly ${threshold} included). The amount is counted after discounts and before the delivery fee. Below ${threshold} the fee depends on your zone${zoneFees ? `: ${zoneFees}` : ''}. If your address is not on our list, we confirm the fee with you on WhatsApp — nothing is charged for delivery until then. If a discount brings your products below ${threshold}, the delivery fee applies again.`
        : 'The delivery fee is shown at checkout before you pay.'
    },
    { q: 'How long does delivery take?', a: 'Delivery is usually the next day, according to our route. We send you a message about 30 minutes before we arrive.' },
    {
      q: 'Can I return a product?',
      a: `${panties ? `${panties} ` : ''}For any other item, contact us on WhatsApp and we will help you.`
    },
    { q: 'Are the products authentic?', a: 'Yes! All our products are 100% authentic, sourced directly from the brands we sell.' },
    { q: 'How do I track my order?', a: "You'll receive order updates via WhatsApp. You can also check your order status with your order number and phone on the Track Order page." },
    { q: 'Do you have a physical store?', a: 'We sell online with home delivery across Curaçao.' },
    { q: 'How do I find my bra size?', a: "Check our size guide on any bra product page. If you're unsure, contact us via WhatsApp and we'll help you find the perfect fit!" },
    { q: 'Can I cancel my order?', a: 'Orders can be cancelled before they are being prepared. Contact us via WhatsApp as soon as possible to request a cancellation.' }
  ]
}

function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)
  const { data: options } = useCheckoutOptions()
  const faqs = buildFaqs(options)

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
