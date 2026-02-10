import { Link } from 'react-router-dom'

function Footer() {
  return (
    <>
      {/* Bottom Features */}
      <div className="bottom-features">
        <div className="bottom-features-content">
          <div className="bottom-feature">
            <div className="bottom-feature-icon">
              <i className="fas fa-truck"></i>
            </div>
            <div className="bottom-feature-text">
              <h4>Free Home Delivery</h4>
              <p>Orders over Fl. 80</p>
            </div>
          </div>
          <div className="bottom-feature">
            <div className="bottom-feature-icon">
              <i className="fas fa-money-bill-wave"></i>
            </div>
            <div className="bottom-feature-text">
              <h4>Pay in Florin Antiano</h4>
              <p>Safe payments</p>
            </div>
          </div>
          <div className="bottom-feature">
            <div className="bottom-feature-icon">
              <i className="fas fa-sync-alt"></i>
            </div>
            <div className="bottom-feature-text">
              <h4>Easy Returns on Curacao</h4>
              <p>30 day return policy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <section className="newsletter">
        <h3>Sign up for exclusive offers!</h3>
        <p>Enter your email address to receive updates and promotions</p>
        <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="Your email address" />
          <button type="submit">Subscribe</button>
        </form>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Link to="/" className="logo logo-small">
              <img src="/logo.png" alt="UNISTYLES" style={{ filter: 'brightness(0) invert(1)' }} />
            </Link>
            <p>Your destination for premium Colombian fashion and beauty in Curacao.</p>
            <div className="footer-social">
              <a href="#"><i className="fab fa-facebook-f"></i></a>
              <a href="#"><i className="fab fa-instagram"></i></a>
              <a href="#"><i className="fab fa-whatsapp"></i></a>
              <a href="#"><i className="fab fa-tiktok"></i></a>
            </div>
          </div>
          <div className="footer-links">
            <h4>Shop</h4>
            <ul>
              <li><Link to="/bras">Bras</Link></li>
              <li><Link to="/panties">Panties</Link></li>
              <li><Link to="/shapewear">Shapewear</Link></li>
              <li><Link to="/colonias">Colonias</Link></li>
              <li><Link to="/cremas">Cremas</Link></li>
              <li><Link to="/accesorios">Accesorios</Link></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Help</h4>
            <ul>
              <li><a href="#">Size Guide</a></li>
              <li><a href="#">Shipping</a></li>
              <li><a href="#">Returns</a></li>
              <li><a href="#">FAQ</a></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Contact</h4>
            <ul>
              <li><a href="#">Curacao, Caribbean</a></li>
              <li><a href="tel:+59990000425">+5999 000-0425</a></li>
              <li><a href="mailto:info@unistylescuracao.com">info@unistylescuracao.com</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 Unistyles Curacao. All rights reserved.</p>
          <div className="payment-icons">
            <i className="fab fa-cc-visa"></i>
            <i className="fab fa-cc-mastercard"></i>
            <i className="fab fa-cc-paypal"></i>
          </div>
        </div>
      </footer>
    </>
  )
}

export default Footer
