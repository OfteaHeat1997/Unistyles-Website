import { useState, useEffect, useRef } from 'react'
import '../styles/splash.css'

// Module-level flag: only show splash once per full page load.
let hasPlayedThisPageLoad = false

function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    if (hasPlayedThisPageLoad) return false
    hasPlayedThisPageLoad = true
    return true
  })
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!visible) return

    document.body.style.overflow = 'hidden'

    // Start exit at 2.3s
    timerRef.current = setTimeout(() => setExiting(true), 2300)

    return () => {
      document.body.style.overflow = ''
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible])

  // Remove from DOM after exit animation completes
  useEffect(() => {
    if (!exiting) return
    const t = setTimeout(() => {
      setVisible(false)
      document.body.style.overflow = ''
    }, 600)
    return () => clearTimeout(t)
  }, [exiting])

  if (!visible) return null

  return (
    <div className={`splash-screen ${exiting ? 'splash-exit' : ''}`}>
      <div className="splash-logo-container splash-logo-enter">
        <img
          className="splash-logo"
          src="/logo-gold-on-black.png"
          alt="UNISTYLES"
        />
        <div className="splash-shimmer" />
      </div>
      <span className="splash-wordmark splash-wordmark-enter">
        UNISTYLES
      </span>
    </div>
  )
}

export default SplashScreen
