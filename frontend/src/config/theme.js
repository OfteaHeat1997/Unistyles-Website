// UNISTYLES - Brand Identity Theme
// Based on Brand Board v1 + Proposed Final Palette
// Warm neutrals + Gold accents + Caribbean Teal

export const theme = {
  colors: {
    // Backgrounds — Warm Sand Tones
    bg: '#FFFFFF',
    bgPage: '#FAF8F5',
    bgSection: '#F3EDE6',

    // Text — Warm Charcoal Family
    black: '#1A1A1A',
    text: '#1A1A1A',
    textSecondary: '#3A3F45',
    textMuted: '#6B6560',
    textDisabled: '#9B9490',

    // Accent — Gold (from Logo)
    gold: '#C5A55A',
    goldHover: '#D4B96E',
    goldSoft: '#EDD9A3',

    // Actions — Caribbean Teal + Navy
    teal: '#1B4D4F',
    tealHover: '#24635F',
    navy: '#1F3347',

    // Border
    border: '#E6DED8',
    borderLight: '#F3EDE6',

    // Semantic
    success: '#3D7A5F',
    warning: '#B8862D',
    error: '#A4443A',

    // Legacy aliases
    white: '#FFFFFF'
  },

  fonts: {
    heading: "'Playfair Display', Georgia, serif",
    body: "'Inter', -apple-system, sans-serif"
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px'
  },

  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px'
  },

  shadows: {
    sm: '0 2px 8px rgba(0,0,0,0.06)',
    md: '0 4px 16px rgba(0,0,0,0.08)',
    lg: '0 8px 24px rgba(0,0,0,0.1)'
  }
}

export default theme
