import { useEffect, useState } from 'react'
import ProductCard from '../components/ProductCard'

// Sample products data (will come from API later)
const allProducts = {
  bras: [
    { id: 1, name: 'Leonisa Lace Bralette', ref: '011911', price: 125, image: '/images/bra1.jpg', badge: 'New' },
    { id: 2, name: 'Leonisa Contour Push-Up', ref: '011968', price: 115, image: '/images/bra2.jpg' },
    { id: 3, name: 'Leonisa Strapless Lace', ref: '71318', price: 135, image: '/images/bra3.jpg' },
    { id: 4, name: 'Leonisa Full Coverage', ref: '011843', price: 105, image: '/images/bra4.jpg', badge: 'Bestseller' }
  ],
  panties: [
    { id: 5, name: 'Leonisa High-Waist Brief', ref: '012345', price: 45, image: '/images/panty1.jpg' },
    { id: 6, name: 'Leonisa Seamless Thong', ref: '012346', price: 35, image: '/images/panty2.jpg' }
  ],
  shapewear: [
    { id: 7, name: 'Leonisa Firm Compression', ref: '012347', price: 175, image: '/images/shapewear1.jpg', badge: 'Popular' }
  ],
  colonias: [
    { id: 8, name: 'Esika Ainnara EDP', ref: '012348', price: 95, image: '/images/cologne1.jpg', badge: 'New' }
  ],
  cremas: [
    { id: 9, name: "L'Bel Essential Cream", ref: '012349', price: 85, image: '/images/cream1.jpg' }
  ],
  bloqueador: [
    { id: 10, name: 'Sunblock SPF 50+', ref: '012350', price: 55, image: '/images/sunblock1.jpg' }
  ],
  desodorantes: [
    { id: 11, name: 'Roll-On Fresh', ref: '012351', price: 25, image: '/images/deodorant1.jpg' }
  ],
  'limpieza-facial': [
    { id: 12, name: 'Facial Cleanser', ref: '012352', price: 45, image: '/images/cleanser1.jpg' }
  ],
  accesorios: [
    { id: 13, name: 'Gold Earrings', ref: '012353', price: 65, image: '/images/accessory1.jpg' }
  ]
}

const categoryInfo = {
  bras: { title: 'BH / Bras', description: 'Premium Colombian bras for every occasion' },
  panties: { title: 'Pantys', description: 'Comfortable and elegant panties' },
  shapewear: { title: 'Fajas / Shapewear', description: 'Colombian shapewear for the perfect silhouette' },
  colonias: { title: 'Colonias', description: 'Authentic Colombian fragrances' },
  cremas: { title: 'Cremas', description: 'Skincare products for radiant skin' },
  bloqueador: { title: 'Bloqueador', description: 'Sun protection for Caribbean sun' },
  desodorantes: { title: 'Desodorantes', description: 'Stay fresh all day' },
  'limpieza-facial': { title: 'Limpieza Facial', description: 'Facial cleansing products' },
  accesorios: { title: 'Accesorios / Joyas', description: 'Beautiful accessories and jewelry' }
}

function Category({ category }) {
  const [products, setProducts] = useState([])
  const info = categoryInfo[category] || { title: 'Products', description: '' }

  useEffect(() => {
    // Simulate API call - will be replaced with real API
    setProducts(allProducts[category] || [])
  }, [category])

  return (
    <>
      {/* Category Header */}
      <section className="hero" style={{ minHeight: '250px', padding: '40px 0' }}>
        <div className="hero-content" style={{ gridTemplateColumns: '1fr', textAlign: 'center' }}>
          <div className="hero-text" style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '42px' }}>{info.title}</h1>
            <p style={{ maxWidth: '600px', margin: '0 auto' }}>{info.description}</p>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="new-arrivals">
        <div className="products-grid">
          {products.length > 0 ? (
            products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' }}>
              <h3>Coming Soon</h3>
              <p>Products in this category are being added. Check back soon!</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Category
