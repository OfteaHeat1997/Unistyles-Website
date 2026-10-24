# Unistyles Curaçao — Inventario completo de lo que ya existe

**Fecha:** 26 de agosto de 2026
**Alcance:** todo. Frontend, backend, diseño, datos, CMS, integraciones, infraestructura.
**Método:** barrido directo del repositorio. Todo lo que aparece aquí se contó o se leyó en el código. Nada está estimado.
**Documento hermano:** `INVESTIGACION-ECOMMERCE-PROFESIONAL.md` cuenta lo que *falta*. Este cuenta lo que *hay*. Los dos juntos son la investigación completa.

---

## Resumen en números

| Capa | Cantidad |
|---|---|
| Páginas del frontend | 27 |
| Rutas declaradas en el router | 29 |
| Componentes React reutilizables | 16 |
| Hooks de datos | 12 |
| Líneas de páginas | 14.922 |
| Líneas de componentes | 2.217 |
| Líneas de CSS propio | 6.347 (`styles/main.css`) |
| Grupos de rutas del backend | 16 |
| Endpoints de API | 70 |
| Líneas de rutas del backend | 4.949 |
| Servicios externos programados | 2 (Sentoo, WhatsApp Cloud API) |
| Colecciones en Directus | 7 |
| Campos del producto en Directus | 45 |
| Tablas en el esquema v2 | 15 |
| Tablas en el esquema en producción | 12 |
| Migraciones SQL | 4 |
| Productos cargados | ~285 |
| Contenedores de la pila | 5 |

---

## 1. Frontend

### 1.1 Las 29 rutas del router

Declaradas en `services/frontend/src/App.jsx`. Todas cuelgan de un `<Layout>` común con cabecera, pie y carrito lateral.

**Catálogo — 10 rutas**
`/` Home · `/bras` · `/panties` · `/shapewear` (las tres usan el mismo componente `Category` con distinto parámetro) · `/perfume` · `/cremas` · `/bloqueador` · `/desodorantes` · `/limpieza-facial` · `/accesorios`

**Producto y marca — 3**
`/product/:id` · `/brand/:brandId` · `/search`

**Compra — 2**
`/checkout` · `/payment/callback`

**Cuenta — 4**
`/login` · `/register` · `/forgot-password` · `/profile` (única ruta envuelta en `ProtectedRoute`)

**Servicio — 3**
`/track-order` · `/wishlist` · `/admin`

**Contenido — 6**
`/about` · `/contact` · `/faq` · `/terms` · `/privacy` · `/shipping`

**Sistema — 1**
`*` NotFound

### 1.2 Las 27 páginas, por tamaño

Seis páginas concentran 9.760 líneas — el 65 % de todo el frontend. Son las de categoría de belleza. **El motivo de ese tamaño no es el catálogo** —los productos los leen de Directus con `useProductsByCategory`— sino que cada una lleva dentro un bloque `<style>` propio de unas mil líneas de CSS:

| Página | Total | CSS incrustado |
|---|---|---|
| `Skincare.jsx` | 1.825 | ~1.011 líneas desde la 814 |
| `Sunscreen.jsx` | 1.805 | ~1.012 desde la 793 |
| `FacialCleansing.jsx` | 1.763 | ~1.011 desde la 752 |
| `Perfume.jsx` | 1.733 | ~900 desde la 833 |
| `Accessories.jsx` | 1.533 | ~880 desde la 653 |
| `PersonalCare.jsx` | 1.111 | ~634 desde la 477 |

Son **~5.450 líneas de CSS repetidas seis veces**, encima de las 6.347 de `main.css`. `Category.jsx`, `Product.jsx` y `Home.jsx` no tienen `<style>` incrustado: usan la hoja común. La diferencia entre unas y otras marca cuál es el patrón bueno.

Lo que sí llevan dentro esas seis páginas, y es contenido de valor: la configuración de filtros, los pasos de rutina, las funciones que derivan atributos del producto (`getConcern`, `getApplicationArea`, `getRoutineStep`, `getKeyIngredients`) y las preguntas del quiz.

