import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminDashboard from '../components/admin/AdminDashboard'
import AdminOrders from '../components/admin/AdminOrders'
import AdminSchedule from '../components/admin/AdminSchedule'
import AdminInventory from '../components/admin/AdminInventory'
import AdminPayments from '../components/admin/AdminPayments'
import AdminSettings from '../components/admin/AdminSettings'
import AdminUsers from '../components/admin/AdminUsers'

// Owner back office. Access is guarded twice: <ProtectedRoute roles={['admin']}>
// in App.jsx and requireRole('admin') on every /api/admin route.

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
  { id: 'orders', label: 'Orders', icon: 'fa-receipt' },
  { id: 'schedule', label: 'Schedule', icon: 'fa-calendar-day' },
  { id: 'inventory', label: 'Inventory', icon: 'fa-boxes' },
  { id: 'payments', label: 'Payments', icon: 'fa-cash-register' },
  { id: 'settings', label: 'Settings', icon: 'fa-sliders-h' },
  { id: 'users', label: 'Users', icon: 'fa-users' }
]

function Admin() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'dashboard'
  const [filters, setFilters] = useState({})

  const goTo = (id, f = {}) => {
    setFilters(f)
    setParams({ tab: id })
    window.scrollTo({ top: 0 })
  }

  return (
    <section style={{ background: 'var(--cream-bg)', minHeight: '80vh', padding: '25px 0 60px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px' }}>Back office</h1>
          <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>Signed in as {user?.firstName || user?.email} · admin</p>
        </div>

        <nav aria-label="Admin sections" style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '4px' }}>
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => goTo(t.id)} aria-current={tab === t.id ? 'page' : undefined}
              style={{
                padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '14px',
                background: tab === t.id ? 'var(--dark)' : 'var(--white)', color: tab === t.id ? 'white' : 'var(--dark)'
              }}>
              <i className={`fas ${t.icon}`} style={{ marginRight: '7px' }}></i>{t.label}
            </button>
          ))}
        </nav>

        {tab === 'dashboard' && <AdminDashboard goTo={goTo} />}
        {tab === 'orders' && <AdminOrders initialFilters={filters} />}
        {tab === 'schedule' && <AdminSchedule />}
        {tab === 'inventory' && <AdminInventory initialFilters={filters} />}
        {tab === 'payments' && <AdminPayments />}
        {tab === 'settings' && <AdminSettings />}
        {tab === 'users' && <AdminUsers />}
      </div>
    </section>
  )
}

export default Admin
