import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useHomepage } from '../hooks/useProducts'

// Default slides — mix of videos and images
const defaultSlides = [
  {
    id: 1,
    type: 'video',
    src: '/images/Accesorrios/2026-02-06-145858095.mp4',
    title: ['Elegance', 'Redefined'],
    subtitle: 'Discover our premium Colombian accessories collection',
    cta: { text: 'Shop Accessories', link: '/accesorios' }
  },
  {
    id: 2,
    type: 'image',
    src: '/images/hero-bra.jpg',
    title: ['Timeless', 'Beauty'],
    subtitle: 'Luxurious shapewear designed for the modern woman',
    cta: { text: 'Shop Shapewear', link: '/shapewear' }
  },
  {
    id: 3,
    type: 'video',
    src: '/images/Accesorrios/2026-02-04-181023290.mp4',
    title: ['Handcrafted', 'Jewelry'],
    subtitle: 'Unique pieces that tell your story',
    cta: { text: 'View Collection', link: '/accesorios' }
  },
  {
    id: 4,
    type: 'image',
    src: '/images/LEONISA_HD_04.jpg',
    title: ['New', 'Collection'],
    subtitle: 'Be the first to explore our latest arrivals',
    cta: { text: 'Shop Now', link: '/bras' }
  },
  {
    id: 5,
    type: 'video',
    src: '/images/Accesorrios/2026-02-04-192040283.mp4',
    title: ['Colombian', 'Beauty'],
    subtitle: 'Authentic brands delivered to your door in Curacao',
    cta: { text: 'Explore', link: '/accesorios' }
  },
  {
    id: 6,
    type: 'image',
    src: '/images/LEONISA_HD_05.jpg',
    title: ['Perfect', 'Comfort'],
    subtitle: 'Premium quality lingerie for everyday confidence',
    cta: { text: 'Shop Lingerie', link: '/bras' }
  },
  {
    id: 7,
    type: 'video',
    src: '/images/Accesorrios/2026-02-05-011458411.mp4',
    title: ['Shine', 'Bright'],
    subtitle: 'Statement accessories for every occasion',
    cta: { text: 'Shop Now', link: '/accesorios' }
  }
]

// Side menu items
const sideMenuItems = [
  { label: 'Showroom', link: '/bras' },
  { label: 'Collections', link: '/shapewear' },
  { label: 'Perfumes', link: '/perfume' },
  { label: 'Contact', link: '/contact' }
]