| Página | Líneas | Qué es |
|---|---|---|
| `Skincare.jsx` | 1.825 | Cremas, con filtros por tipo de piel y rutina |
| `Sunscreen.jsx` | 1.805 | Bloqueador, con filtros por SPF |
| `FacialCleansing.jsx` | 1.763 | Limpieza facial |
| `Perfume.jsx` | 1.733 | Perfumes + quiz de fragancia |
| `Accessories.jsx` | 1.533 | Accesorios |
| `PersonalCare.jsx` | 1.111 | Desodorantes y cuidado personal |
| `Category.jsx` | 716 | Motor genérico de categoría — sirve bras, panties y shapewear |
| `Checkout.jsx` | 627 | Compra en tres pasos |
| `Product.jsx` | 561 | Ficha de producto |
| `Profile.jsx` | 548 | Cuenta: datos, direcciones, pedidos, contraseña |
| `Admin.jsx` | 386 | Panel de administración |
| `PaymentCallback.jsx` | 318 | Vuelta desde Sentoo, con estado en vivo |
| `Home.jsx` | 314 | Portada |
| `About.jsx` | 213 | Nosotros |
| `Register.jsx` | 197 | Registro |
| `Shipping.jsx` | 194 | Envíos, con el mapa de zonas |
| `Brand.jsx` | 164 | Página de marca |
| `Login.jsx` | 155 | Inicio de sesión |
| `TrackOrder.jsx` | 138 | Seguimiento por número de pedido |
| `Contact.jsx` | 132 | Contacto |
| `Search.jsx` | 125 | Resultados de búsqueda |
| `ForgotPassword.jsx` | 109 | Solicitud de recuperación |
| `Wishlist.jsx` | 85 | Lista de deseos |
| `FAQ.jsx` | 73 | Preguntas frecuentes |
| `Terms.jsx` | 42 | Términos |
| `Privacy.jsx` | 39 | Privacidad |
| `NotFound.jsx` | 16 | 404 |

### 1.3 Los 16 componentes

| Componente | Líneas | Qué hace |
|---|---|---|
| `HeroSlider.jsx` | 352 | Carrusel de portada con efecto Ken Burns |
| `Header.jsx` | 347 | Cabecera con navegación, buscador, carrito y cuenta |
| `NewReleasesCarousel.jsx` | 322 | Carrusel de novedades |
| `CartSidebar.jsx` | 226 | Carrito lateral: cantidades, envío por WhatsApp, ir a checkout |
| `DeliveryMap.jsx` | 174 | Mapa Leaflet de Curaçao con las tres zonas como polígonos y detección por GPS |
| `AddressAutocomplete.jsx` | 159 | Autocompletado de dirección real vía Nominatim, con detección de zona |
| `QuickViewModal.jsx` | 149 | Vista rápida de producto sin salir del listado |
| `ProductCard.jsx` | 102 | Tarjeta de producto |
| `Footer.jsx` | 76 | Pie con enlaces y redes |
| `ErrorBoundary.jsx` | 61 | Captura de errores de React para que la página no se quede en blanco |
| `ProtectedRoute.jsx` | 60 | Guarda de ruta autenticada |
| `SplashScreen.jsx` | 59 | Pantalla de entrada de marca |
| `AnimatedLogo.jsx` | 50 | Logo animado con cinco animaciones propias |
| `Layout.jsx` | 38 | Esqueleto común de todas las páginas |
| `ProductSkeleton.jsx` | 28 | Esqueleto de carga del catálogo |
| `ScrollToTop.jsx` | 14 | Vuelve arriba al cambiar de ruta |

### 1.4 Los 12 hooks de datos

Todos en `hooks/`, construidos sobre React Query — es decir, con caché, reintentos y estados de carga y error resueltos:

`useProducts` · `useProduct` · `useProductsByCategory` · `useProductSearch` · `usePrefetchProducts` · `useCategories` · `useCategory` · `useBrands` · `useHomepage` · `usePage` · `useBusinessSettings` · `useDeliveryZones`

Los cuatro últimos son importantes: significan que el frontend ya sabe leer de Directus la portada, las páginas de contenido y los ajustes del negocio. La tubería existe aunque hoy los textos sigan escritos en el código.

### 1.5 Servicios, estado y utilidades del cliente

