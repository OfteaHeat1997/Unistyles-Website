import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Category from './pages/Category'
import Product from './pages/Product'
import About from './pages/About'
import Contact from './pages/Contact'
import Checkout from './pages/Checkout'
import Login from './pages/Login'
import Register from './pages/Register'
import NotFound from './pages/NotFound'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="bras" element={<Category category="bras" />} />
        <Route path="panties" element={<Category category="panties" />} />
        <Route path="shapewear" element={<Category category="shapewear" />} />
        <Route path="colonias" element={<Category category="colonias" />} />
        <Route path="cremas" element={<Category category="cremas" />} />
        <Route path="bloqueador" element={<Category category="bloqueador" />} />
        <Route path="desodorantes" element={<Category category="desodorantes" />} />
        <Route path="limpieza-facial" element={<Category category="limpieza-facial" />} />
        <Route path="accesorios" element={<Category category="accesorios" />} />
        <Route path="product/:id" element={<Product />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
