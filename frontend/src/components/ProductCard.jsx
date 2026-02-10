import { Link } from 'react-router-dom'

function ProductCard({ product }) {
  const { id, name, ref, price, image, badge } = product

  const whatsappUrl = `https://wa.me/59990000425?text=${encodeURIComponent(`Hi! I'm interested in ${name} REF ${ref}`)}`

  return (
    <Link to={`/product/${id}`} className="product-card">
      <div className="product-image">
        <img src={image} alt={name} />
        {badge && <span className="product-badge">{badge}</span>}
        <button className="quick-view" onClick={(e) => e.preventDefault()}>Quick View</button>
      </div>
      <div className="product-info">
        <p className="product-ref">REF {ref}</p>
        <h3 className="product-name">{name}</h3>
        <p className="product-price">Fl. {price}</p>
        <div className="product-actions">
          <button className="btn-add-cart" onClick={(e) => e.preventDefault()}>Add to Cart</button>
          <a
            href={whatsappUrl}
            className="btn-wa-order"
            target="_blank"
            rel="noopener noreferrer"
            title="Order via WhatsApp"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="fab fa-whatsapp"></i>
          </a>
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
