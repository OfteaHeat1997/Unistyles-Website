import { BUSINESS } from '../config'

function WhatsAppButton() {
  const whatsappUrl = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(BUSINESS.whatsappMessage)}`

  return (
    <div className="whatsapp-float">
      <div className="wa-tooltip">
        <strong>Need help?</strong><br />
        Chat with us on WhatsApp!
      </div>
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp">
        <i className="fab fa-whatsapp"></i>
      </a>
    </div>
  )
}

export default WhatsAppButton
