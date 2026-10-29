# Prompt para ChatGPT — Coolify con contenedores separados

Copia todo lo que está dentro del bloque de abajo y pégalo en ChatGPT.
**No pegues contraseñas reales en ChatGPT** — usa los marcadores `REEMPLAZAR_…`
y rellénalos tú directamente en Coolify.

```text
Eres un experto en Coolify v4, Docker y despliegues de producción. Ayúdame paso a paso,
con clics exactos y en español sencillo (no soy experta en servidores). Dame UNA fase
a la vez y espera a que te confirme que está en verde antes de pasar a la siguiente.

## Mi proyecto
- Tienda online "Unistyles" (Curaçao). Repo: https://github.com/OfteaHeat1997/Unistyles-Website (rama master).
- Servidor: VPS Ubuntu 24.04, IP 157.173.193.90, 6 cores, 11.7 GB RAM. Coolify v4 instalado
  en el mismo servidor (por eso el servidor se llama "localhost" en Coolify; es normal).
- Panel de Coolify: cloud.unistylescuracao.com. Proxy: Traefik (por defecto), SSL Let's Encrypt.
- DNS: unistylescuracao.com, api.unistylescuracao.com y cms.unistylescuracao.com apuntan a 157.173.193.90.

## Qué quiero
Antes tenía los 5 servicios TODOS JUNTOS en un solo recurso "Docker Compose" (docker-compose.yaml
en la raíz del repo). Si se rompía, se caía todo y llegué a perder la base de datos.
Quiero 5 RECURSOS SEPARADOS en Coolify (contenedores independientes, mismo servidor):

DATABASES
  - unistyles-postgres  (postgres:16-alpine, user "unistyles", db "unistyles_db", backups diarios ON)
  - unistyles-redis     (redis:7-alpine, con contraseña)
APPLICATIONS
  - unistyles-directus  (CMS)    Docker Image directus/directus:11 → https://cms.unistylescuracao.com, puerto 8055,
                                 volumen persistente en /directus/uploads
  - unistyles-backend   (API)    Application desde el repo, Build Pack Dockerfile, Base Directory /services/backend,
                                 Dockerfile /Dockerfile → https://api.unistylescuracao.com, puerto 3000
  - unistyles-frontend  (Tienda) Application desde el repo, Build Pack Dockerfile, Base Directory /services/frontend,
                                 Dockerfile /Dockerfile → https://unistylescuracao.com, puerto 80

Stack: frontend Vite + Nginx; backend Node/Express + Socket.IO; Directus 11 como CMS de productos;
Directus y el backend comparten la misma base de datos unistyles_db.

## Estado actual (comprobado el 22 ago 2026)
- ✅ unistyles-postgres: funcionando.
- ✅ Redis: funcionando (recurso llamado redis-database-dzmrnt3yx4godrkflyvv5rqf).
- ✅ unistyles-directus: https://cms.unistylescuracao.com/server/health responde {"status":"ok"}.
- ⚠️ Tienda: https://unistylescuracao.com carga, pero no sé si la sirve el bloque viejo (Docker Compose 5-en-1)
  o un recurso nuevo llamado "unistyles". Hay que identificarlo.
- ❌ Backend/API: NO existe todavía. api.unistylescuracao.com no responde.
- Pendiente: crear las tablas del backend (database/init.sql) en la base de datos nueva.
- El bloque viejo 5-en-1 y un recurso huérfano "postgresql-database" siguen ahí; NO borrarlos hasta el final.

## Variables de entorno

### Backend (Environment Variables normales; marcar como Secret las contraseñas)
Los hosts internos los da Coolify en la pantalla de cada base de datos ("Postgres URL (Internal)" /
"Redis URL (Internal)"). NO son "postgres" ni "localhost".
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://unistyles:REEMPLAZAR_DB_PASSWORD@REEMPLAZAR_HOST_POSTGRES:5432/unistyles_db
REDIS_URL=redis://:REEMPLAZAR_REDIS_PASSWORD@REEMPLAZAR_HOST_REDIS:6379
JWT_SECRET=REEMPLAZAR_JWT_SECRET   (mínimo 32 caracteres)
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://unistylescuracao.com
DIRECTUS_URL=https://cms.unistylescuracao.com
SITE_URL=https://unistylescuracao.com
WHATSAPP_NUMBER=+59996736285
(WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_VERIFY_TOKEN,
 WHATSAPP_APP_SECRET, SENTOO_API_KEY, SENTOO_MERCHANT_ID pueden ir vacíos; SENTOO_SANDBOX=true)
Si falta DATABASE_URL, REDIS_URL o JWT_SECRET, el contenedor se apaga solo.
Éxito en los logs: "UNISTYLES E-COMMERCE API SERVER ... Status: Running ... Port: 3000".
Comprobación: curl https://api.unistylescuracao.com/health → {"status":"healthy",...}

### Directus (ya funciona, solo como referencia)
KEY, SECRET, ADMIN_EMAIL=admin@unistylescuracao.com, ADMIN_PASSWORD, PUBLIC_URL=https://cms.unistylescuracao.com,
DB_CLIENT=pg, DB_HOST=<host interno postgres>, DB_PORT=5432, DB_DATABASE=unistyles_db, DB_USER=unistyles,
DB_PASSWORD, CACHE_ENABLED=true, CACHE_STORE=redis, REDIS=redis://:<pass>@<host interno redis>:6379,
CORS_ENABLED=true, CORS_ORIGIN=https://unistylescuracao.com

### Frontend — ¡variables de BUILD! (marcar "Is Build Variable?" en cada una)
VITE_API_URL=https://api.unistylescuracao.com
VITE_DIRECTUS_URL=https://cms.unistylescuracao.com
VITE_USE_CMS=true
Vite las mete dentro del paquete al construir; si no son de build, la tienda carga pero se queda girando.

## Fases que faltan (guíame en este orden)
Fase 4 — Crear unistyles-backend (+ New → Application → Public Repository → repo y rama master →
  Build Pack Dockerfile → datos de arriba → variables → Deploy → comprobar /health).
Fase 4-bis — Crear tablas del backend: en Coolify, recurso unistyles-postgres → Terminal →
  psql -U unistyles -d unistyles_db -c '\dt'
  Si solo hay tablas directus_*, ejecutar:
  wget -qO- https://raw.githubusercontent.com/OfteaHeat1997/Unistyles-Website/master/database/init.sql | psql -U unistyles -d unistyles_db
  Deben aparecer 12 tablas: users, addresses, orders, order_items, payments, carts, reviews,
  newsletter_subscribers, settings, coupons, product_variants, whatsapp_messages.
Fase 5 — Frontend: primero averiguar qué recurso sirve hoy unistylescuracao.com. Si ya es una Application
  con Base Directory /services/frontend, renombrarla a unistyles-frontend, revisar las 3 variables de build
  y redeploy. Si es el bloque viejo, crear unistyles-frontend nuevo (quitar antes el dominio del viejo para
  que no choquen).
Fase 6 — Cargar los 285 productos desde mi portátil:
  DIRECTUS_URL=https://cms.unistylescuracao.com DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
  DIRECTUS_ADMIN_PASSWORD=<pass> node services/directus/bootstrap.js
  (mismas variables) node deploy/scripts/migrate-strapi-to-directus.js
Fase 7 — Probar: tienda con productos, /health de la API, login en https://cms.unistylescuracao.com/admin,
  carrito y registro sin errores de red.
Fase 8 — Solo cuando TODO esté en verde: parar y borrar el recurso viejo Docker Compose 5-en-1 y el
  "postgresql-database" huérfano. Antes, confirmar que hay un backup reciente de unistyles-postgres.

## Reglas para ti
- Nunca me pidas que pegue contraseñas reales en el chat; usa marcadores.
- Si te mando una captura o un log de error, dime exactamente qué significa y qué clic hacer.
- No me hagas borrar nada (sobre todo bases de datos o volúmenes) sin avisarme claramente antes.
- Empieza por la Fase 4 y pregúntame qué veo en pantalla.
```
