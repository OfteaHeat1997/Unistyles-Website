import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useHomepage, useCategories, useBrands } from '../hooks/useProducts'
import { getGeneralInquiryUrl } from '../utils/whatsapp'
import HeroSlider from '../components/HeroSlider'
import NewReleasesCarousel from '../components/NewReleasesCarousel'

// Category tile configuration - CORRECT product images for each category
const categoryConfig = {
  shapewear: { image: '/images/LEONISA_HIGH_WAIST_SHAPER_BEIGE.jpg', label: 'Shapewear' },
  bras: { image: '/images/cat-bras.jpg', label: 'Bras' },
  panties: { image: '/images/cat-panties.jpg', label: 'Panties' },
  perfume: { image: '/images/cat-perfume.jpg', label: 'Perfumes' },
  cremas: { image: '/images/cat-skincare.jpg', label: 'Creams' },
  bloqueador: { image: '/images/Total Block 140g.png', label: 'Sunscreen' },
  desodorantes: { image: '/images/deodorante corri rose.jpg', label: 'Personal Care' },
  'limpieza-facial': { image: '/images/Agua Micelar 2 en 1 lbel.jpg', label: 'Facial Care' },
  accesorios: { image: '/images/cat-accesorios.jpg', label: 'Accessories' }
}

// Brand configuration with logos and categories
const brandConfig = {
  'Leonisa': {
    category: 'Lingerie & Shapewear',
    logo: '/images/brand-leonisa.png',
    link: '/shapewear'
  },
  "L'Bel": {
    category: 'Skincare & Fragrances',
    logo: '/images/brand-lbel.png',
    link: '/cremas'
  },
  'Esika': {
    category: 'Beauty & Fragrances',
    logo: '/images/brand-esika.png',
    link: '/perfume'
  },
  'Yanbal': {
    category: 'Beauty & Suncare',
    logo: '/images/brand-yanbal.png',
    link: '/bloqueador'
  },
  'Cyzone': {
    category: 'Trendy Fragrances',
    logo: '/images/brand-cyzone.png',
    link: '/perfume'
  }
}

