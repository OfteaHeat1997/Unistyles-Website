# PROMPT — Arreglos de la auditoría (10-oct-2026)

Fuente: `Unistyles_Research_Auditoria_y_Plan_2026.docx`. Estado previo: `docs/IMPLEMENTATION-STATUS.md` (25-oct).
Ejecutar los pasos **en orden**. Un paso = un commit. No avanzar si las pruebas del paso fallan.

---

## Reglas para el agente

- Trabaja en `unistyles-website-v2` (backend `services/backend`, frontend `services/frontend`, BD `database/`).
- Antes de tocar algo, lee el código actual: muchos puntos ya están hechos (D01–D22). Verifica, no reescribas.
- Cada paso termina con: código + prueba (unit o integración en `services/backend/test/`) + línea actualizada en
  `docs/IMPLEMENTATION-STATUS.md` con estado *Verified / Implemented / Pending*.
- Nada de valores inventados (stock, precios, fotos, zonas). Si falta un dato, déjalo configurable y márcalo
  *pending approval* en Settings.
- Montos en ANG, cálculo en céntimos (`services/pricing.js`).

---

## Fase 1 — Reparar la compra (P0)

### Paso 1. Carrito
1. Reproduce: agregar variante → abrir `CartSidebar` → cambiar cantidad → eliminar → ir a checkout.
2. Revisa `stores/cartStore.js`, `services/cartService.js`, `routes/cart.js`.
3. Criterios: la línea guarda `variant_id`, talla, color, SKU y precio correctos; cantidad editable con tope de
   stock; eliminar funciona; total se recalcula; carrito persiste al recargar y al iniciar sesión (merge invitado →
   usuario sin duplicar líneas).
4. Prueba de integración: añadir, editar, eliminar, merge.

### Paso 2. Talla / color
1. `pages/Product.jsx`: mostrar solo combinaciones existentes; deshabilitar y marcar "Agotado" las sin stock.
2. Al cambiar variante se sincronizan imagen, precio, SKU y stock.
3. No se puede agregar al carrito sin elegir variante cuando el producto tiene variantes (backend también lo rechaza).
4. Cada combinación talla-color = SKU + stock propio (verificar esquema `product_variants`).
5. Prueba: combinación inexistente → 422; agotada → 409.

### Paso 3. Regla de delivery (100 ANG)
1. Cambiar default en `services/settings.js` y `migrations/004` (o nueva migración 005):
   `free_delivery_threshold = 100`, `free_delivery_rule = 'gte'`.
2. Base del umbral: subtotal de productos **después de descuentos, antes del delivery**.
3. Tarifas por zona: cercana 10 ANG, lejana 20 ANG (configurables en `delivery_zones`).
4. Pickup siempre 0 ANG y exige franja/cita confirmada.
5. UI (carrito y checkout): "Te faltan X ANG para delivery gratis", se actualiza con cantidad, cupón o productos.
6. Pruebas unitarias en `pricing` con la tabla:

| Subtotal | Zona | Delivery | Total |
|---|---|---|---|
| 80 | cercana | 10 | 90 |
| 80 | lejana | 20 | 100 |
| 99,99 | ambas | 10 / 20 | — |
| 100,00 | ambas | 0 | 100 |
| 100,01 | ambas | 0 | 100,01 |
| 120 | ambas | 0 | 120 |
| 110 con cupón −15 | cercana | 10 | 105 |

### Paso 4. Página de preguntas frecuentes
1. En `pages/FAQ.jsx` (y enlazar desde `Shipping.jsx` y el checkout) publicar la regla completa: umbral 100 ANG,
   base de cálculo, tarifas por zona, pickup sin coste, zonas cubiertas, días/tiempos de reparto, qué pasa si el pedido
   se modifica o devuelve.
2. Los valores se leen de `/api/settings` público, no se escriben a mano, para que FAQ y checkout nunca difieran.

### Paso 5. Checkout y pago de punta a punta
1. Recorrer en navegador: dirección → delivery/pickup → tarifa → pago → confirmación.
2. Confirmar que funcionan: `Idempotency-Key` (sin pedidos duplicados), cotización en servidor, pago confirmado una
   vez, expiración de no pagados.
3. Pago fallido: mensaje claro + reintento, sin descontar stock.
4. Escribir la suite Playwright pendiente (spec §5.17) cubriendo el checklist de la Fase 4.

### Paso 6. Inventario
1. Stock se descuenta solo en el evento definido (reserva al crear pedido, liberación si expira, definitivo al pagar).
   Documentar el evento elegido en `IMPLEMENTATION-STATUS.md`.
