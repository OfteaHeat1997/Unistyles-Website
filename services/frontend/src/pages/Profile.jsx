/**
 * User Profile Page
 *
 * Displays user information, order history, and account settings.
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function Profile() {
  const navigate = useNavigate()
  const { user, logout, updateProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [message, setMessage] = useState({ type: '', text: '' })

  // Initialize form data from user
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || ''
      })
    }
  }, [user])

  // Fetch orders when orders tab is active
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders()
    }
  }, [activeTab])

  const fetchOrders = async () => {
    setOrdersLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setOrdersLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    const result = await updateProfile({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone
    })

    if (result.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setEditing(false)
    } else {
      setMessage({ type: 'error', text: result.error })
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully!' })
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to change password' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' })
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: '#B8862D',
      confirmed: '#3D7A5F',
      processing: '#1B4D4F',
      shipped: '#1F3347',
      delivered: '#3D7A5F',
      cancelled: '#A4443A'
    }
    return colors[status] || '#6B6560'
  }

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>My Account</span>
        </div>
      </div>

      <section style={{ padding: '40px 0', background: 'var(--cream-bg)', minHeight: '70vh' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '30px' }}>
            {/* Sidebar */}
            <div>
              <div style={{ background: 'var(--white)', padding: '25px', borderRadius: '10px', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'var(--muted-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 15px',
                    fontSize: '28px',
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    {user?.firstName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", marginBottom: '5px' }}>
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>{user?.email}</p>
                </div>
              </div>

              <nav style={{ background: 'var(--white)', borderRadius: '10px', overflow: 'hidden' }}>
                <button
                  onClick={() => setActiveTab('profile')}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    border: 'none',
                    background: activeTab === 'profile' ? 'var(--cream-bg)' : 'transparent',
                    borderLeft: activeTab === 'profile' ? '3px solid var(--muted-gold)' : '3px solid transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'profile' ? '600' : '400'
                  }}
                >
                  Profile Information
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    border: 'none',
                    background: activeTab === 'orders' ? 'var(--cream-bg)' : 'transparent',
                    borderLeft: activeTab === 'orders' ? '3px solid var(--muted-gold)' : '3px solid transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'orders' ? '600' : '400'
                  }}
                >
                  Order History
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    border: 'none',
                    background: activeTab === 'security' ? 'var(--cream-bg)' : 'transparent',
                    borderLeft: activeTab === 'security' ? '3px solid var(--muted-gold)' : '3px solid transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'security' ? '600' : '400'
                  }}
                >
                  Security
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    border: 'none',
                    borderTop: '1px solid var(--border-light)',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--error)'
                  }}
                >
                  Logout
                </button>
              </nav>
            </div>

            {/* Main Content */}
            <div>
              {message.text && (
                <div style={{
                  padding: '12px 20px',
                  borderRadius: '5px',
                  marginBottom: '20px',
                  background: message.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                  color: message.type === 'success' ? 'var(--success)' : 'var(--error)'
                }}>
                  {message.text}
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div style={{ background: 'var(--white)', padding: '30px', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px' }}>Profile Information</h2>
                    {!editing && (
                      <button
                        onClick={() => setEditing(true)}
                        style={{
                          padding: '8px 16px',
                          border: '1px solid var(--dark)',
                          borderRadius: '5px',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Edit Profile
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleProfileUpdate}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>First Name</label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          disabled={!editing}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid var(--border)',
                            borderRadius: '5px',
                            fontSize: '14px',
                            background: editing ? 'var(--white)' : 'var(--soft-gray)'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Last Name</label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          disabled={!editing}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '1px solid var(--border)',
                            borderRadius: '5px',
                            fontSize: '14px',
                            background: editing ? 'var(--white)' : 'var(--soft-gray)'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        disabled
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid var(--border)',
                          borderRadius: '5px',
                          fontSize: '14px',
                          background: 'var(--soft-gray)',
                          color: 'var(--text-secondary)'
                        }}
                      />
                      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '5px' }}>Email cannot be changed</p>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Phone (WhatsApp)</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={!editing}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid var(--border)',
                          borderRadius: '5px',
                          fontSize: '14px',
                          background: editing ? 'var(--white)' : 'var(--soft-gray)'
                        }}
                      />
                    </div>

                    {editing && (
                      <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(false)
                            setFormData({
                              firstName: user?.firstName || '',
                              lastName: user?.lastName || '',
                              email: user?.email || '',
                              phone: user?.phone || ''
                            })
                          }}
                          style={{
                            padding: '12px 24px',
                            border: '1px solid var(--border)',
                            borderRadius: '5px',
                            background: 'transparent',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn-shop"
                          style={{ padding: '12px 24px' }}
                        >
                          Save Changes
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div style={{ background: 'var(--white)', padding: '30px', borderRadius: '10px' }}>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '25px' }}>Order History</h2>

                  {ordersLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <p>Loading orders...</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <p style={{ color: 'var(--dark-warmth)', marginBottom: '20px' }}>You haven't placed any orders yet.</p>
                      <Link to="/" className="btn-shop">Start Shopping</Link>
                    </div>
                  ) : (
                    <div>
                      {orders.map((order) => (
                        <div key={order.id} style={{
                          border: '1px solid var(--border-light)',
                          borderRadius: '8px',
                          padding: '20px',
                          marginBottom: '15px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div>
                              <h4 style={{ marginBottom: '5px' }}>Order #{order.orderNumber}</h4>
                              <p style={{ fontSize: '13px', color: 'var(--dark-warmth)' }}>
                                {formatDate(order.createdAt)}
                              </p>
                            </div>
                            <span style={{
                              padding: '5px 12px',
                              borderRadius: '15px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: 'white',
                              background: getStatusColor(order.status),
                              textTransform: 'capitalize'
                            }}>
                              {order.status}
                            </span>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--dark-warmth)' }}>
                                {order.items?.length || 0} item(s)
                              </span>
                              <span style={{ fontWeight: '600' }}>
                                XCG {order.total?.toFixed(2) || '0.00'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div style={{ background: 'var(--white)', padding: '30px', borderRadius: '10px' }}>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '25px' }}>Change Password</h2>

                  <form onSubmit={handlePasswordChange}>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Current Password</label>
                      <input
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid var(--border)',
                          borderRadius: '5px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>New Password</label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        required
                        minLength={8}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid var(--border)',
                          borderRadius: '5px',
                          fontSize: '14px'
                        }}
                        placeholder="At least 8 characters"
                      />
                    </div>

                    <div style={{ marginBottom: '25px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid var(--border)',
                          borderRadius: '5px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn-shop"
                      style={{ padding: '12px 24px' }}
                    >
                      Change Password
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default Profile