- `services/directusService.js` — cliente del CMS, 408 líneas.
- `services/cartService.js` — carrito contra el backend, con identificador de carrito de invitada.
- `stores/cartStore.js` — estado del carrito en el cliente.
- `contexts/AuthContext.jsx` — sesión, registro, login, logout, persistencia.
- `utils/api.js` — cliente HTTP con el token adjunto.
- `utils/whatsapp.js` — **siete generadores de enlace a WhatsApp**: consulta general, consulta de producto (con nombre, referencia, talla y color), pedido desde el carrito, pedido desde el checkout (con número de pedido, cliente, dirección, artículos, subtotal, envío y total), ayuda de cuenta, pregunta general y ayuda por categoría.
- `data/curacaoZones.js` — las tres zonas con polígonos, tarifa, umbral de envío gratis y plazo.
- `config/theme.js`, `config/constants.js`, `config.js` — configuración y tema.

---

## 2. Sistema de diseño

### 2.1 La paleta que manda

Definida dos veces en paralelo: como objeto JavaScript en `config/theme.js` y como variables CSS en `styles/main.css`. Ambas coinciden. Es la identidad real de la marca — «neutros cálidos + dorado + teal caribeño».

**Fondos** — `#FFFFFF` tarjetas · `#FAF8F5` página (blanco cálido) · `#F3EDE6` secciones (crema arena)
**Texto** — `#1A1A1A` titulares · `#3A3F45` cuerpo · `#6B6560` secundario · `#9B9490` desactivado
**Dorado, el acento del logo** — `#C5A55A` · `#D4B96E` al pasar el ratón · `#EDD9A3` suave
**Teal caribeño, las acciones** — `#1B4D4F` botón principal · `#24635F` al pasar el ratón · `#1F3347` navy para pie y superposiciones
**Bordes** — `#E6DED8` taupe suave · `#F3EDE6` crema
**Semánticos** — `#3D7A5F` éxito · `#B8862D` aviso de stock bajo · `#A4443A` error

Además hay **21 alias heredados** (`--cream-bg`, `--nude`, `--accent-coral`…) que apuntan a los tokens nuevos. Son el rastro de una paleta anterior; funcionan, pero conviene saber que existen.

### 2.2 Tipografía

- Titulares: **Playfair Display** (serif), pesos 400–700.
- Cuerpo: **Inter**, pesos 300–600.
- Ambas se cargan desde Google Fonts en `index.html`.
- Iconos: Font Awesome 6.4.0 desde CDN.

### 2.3 Escalas

- **Espaciado:** 4 · 8 · 16 · 24 · 32 · 48 · 64 px.
- **Radios:** 4 · 8 · 12 px.
- **Sombras:** tres niveles, todas con opacidad muy baja (0,06 / 0,08 / 0,10) — el estilo es suave, no marcado.

### 2.4 Movimiento

**13 animaciones CSS propias** en `main.css`: `modalSlideIn`, `fadeIn`, `slideUp`, `skeleton-loading`, `spin`, `whatsapp-pulse`, `kenBurns`, y cinco dedicadas solo al logo animado (`alogo-pop-in`, `alogo-float`, `alogo-glow-pulse`, `alogo-glow-burst`, `alogo-spark`).

Además **Framer Motion** en un componente, con 11 usos de `motion.` y 5 de `AnimatePresence`.

### 2.5 Un conflicto que conviene conocer

`tailwind.config.js` declara una paleta y unas fuentes **distintas** a las que usa el sitio: coral `#D4A088`, crema `#FAF7F2`, marrones, y las tipografías Cormorant Garamond + Montserrat. Esas dos fuentes no se cargan en ningún sitio, así que si alguna clase de Tailwind las usa, el navegador cae en la fuente por defecto sin avisar. La paleta viva es la de `theme.js` y `main.css`; la de Tailwind es residuo de una versión anterior.

---

## 3. Backend — los 70 endpoints

Express sobre Node 20. Todo bajo `/api`. Enumerados desde `services/backend/src/routes/`.

### 3.1 Autenticación — `/api/auth` · 9 endpoints
`POST /register` · `POST /verify-email` · `POST /resend-verification` · `POST /login` · `POST /refresh` · `GET /me` · `POST /logout` · `POST /forgot-password` · `POST /reset-password`

