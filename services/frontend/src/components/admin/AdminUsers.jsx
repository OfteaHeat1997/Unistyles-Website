import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../utils/api'
import { useAuth } from '../../contexts/AuthContext'
import { card, input, th, td, shortDate, Loading, ErrorBox, Empty, Pill } from './ui'

function AdminUsers() {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [error, setError] = useState('')
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (role) params.set('role', role)

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['admin', 'users', params.toString()],
    queryFn: () => api.get(`/api/admin/users?${params}`)
  })

  const changeRole = async (id, newRole) => {
    setError('')
    try {
      await api.put(`/api/admin/users/${id}`, { role: newRole })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
        <input placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...input, flex: '1 1 220px' }} aria-label="Search users" />
        <select value={role} onChange={e => setRole(e.target.value)} style={input} aria-label="Role">
          <option value="">All roles</option><option value="customer">Customers</option><option value="driver">Drivers</option><option value="admin">Admins</option>
        </select>
      </div>
      <ErrorBox error={loadError} onRetry={refetch} />
      <ErrorBox error={error ? { message: error } : null} />
      {isLoading ? <Loading /> : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
            <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Phone</th><th style={th}>Joined</th><th style={th}>Role</th></tr></thead>
            <tbody>
              {data?.users.map(u => (
                <tr key={u.id}>
                  <td style={td}>{u.first_name} {u.last_name} {!u.is_verified && <Pill color="#e67e22">unverified</Pill>}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>{u.phone || '—'}</td>
                  <td style={td}>{shortDate(u.created_at)}</td>
                  <td style={td}>
                    <select value={u.role} disabled={u.id === me?.id} onChange={e => changeRole(u.id, e.target.value)} style={input} aria-label={`Role of ${u.email}`}>
                      <option value="customer">customer</option><option value="driver">driver</option><option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.users.length === 0 && <Empty>No users found.</Empty>}
        </div>
      )}
      <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', marginTop: '10px' }}>
        To add a delivery person: ask them to register on the site, then set their role to <strong>driver</strong> here.
      </p>
    </div>
  )
}

export default AdminUsers
