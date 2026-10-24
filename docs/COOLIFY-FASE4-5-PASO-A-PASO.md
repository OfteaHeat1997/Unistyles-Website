# Coolify — Fase 4 (Backend/API) y Fase 5 (Frontend/Tienda)

> Continuación de `docs/COOLIFY-SEPARATED-SETUP.md`.
> Los valores reales (contraseñas, hosts internos) están en
> **`COOLIFY-SECRETOS-produccion.txt`** (raíz del repo, NO se sube a GitHub).

## Estado comprobado el 22-ago-2026

| Servicio | Recurso en Coolify | Estado real (comprobado desde fuera) |
|---|---|---|
| PostgreSQL | `unistyles-postgres` | ✅ Running (Directus se conecta a él) |
| Redis | `redis-database-dzmrnt3yx4godrkflyvv5rqf` | ✅ Running |
| Directus / CMS | `unistyles-directus` | ✅ `https://cms.unistylescuracao.com/server/health` → `{"status":"ok"}` |
| Tienda | ¿`unistyles`? (por identificar) | ⚠️ `https://unistylescuracao.com` → 200 y muestra la tienda, pero hay que confirmar QUÉ recurso la sirve |
| API / Backend | — | ❌ NO existe. `https://api.unistylescuracao.com` no responde (el DNS sí apunta a 157.173.193.90) |

**Conclusión:** falta la Fase 4 (backend) y confirmar/rehacer la Fase 5 (frontend).

---

## Fase 4 — Backend / API  (`unistyles-backend`)

### 4.1 Crear el recurso

1. Coolify → proyecto **Unistyles** → entorno **production**.
2. **+ New** → **Application** → **Public Repository**.
3. Repository URL: `https://github.com/OfteaHeat1997/Unistyles-Website`
   · Branch: `master` → **Check repository** → **Continue**.
4. Build Pack: **Dockerfile**.

### 4.2 Configuración (pestaña *Configuration → General*)

| Campo | Valor exacto |
|---|---|
| Name | `unistyles-backend` |
| Base Directory | `/services/backend` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `3000` |
| Domains | `https://api.unistylescuracao.com` |

Guardar (**Save**) antes de seguir.

### 4.3 Variables de entorno

*Configuration → Environment Variables* → **Developer view** (pegar en bloque) →
copiar el bloque de la sección **FASE 4 — BACKEND** de
`COOLIFY-SECRETOS-produccion.txt` → **Save**.

Obligatorias para que arranque (si falta una, el contenedor se apaga solo):
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (mínimo 32 caracteres).

### 4.4 Desplegar

**Deploy** → mirar *Logs*. Señal de éxito:

```
UNISTYLES E-COMMERCE API SERVER
Status:  Running
Port:    3000
```

### 4.5 Comprobar

```bash
curl https://api.unistylescuracao.com/health
# esperado: {"status":"healthy","timestamp":"...","uptime":...}
```

---

## Fase 4-bis — Crear las tablas del backend (¡IMPORTANTE!)

Con la base de datos gestionada de Coolify, `database/init.sql` **ya no se
ejecuta solo** (antes lo hacía el docker-compose). Sin esto, `/health` responde
bien pero registrarse, carrito, pedidos y pagos fallan.

1. Coolify → recurso **`unistyles-postgres`** → botón **Terminal**.
2. Comprobar qué tablas hay:

```bash
psql -U unistyles -d unistyles_db -c '\dt'
```

- Si ya aparecen `users`, `orders`, `payments`, `carts`… → **no hagas nada más**.
- Si sólo aparecen tablas que empiezan por `directus_` → ejecutar:

```bash
wget -qO- https://raw.githubusercontent.com/OfteaHeat1997/Unistyles-Website/master/database/init.sql | psql -U unistyles -d unistyles_db
```

3. Volver a comprobar con el `\dt` del punto 2: deben salir 12 tablas nuevas
   (`users`, `addresses`, `orders`, `order_items`, `payments`, `carts`,
   `reviews`, `newsletter_subscribers`, `settings`, `coupons`,
   `product_variants`, `whatsapp_messages`).

---

## Fase 5 — Frontend / Tienda  (`unistyles-frontend`)

**Antes de crear nada:** averiguar qué recurso sirve hoy `unistylescuracao.com`
(en el panel, el recurso llamado `unistyles`). Dos caminos:

- **Si ese recurso ya es una Application desde Git con Base Directory
  `/services/frontend`** → sólo hay que renombrarlo a `unistyles-frontend`,
  revisar las 3 variables de build y volver a desplegar (paso 5.2 y 5.3).
- **Si es el bloque viejo (Docker Compose 5-en-1)** → crear el recurso nuevo
  como abajo y apagar el viejo al final (Fase 8).

### 5.1 Crear el recurso

**+ New** → **Application** → **Public Repository** → mismo repo y branch
`master` → Build Pack **Dockerfile**.

| Campo | Valor exacto |
|---|---|
| Name | `unistyles-frontend` |
| Base Directory | `/services/frontend` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `80` |
| Domains | `https://unistylescuracao.com` |

### 5.2 Variables — ¡de BUILD, no normales!

*Environment Variables* → añadir estas 3 marcando la casilla
**“Is Build Variable?”** en cada una:

```
VITE_API_URL=https://api.unistylescuracao.com
VITE_DIRECTUS_URL=https://cms.unistylescuracao.com
VITE_USE_CMS=true
```

Vite las “hornea” dentro del paquete al construir. Si no están marcadas como
build variables, la tienda carga pero se queda girando.

### 5.3 Desplegar y comprobar

- `https://unistylescuracao.com` → la tienda carga y muestra productos.
- Abrir el carrito / iniciar sesión → ya no debe dar error de red
  (eso es lo que arregla la Fase 4).

---

## Después: Fases 6, 7 y 8

- **Fase 6** — recuperar los 285 productos (`bootstrap.js` + `migrate-strapi-to-directus.js`).
- **Fase 7** — probar las 3 URLs.
- **Fase 8** — borrar el recurso viejo de Docker Compose y el `postgresql-database` huérfano.