**Dato importante:** `POST /reset-password` **sí existe y está terminado en el backend**. Lo que falta es únicamente la página del frontend que lo llame.

### 3.2 Usuarios — `/api/users` · 7 endpoints
`GET /profile` · `PUT /profile` · `PUT /password` · `POST /addresses` · `PUT /addresses/:id` · `DELETE /addresses/:id` · `GET /orders`
Todo el grupo va detrás del middleware `authenticate` aplicado en `index.js:200`.

### 3.3 Carrito — `/api/cart` · 6 endpoints
`GET /` · `POST /add` · `PUT /update` · `DELETE /remove/:productId` · `DELETE /clear` · `POST /merge`
`merge` es el que fusiona el carrito de invitada guardado en Redis con el de la cuenta al iniciar sesión.

### 3.4 Pedidos — `/api/orders` · 5 endpoints
`POST /` (checkout) · `GET /` · `GET /:id` · `GET /track/:orderNumber` · `PUT /:id/cancel`

### 3.5 Pagos — `/api/payments` · 6 endpoints
`POST /cod` contra-entrega · `POST /sentoo` · `POST /sentoo/webhook` · `GET /:orderId/sentoo-status` · `POST /bank-transfer` · `GET /:orderId/status`

### 3.6 Catálogo — 11 endpoints
Productos `/api/products`: `GET /` · `GET /featured` · `GET /search` · `GET /:slug`
Categorías `/api/categories`: `GET /` · `GET /:slug`
Variantes `/api/variants`: `GET /product/:productId` · `POST /` · `PUT /:id` · `DELETE /:id`

### 3.7 Quiz de perfumes — `/api/perfumes` · 5 endpoints
`GET /quiz` · `POST /quiz/results` · `GET /filters` · `GET /` · `GET /:id`
Es el único de este grupo que el frontend llama hoy: `POST /quiz/results`.

### 3.8 Quiz de skincare — `/api/skincare` · 4 endpoints
`GET /quiz` · `POST /quiz/results` · `GET /filters` · `GET /`

### 3.9 Cupones — `/api/coupons` · 5 endpoints
`POST /validate` · `POST /apply` · `GET /` · `POST /` · `DELETE /:id`

### 3.10 Reseñas — `/api/reviews` · 3 endpoints
`GET /product/:productId` · `POST /` · `DELETE /:id`

### 3.11 Envío — `/api/delivery` · 2 endpoints
`GET /zones` · `GET /calculate`
Expone además dos funciones reutilizables: `getZoneByArea` y `getFreeShippingThreshold`.

### 3.12 Administración — `/api/admin` · 7 endpoints
`GET /users` · `GET /users/:id` · `PUT /users/:id` · `DELETE /users/:id` · `GET /orders` · `PUT /orders/:id` · `GET /stats`

### 3.13 WhatsApp — `/api/whatsapp` · 2 endpoints
`GET /webhook` verificación · `POST /webhook` recepción de mensajes

### 3.14 Boletín — `/api/newsletter` · 1 endpoint
`POST /subscribe`

---

## 4. Capa transversal del backend

### 4.1 Middleware de autenticación (`middleware/auth.js`)
Siete piezas: `authenticate`, `optionalAuth`, `adminOnly` (que verifica el rol **contra la base de datos**, no solo contra el token), `generateToken`, `generateRefreshToken`, `blacklistToken` e `isTokenBlacklisted` — estos dos últimos sobre Redis, lo que permite invalidar sesiones de verdad.

### 4.2 Configuración global (`index.js`)
- **Helmet** con política de seguridad de contenido explícita.
- **CORS** con lista blanca construida dinámicamente.
- **Cuatro limitadores de peticiones**: general sobre `/api/`, uno específico para `/api/auth/login`, uno para validar y aplicar cupones, y uno para reseñas. El webhook de Sentoo está deliberadamente exento para que nunca se rechace un aviso de pago.
- **Identificador de petición** propio y registro con `winston` + `morgan`.
- **Compresión** activada.
- Cuerpo JSON hasta 10 MB, con lectura del cuerpo en crudo para el webhook de WhatsApp (necesario para verificar la firma).
- **Socket.IO** para el estado de pago en vivo.

