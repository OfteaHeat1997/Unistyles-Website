import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'

// Sample products data (will come from API later)
const newArrivals = [
  { id: 1, name: 'Leonisa Lace Bralette', ref: '011911', price: 125, image: '/images/bra1.jpg', badge: 'New' },
  { id: 2, name: 'Leonisa Contour Push-Up', ref: '011968', price: 115, image: '/images/bra2.jpg' },
  { id: 3, name: 'Leonisa Strapless Lace', ref: '71318', price: 135, image: '/images/bra3.jpg' },
  { id: 4, name: 'Leonisa Full Coverage', ref: '011843', price: 105, image: '/images/bra4.jpg', badge: 'Bestseller' }
]

const categories = [
  { slug: 'bras', name: 'BH / Bras', count: 77, image: '/images/cat-bras.jpg' },
  { slug: 'panties', name: 'Pantys', count: 72, image: '/images/cat-panties.jpg' },
  { slug: 'colonias', name: 'Colonias', count: 71, image: '/images/cat-fragrances.jpg' },
  { slug: 'cremas', name: 'Cremas', count: 49, image: '/images/cat-beauty.jpg' },
  { slug: 'bloqueador', name: 'Bloqueador', count: 11, image: '/images/cat-bloqueador.jpg' },
  { slug: 'desodorantes', name: 'Desodorantes', count: 25, image: '/images/cat-desodorantes.jpg' },
  { slug: 'limpieza-facial', name: 'Limpieza Facial', count: 6, image: '/images/cat-skincare.jpg' },
  { slug: 'accesorios', name: 'Accesorios / Joyas', count: 82, image: '/images/cat-accesorios.jpg' }
]

const testimonials = [
  {
    text: "Finally found quality Colombian lingerie in Curacao! The delivery was fast and the bras fit perfectly. I'll definitely order again.",
    author: 'Maria C.',
    location: 'Willemstad'
  },
  {
    text: "I love that I can order via WhatsApp and pay when they deliver. So easy and personal! The L'Bel creams are amazing.",
    author: 'Carmen R.',
    location: 'Otrobanda'
  },
  {
    text: "Authentic Leonisa products at fair prices. They even helped me choose the right size over WhatsApp. Excellent service!",
    author: 'Ana L.',
    location: 'Punda'
  }
]

const brands = [
  { id: 'leonisa', name: 'LEONISA', category: 'Lingerie', tagline: "Colombia's #1 lingerie brand since 1956", link: '/bras' },
  { id: 'lbel', name: "L'BEL", category: 'Skincare', tagline: 'Science & technology for your skin', link: '/cremas' },
  { id: 'esika', name: 'esika', category: 'Beauty', tagline: 'Confidence is beauty', link: '/colonias' },
  { id: 'cyzone', name: 'CYZONE', category: 'Fragrances', tagline: 'Trendy beauty for everyone', link: '/colonias' },
  { id: 'yanbal', name: 'YANBAL', category: 'Beauty', tagline: 'Premium beauty since 1967', link: '/cremas' }
]

function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <i className="fas fa-truck"></i>
              FREE DELIVERY IN CURACAO
            </div>
            <h1>Elegant &<br />Affordable<br />Colombian Style</h1>
            <p>Discover carefully curated Colombian lingerie, fashion, and beauty products, delivered with personal care in Curacao.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <Link to="/bras" className="btn-shop">Shop Now</Link>
              <a
                href="https://wa.me/59990000425?text=Hola!%20I'm%20interested%20in%20your%20products"
                className="btn-whatsapp"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="fab fa-whatsapp"></i>
                Order via WhatsApp
              </a>
            </div>
          </div>
          <div className="hero-image">
            <img src="/images/hero-bra.jpg" alt="Leonisa Elegant Lingerie" />
          </div>
        </div>
      </section>

      {/* Features Bar */}
      <div className="features-bar">
        <div className="features-content">
          <div className="feature-item">
            <div className="feature-icon">
              <i className="fas fa-truck"></i>
            </div>
            <div className="feature-text">
              <h4>Local Delivery</h4>
              <p>Delivery gifts on Curacao</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">
              <i className="fas fa-shield-alt"></i>
            </div>
            <div className="feature-text">
              <h4>Safe Payments</h4>
              <p>Pay secure via florin</p>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">
              <i className="fas fa-undo"></i>
            </div>
            <div className="feature-text">
              <h4>Easy Returns</h4>
              <p>Return 7 days after delivery</p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <section className="categories">
        <div className="section-header">
          <h2>Shop by Category</h2>
          <p>Explore our curated collection of Colombian products</p>
        </div>
        <div className="categories-grid">
          {categories.map((cat) => (
            <Link to={`/${cat.slug}`} className="category-card" key={cat.slug}>
              <img src={cat.image} alt={cat.name} />
              <div className="category-overlay">
                <h3>{cat.name}</h3>
                <p>{cat.count} Products</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* New Arrivals Section */}
      <section className="new-arrivals">
        <div className="section-header">
          <h2>New Arrivals</h2>
          <p>Our latest products just for you</p>
        </div>
        <div className="products-grid">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Welcome Section */}
      <section className="welcome">
        <div className="welcome-content">
          <div className="welcome-image">
            <img src="/images/welcome-img.jpg" alt="Leonisa Colombian Lingerie" />
          </div>
          <div className="welcome-text">
            <h2>Welcome to Unistyles</h2>
            <p>We bring the best of Colombian fashion and beauty to Curacao, with quality products from brands like Leonisa, Esika, L'Bel, and more.</p>
            <p>Enjoy a personal, worry-free shopping experience with local delivery and easy returns.</p>
            <Link to="/about" className="btn-outline">Learn More About Us</Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials">
        <div className="section-header">
          <h2>What Our Customers Say</h2>
          <p>Real experiences from women in Curacao</p>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((testimonial, index) => (
            <div className="testimonial-card" key={index}>
              <div className="stars">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
              </div>
              <p>"{testimonial.text}"</p>
              <span className="author">{testimonial.author}</span>
              <span className="location">{testimonial.location}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Brands Section */}
      <section className="brands">
        <div className="section-header">
          <h2>Authentic Colombian Brands</h2>
          <p>Premium quality products directly from Colombia</p>
        </div>
        <div className="brands-grid">
          {brands.map((brand) => (
            <Link to={brand.link} className={`brand-card ${brand.id}`} key={brand.id}>
              <div className="brand-logo">
                <span className="brand-text">{brand.name}</span>
              </div>
              <p className="brand-category">{brand.category}</p>
              <p className="brand-tagline">{brand.tagline}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}

export default Home
