# Prompt: reconstruir la base de datos de Unistyles desde cero

> Para pegar en la IA del developer que va a rehacer la base de datos.
> Escrito el 25-oct-2026. Repo: github.com/OfteaHeat1997/Unistyles-Website (rama `master`).
> Copia todo lo que hay debajo de la línea.

---

## Rol

Eres un software engineer senior especializado en modelado de datos, PostgreSQL y despliegue con Docker.
Vas a ayudarme a **rediseñar e implementar desde cero la base de datos** de una tienda online real (no es un
proyecto académico). Trabaja con el código real del repositorio. Si algo no lo puedes confirmar en el código,
dilo explícitamente en lugar de inventarlo.

## 1. El negocio

Unistyles Curaçao: tienda online de una dueña en Curaçao. Vende 9 categorías: bras, panties, shapewear,
colonias (perfumes), cremas, bloqueador, desodorantes, limpieza facial y accesorios/joyería.
Inventario actual: **285 productos**. Solo los bras tienen variantes (talla + color, 77 SKUs).
Moneda: XCG/ANG. Pagos con **Sentoo** (pasarela local). Avisos por **WhatsApp** y email. Entregas por zonas de la isla.

Las fuentes de verdad del inventario están **fuera del repo**: documentos Word de catálogo y fotos en Google Drive.
Te los voy a pasar aparte. El repo tiene una versión derivada en `database/seed-data.json`.

## 2. Stack actual

- **Frontend**: React + Vite, servido por nginx (`services/frontend`). Usa React Query.
- **Backend**: Node/Express (`services/backend`). Rutas en `src/routes/*.js`; la carpeta `controllers/` está vacía.
- **CMS**: Directus 11 (`services/directus/bootstrap.js` crea sus colecciones). **Quédate en Directus 11, no 12.**
- **Base de datos**: PostgreSQL **16** (no 18, por compatibilidad con Directus 11). Una sola BD `unistyles_db`,
  usuario `unistyles`, compartida entre Directus y el backend.
- **Redis**: sesiones y caché.
- **Infra**: un VPS en Contabo (Ubuntu 24.04, 6 cores, 11,7 GB RAM) con **Coolify v4.3.x** instalado.
  Cloudflare delante del dominio.

## 3. Despliegue en Coolify: estado actual

Arquitectura elegida (“Plan A”): **cada servicio es un recurso separado de Coolify**, sin docker-compose.
El motivo es que un redeploy del compose borró el volumen de Postgres y se perdió la BD.
Si cae un servicio, los demás siguen funcionando.

| Recurso | Tipo | Estado | Dominio |
|---|---|---|---|
| `unistyles-postgres` | Database (postgres:16-alpine, backups automáticos) | Running | interno |
| redis (`redis-database-dzmrnt…`) | Database | Running | interno |
| `unistyles-directus` | App, imagen Docker, puerto 8055, volumen `/directus/uploads` | Running | cms.unistylescuracao.com |
| backend (`unistyles--website:main-pl7f…`) | App, Dockerfile, base dir `/services/backend`, puerto 3000 | Running | api.unistylescuracao.com |
| frontend | App, Dockerfile, base dir `/services/frontend` | Pendiente de confirmar qué recurso sirve el dominio raíz | unistylescuracao.com |

Hay recursos sobrantes que se borrarán cuando todo esté en verde: el compose viejo (`unistyles--website:main-t8jw…`, Exited),
un app `unistyles` sin identificar, un `Frontend/service` y un `Unistyles n8n`.

Fases de despliegue: 1 Postgres ✅ · 2 Redis ✅ · 3 Directus ✅ · 4 backend ✅ · 4-bis tablas ✅ (con `init.sql` **v1**) ·
**5 frontend ⏳ · 6 cargar catálogo ⏳ (a medias) · 7 verificación · 8 borrar recursos viejos**.

Gotchas de Coolify ya confirmados:
- Una BD gestionada **no ejecuta** `docker-entrypoint-initdb.d`. El esquema se aplica a mano con `psql` desde el Terminal del recurso.
- En Coolify 4.3.10+ el campo Branch queda bloqueado en `main` al crear el recurso; hay que cambiarlo a `master` después en Git Source.
- Dominio con puerto: `api.unistylescuracao.com:3000` (la sintaxis de Coolify para enrutar al puerto del contenedor).
- Variables de entorno de build del frontend: `VITE_API_URL`, `VITE_DIRECTUS_URL`, `VITE_USE_CMS`.
- Los secretos **no** están en el repo (es público). Te los paso aparte. Nunca los escribas en ningún archivo versionado.

