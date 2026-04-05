// ===========================================
// UNISTYLES — Single Source of Truth for Config
// ===========================================

// Business Information
export const BUSINESS = {
  name: 'UNISTYLES',
  tagline: 'Elegant & Affordable Colombian Style',
  description: 'Tu destino de belleza colombiana. Brasiers, fajas, perfumes y productos de cuidado personal.',
  phone: '+59996736285',
  whatsapp: '59996736285',
  whatsappMessage: 'Bon dia! Mi ta interesá pa sa mas di boso produktonan.',
  email: 'info@unistylescuracao.com',
  location: 'Curacao, Caribbean',
  currency: 'XCG',
  currencySymbol: 'XCG',
  freeShippingMin: 80,
  social: {
    instagram: 'https://instagram.com/unistylescuracao',
    facebook: 'https://facebook.com/unistylescuracao',
    tiktok: 'https://tiktok.com/@unistylescuracao'
  },
  hours: {
    weekdays: '9:00 AM - 6:00 PM',
    saturday: '10:00 AM - 4:00 PM',
    sunday: 'Closed'
  }
}

// Delivery Configuration
export const DELIVERY = {
  freeShippingThreshold: 80,
  standardFee: 10,
  areas: [
    'Willemstad', 'Punda', 'Otrobanda', 'Pietermaai', 'Scharloo',
    'Jan Thiel', 'Blue Bay', 'Banda Abou', 'Banda Ariba'
  ],
  zones: [
    { name: 'Willemstad', fee: 0 },
    { name: 'Punda', fee: 0 },
    { name: 'Otrobanda', fee: 0 },
    { name: 'Pietermaai', fee: 0 },
    { name: 'Scharloo', fee: 0 },
    { name: 'Jan Thiel', fee: 5 },
    { name: 'Blue Bay', fee: 5 },
    { name: 'Banda Abou', fee: 10 },
    { name: 'Banda Ariba', fee: 10 }
  ]
}

// Payment Methods
export const PAYMENT_METHODS = [
  { id: 'cod', name: 'Cash on Delivery', icon: 'money-bill-wave', description: 'Pay cash when your order arrives', iconClass: 'cod', enabled: true },
  { id: 'sentoo', name: 'Sentoo', icon: 'credit-card', description: 'Pay by bank, Visa/Mastercard, or iDEAL', iconClass: 'sentoo', enabled: true },
  { id: 'bank', name: 'Bank Transfer', icon: 'university', description: 'Transfer to MCB or RBC account', iconClass: 'bank', enabled: true }
]

// Categories
export const CATEGORIES = [
  { slug: 'bras', name: 'BH / Bras', count: 77, image: '/images/cat-bras.jpg' },
  { slug: 'panties', name: 'Pantys', count: 72, image: '/images/cat-panties.jpg' },
  { slug: 'shapewear', name: 'Fajas / Shapewear', count: 15, image: '/images/LEONISA_HIGH_WAIST_SHAPER_BEIGE.jpg' },
  { slug: 'perfume', name: 'Perfumes', count: 146, image: '/images/cat-perfume.jpg' },
  { slug: 'cremas', name: 'Cremas', count: 49, image: '/images/cat-beauty.jpg' },
  { slug: 'bloqueador', name: 'Bloqueador', count: 11, image: '/images/cat-bloqueador.jpg' },
  { slug: 'desodorantes', name: 'Personal Care', count: 29, image: '/images/cat-desodorantes.jpg' },
  { slug: 'limpieza-facial', name: 'Limpieza Facial', count: 6, image: '/images/cat-skincare.jpg' },
  { slug: 'accesorios', name: 'Accesorios / Joyas', count: 82, image: '/images/cat-accesorios.jpg' }
]

// Brands
export const BRANDS = [
  { id: 'leonisa', name: 'LEONISA', category: 'Lingerie', tagline: "Colombia's #1 lingerie brand since 1956", link: '/bras' },
  { id: 'lbel', name: "L'BEL", category: 'Skincare', tagline: 'Science & technology for your skin', link: '/cremas' },
  { id: 'esika', name: 'esika', category: 'Beauty', tagline: 'Confidence is beauty', link: '/perfume' },
  { id: 'cyzone', name: 'CYZONE', category: 'Fragrances', tagline: 'Trendy beauty for everyone', link: '/perfume' },
  { id: 'yanbal', name: 'YANBAL', category: 'Beauty', tagline: 'Premium beauty since 1967', link: '/cremas' }
]

// Currency
export const CURRENCY = {
  code: 'XCG',
  symbol: 'XCG',
  name: 'Caribbean Guilder'
}

// Size Charts
export const SIZE_CHARTS = {
  bras: {
    headers: ['Size', 'Band (inches)', 'Cup'],
    rows: [
      ['32A', '27-28', 'A'], ['32B', '27-28', 'B'],
      ['34A', '29-30', 'A'], ['34B', '29-30', 'B'], ['34C', '29-30', 'C'],
      ['36B', '31-33', 'B'], ['36C', '31-33', 'C'], ['36D', '31-33', 'D'],
      ['38C', '34-36', 'C'], ['38D', '34-36', 'D']
    ]
  },
  shapewear: {
    headers: ['Size', 'Waist (inches)', 'Hips (inches)'],
    rows: [
      ['XS', '24-26', '34-36'], ['S', '27-29', '37-39'],
      ['M', '30-32', '40-42'], ['L', '33-35', '43-45'],
      ['XL', '36-38', '46-48'], ['XXL', '39-41', '49-51']
    ]
  }
}
