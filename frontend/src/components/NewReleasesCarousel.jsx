import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function NewReleasesCarousel({ products }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Use passed products or empty array
  const items = products && products.length > 0 ? products : []
  const totalItems = items.length

  // Auto-play effect - must be before any early returns
  useEffect(() => {
    if (totalItems === 0) return // Skip if no items

    const interval = setInterval(() => {
      setIsAnimating(true)
      setCurrentIndex((prev) => (prev + 1) % totalItems)
      setTimeout(() => setIsAnimating(false), 500)
    }, 5000)

    return () => clearInterval(interval)
  }, [totalItems])

  // Don't render carousel if no products
  if (totalItems === 0) {
    return (
      <section style={{background: 'var(--off-white)', padding: '80px 0', overflow: 'hidden'}}>
        <div style={{textAlign: 'center', marginBottom: '50px'}}>
          <h2 style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: '600',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: 'var(--charcoal)',
            margin: 0
          }}>
            NEW RELEASES
          </h2>
        </div>
        <div style={{textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)'}}>
          <p>Loading new releases...</p>
        </div>
      </section>
    )
  }

  const goToNext = () => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrentIndex((prev) => (prev + 1) % totalItems)
    setTimeout(() => setIsAnimating(false), 500)
  }

  const goToPrev = () => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrentIndex((prev) => (prev - 1 + totalItems) % totalItems)
    setTimeout(() => setIsAnimating(false), 500)
  }

  // Get visible items (5 cards: 2 left, center, 2 right)
  const getVisibleItems = () => {
    const visibleItems = []
    for (let i = -2; i <= 2; i++) {
      const index = (currentIndex + i + totalItems) % totalItems
      visibleItems.push({
        ...items[index],
        position: i
      })
    }
    return visibleItems
  }

  const getCardStyles = (position) => {
    const configs = {
      '-2': {
        left: '5%',
        transform: 'scale(0.7)',
        opacity: 0.5,
        zIndex: 1,
        width: '240px',
        height: '340px'
      },
      '-1': {
        left: '18%',
        transform: 'scale(0.85)',
        opacity: 0.8,
        zIndex: 2,
        width: '280px',
        height: '400px'
      },
      '0': {
        left: '50%',
        transform: 'translateX(-50%) scale(1)',
        opacity: 1,
        zIndex: 3,
        width: '340px',
        height: '480px'
      },
      '1': {
        right: '18%',
        left: 'auto',
        transform: 'scale(0.85)',
        opacity: 0.8,
        zIndex: 2,
        width: '280px',
        height: '400px'
      },
      '2': {
        right: '5%',
        left: 'auto',
        transform: 'scale(0.7)',
        opacity: 0.5,
        zIndex: 1,
        width: '240px',
        height: '340px'
      }
    }

    return configs[position.toString()] || configs['0']
  }

  return (
    <section style={{background: 'var(--off-white)', padding: '80px 0', overflow: 'hidden'}}>
      {/* Header */}
      <div style={{textAlign: 'center', marginBottom: '50px'}}>
        <h2 style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          fontWeight: '600',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: 'var(--charcoal)',
          margin: 0
        }}>
          NEW RELEASES
        </h2>
      </div>

      {/* Carousel Container */}
      <div style={{position: 'relative', height: '520px', maxWidth: '1400px', margin: '0 auto'}}>
        {/* Cards */}
        {getVisibleItems().map((item, idx) => {
          const styles = getCardStyles(item.position)
          const isCenter = item.position === 0

          return (
            <Link
              to={item.link}
              key={`${item.id}-${idx}`}
              style={{
                position: 'absolute',
                top: '50%',
                marginTop: `-${parseInt(styles.height) / 2}px`,
                left: styles.left,
                right: styles.right,
                width: styles.width,
                height: styles.height,
                transform: styles.transform,
                opacity: styles.opacity,
                zIndex: styles.zIndex,
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: isCenter ? '0 25px 50px rgba(0,0,0,0.25)' : '0 10px 30px rgba(0,0,0,0.15)',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                textDecoration: 'none'
              }}
            >
              {/* Background Image */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `url(${item.image}) center/cover no-repeat`
              }} />

              {/* Top Badges */}
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                right: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                zIndex: 2
              }}>
                {/* Category Badge */}
                <span style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: '600',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}>
                  {item.category}
                </span>

                {/* NEW Badge */}
                {item.badge && (
                  <span style={{
                    background: item.badge === 'NEW!' ? 'var(--gold)' : 'var(--charcoal)',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: '700',
                    letterSpacing: '0.5px'
                  }}>
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Gradient Overlay */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '60%',
                background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
                zIndex: 1
              }} />

              {/* Content */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '24px',
                zIndex: 2
              }}>
                <h3 style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: isCenter ? '20px' : '16px',
                  fontWeight: '600',
                  color: 'white',
                  margin: '0 0 6px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {item.name}
                </h3>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.8)',
                  margin: '0 0 16px 0'
                }}>
                  {item.subtitle}
                </p>
                <button style={{
                  background: 'var(--gold)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '50px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: '600',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background 0.3s'
                }}>
                  Shop Now
                </button>
              </div>
            </Link>
          )
        })}

        {/* Navigation Arrows */}
        <button
          onClick={goToPrev}
          style={{
            position: 'absolute',
            left: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'white',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s'
          }}
          aria-label="Previous"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goToNext}
          style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            background: 'white',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s'
          }}
          aria-label="Next"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="2">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  )
}

export default NewReleasesCarousel
