import { useState, useEffect, useMemo } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { cartStore } from '../stores/cartStore'
import { useCategories } from '../hooks/useProducts'
import { useAuth } from '../contexts/AuthContext'
import CartSidebar from './CartSidebar'

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartCount, setCartCount] = useState(cartStore.getItemCount())
  const [activeMenu, setActiveMenu] = useState(null)

  // Auth context
  const { user, isAuthenticated, logout } = useAuth()

  // Fetch categories from Strapi (with fallback to local data)
  const { data: categories } = useCategories({ showInMenu: true })

  // Group categories by breadcrumb for mega menu
  const categoryGroups = useMemo(() => {
    if (!categories) return { lingerie: [], beauty: [], accessories: [] }

    return {
      lingerie: categories.filter(c => c.breadcrumb === 'Lingerie'),
      beauty: categories.filter(c => c.breadcrumb === 'Beauty'),
      accessories: categories.filter(c => c.breadcrumb === 'Accessories')
    }
  }, [categories])

  useEffect(() => {
    const unsubscribe = cartStore.subscribe(() => {
      setCartCount(cartStore.getItemCount())
    })
    return unsubscribe
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setActiveMenu(null)
    if (activeMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [activeMenu])

  return (
    <>
      {/* Announcement Bar */}
      <div className="announcement-bar">
        <p>Free delivery in Curacao on orders over XCG 80</p>
      </div>

      {/* Main Header - Sticky */}
      <header className="main-header">
        <div className="header-inner">
          {/* Logo - Left */}
          <Link to="/" className="logo">
            <img src="/logo.png" alt="UNISTYLES" />
          </Link>

          {/* Navigation - Center */}
          <nav className="main-nav">
            <ul className="nav-list">
              <li>
                <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
                  Home
                </NavLink>
              </li>

              {/* Lingerie - Mega Menu */}
              <li
                className="has-dropdown"
                onMouseEnter={() => setActiveMenu('lingerie')}
                onMouseLeave={() => setActiveMenu(null)}
              >
                <span className="nav-link">
                  Lingerie
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>

                <div className={`mega-menu ${activeMenu === 'lingerie' ? 'active' : ''}`}>
                  <div className="mega-menu-inner">
                    <div className="mega-col">
                      <h4>Shop by Category</h4>
                      <ul>
                        <li><Link to="/bras">Bras</Link></li>
                        <li><Link to="/panties">Panties</Link></li>
                        <li><Link to="/shapewear">Shapewear</Link></li>
                      </ul>
                    </div>
                    <div className="mega-col">
                      <h4>Featured</h4>
                      <ul>
                        <li><Link to="/bras?filter=new">New Arrivals</Link></li>
                        <li><Link to="/bras?filter=bestseller">Bestsellers</Link></li>
                      </ul>
                    </div>
                    <div className="mega-col mega-featured">
                      <div className="mega-brand-card">
                        <img src="/images/LEONISA_HD_07.jpg" alt="Leonisa" />
                        <div className="mega-brand-info">
                          <span>Featured Brand</span>
                          <strong>LEONISA</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>

              {/* Beauty - Mega Menu */}
              <li
                className="has-dropdown"
                onMouseEnter={() => setActiveMenu('beauty')}
                onMouseLeave={() => setActiveMenu(null)}
              >
                <span className="nav-link">
                  Beauty
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>

                <div className={`mega-menu ${activeMenu === 'beauty' ? 'active' : ''}`}>
                  <div className="mega-menu-inner">
                    <div className="mega-col">
                      <h4>Fragrances</h4>
                      <ul>
                        <li><Link to="/perfume">Women's Perfume</Link></li>
                        <li><Link to="/perfume">Men's Cologne</Link></li>
                      </ul>
                    </div>
                    <div className="mega-col">
                      <h4>Skincare</h4>
                      <ul>
                        <li><Link to="/cremas">Creams & Lotions</Link></li>
                        <li><Link to="/bloqueador">Sunscreen</Link></li>
                        <li><Link to="/limpieza-facial">Facial Care</Link></li>
                        <li><Link to="/desodorantes">Deodorants</Link></li>
                      </ul>
                    </div>
                    <div className="mega-col">
                      <h4>Brands</h4>
                      <ul>
                        <li><Link to="/perfume?brand=lbel">L'BEL</Link></li>
                        <li><Link to="/perfume?brand=esika">ESIKA</Link></li>
                        <li><Link to="/perfume?brand=yanbal">YANBAL</Link></li>
                        <li><Link to="/perfume?brand=cyzone">CYZONE</Link></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </li>

              <li>
                <NavLink to="/accesorios">Accessories</NavLink>
              </li>

              <li>
                <NavLink to="/about">About</NavLink>
              </li>
            </ul>
          </nav>

          {/* Actions - Right */}
          <div className="header-actions">
            {isAuthenticated ? (
              <>
                <div className="user-menu-container" style={{ position: 'relative' }}>
                  <Link to="/profile" className="action-icon user-link" aria-label="Account" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span className="user-name" style={{ fontSize: '13px', fontWeight: '500' }}>
                      {user?.firstName || 'Account'}
                    </span>
                  </Link>
                </div>
              </>
            ) : (
              <Link to="/login" className="action-icon" aria-label="Account">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </Link>
            )}

            <a
              href="https://wa.me/59990000425"
              className="action-icon whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>

            <button
              className="action-icon cart-icon"
              onClick={() => setCartOpen(true)}
              aria-label="Cart"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              className={`mobile-toggle ${menuOpen ? 'active' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`mobile-menu ${menuOpen ? 'active' : ''}`}>
          <nav className="mobile-nav">
            <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>

            <div className="mobile-group">
              <span className="mobile-group-title">Lingerie</span>
              <Link to="/bras" onClick={() => setMenuOpen(false)}>Bras</Link>
              <Link to="/panties" onClick={() => setMenuOpen(false)}>Panties</Link>
              <Link to="/shapewear" onClick={() => setMenuOpen(false)}>Shapewear</Link>
            </div>

            <div className="mobile-group">
              <span className="mobile-group-title">Beauty</span>
              <Link to="/perfume" onClick={() => setMenuOpen(false)}>Fragrances</Link>
              <Link to="/cremas" onClick={() => setMenuOpen(false)}>Skincare</Link>
              <Link to="/bloqueador" onClick={() => setMenuOpen(false)}>Sunscreen</Link>
              <Link to="/limpieza-facial" onClick={() => setMenuOpen(false)}>Facial Care</Link>
            </div>

            <Link to="/accesorios" onClick={() => setMenuOpen(false)}>Accessories</Link>
            <Link to="/about" onClick={() => setMenuOpen(false)}>About Us</Link>
          </nav>
        </div>
      </header>

      {/* Cart Sidebar */}
      <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  )
}

export default Header