Documentación existente en el repo: `docs/COOLIFY-SEPARATED-SETUP.md`, `docs/COOLIFY-FASE4-5-PASO-A-PASO.md`,
`deploy/separated/*.env.example`, `docs/DATABASE_ARCHITECTURE.md`, `docs/research/05-base-de-datos.html`.

## 4. Base de datos actual: por qué hay que rehacerla

Hoy hay **dos dueños de datos en la misma BD**:
- **Directus** es dueño del catálogo: `products, categories, brands, pages, customers, business_settings, homepage, directus_files`.
- **SQL propio** es dueño del comercio: `users, addresses, carts, orders, order_items, payments, coupons,
  product_variants, reviews, newsletter_subscribers, settings, whatsapp_messages` (+ en v2: `delivery_zones,
  order_status_history, coupon_redemptions`).

Defectos verificados:
1. **Dos esquemas**: `database/init.sql` (v1, el que está aplicado en producción) y `database/init.v2.sql`
   (v2, mejor: CHECK constraints, precios congelados en `order_items`, FKs hacia Directus añadidas al final con guardas,
   idempotente). v2 usa `IF NOT EXISTS`, así que **no corrige tablas ya creadas por v1**.
2. **`reviews.product_id` es UUID en v1**, pero los productos de Directus tienen id entero → `GET /api/reviews/product/:id` da 500.
3. **La columna `users.role` no existe**, pero `routes/auth.js` (~l.295) hace `SELECT … role …` y `pages/Admin.jsx`
   comprueba `user.role === 'admin'`. La tabla tiene `is_admin BOOLEAN`, que es lo que usa `middleware/auth.js`.
   Resultado: `/api/auth/me` falla y el admin es inaccesible.
4. **Variantes y stock duplicados**: `products.variants` es un campo **JSON** en Directus y además existe la tabla
   `product_variants`, que nadie sincroniza. `products.stock_quantity` e `in_stock` también son independientes entre sí.
5. **Talla y color son texto libre**: hay 24 cadenas de talla para unas 10 tallas reales (`38B`, `38 B`, `38  B`, typo `368C`, S/M/L mezclado con tallas de bra)
   y colores con typos y duplicados (`BERDE`, `BEIBE`, `NEGRO` y `BLACK`, `BEIGE STAMPADO` y `BEIGE  ESTAMPADO`).
6. **Catálogo duplicado en 4 sitios**: Directus, `frontend/src/config.js`, `frontend/src/data/productData.js`, `database/seed-data.json`.
7. **Migraciones con número repetido**: `001_add_coupons_and_variants.sql` y `001_add_whatsapp_messages.sql`.
8. **Cero tests** en todo el proyecto.

## 5. Por qué el inventario sale mal en la web (verificado en producción el 25-oct-2026)

Los datos en Directus cuadran con el seed (285 productos, conteos por categoría correctos). Los fallos están en cómo
se modelaron y cómo se consultan:

- **La página de Perfumes sale vacía**: `pages/Perfume.jsx` pide la categoría `'perfume'`, pero el slug real es `colonias`.
  `?filter[category_id][slug][_eq]=perfume` → 0 resultados. `colonias` → 133.
- **Faltan productos en las categorías**: `fetchProducts` tiene `limit = 25` por defecto y las páginas no paginan.
  De 33 bras se ven 25, y de 133 colonias también 25.
- **El listado no trae stock ni variantes**: `PRODUCT_LIST_FIELDS` en `services/directusService.js` no incluye
  `stock_quantity` ni `variants`, así que la cuadrícula no puede mostrar tallas, colores ni agotados.
- **Stock incoherente**: 49 productos tienen `stock_quantity = 0` pero `in_stock = true`.
- **Filtros por género vacíos**: las 133 colonias tienen `gender = 'unisex'`, así que los filtros mujer/hombre no devuelven nada.
- **Imágenes**: los 285 productos tienen `image = null` (no hay ninguna imagen subida a Directus). Todo depende de
  `legacy_image`, una ruta estática servida por el frontend (`/images/...`).
- **Nombres generados mal**: p. ej. `Leonisa BraESTAMPADOC` o `Leonisa BraSTAMPADO` (concatenación sin espacio en el script de importación).
  Hay 16 nombres duplicados.