2. Bloqueo de fila al reservar: dos clientes, última unidad → solo uno compra.
3. Pedidos manuales (admin/WhatsApp) también descuentan stock por el mismo servicio.

---

## Fase 2 — Catálogo

### Paso 7. Estructura de menú y marcas
1. Menú: Brasieres / Tallas plus / Fajas y moldeadores / Panties / Leggings / Joyería / Perfumes y belleza /
   Ofertas / Novedades. Categorías en BD, no hardcodeadas (eliminar duplicados del catálogo en el frontend).
2. Marcas: Leonisa, Glamorise, Farmasi. Campo `is_active`: una marca sin productos confirmados no se muestra.

### Paso 8. Glamorise
1. Marca + categoría "Brasieres plus".
2. Atributos filtrables: contorno, copa, soporte, cobertura, color, disponibilidad.
3. Guía de medidas/ajuste (componente reutilizable en la ficha).
4. Cargar solo productos reales con fotos autorizadas (dato pendiente de dirección).

### Paso 9. Farmasi
1. Marca + subcategorías (maquillaje, cuidado personal…) solo si hay referencias reales.
2. Campos extra en ficha: ingredientes, modo de uso, caducidad.

### Paso 10. Ficha estándar
Campos obligatorios: nombre, marca, SKU, precio ANG, fotos, descripción, tallas, colores, composición,
instrucciones, stock, "por encargo" (plazo 2–3 días, solo si aplica, nunca contado como stock disponible) y política
aplicable. Validar en admin que no se publique una ficha incompleta.

---

## Fase 3 — Operaciones

### Paso 11. Pedidos
Estados: recibido, pendiente de pago, pagado, preparando, en ruta, entregado, cancelado, devuelto. Historial con
fecha y responsable (verificar contra `orderState.js`; añadir `devuelto` si falta).

### Paso 12. Pagos
Sentoo + Visa/Mastercard en sandbox; conciliación (CSV de admin), pagos fallidos, pedidos no pagados. Queda
*Pending* hasta tener credenciales.

### Paso 13. Delivery y pickup
Aviso 30 min antes (WhatsApp), confirmación de entrega con PIN y foto en `Driver.jsx`; fotos con acceso restringido.
Pickup con ventana horaria confirmada.

### Paso 14. WhatsApp
Plantillas por estado con datos reales del pedido. Ninguna respuesta automática puede inventar stock, fotos, precios
ni condiciones.

### Paso 15. Políticas
Devoluciones por categoría (panties: reclamación por error en 48 h), privacidad, términos, contacto visibles en
`Terms.jsx`, `Privacy.jsx`, `FAQ.jsx`. Texto leído de Settings.

### Paso 16. Analítica
Eventos: vista de producto, agregar al carrito, inicio de checkout, compra (Meta Pixel + GA4). Panel admin semanal:
conversión, carritos abandonados, pedidos, ticket promedio, más vendidos.

---

## Fase 4 — Calidad y seguridad

### Paso 17. Móvil
Navegación, buscador, filtros, velocidad, legibilidad, accesibilidad (Lighthouse ≥ 90 en móvil).

### Paso 18. Checklist de aceptación (automatizar en Playwright)
- [ ] Brasier con talla y color concretos → variante y precio correctos en el carrito.
- [ ] Talla/color agotados, cambio de cantidad, eliminación.
- [ ] Delivery con 99,99 / 100,00 / 100,01 ANG en ambas zonas.
- [ ] Cupón que baja el subtotal por debajo de 100 ANG → vuelve a cobrar delivery.
- [ ] Pickup sin delivery.
- [ ] Pedido de prueba: confirmación, pago, stock actualizado.
- [ ] Fichas Glamorise y Farmasi en Android/iPhone (viewport).
- [ ] Políticas, WhatsApp, contacto y tiempos visibles.
- [ ] Pedido manual actualiza inventario.

---

## Decisiones de dirección (no bloquean el código, sí el lanzamiento)

1. 100 ANG después de descuentos (recomendado) — confirmar.
2. Lista de zonas cercanas / lejanas / excluidas.
3. Catálogo inicial, precios, márgenes, fotos y stock de Glamorise y Farmasi.
4. Fuente única de inventario (Airtable o servidor) y quién aprueba cambios.
5. Política de devoluciones y revisión legal.
6. Pasarela de pagos, impuestos y pedidos no pagados.
7. Fecha de lanzamiento solo tras superar la Fase 4.
