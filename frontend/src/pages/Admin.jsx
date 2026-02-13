import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function Admin() {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if user is authenticated and is admin
  useEffect(() => {
    if (authLoading) return // Wait for auth to load

    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    // Check if user is admin - redirect if not
    if (user && user.role !== 'admin') {
      navigate('/')
      return
    }
  }, [isAuthenticated, authLoading, user, navigate])

  // Fetch data based on active tab - must be before conditional returns (Rules of Hooks)
  useEffect(() => {
    // Don't fetch if not authenticated or not admin
    if (authLoading || !isAuthenticated || !token) return
    if (user && user.role !== 'admin') return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }

        if (activeTab === 'dashboard') {
          const res = await fetch('/api/admin/stats', { headers })
          if (res.status === 403) {
            setError('Admin access required')
            return
          }
          if (!res.ok) throw new Error('Failed to fetch stats')
          const data = await res.json()
          setStats(data)
        } else if (activeTab === 'users') {
          const res = await fetch('/api/admin/users', { headers })
          if (res.status === 403) {
            setError('Admin access required')
            return
          }
          if (!res.ok) throw new Error('Failed to fetch users')
          const data = await res.json()
          setUsers(data.users)
        } else if (activeTab === 'orders') {
          const res = await fetch('/api/admin/orders', { headers })
          if (res.status === 403) {
            setError('Admin access required')
            return
          }
          if (!res.ok) throw new Error('Failed to fetch orders')
          const data = await res.json()
          setOrders(data.orders)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activeTab, token, authLoading, isAuthenticated, user])

  const updateOrderStatus = async (orderId, status) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })

      if (res.ok) {
        setOrders(orders.map(order =>
          order.id === orderId ? { ...order, status } : order
        ))
      }
    } catch (err) {
      console.error('Failed to update order:', err)
    }
  }

  const updateUserRole = async (userId, role) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role })
      })

      if (res.ok) {
        setUsers(users.map(u =>
          u.id === userId ? { ...u, role } : u
        ))
      }
    } catch (err) {
      console.error('Failed to update user:', err)
    }
  }

  // Don't render anything while checking auth
  if (authLoading) {
    return (
      <div className="admin-page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect happens in useEffect, return null while it processes
  if (!isAuthenticated || (user && user.role !== 'admin')) {
    return null
  }

  if (error === 'Admin access required') {
    return (
      <div className="admin-page">
        <div className="container" style={{ padding: '100px 20px', textAlign: 'center' }}>
          <h1>Access Denied</h1>
          <p>You need admin privileges to access this page.</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-logo">
            <h2>Admin Panel</h2>
          </div>
          <nav className="admin-nav">
            <button
              className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Dashboard
            </button>
            <button
              className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Users
            </button>
            <button
              className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              Orders
            </button>
          </nav>
          <div className="admin-user">
            <span>Logged in as</span>
            <strong>{user?.firstName} {user?.lastName}</strong>
          </div>
        </aside>

        {/* Main Content */}
        <main className="admin-main">
          {loading ? (
            <div className="admin-loading">Loading...</div>
          ) : error ? (
            <div className="admin-error">{error}</div>
          ) : (
            <>
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && stats && (
                <div className="admin-dashboard">
                  <h1>Dashboard</h1>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon users">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                      </div>
                      <div className="stat-info">
                        <span className="stat-label">Total Users</span>
                        <span className="stat-value">{stats.totalUsers}</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon orders">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                          <line x1="3" y1="6" x2="21" y2="6" />
                        </svg>
                      </div>
                      <div className="stat-info">
                        <span className="stat-label">Total Orders</span>
                        <span className="stat-value">{stats.totalOrders}</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon revenue">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                      </div>
                      <div className="stat-info">
                        <span className="stat-label">Total Revenue</span>
                        <span className="stat-value">XCG {stats.totalRevenue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {stats.ordersByStatus.length > 0 && (
                    <div className="orders-summary">
                      <h3>Orders by Status</h3>
                      <div className="status-pills">
                        {stats.ordersByStatus.map(item => (
                          <span key={item.status} className={`status-pill ${item.status}`}>
                            {item.status}: {item.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="admin-users">
                  <h1>Users</h1>
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Role</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id}>
                            <td>{u.first_name} {u.last_name}</td>
                            <td>{u.email}</td>
                            <td>{u.phone || '-'}</td>
                            <td>
                              <select
                                value={u.role || 'customer'}
                                onChange={(e) => updateUserRole(u.id, e.target.value)}
                                className="role-select"
                              >
                                <option value="customer">Customer</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                            <td>{new Date(u.created_at).toLocaleDateString()}</td>
                            <td>
                              <button className="btn-small" onClick={() => alert('View user details coming soon')}>
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div className="admin-orders">
                  <h1>Orders</h1>
                  {orders.length === 0 ? (
                    <p>No orders yet.</p>
                  ) : (
                    <div className="admin-table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Order #</th>
                            <th>Customer</th>
                            <th>Total</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map(order => (
                            <tr key={order.id}>
                              <td><strong>{order.order_number}</strong></td>
                              <td>
                                {order.first_name} {order.last_name}<br />
                                <small>{order.email}</small>
                              </td>
                              <td>XCG {parseFloat(order.total).toFixed(2)}</td>
                              <td>{order.payment_method}</td>
                              <td>
                                <select
                                  value={order.status}
                                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                  className={`status-select ${order.status}`}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="processing">Processing</option>
                                  <option value="shipped">Shipped</option>
                                  <option value="delivered">Delivered</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </td>
                              <td>{new Date(order.created_at).toLocaleDateString()}</td>
                              <td>
                                <button className="btn-small" onClick={() => alert('View order details coming soon')}>
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default Admin