## 6. Lo que te pido

### Paso 1: entender (no escribas código todavía)
Lee primero: `database/init.sql`, `database/init.v2.sql`, `database/migrations/*`, `services/directus/bootstrap.js`,
`services/backend/src/routes/*.js`, `services/backend/src/middleware/auth.js`, `services/frontend/src/services/directusService.js`,
`services/frontend/src/hooks/useProducts.js`, `database/seed-data.json` y `deploy/scripts/migrate-strapi-to-directus.js`.
Después dame un resumen de qué tabla o colección usa cada ruta del backend y cada página del frontend.

### Paso 2: decisiones de arquitectura (dame tu recomendación y su porqué)
- **¿Quién es el dueño del catálogo?** Opción A: Directus (el panel de la dueña para editar productos).
  Opción B: tablas SQL propias, con Directus solo como panel sobre ellas. Debe existir **una sola fuente de verdad**.
- **Variantes como tabla, no JSON**: `product_variants` con SKU único, stock por variante y precio por variante,
  y con FK real a `products`.
- **Vocabularios controlados**: tablas `sizes` y `colors` (o el equivalente en Directus) con FK, para que no se repitan los typos.
- **Stock**: una sola columna y `in_stock` derivado, no almacenado aparte.
- **Roles**: `is_admin` o `role`. Elige una y alinea backend + frontend.
- **Imágenes**: subirlas a Directus (`directus_files`) o servirlas estáticas. Ten en cuenta que son ~900 fotos originales (1,5 GB)
  que conviene optimizar antes.

### Paso 3: diagramas (Mermaid, que se vean en GitHub)
1. **ERD completo** del esquema nuevo (`erDiagram`): PK, FK y cardinalidades, y las tablas de Directus marcadas como tales.
2. **Flowchart del flujo de datos del inventario** (`flowchart TD`): Word/Drive → limpieza/normalización → seed →
   carga a la BD → Directus → API → página de la tienda.
3. **Flowchart de despliegue en Coolify** (`flowchart LR`): Cloudflare → los 5 recursos → qué habla con qué y por qué puerto.
4. **Secuencia del checkout** (`sequenceDiagram`): carrito → cupón → zona de entrega → pedido → Sentoo → webhook →
   cambio de estado → WhatsApp/email, con los casos de fallo.
5. **Diagramas de estado** (`stateDiagram-v2`) de `orders.status` y `payments.status` con los valores reales.
6. **Flowchart del procedimiento de reconstrucción** (Paso 5).

### Paso 4: implementación
- Un **único** `database/schema.sql` idempotente (o migraciones numeradas sin repetir, con una herramienta real:
  node-pg-migrate, Knex o la que recomiendes) que sustituya a `init.sql` e `init.v2.sql`.
- Un **script de importación** reproducible que lea los catálogos limpios y cargue el inventario normalizando tallas,
  colores y nombres. Que valide e informe de los errores en lugar de cargar basura.
- Ajustes en el backend y el frontend que dependan del esquema: `role`/`is_admin`, `reviews.product_id`, slug de perfumes,
  paginación, campos del listado y stock.
- **Tests**: como mínimo, pruebas del esquema (constraints, FKs) y del import (los conteos por categoría coinciden con la fuente).

### Paso 5: plan para aplicarlo en Coolify (sin perder datos)
- Backup primero: `pg_dump` desde el Terminal de `unistyles-postgres` y descarga del dump.
- Hoy no hay pedidos ni clientes reales, así que se puede hacer un **drop y recreación limpia** de las tablas del backend.
  Confírmalo antes consultando `SELECT count(*)` en `users` y `orders`.
- Orden exacto de comandos: esquema → bootstrap de Directus → FKs → import → verificación.
- Checklist de verificación con URLs reales: `https://api.unistylescuracao.com/health`,
  `https://cms.unistylescuracao.com/items/products?aggregate[count]=*`, y que cada página de categoría muestre su total real.

## 7. Reglas
- Nada destructivo en producción sin backup verificado y sin que yo lo confirme.
- Ningún secreto en archivos del repo. El repo es **público**.
- PostgreSQL 16 y Directus 11. No actualizar versiones durante este trabajo.
- Cita el archivo (y la línea) de cada afirmación sobre el código actual.
- Si algo está a medias o no está claro, escribe **“No implementado / no claro:”** en vez de suponer.
