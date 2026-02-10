import { useState, useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { cartStore } from '../stores/cartStore'
import CartSidebar from './CartSidebar'

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartCount, setCartCount] = useState(cartStore.getItemCount())

  useEffect(() => {
    const unsubscribe = cartStore.subscribe(() => {
      setCartCount(cartStore.getItemCount())
    })
    return unsubscribe
  }, [])

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const toggleCart = (e) => {
    e.preventDefault()
    setCartOpen(!cartOpen)
  }

  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-content">
          <a href="tel:+59990000425">
            <i className="fas fa-phone"></i> +5999 000-0425
          </a>
          <span>Free shipping on orders over Fl. 150</span>
          <a href="#">
            <i className="fas fa-map-marker-alt"></i> Curacao
          </a>
        </div>
      </div>

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <img src="/logo.png" alt="UNISTYLES" />
          </Link>

          <div className={`menu-toggle ${menuOpen ? 'active' : ''}`} onClick={toggleMenu}>
            <span></span>
            <span></span>
            <span></span>
          </div>

          <ul className={`nav-menu ${menuOpen ? 'active' : ''}`}>
            <li>
              <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                Home
              </NavLink>
            </li>
            <li className="has-dropdown">
              <a href="#">Lingerie</a>
              <ul className="dropdown">
                <li><Link to="/bras">Bras</Link></li>
                <li><Link to="/panties">Panties</Link></li>
                <li><Link to="/shapewear">Shapewear</Link></li>
                <div className="dropdown-divider"></div>
                <li><a href="#">View All Lingerie</a></li>
              </ul>
            </li>
            <li className="has-dropdown">
              <a href="#">Beauty</a>
              <ul className="dropdown">
                <li><Link to="/colonias">Colonias</Link></li>
                <li><Link to="/cremas">Cremas</Link></li>
                <li><Link to="/bloqueador">Bloqueador</Link></li>
                <li><Link to="/desodorantes">Desodorantes</Link></li>
                <li><Link to="/limpieza-facial">Limpieza Facial</Link></li>
                <div className="dropdown-divider"></div>
                <li><a href="#">View All Beauty</a></li>
              </ul>
            </li>
            <li>
              <Link to="/accesorios">Accesorios</Link>
            </li>
            <li>
              <Link to="/about">About Us</Link>
            </li>
          </ul>

          <div className="nav-icons">
            <a href="#" title="Search"><i className="fas fa-search"></i></a>
            <Link to="/login" title="Account"><i className="fas fa-user"></i></Link>
            <a href="#" className="cart-icon" title="Cart" onClick={toggleCart}>
              <i className="fas fa-shopping-bag"></i>
              <span className="cart-badge">{cartCount}</span>
            </a>
          </div>
        </div>
      </header>

      {/* Cart Sidebar */}
      <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  )
}

export default Header