function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [direction, setDirection] = useState(1)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const sliderRef = useRef(null)
  const videoRefs = useRef({})

  // Fetch homepage data from Strapi
  const { data: homepageData } = useHomepage()

  // Transform Strapi hero slides or use defaults
  const slides = useMemo(() => {
    if (homepageData?.heroSlides && homepageData.heroSlides.length > 0) {
      return homepageData.heroSlides.map((slide, index) => ({
        id: slide.id || index + 1,
        type: slide.type || 'image',
        src: slide.image || slide.legacyImage || defaultSlides[index]?.src,
        title: [slide.title || '', slide.titleLine2 || ''],
        subtitle: slide.subtitle || '',
        cta: {
          text: slide.buttonText || 'Shop Now',
          link: slide.buttonLink || '/bras'
        }
      }))
    }
    return defaultSlides
  }, [homepageData])

  const totalSlides = slides.length

  // Navigation
  const goToSlide = useCallback((index) => {
    setDirection(index > currentSlide ? 1 : -1)
    setCurrentSlide(index)
  }, [currentSlide])

  const nextSlide = useCallback(() => {
    setDirection(1)
    setCurrentSlide((prev) => (prev + 1) % totalSlides)
  }, [totalSlides])

  const prevSlide = useCallback(() => {
    setDirection(-1)
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)
  }, [totalSlides])

  // Auto-play: 6s for images, 8s for videos
  useEffect(() => {
    if (isPaused) return
    const slide = slides[currentSlide]
    const duration = slide.type === 'video' ? 8000 : 6000
    const interval = setTimeout(nextSlide, duration)
    return () => clearTimeout(interval)
  }, [isPaused, nextSlide, currentSlide, slides])

  // Play/pause videos when slide changes
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, video]) => {
      if (!video) return
      if (parseInt(idx) === currentSlide) {
        video.currentTime = 0
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    })
  }, [currentSlide])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextSlide()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevSlide()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextSlide, prevSlide])

  // Touch handlers
  const minSwipeDistance = 50
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX) }
  const onTouchMove = (e) => { setTouchEnd(e.targetTouches[0].clientX) }
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    if (distance > minSwipeDistance) nextSlide()
    if (distance < -minSwipeDistance) prevSlide()
  }

  const formatNumber = (num) => String(num).padStart(2, '0')

  // Animation variants
  const slideVariants = {
    enter: (dir) => ({ opacity: 0, filter: 'blur(10px)', scale: dir > 0 ? 1.1 : 0.9 }),
    center: {
      opacity: 1, filter: 'blur(0px)', scale: 1,
      transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
    },
    exit: (dir) => ({
      opacity: 0, filter: 'blur(10px)', scale: dir > 0 ? 0.9 : 1.1,
      transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
    })
  }

  const contentVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1, y: 0,
      transition: { duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1], staggerChildren: 0.1 }
    },
    exit: { opacity: 0, y: -20, transition: { duration: 0.4 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } }
  }

  const slide = slides[currentSlide]

  return (
    <section
      ref={sliderRef}
      className="hero-slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Background Slides */}
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentSlide}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="hero-slide-bg"
        >
          {slide.type === 'video' ? (
            <video
              ref={(el) => { videoRefs.current[currentSlide] = el }}
              className="hero-slide-media"
              src={slide.src}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <div
              className="hero-slide-media hero-slide-image"
              style={{ backgroundImage: `url(${slide.src})` }}
            />
          )}

          {/* Dark Gradient Overlay */}
          <div className="hero-slide-overlay" />
        </motion.div>
      </AnimatePresence>

      {/* Preload next video */}
      {slides.map((s, idx) => (
        s.type === 'video' && idx !== currentSlide ? (
          <video
            key={s.id}
            ref={(el) => { videoRefs.current[idx] = el }}
            src={s.src}
            muted
            playsInline
            preload="auto"
            style={{ display: 'none' }}
          />
        ) : null
      ))}

      {/* Logo - Top Left */}
      <Link to="/" className="hero-logo">
        <img src="/logo.png" alt="UNISTYLES" />
      </Link>

      {/* Side Navigation Menu - Left */}
      <nav className="hero-side-nav">
        {sideMenuItems.map((item, idx) => (
          <Link key={idx} to={item.link} className="hero-side-link">
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Main Content - Center */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="hero-content"
        >
          <div className="hero-content-inner">
            <motion.h1 variants={itemVariants} className="hero-title">
              <span className="hero-title-line">{slide.title[0]}</span>
              <span className="hero-title-line hero-title-italic">{slide.title[1]}</span>
            </motion.h1>

            <motion.p variants={itemVariants} className="hero-subtitle">
              {slide.subtitle}
            </motion.p>

            <motion.div variants={itemVariants}>
              <Link to={slide.cta.link} className="hero-cta">
                {slide.cta.text}
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slide Counter - Bottom Left */}
      <div className="hero-counter">
        <span className="hero-counter-current">{formatNumber(currentSlide + 1)}</span>
        <span className="hero-counter-sep">/</span>
        <span className="hero-counter-total">{formatNumber(totalSlides)}</span>
        <div className="hero-progress">
          <motion.div
            className="hero-progress-bar"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: slide.type === 'video' ? 8 : 6, ease: 'linear' }}
            key={currentSlide}
          />
        </div>
      </div>

      {/* Navigation Arrows - Bottom Center */}
      <div className="hero-arrows">
        <button onClick={prevSlide} className="hero-arrow" aria-label="Previous slide">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button onClick={nextSlide} className="hero-arrow" aria-label="Next slide">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Thumbnail Navigation - Right Side */}
      <div className="hero-thumbnails">
        {slides.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => goToSlide(idx)}
            className={`hero-thumb ${idx === currentSlide ? 'active' : ''}`}
            aria-label={`Go to slide ${idx + 1}`}
          >
            {s.type === 'video' ? (
              <div className="hero-thumb-video-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            ) : (
              <img src={s.src} alt="" loading="lazy" />
            )}
          </button>
        ))}
      </div>
    </section>
  )
}

export default HeroSlider
