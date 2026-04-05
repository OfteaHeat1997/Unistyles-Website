import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'

// Code-split: lazy-load pages that aren't needed on initial render
const Category = lazy(() => import('./pages/Category'))
const Perfume = lazy(() => import('./pages/Perfume'))
const PersonalCare = lazy(() => import('./pages/PersonalCare'))
const Skincare = lazy(() => import('./pages/Skincare'))
const Sunscreen = lazy(() => import('./pages/Sunscreen'))
const FacialCleansing = lazy(() => import('./pages/FacialCleansing'))
const Accessories = lazy(() => import('./pages/Accessories'))
const Product = lazy(() => import('./pages/Product'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Profile = lazy(() => import('./pages/Profile'))
const PaymentCallback = lazy(() => import('./pages/PaymentCallback'))
const Search = lazy(() => import('./pages/Search'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const FAQ = lazy(() => import('./pages/FAQ'))
const Shipping = lazy(() => import('./pages/Shipping'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const TrackOrder = lazy(() => import('./pages/TrackOrder'))
const Admin = lazy(() => import('./pages/Admin'))
const Brand = lazy(() => import('./pages/Brand'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Loading fallback for lazy-loaded pages
function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <div className="spinner"></div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Main site with header/footer */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="bras" element={<Category category="bras" />} />
          <Route path="panties" element={<Category category="panties" />} />
          <Route path="shapewear" element={<Category category="shapewear" />} />
          <Route path="perfume" element={<Perfume />} />
          <Route path="cremas" element={<Skincare />} />
          <Route path="bloqueador" element={<Sunscreen />} />
          <Route path="desodorantes" element={<PersonalCare />} />
          <Route path="limpieza-facial" element={<FacialCleansing />} />
          <Route path="accesorios" element={<Accessories />} />
          <Route path="product/:id" element={<Product />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="payment/callback" element={<PaymentCallback />} />
          <Route path="search" element={<Search />} />
          <Route path="login" element={<Login />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="register" element={<Register />} />
          <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="shipping" element={<Shipping />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="track-order" element={<TrackOrder />} />
          <Route path="admin" element={<Admin />} />
          <Route path="brand/:brandId" element={<Brand />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}

export default App
