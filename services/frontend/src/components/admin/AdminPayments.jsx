import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, apiFetch } from '../../utils/api'
import { card, input, th, td, money, shortDate, Loading, ErrorBox, Empty, StatusPill, Button } from './ui'

const isoDay = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)

function AdminPayments() {
  const [from, setFrom] = useState(isoDay(-30))
  const [to, setTo] = useState(isoDay(0))
  const [downloadError, setDownloadError] = useState('')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'payments', from, to],
    queryFn: () => api.get(`/api/admin/payments?from=${from}&to=${to}`)
  })

  const downloadCsv = async () => {
    setDownloadError('')
    try {
      const res = await apiFetch(`/api/admin/payments?from=${from}&to=${to}&format=csv`, { raw: true })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payments_${from}_${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(err.message)
    }
  }

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px', alignItems: 'center' }}>
        <label style={{ fontSize: '13px' }}>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={input} /></label>
        <label style={{ fontSize: '13px' }}>To <input type="date" value={to} onChange={e => setTo(e.target.value)} style={input} /></label>
        <Button onClick={downloadCsv}><i className="fas fa-file-csv"></i> Export CSV</Button>
        {downloadError && <span role="alert" style={{ color: '#c0392b', fontSize: '12px' }}>{downloadError}</span>}
      </div>
      <ErrorBox error={error} onRetry={refetch} />
      {isLoading ? <Loading /> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
            {data.summary.map(s => (
              <div key={s.method} style={card}>
                <p style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--dark-warmth)' }}>{s.method.replace('_', ' ')} · {s.count} orders</p>
                <p style={{ fontSize: '20px', fontWeight: 700 }}>{money(s.paid)}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Open {money(s.pending)} · Refunded {money(s.refunded)}</p>
              </div>
            ))}
          </div>
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
              <thead><tr><th style={th}>Order</th><th style={th}>Created</th><th style={th}>Method</th><th style={th}>Payment</th><th style={th}>Reference</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={{ ...th, textAlign: 'right' }}>Refunded</th></tr></thead>
              <tbody>
                {data.payments.map(p => (
                  <tr key={p.orderNumber}>
                    <td style={td}>{p.orderNumber}</td>
                    <td style={td}>{shortDate(p.createdAt)}</td>
                    <td style={td}>{p.method.replace('_', ' ')}</td>
                    <td style={td}><StatusPill status={p.paymentStatus} />{p.failureReason && <><br /><span style={{ fontSize: '11px', color: '#c0392b' }}>{p.failureReason}</span></>}</td>
                    <td style={{ ...td, fontSize: '11px', wordBreak: 'break-all' }}>{p.reference || '—'}{p.paidAt ? <><br />paid {shortDate(p.paidAt)}</> : ''}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{money(p.total)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{p.refunded ? money(p.refunded) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.payments.length === 0 && <Empty>No orders in this period.</Empty>}
          </div>
        </>
      )}
    </div>
  )
}

export default AdminPayments