### 4.3 Utilidades
`db.js` (55) · `redis.js` (25) · `logger.js` (81) · `images.js` (46) · `validateEnv.js` (44, valida las variables al arrancar y no deja levantar el servidor si falta alguna) · `notifications.js` (388).

### 4.4 `notifications.js` — lo que el sistema ya sabe enviar
Con reintentos automáticos (`withRetry`, hasta 3 intentos) y transporte SMTP por Nodemailer:
- `sendOrderConfirmation` — correo «Order Confirmed – UNI-…» con los artículos.
- `sendVerificationEmail` — verificación de cuenta.
- `sendPasswordResetEmail` — recuperación de contraseña.
- `sendOrderStatusUpdate` — aviso de cambio de estado.
- `sendWhatsAppNotification` — aviso de pedido por WhatsApp.
- `sendWelcomeMessage` — bienvenida.
- `getWhatsAppLink` — enlace de respaldo `wa.me` cuando la plantilla de Meta no está aprobada.

### 4.5 `services/sentoo.js` (168 líneas)
Cliente completo del proveedor de pago local: `isConfigured`, `getClient`, `createTransaction` (importe, descripción, moneda, URL de retorno, cliente, caducidad), `fetchStatus` y `cancelTransaction`. Tiene modo **sandbox** y modo real, con URLs distintas para API y para la pasarela de pago.

### 4.6 `services/whatsapp.js` (315 líneas)
Cliente de la Cloud API de Meta, versión `v21.0` del Graph API:
- `sendTextMessage`, `sendInteractiveMessage` (menús de botones y listas), `sendTemplateMessage`, `sendMediaMessage`.
- `verifyWebhook` y `verifySignature` — comprobación criptográfica de que el mensaje viene de Meta.
- `parseWebhookPayload`, `normalizePhone`, `logMessage` — cada mensaje entrante y saliente se guarda en la tabla `whatsapp_messages` con dirección, teléfono, identificador de Meta, tipo, contenido, plantilla, estado y pedido asociado.

### 4.7 El bot de WhatsApp (`routes/whatsapp.js`, 355 líneas)
Conversación con estado guardado en Redis. Responde **en papiamentu**. Sabe:
- mostrar un menú de categorías («Mira kategorias») con descripciones,
- pedir un número de pedido y validarlo contra el formato `UNI-XXXXXX-XXXX`, respondiendo `❌ E number di order no ta balido…` si no encaja,
- consultar el estado real del pedido en la base de datos,
- y avisar con `⚠️ Tin un eror buskando bo order…` si la consulta falla.

---

## 5. Datos

### 5.1 Esquema en producción — `database/init.sql`, 12 tablas
`users` · `addresses` · `carts` · `orders` · `order_items` · `payments` · `reviews` · `coupons` · `product_variants` · `delivery_zones` · `newsletter_subscribers` · `settings` · `whatsapp_messages`

### 5.2 Esquema v2 — `database/init.v2.sql`, 15 tablas
Todas las anteriores más **`order_status_history`** y **`coupon_redemptions`**.

Lo que v2 añade además de tablas:
- Restricciones `CHECK` reales sobre los estados. Un pedido solo puede estar en `pending`, `awaiting_payment`, `confirmed`, `processing`… y un método de pago solo puede ser `cod`, `sentoo`, `bank_transfer`, `card` o `whatsapp`.
- **Disparadores automáticos** que escriben en `order_status_history` cada vez que se crea un pedido o cambia su estado. No hay que acordarse de registrarlo: la base de datos lo hace sola.
- Precios congelados en la línea de pedido, para que cambiar el precio de un producto no altere pedidos ya hechos.
- Marcas de tiempo automáticas y claves foráneas condicionales hacia las tablas de Directus.
- Las tres zonas de entrega **sembradas con sus barrios** (`init.v2.sql:535`).

### 5.3 Migraciones
`001_add_coupons_and_variants.sql` · `001_add_whatsapp_messages.sql` · `002_delivery_zones.sql` · `003_address_geocoding.sql`
Ejecutadas por `database/migrate.js`.

