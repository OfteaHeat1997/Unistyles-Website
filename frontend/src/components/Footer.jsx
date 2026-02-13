import { Link } from 'react-router-dom'

function Footer() {
  return (
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
            <a href="https://wa.me/59990000425" target="_blank" rel="noopener noreferrer"><i className="fab fa-whatsapp"></i></a>
            <a href="#"><i className="fab fa-tiktok"></i></a>
          </div>
        </div>
        <div className="footer-links">
          <h4>Lingerie</h4>
          <ul>
            <li><Link to="/bras">Bras</Link></li>
            <li><Link to="/panties">Panties</Link></li>
            <li><Link to="/shapewear">Shapewear</Link></li>
          </ul>
          <h4 style={{marginTop: '20px'}}>Beauty</h4>
          <ul>
            <li><Link to="/perfume">Perfumes</Link></li>
            <li><Link to="/cremas">Skincare</Link></li>
            <li><Link to="/accesorios">Accessories</Link></li>
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
        <p>&copy; {new Date().getFullYear()} Unistyles Curacao. All rights reserved.</p>
        <div className="payment-icons">
          <i className="fab fa-cc-visa"></i>
          <i className="fab fa-cc-mastercard"></i>
          <i className="fab fa-cc-paypal"></i>
        </div>
      </div>
    </footer>
  )
}

export default Footer
