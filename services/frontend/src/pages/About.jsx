import { Link } from 'react-router-dom'
import { getGeneralInquiryUrl } from '../utils/whatsapp'

function About() {
  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
        <div className="about-hero-overlay"></div>
        <div className="about-hero-content">
          <span className="about-tagline">Est. 2020 - Curacao</span>
          <h1>Elevating Caribbean Beauty</h1>
          <p>Premium Colombian fashion and beauty, curated for the modern Caribbean woman.</p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="about-mission">
        <div className="about-container">
          <div className="mission-grid">
            <div className="mission-text">
              <span className="section-label">Our Mission</span>
              <h2>Empowering Confidence Through Quality</h2>
              <p>
                At Unistyles, we believe every woman deserves to feel confident and beautiful.
                We bridge the gap between Colombia's finest fashion houses and the vibrant
                women of Curacao, delivering authentic products that celebrate femininity,
                comfort, and elegance.
              </p>
              <p>
                Our commitment goes beyond selling products. We provide personalized service,
                expert guidance on sizing and style, and a shopping experience that makes
                you feel valued and understood.
              </p>
            </div>
            <div className="mission-image">
              <img src="/images/LEONISA_HD_02.jpg" alt="Unistyles Quality" />
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="about-story">
        <div className="about-container">
          <div className="story-grid">
            <div className="story-image">
              <img src="/images/LEONISA_HD_04.jpg" alt="Our Journey" />
            </div>
            <div className="story-text">
              <span className="section-label">Our Story</span>
              <h2>From Passion to Purpose</h2>
              <p>
                Unistyles was born from a simple observation: Caribbean women were searching
                for high-quality Colombian lingerie and beauty products that combined superior
                craftsmanship with accessible pricing.
              </p>
              <p>
                What started as a small venture in 2020 has grown into Curacao's trusted
                destination for authentic Colombian brands. We've served hundreds of satisfied
                customers, each one reinforcing our belief that quality and personal service
                make all the difference.
              </p>
              <p>
                Today, we're proud to offer curated collections from Colombia's most beloved
                brands, delivered with the warmth and care that defines Caribbean hospitality.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="about-stats">
        <div className="about-container">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-number">500+</span>
              <span className="stat-label">Happy Customers</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">5</span>
              <span className="stat-label">Premium Brands</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">100%</span>
              <span className="stat-label">Authentic Products</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">4.9</span>
              <span className="stat-label">Customer Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="about-values">
        <div className="about-container">
          <div className="values-header">
            <span className="section-label">What Sets Us Apart</span>
            <h2>Our Promise to You</h2>
          </div>
          <div className="values-grid">
            <div className="value-card">
              <div className="value-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
              </div>
              <h3>Authenticity Guaranteed</h3>
              <p>Every product is sourced directly from authorized Colombian distributors. No imitations, ever.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </div>
              <h3>Personal Touch</h3>
              <p>We offer one-on-one consultations via WhatsApp to help you find the perfect fit and style.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="3" width="15" height="13" rx="2"/>
                  <path d="M16 8h4l3 3v5a2 2 0 0 1-2 2h-5"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </div>
              <h3>Island-Wide Delivery</h3>
              <p>We deliver to your doorstep anywhere in Curacao, with free shipping on orders over XCG 80.</p>
            </div>
            <div className="value-card">
              <div className="value-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </div>
              <h3>Easy Returns</h3>
              <p>Not the right fit? Return within 7 days for a full refund or exchange. No questions asked.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Brands Section */}
      <section className="about-brands">
        <div className="about-container">
          <div className="brands-header">
            <span className="section-label">Our Partners</span>
            <h2>Brands We Proudly Represent</h2>
            <p>We've partnered with Colombia's most trusted names in fashion and beauty</p>
          </div>
          <div className="about-brands-grid">
            <div className="about-brand-item">
              <h4>LEONISA</h4>
              <p>Premium shapewear & lingerie</p>
            </div>
            <div className="about-brand-item">
              <h4>L'BEL</h4>
              <p>Luxury skincare & fragrances</p>
            </div>
            <div className="about-brand-item">
              <h4>ESIKA</h4>
              <p>Beauty & personal care</p>
            </div>
            <div className="about-brand-item">
              <h4>CYZONE</h4>
              <p>Trendy cosmetics & accessories</p>
            </div>
            <div className="about-brand-item">
              <h4>YANBAL</h4>
              <p>Premium fragrances & jewelry</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="about-cta">
        <div className="about-container">
          <div className="cta-box">
            <h2>Ready to Experience the Difference?</h2>
            <p>Browse our collection or reach out for personalized recommendations</p>
            <div className="cta-buttons">
              <Link to="/bras" className="btn-primary">
                Explore Collection
              </Link>
              <a
                href={getGeneralInquiryUrl()}
                className="btn-secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