### 5.4 Semillas
`seed-data.json` (4.018 líneas) y `seed-example.sql`.

### 5.5 El catálogo, y dónde vive cada copia
- **Directus** — la fuente oficial, ~285 productos. Es de donde leen las páginas hoy.
- `frontend/src/data/productData.js` — 4.042 líneas.
- `database/seed-data.json` — 4.018 líneas.
- `frontend/src/config.js` — 89 líneas con las categorías escritas a mano.

Cuatro copias. Las páginas de belleza **no** son una quinta: leen de Directus como debe ser.

---

## 6. Directus — el CMS

Siete colecciones creadas por `services/directus/bootstrap.js`: **`products`**, **`categories`**, **`brands`**, **`pages`**, **`customers`**, **`business_settings`** y **`homepage`**.

### 6.1 `products` — 45 campos

Es, con diferencia, la pieza mejor diseñada del proyecto.

**Comercio** — `name`, `slug`, `ref`, `description`, `price`, `compare_at_price`, `in_stock`, `stock_quantity`, `featured`, `sort_order`
**Imágenes** — `image`, `gallery`, `legacy_image`, `legacy_id`
**Lencería** — `color`, `size`, `style`, `compression` (light/medium/firm), `material`, `variants`
**Etiquetas** — `badge`: new, bestseller, premium, sale, gift_set, pack_3
**Perfumería, taxonomía completa** — `gender`, `fragrance_family` (floral, oriental, woody, fresh, fruity, gourmand, citrus, aquatic), `scent_profile` (sweet, spicy, musky, powdery, green, aromatic, warm, cool), `intensity`, `occasion` (daily, office, evening, romantic, special, casual, sport), `season`, `top_notes`, `middle_notes`, `base_notes`, `volume`, `concentration` (parfum, edp, edt, cologne, splash)
**Cosmética** — `skin_type`, `skin_concern`, `application_area`, `texture`, `key_ingredients`, `spf`, `dermatologist_tested`, `routine_step` (cleanse, treat, moisturize, protect), `time_of_use`
**Relaciones** — `category_id` → `categories`, `brand_id` → `brands`

Esa taxonomía es exactamente lo que alimenta los quizzes de perfume y skincare, y lo que permitiría filtros avanzados sin escribir nada nuevo.

### 6.2 Las otras colecciones
- **`categories`** — nombre, slug, descripción, miga de pan, imagen, `filter_type` (size / style / category / compression), `filters` en JSON, orden y `show_in_menu`.
- **`brands`** — nombre, slug, descripción, logo, web, país, destacada.
- **`pages`** — título, slug, contenido enriquecido, extracto, imagen destacada, **`seo_title` y `seo_description`**, mostrar en pie, orden. Los campos de SEO ya existen en el CMS; lo que falta es que el frontend los use.
- **`customers`**, **`business_settings`**, **`homepage`**.

---

## 7. Integraciones externas ya programadas

| Servicio | Para qué | Estado del código |
|---|---|---|
| **Sentoo** | Pago local de Curaçao, conectado a MCB y otros bancos | Completo, con sandbox y producción |
| **WhatsApp Cloud API (Meta)** | Bot en papiamentu, plantillas, mensajes interactivos | Completo, con verificación de firma |
| **SMTP / Nodemailer** | Seis correos transaccionales con reintentos | Completo |
| **Socket.IO** | Estado de pago en vivo en `/payment/callback` | Completo |
| **Leaflet + OpenStreetMap** | Mapa de zonas con polígonos | Completo |
| **Nominatim** | Autocompletado de direcciones reales de Curaçao | Completo |
| **Geolocalización del navegador** | Botón «detectar mi zona» | Completo |
| **Directus** | CMS del catálogo y el contenido | Completo |
| **Redis** | Carrito de invitada, lista negra de tokens, estado del bot | Completo |

---

## 8. Envío: las tres zonas

Definidas dos veces —en `frontend/src/data/curacaoZones.js` con sus polígonos, y en la base de datos con sus barrios.

| Zona | Tarifa | Envío gratis desde | Plazo |
|---|---|---|---|
| 1 — Centro | XCG 5 | XCG 75 | 1–2 días laborables |
| 2 — Este | XCG 10 | XCG 100 | 1–2 días laborables |
| 3 — Oeste y Norte | XCG 25 | XCG 150 | 2–3 días laborables |

