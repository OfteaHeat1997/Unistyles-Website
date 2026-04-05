import { useState, useEffect } from 'react'

function AnimatedLogo({ variant = 'header' }) {
  const [entered, setEntered] = useState(false)

  // Trigger pop-in entrance after mount
  useEffect(() => {
    if (variant === 'footer') return
    const t = setTimeout(() => setEntered(true), 100)
    return () => clearTimeout(t)
  }, [variant])

  // Footer: simple white logo
  if (variant === 'footer') {
    return (
      <img
        src="/logo.png"
        alt="UNISTYLES"
        style={{ filter: 'brightness(0) invert(1)' }}
      />
    )
  }

  // Header: interactive 3D logo
  return (
    <div className={`alogo ${entered ? 'alogo-entered' : ''}`}>
      <div className="alogo-flipper">
        {/* Front face - Gold */}
        <div className="alogo-face alogo-front">
          <img src="/logo.png" alt="UNISTYLES" draggable="false" />
        </div>
        {/* Back face - Dark */}
        <div className="alogo-face alogo-back">
          <img src="/logo.png" alt="" aria-hidden="true" draggable="false" />
        </div>
      </div>

      {/* Glow ring */}
      <div className="alogo-glow" />

      {/* Sparkle particles */}
      <div className="alogo-sparkle alogo-sparkle-1" />
      <div className="alogo-sparkle alogo-sparkle-2" />
      <div className="alogo-sparkle alogo-sparkle-3" />
      <div className="alogo-sparkle alogo-sparkle-4" />
    </div>
  )
}

export default AnimatedLogo
