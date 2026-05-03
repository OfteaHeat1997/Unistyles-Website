function ProductSkeleton({ count = 8 }) {
  return (
    <div className="products-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="product-card" style={{ pointerEvents: 'none' }}>
          <div style={{
            width: '100%', paddingBottom: '120%', background: 'linear-gradient(90deg, var(--border-light) 25%, #f0ece8 50%, var(--border-light) 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: '8px'
          }} />
          <div style={{ padding: '15px 0' }}>
            <div style={{ height: '12px', width: '40%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '8px' }} />
            <div style={{ height: '16px', width: '80%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '8px' }} />
            <div style={{ height: '12px', width: '50%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '8px' }} />
            <div style={{ height: '20px', width: '35%', background: 'var(--border-light)', borderRadius: '4px' }} />
          </div>
          <style>{`
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
          `}</style>
        </div>
      ))}
    </div>
  )
}

export default ProductSkeleton
