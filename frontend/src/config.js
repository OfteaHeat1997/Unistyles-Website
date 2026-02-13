// Business Configuration
export const BUSINESS = {
  name: 'UNISTYLES',
  tagline: 'Elegant & Affordable Colombian Style',
  phone: '+59990000425',
  whatsapp: '59990000425',
  whatsappMessage: 'Hola! I have a question about your products',
  email: 'info@unistylescuracao.com',
  location: 'Curacao, Caribbean',
  currency: 'XCG',
  freeShippingMin: 150
}

// Delivery Configuration
export const DELIVERY = {
  freeShippingThreshold: 80,
  standardFee: 10,
  areas: [
    'Willemstad',
    'Punda',
    'Otrobanda',
    'Pietermaai',
    'Scharloo',
    'Jan Thiel',
    'Blue Bay',
    'Banda Abou',
    'Banda Ariba'
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

// Payment Methods Configuration
export const PAYMENT_METHODS = [
  {
    id: 'cod',
    name: 'Cash on Delivery',
    icon: 'money-bill-wave',
    description: 'Pay cash when your order arrives',
    iconClass: 'cod',
    enabled: true
  },
  {
    id: 'sentoo',
    name: 'Sentoo',
    icon: 'mobile-alt',
    description: 'Pay via Sentoo mobile app',
    iconClass: 'sentoo',
    enabled: true
  },
  {
    id: 'bank',
    name: 'Bank Transfer',
    icon: 'university',
    description: 'Transfer to MCB or RBC account',
    iconClass: 'bank',
    enabled: true
  }
]

// Categories Configuration
export const CATEGORIES = [
  { slug: 'bras', name: 'BH / Bras', count: 77, image: '/images/cat-bras.jpg' },
  { slug: 'panties', name: 'Pantys', count: 72, image: '/images/cat-panties.jpg' },
  { slug: 'shapewear', name: 'Fajas / Shapewear', count: 15, image: '/images/LEONISA_HIGH_WAIST_SHAPER_BEIGE.jpg' },
  { slug: 'perfume', name: 'Perfumes', count: 146, image: '/images/cat-perfume.jpg' },
  { slug: 'cremas', name: 'Cremas', count: 49, image: '/images/cat-beauty.jpg' },
  { slug: 'bloqueador', name: 'Bloqueador', count: 11, image: '/images/cat-bloqueador.jpg' },
  { slug: 'desodorantes', name: 'Desodorantes', count: 25, image: '/images/cat-desodorantes.jpg' },
  { slug: 'limpieza-facial', name: 'Limpieza Facial', count: 6, image: '/images/cat-skincare.jpg' },
  { slug: 'accesorios', name: 'Accesorios / Joyas', count: 82, image: '/images/cat-accesorios.jpg' }
]

// Brands Configuration
export const BRANDS = [
  { id: 'leonisa', name: 'LEONISA', category: 'Lingerie', tagline: "Colombia's #1 lingerie brand since 1956", link: '/bras' },
  { id: 'lbel', name: "L'BEL", category: 'Skincare', tagline: 'Science & technology for your skin', link: '/cremas' },
  { id: 'esika', name: 'esika', category: 'Beauty', tagline: 'Confidence is beauty', link: '/perfume' },
  { id: 'cyzone', name: 'CYZONE', category: 'Fragrances', tagline: 'Trendy beauty for everyone', link: '/perfume' },
  { id: 'yanbal', name: 'YANBAL', category: 'Beauty', tagline: 'Premium beauty since 1967', link: '/cremas' }
]
