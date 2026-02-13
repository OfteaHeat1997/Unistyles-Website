import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useHomepage } from '../hooks/useProducts'

// Default slides (fallback when Strapi is unavailable)
const defaultSlides = [
  {
    id: 1,
    image: '/images/hero-bra.jpg',
    title: ['Elegance', 'Redefined'],
    subtitle: 'Discover our premium Colombian lingerie collection',
    cta: { text: 'Shop Lingerie', link: '/bras' }
  },
  {
    id: 2,
    image: '/images/LEONISA_HD_02.jpg',
    title: ['Timeless', 'Beauty'],
    subtitle: 'Luxurious shapewear designed for the modern woman',
    cta: { text: 'Shop Shapewear', link: '/shapewear' }
  },
  {
    id: 3,
    image: '/images/LEONISA_HD_04.jpg',
    title: ['New', 'Collection'],
    subtitle: 'Be the first to explore our latest arrivals',
    cta: { text: 'View Collection', link: '/bras' }
  },
  {
    id: 4,
    image: '/images/LEONISA_HD_05.jpg',
    title: ['Perfect', 'Comfort'],
    subtitle: 'Premium quality lingerie for everyday confidence',
    cta: { text: 'Shop Now', link: '/bras' }
  },
  {
    id: 5,
    image: '/images/LEONISA_HD_06.jpg',
    title: ['Colombian', 'Beauty'],
    subtitle: 'Authentic brands delivered to your door in Curacao',
    cta: { text: 'Explore', link: '/shapewear' }
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

  // Fetch homepage data from Strapi
  const { data: homepageData } = useHomepage()

  // Transform Strapi hero slides to component format
  const slides = useMemo(() => {
    if (homepageData?.heroSlides && homepageData.heroSlides.length > 0) {
      return homepageData.heroSlides.map((slide, index) => ({
        id: slide.id || index + 1,
        image: slide.image || slide.legacyImage || defaultSlides[index]?.image,
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

  // Navigation functions
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

  // Auto-play
  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(nextSlide, 6000)
    return () => clearInterval(interval)
  }, [isPaused, nextSlide])

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

  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    if (isLeftSwipe) nextSlide()
    if (isRightSwipe) prevSlide()
  }

  // Format slide number
  const formatNumber = (num) => String(num).padStart(2, '0')

  // Animation variants
  const slideVariants = {
    enter: (direction) => ({
      opacity: 0,
      filter: 'blur(10px)',
      scale: direction > 0 ? 1.1 : 0.9
    }),
    center: {
      opacity: 1,
      filter: 'blur(0px)',
      scale: 1,
      transition: {
        duration: 0.8,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    exit: (direction) => ({
      opacity: 0,
      filter: 'blur(10px)',
      scale: direction > 0 ? 0.9 : 1.1,
      transition: {
        duration: 0.8,
        ease: [0.4, 0, 0.2, 1]
      }
    })
  }

  const contentVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: 0.3,
        ease: [0.4, 0, 0.2, 1],
        staggerChildren: 0.1
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: { duration: 0.4 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] }
    }
  }

  return (
    <section
      ref={sliderRef}
      className="relative w-full h-screen overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ background: 'var(--dark)' }}
    >
      {/* Background Slides with Ken Burns Effect */}
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={currentSlide}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0"
        >
          {/* Ken Burns Image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${slides[currentSlide].image})`,
              animation: 'kenBurns 8s ease-out forwards'
            }}
          />

          {/* Dark Gradient Overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.3) 100%)'
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Logo - Top Left */}
      <Link
        to="/"
        className="absolute top-8 left-8 z-20"
        style={{ zIndex: 50 }}
      >
        <img
          src="/logo.png"
          alt="UNISTYLES"
          className="h-10 md:h-12 w-auto brightness-0 invert"
        />
      </Link>

      {/* Side Navigation Menu - Left */}
      <nav
        className="absolute left-8 top-1/2 -translate-y-1/2 z-20 hidden lg:flex flex-col gap-6"
        style={{ zIndex: 50 }}
      >
        {sideMenuItems.map((item, idx) => (
          <Link
            key={idx}
            to={item.link}
            className="hover:text-white text-xs uppercase tracking-[3px] transition-colors duration-300 writing-vertical"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              transform: 'rotate(180deg)',
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.7)'
            }}
          >
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
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ zIndex: 30 }}
        >
          <div className="text-center px-6 max-w-4xl">
            {/* Heading */}
            <motion.h1
              variants={itemVariants}
              className="mb-6"
              style={{
                fontFamily: "'Cormorant Garamond', 'Playfair Display', serif",
                fontWeight: 400
              }}
            >
              <span
                className="block text-white text-5xl md:text-7xl lg:text-8xl leading-tight"
                style={{ letterSpacing: '-1px' }}
              >
                {slides[currentSlide].title[0]}
              </span>
              <span
                className="block text-5xl md:text-7xl lg:text-8xl leading-tight italic"
                style={{ letterSpacing: '-1px', color: 'rgba(255, 255, 255, 0.95)' }}
              >
                {slides[currentSlide].title[1]}
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-base md:text-lg mb-10 max-w-xl mx-auto"
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 300,
                letterSpacing: '0.5px',
                lineHeight: 1.8,
                color: 'rgba(255, 255, 255, 0.85)'
              }}
            >
              {slides[currentSlide].subtitle}
            </motion.p>

            {/* CTA Button */}
            <motion.div variants={itemVariants}>
              <Link
                to={slides[currentSlide].cta.link}
                className="inline-block px-10 py-4 text-white uppercase text-xs tracking-[3px] transition-all duration-500 hover:bg-white hover:text-black"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontWeight: 500,
                  border: '1px solid rgba(255, 255, 255, 0.5)'
                }}
              >
                {slides[currentSlide].cta.text}
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slide Counter - Bottom Left */}
      <div
        className="absolute bottom-8 left-8 z-20 flex items-center gap-4"
        style={{ zIndex: 50 }}
      >
        <span
          className="text-white text-3xl md:text-4xl font-light"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {formatNumber(currentSlide + 1)}
        </span>
        <span className="text-lg" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>/</span>
        <span
          className="text-lg"
          style={{ fontFamily: "'Montserrat', sans-serif", color: 'rgba(255, 255, 255, 0.5)' }}
        >
          {formatNumber(totalSlides)}
        </span>

        {/* Progress Bar */}
        <div className="ml-4 w-24 h-[1px] overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}>
          <motion.div
            className="h-full bg-white"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{
              duration: 6,
              ease: 'linear',
              repeat: Infinity
            }}
            key={currentSlide}
          />
        </div>
      </div>

      {/* Navigation Arrows - Bottom Center */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-6"
        style={{ zIndex: 50 }}
      >
        <button
          onClick={prevSlide}
          className="w-12 h-12 rounded-full flex items-center justify-center hover:text-white hover:border-white transition-all duration-300"
          style={{ border: '1px solid rgba(255, 255, 255, 0.4)', color: 'rgba(255, 255, 255, 0.7)' }}
          aria-label="Previous slide"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={nextSlide}
          className="w-12 h-12 rounded-full flex items-center justify-center hover:text-white hover:border-white transition-all duration-300"
          style={{ border: '1px solid rgba(255, 255, 255, 0.4)', color: 'rgba(255, 255, 255, 0.7)' }}
          aria-label="Next slide"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Thumbnail Navigation - Right Side */}
      <div
        className="absolute right-8 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col gap-4"
        style={{ zIndex: 50 }}
      >
        {slides.map((slide, idx) => (
          <button
            key={slide.id}
            onClick={() => goToSlide(idx)}
            className={`
              w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-300
              ${idx === currentSlide
                ? 'border-white scale-110'
                : 'border-transparent opacity-50 hover:opacity-80 hover:border-white/50'}
            `}
            aria-label={`Go to slide ${idx + 1}`}
          >
            <img
              src={slide.image}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Vertical Up/Down Arrows - Far Right */}
      <div
        className="absolute right-8 bottom-8 z-20 hidden lg:flex flex-col gap-2"
        style={{ zIndex: 50 }}
      >
        <button
          onClick={prevSlide}
          className="hover:text-white transition-colors p-2"
          style={{ color: 'rgba(255, 255, 255, 0.5)' }}
          aria-label="Previous"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button
          onClick={nextSlide}
          className="hover:text-white transition-colors p-2"
          style={{ color: 'rgba(255, 255, 255, 0.5)' }}
          aria-label="Next"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Ken Burns CSS Animation */}
      <style>{`
        @keyframes kenBurns {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.1);
          }
        }
      `}</style>
    </section>
  )
}

export default HeroSlider