Barrios catalogados: Willemstad, Punda, Otrobanda, Pietermaai, Scharloo, Jan Thiel, Blue Bay, Saliña, Mahaai, Cas Grandi, Banda Abou, Banda Ariba, Tera Kòrá, Groot Kwartier.

Cada pedido guarda la zona y las coordenadas de entrega.

---

## 9. Infraestructura

**La pila, de abajo arriba:**
1. **Contabo** — el servidor (VPS). Entrega un Linux encendido y nada más.
2. **Coolify** — orquesta encima: construye las imágenes, las levanta, renueva TLS, guarda las variables.
3. **Cinco contenedores** — frontend, backend, Directus 11, PostgreSQL 16-alpine y Redis 7-alpine.

**Lo que ya existe alrededor:**
- `docker-compose.yml` con los cinco servicios.
- Cuatro Dockerfiles: producción y desarrollo, para frontend y backend.
- `.env.coolify.example` y tres plantillas más en `deploy/separated/`.
- `deploy/scripts/backup-db.sh` y `deploy/scripts/migrate-strapi-to-directus.js`.
- Documentación de despliegue: `deploy/separated/01-databases-notes.md`, `docs/COOLIFY-SEPARATED-SETUP.md`, `docs/COOLIFY-FASE4-5-PASO-A-PASO.md`.
- `.github/workflows/ci.yml` con tres trabajos: backend (levanta Postgres y Redis reales, carga el esquema, aplica migraciones y comprueba `/health`), frontend (instala y construye) y docker (construye ambas imágenes).

---

## 10. Seguridad ya implementada

- Contraseñas con **bcrypt**.
- Consultas **parametrizadas** en todo el acceso a datos.
- Rol de administración verificado **contra la base de datos**, no solo contra el token.
- **Helmet** con política de seguridad de contenido explícita.
- **CORS** con lista blanca.
- **Cuatro limitadores** de peticiones, con exención deliberada para el webhook de Sentoo.
- Respuestas de login **a prueba de enumeración** — no revelan si un correo existe.
- **Lista negra de tokens** en Redis: cerrar sesión invalida de verdad.
- **Verificación de firma** en el webhook de WhatsApp.
- **Re-verificación** del webhook de pago contra Sentoo: no se fía del mensaje entrante.
- Checkout **transaccional** con `SELECT … FOR UPDATE` sobre las filas de producto antes de descontar stock (`orders.js:63`), y comprobación de stock suficiente antes de confirmar.
- **Validación de variables de entorno** al arrancar: si falta una crítica, el servidor no levanta.
- Límite de 10 MB en el cuerpo de las peticiones.

---

## 11. Lo que este inventario deja claro

1. **El backend está terminado en más sitios de los que se cree.** `POST /reset-password` existe; el quiz de skincare tiene sus cuatro endpoints; el panel de administración tiene siete. Lo que falta es, en varios casos, solo la pantalla que los llame.
2. **`init.v2.sql` ya resuelve problemas que parecían pendientes.** `order_status_history` no solo existe: se rellena sola con disparadores. `coupon_redemptions` también. Lo que falta es declararlo oficial y migrar producción.
3. **Directus es el activo más infravalorado.** 45 campos de producto con taxonomía completa de perfumería y cosmética, y campos de SEO en `pages` que nadie está usando todavía.
4. **Las seis páginas grandes no son un problema de catálogo, sino de CSS.** Leen de Directus correctamente; lo que las infla son ~5.450 líneas de estilos incrustados repetidos entre ellas. Sacarlos a `main.css` reduce el frontend en más de un tercio sin tocar ni una funcionalidad. El catálogo sí está duplicado, pero en otros cuatro sitios.
5. **Hay dos sistemas de diseño en el repositorio.** El vivo (dorado + teal, Playfair + Inter) y uno residual en `tailwind.config.js` (coral, Cormorant + Montserrat) cuyas fuentes ni siquiera se cargan.
6. **La capa de seguridad es seria de verdad**, y merece describirse como tal en la investigación en vez de darla por supuesta.
