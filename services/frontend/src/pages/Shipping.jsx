import { Link } from 'react-router-dom'
import { getGeneralQuestionUrl } from '../utils/whatsapp'
import { useDeliveryZones } from '../hooks/useDeliveryZones'
import DeliveryMap from '../components/DeliveryMap'

function Shipping() {
  const { zones, freeShippingThreshold, isLoading } = useDeliveryZones()

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: 'var(--cream-bg)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--charcoal)', textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 10px', color: 'var(--text-tertiary)' }}>/</span>
          <span style={{ color: 'var(--muted-gold)' }}>Shipping & Delivery</span>
        </div>
      </div>

      <section style={{ padding: '60px 0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', marginBottom: '10px', textAlign: 'center' }}>
            Shipping & Delivery
          </h1>
          <p style={{ textAlign: 'center', color: 'var(--dark-warmth)', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' }}>
            We deliver to every corner of Curacao. Check your zone, fee and delivery time below.
          </p>

          {/* Free delivery banner */}
          <div style={{
            background: 'linear-gradient(135deg, #1A1A1A 0%, #2d2d2d 100%)', color: 'var(--white)',
            padding: '30px', borderRadius: '12px', marginBottom: '40px', textAlign: 'center'
          }}>
            <i className="fas fa-truck" style={{ fontSize: '36px', color: 'var(--muted-gold)', marginBottom: '12px' }}></i>
            <h2 style={{ fontSize: '24px', marginBottom: '5px' }}>
              Free Delivery in Centro from <span style={{ color: 'var(--muted-gold)' }}>XCG {zones[0]?.freeThreshold ?? freeShippingThreshold}</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>Each zone has its own free-shipping threshold — see below</p>
          </div>

          {/* Interactive delivery map with zone polygons + geolocation */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '20px' }}>
              <i className="fas fa-map-marked-alt" style={{ color: 'var(--muted-gold)', marginRight: '10px' }}></i>
              Delivery Coverage Map
            </h2>
            <DeliveryMap height={420} />
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              Hover a zone to see fees and ETA. Click <strong>Detect my zone</strong> to find your zone using GPS.
            </p>
          </div>

          {/* Delivery Zones */}
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '25px' }}>
            <i className="fas fa-map-pin" style={{ color: 'var(--muted-gold)', marginRight: '10px' }}></i>
            Delivery Zones
          </h2>

          {isLoading ? (
            <p style={{ color: 'var(--dark-warmth)' }}>Loading zones…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
              {zones.map(zone => (
                <div key={zone.id} style={{
                  border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '18px 24px', background: 'var(--cream-bg)', borderBottom: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '14px', height: '14px', borderRadius: '50%', background: zone.color, flexShrink: 0
                      }}></div>
                      <div>
                        <h3 style={{ fontSize: '16px', margin: 0 }}>{zone.name}</h3>
                        <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', margin: 0 }}>
                          <i className="fas fa-clock" style={{ marginRight: '4px' }}></i>{zone.estimatedDays}
                          {zone.freeThreshold && (
                            <> • Free over XCG {zone.freeThreshold}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <span style={{
                      background: zone.fee === 0 ? '#e8f5e9' : '#fff3e0',
                      color: zone.color,
                      padding: '6px 16px', borderRadius: '20px',
                      fontSize: '14px', fontWeight: '700'
                    }}>
                      {zone.fee === 0 ? 'FREE' : `XCG ${zone.fee}`}
                    </span>
                  </div>

                  <div style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                      {zone.neighborhoods.map(area => (
                        <div key={area.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <i className="fas fa-map-marker-alt" style={{ color: zone.color, marginTop: '3px', fontSize: '12px', flexShrink: 0 }}></i>
                          <div>
                            <span style={{ fontWeight: '600', fontSize: '14px' }}>{area.name}</span>
                            {area.desc && (
                              <p style={{ fontSize: '12px', color: 'var(--dark-warmth)', margin: '2px 0 0' }}>{area.desc}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Zone Legend */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap',
            padding: '20px', background: 'var(--cream-bg)', borderRadius: '10px', marginBottom: '40px'
          }}>
            {zones.map(zone => (
              <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: zone.color }}></div>
                <span>{zone.name.split('—')[0].trim()}: <strong>{zone.fee === 0 ? 'FREE' : `XCG ${zone.fee}`}</strong></span>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', marginBottom: '25px' }}>
            How It Works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            {[
              { icon: 'fa-shopping-bag', title: '1. Place Order', desc: 'Online or via WhatsApp' },
              { icon: 'fa-check-circle', title: '2. Confirmation', desc: 'WhatsApp confirmation within 1 hour' },
              { icon: 'fa-box', title: '3. Preparation', desc: 'We prepare & pack your order' },
              { icon: 'fa-home', title: '4. Delivery', desc: 'Delivered to your door in Curacao' }
            ].map(step => (
              <div key={step.title} style={{
                textAlign: 'center', padding: '25px 15px', background: 'var(--white)',
                borderRadius: '10px', border: '1px solid var(--border-light)'
              }}>
                <div style={{
                  width: '50px', height: '50px', borderRadius: '50%', background: 'var(--cream-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
                }}>
                  <i className={`fas ${step.icon}`} style={{ fontSize: '20px', color: 'var(--muted-gold)' }}></i>
                </div>
                <h4 style={{ marginBottom: '5px', fontSize: '14px' }}>{step.title}</h4>
                <p style={{ fontSize: '13px', color: 'var(--dark-warmth)', margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Important Notes */}
          <div style={{
            padding: '25px', background: '#fffef5', border: '1px solid #f0e6c0',
            borderRadius: '10px', marginBottom: '40px'
          }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>
              <i className="fas fa-info-circle" style={{ color: 'var(--muted-gold)', marginRight: '8px' }}></i>
              Important Information
            </h3>
            <ul style={{ fontSize: '14px', lineHeight: '2', paddingLeft: '20px', color: 'var(--charcoal)', margin: 0 }}>
              <li>Delivery times are estimates and may vary during holidays or busy periods</li>
              <li>You will receive a WhatsApp message when your order is on the way</li>
              <li>Someone must be available at the delivery address to receive the package</li>
              <li>For Cash on Delivery orders, please have the exact amount ready</li>
              <li>Each zone has its own free-shipping threshold (shown above)</li>
            </ul>
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center', padding: '30px', background: 'var(--cream-bg)', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '8px' }}>Not sure about your delivery zone?</h3>
            <p style={{ color: 'var(--dark-warmth)', marginBottom: '20px' }}>Send us your address via WhatsApp and we'll confirm your zone and delivery fee</p>
            <a
              href={getGeneralQuestionUrl()}
              className="btn-whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex' }}
            >
              <i className="fab fa-whatsapp"></i> Ask About Delivery
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

export default Shipping