function Home() {
  // Fetch homepage data from Strapi (with fallback to local data)
  const { data: homepageData, isLoading } = useHomepage()

  // Fetch categories and brands
  const { data: categories } = useCategories({ showInMenu: true })
  const { data: brands } = useBrands()

  // Get products for new arrivals and bestsellers
  const { newArrivals, bestsellers, carouselProducts } = useMemo(() => {
    if (homepageData) {
      // Transform products for carousel format (use newArrivals, fall back to featuredProducts)
      const carouselSource = (homepageData.newArrivals?.length > 0 ? homepageData.newArrivals : homepageData.featuredProducts) || []
      const carouselItems = carouselSource.slice(0, 7).map(product => ({
        id: product.id,
        name: product.name,
        subtitle: product.brand?.name || product.categoryName || 'Premium Collection',
        image: product.image,
        badge: product.badge,
        category: (product.category?.name || product.categoryName || '').toUpperCase(),
        link: `/product/${product.id}`
      }))

      return {
        newArrivals: homepageData.newArrivals?.slice(0, 4) || [],
        bestsellers: homepageData.featuredProducts?.slice(0, 4) || [],
        carouselProducts: carouselItems
      }
    }
    return { newArrivals: [], bestsellers: [], carouselProducts: [] }
  }, [homepageData])

  // Get display categories (from API or use default config)
  const displayCategories = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.slice(0, 8).map(cat => ({
        slug: cat.slug,
        name: categoryConfig[cat.slug]?.label || cat.name,
        image: cat.image || categoryConfig[cat.slug]?.image || '/images/placeholder.jpg'
      }))
    }
    // Fallback to config-based categories (first 8)
    return Object.entries(categoryConfig).slice(0, 8).map(([slug, config]) => ({
      slug,
      name: config.label,
      image: config.image
    }))
  }, [categories])

  // Get display brands (from API or use default config)
  const displayBrands = useMemo(() => {
    if (brands && brands.length > 0) {
      return brands.filter(b => b.featured !== false).slice(0, 5).map(brand => ({
        name: brand.name,
        category: brandConfig[brand.name]?.category || brand.description || 'Premium Products',
        logo: brandConfig[brand.name]?.logo || '/images/placeholder.jpg',
        link: brandConfig[brand.name]?.link || '/'
      }))
    }
    // Fallback to config-based brands
    return Object.entries(brandConfig).map(([name, config]) => ({
      name,
      category: config.category,
      logo: config.logo,
      link: config.link
    }))
  }, [brands])

  return (
    <div className="home-page">
      {/* Full-Screen Hero Slider with Ken Burns Effect */}
      <HeroSlider />

      {/* New Releases Carousel */}
      <NewReleasesCarousel products={carouselProducts} />

      {/* Categories Grid - Clean 4-Column Layout */}
      <section className="shop-by-category">
        <div className="container">
          <h2 className="shop-category-title">Shop by Category</h2>
          <div className="shop-category-grid">
            {displayCategories.map((category) => (
              <Link to={`/${category.slug}`} className="shop-category-card" key={category.slug}>
                <img src={category.image} alt={category.name} loading="lazy" />
                <span className="shop-category-name">{category.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* New Releases - Product Grid */}
      <section className="products-section">
        <div className="container">
          <div className="section-header">
            <h2>New Releases</h2>
            <Link to="/bras" className="view-all-link">View All</Link>
          </div>
          <div className="products-grid-4">
            {newArrivals.map((product) => (
              <Link to={`/product/${product.id}`} className="product-tile" key={product.id}>
                <div className="product-image">
                  <img src={product.image} alt={product.name} />
                  {product.badge && (
                    <span className="product-badge">{product.badge}</span>
                  )}
                </div>
                <div className="product-details">
                  {product.brand && <span className="product-brand">{typeof product.brand === 'object' ? product.brand.name : product.brand}</span>}
                  <h3 className="product-name">{product.name}</h3>
                  <p className="product-price">XCG {product.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Banner */}
      <section className="featured-banner">
        <div className="banner-content">
          <div className="banner-text">
            <span className="banner-label">Featured Brand</span>
            <h2>LEONISA</h2>
            <p>Colombia's #1 lingerie brand since 1956. Premium quality shapewear and lingerie designed for the modern woman.</p>
            <Link to="/shapewear" className="btn-primary">Shop Leonisa</Link>
          </div>
          <div className="banner-image">
            <img src="/images/LEONISA_HD_03.jpg" alt="Leonisa Shapewear" />
          </div>
        </div>
      </section>

      {/* Bestsellers - Product Grid */}
      <section className="products-section">
        <div className="container">
          <div className="section-header">
            <h2>Bestsellers</h2>
            <Link to="/bras" className="view-all-link">View All</Link>
          </div>
          <div className="products-grid-4">
            {bestsellers.map((product) => (
              <Link to={`/product/${product.id}`} className="product-tile" key={product.id}>
                <div className="product-image">
                  <img src={product.image} alt={product.name} />
                  {product.badge && (
                    <span className="product-badge bestseller">{product.badge}</span>
                  )}
                </div>
                <div className="product-details">
                  {product.brand && <span className="product-brand">{typeof product.brand === 'object' ? product.brand.name : product.brand}</span>}
                  <h3 className="product-name">{product.name}</h3>
                  <p className="product-price">XCG {product.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Features */}
      <section className="trust-section">
        <div className="container">
          <div className="trust-grid">
            <div className="trust-item">
              <div className="trust-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="3" width="15" height="13" rx="2"/>
                  <path d="M16 8h4l3 3v5a2 2 0 0 1-2 2h-1"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </div>
              <div className="trust-text">
                <h4>Free Delivery</h4>
                <p>On orders over XCG 80</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div className="trust-text">
                <h4>100% Authentic</h4>
                <p>Original Colombian brands</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
              </div>
              <div className="trust-text">
                <h4>WhatsApp Orders</h4>
                <p>Personal service</p>
              </div>
            </div>
            <div className="trust-item">
              <div className="trust-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="23 4 23 10 17 10"/>
                  <polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </div>
              <div className="trust-text">
                <h4>Easy Returns</h4>
                <p>7 day return policy</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brands Section - Logo Grid */}
      <section className="brands-section-new">
        <div className="container">
          <div className="section-header centered">
            <h2>Our Brands</h2>
          </div>
          <div className="brands-logo-grid">
            {displayBrands.map((brand) => (
              <Link to={brand.link} className="brand-logo-card" key={brand.name}>
                <div className="brand-logo-wrapper">
                  <img src={brand.logo} alt={brand.name} loading="lazy" />
                </div>
                <span className="brand-category-label">{brand.category}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WhatsApp CTA */}
      <section className="whatsapp-section">
        <div className="container">
          <div className="whatsapp-cta">
            <div className="whatsapp-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div className="whatsapp-text">
              <h3>Need Help Ordering?</h3>
              <p>Chat with us on WhatsApp for personal assistance</p>
            </div>
            <a
              href={getGeneralInquiryUrl()}
              className="btn-whatsapp"
              target="_blank"
              rel="noopener noreferrer"
            >
              Chat Now
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
