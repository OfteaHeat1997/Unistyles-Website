import { Link } from 'react-router-dom'
import AnimatedLogo from './AnimatedLogo'
import { BUSINESS } from '../config'
import { getGeneralInquiryUrl } from '../utils/whatsapp'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <Link to="/" className="logo logo-small">
            <AnimatedLogo variant="footer" />
          </Link>
          <p>Your destination for premium Colombian fashion and beauty in Curacao.</p>
          <div className="footer-social">
            <a href={BUSINESS.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
            <a href={BUSINESS.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
            <a href={getGeneralInquiryUrl()} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><i className="fab fa-whatsapp"></i></a>
            <a href={BUSINESS.social.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok"><i className="fab fa-tiktok"></i></a>
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
            <li><Link to="/shipping">Shipping & Delivery</Link></li>
            <li><Link to="/track-order">Track Your Order</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
            <li><Link to="/contact">Contact Us</Link></li>
          </ul>
          <h4 style={{marginTop: '20px'}}>Legal</h4>
          <ul>
            <li><Link to="/terms">Terms & Conditions</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
          </ul>
        </div>
        <div className="footer-links">
          <h4>Contact</h4>
          <ul>
            <li>Curacao, Caribbean</li>
            <li><a href={`tel:${BUSINESS.phone}`}>{BUSINESS.phone}</a></li>
            <li><a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></li>
          </ul>
          <h4 style={{marginTop: '20px'}}>Hours</h4>
          <ul>
            <li>Mon-Fri: {BUSINESS.hours.weekdays}</li>
            <li>Sat: {BUSINESS.hours.saturday}</li>
            <li>Sun: {BUSINESS.hours.sunday}</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Unistyles Curacao. All rights reserved.</p>
        <div className="payment-icons">
          <i className="fab fa-cc-visa"></i>
          <i className="fab fa-cc-mastercard"></i>
        </div>
      </div>
    </footer>
  )
}

export default Footer
