// UNISTYLES Theme Configuration
// Edit these values to change the entire site's look and feel

export const theme = {
  // Brand Colors
  colors: {
    // Primary - Muted Gold (Colombian elegance)
    primary: {
      light: '#D4B96A',
      main: '#C5A55A',
      dark: '#A8894A',
      hover: '#B89545'
    },

    // Secondary - Charcoal (sophistication)
    secondary: {
      light: '#4A4A4A',
      main: '#2C2C2C',
      dark: '#1A1A1A'
    },

    // Backgrounds
    background: {
      cream: '#F8F6F1',
      white: '#FFFFFF',
      light: '#FAF9F7'
    },

    // Text colors
    text: {
      primary: '#2C2C2C',
      secondary: '#666666',
      muted: '#888888',
      light: '#AAAAAA'
    },

    // Accent colors
    accent: {
      rose: '#D4A5A5',
      blush: '#E8D4D4',
      coral: '#E07B7B'
    },

    // Status colors
    status: {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
      info: '#2196F3'
    }
  },

  // Typography
  fonts: {
    heading: "'Playfair Display', Georgia, serif",
    body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },

  // Font sizes
  fontSizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '2rem',    // 32px
    '4xl': '2.5rem',  // 40px
    '5xl': '3rem'     // 48px
  },

  // Spacing
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem'     // 64px
  },

  // Border radius
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px'
  },

  // Shadows
  shadows: {
    sm: '0 2px 10px rgba(0,0,0,0.08)',
    md: '0 4px 20px rgba(0,0,0,0.1)',
    lg: '0 8px 30px rgba(0,0,0,0.12)',
    xl: '0 15px 50px rgba(0,0,0,0.15)'
  },

  // Transitions
  transitions: {
    fast: '0.15s ease',
    normal: '0.3s ease',
    slow: '0.5s ease'
  },

  // Breakpoints
  breakpoints: {
    mobile: '480px',
    tablet: '768px',
    laptop: '1024px',
    desktop: '1200px'
  }
}

export default theme
