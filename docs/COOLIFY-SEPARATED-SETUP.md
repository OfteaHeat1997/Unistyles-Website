# Unistyles en Coolify — Montaje SEPARADO (cada servicio aparte)

> **Objetivo:** dejar de tener los 5 servicios apretados en un solo bloque
> (`docker-compose.yml`) y pasar a **5 recursos independientes** en Coolify,
> agrupados por tipo — igual que el panel ordenado que te gustó (Applications /
> Databases). Si uno se cae, los demás siguen funcionando. La base de datos vive
> aparte, con backups automáticos, y **nunca se vuelve a borrar sola.**

> **22-ago-2026 — Fases 1, 2 y 3 hechas.** Los clics exactos que faltan
> (Fase 4 backend, Fase 4-bis tablas, Fase 5 frontend) están en
> [COOLIFY-FASE4-5-PASO-A-PASO.md](COOLIFY-FASE4-5-PASO-A-PASO.md).

## Cómo queda tu tienda (calcado al panel que te gustó)

```
DATABASES                         (se crean PRIMERO — son las que protegemos)
  ● unistyles-postgres            pgsql interno  ·  backups automáticos ON
  ● unistyles-redis               redis interno

APPLICATIONS
  ● unistyles-directus  (CMS)     https://cms.unistylescuracao.com
  ● unistyles-backend   (API)     https://api.unistylescuracao.com
  ● unistyles-frontend  (Tienda)  https://unistylescuracao.com
```

> El panel de ejemplo (AetherCorp) tenía además una sección *Services*
> (Auth, Email, Image-Resizer, Analytics…). **Tú NO necesitas esas todavía** —
> en tu caso el login va dentro del backend, el correo es SMTP del backend, y el
> redimensionado de imágenes lo hace Directus. Son extras para el futuro, no ahora.

## Aclaración importante: "localhost" NO es un problema

En Coolify, tu servidor se llama **"localhost"** simplemente porque Coolify está
instalado en ese mismo servidor. **No significa que tu web sea solo local** — tu
sitio está de verdad en internet, en el servidor "Unistyles Server"
(157.173.193.90, Ubuntu 24.04, 6 núcleos, 11.7 GB RAM). Los 5 recursos separados
corren en ese mismo servidor. "Separado" = contenedores independientes, **no**
servidores distintos. Un solo servidor bien organizado es lo correcto y más barato.

---

## Orden de trabajo (fases)

Hazlo en este orden exacto. No pases a la siguiente fase hasta que la anterior
esté en verde.

### Fase 0 — Antes de tocar nada
- [ ] Ten a mano tu gestor de contraseñas con los 7 secretos generados
      (`DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `DIRECTUS_KEY`,
      `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_PASSWORD`, `WHATSAPP_VERIFY_TOKEN`).
- [ ] **NO borres todavía** el bloque viejo de 5-en-1. Lo apagamos al final,
      cuando lo nuevo ya funcione. Así no te quedas sin nada en el camino.

### Fase 1 — Base de datos PostgreSQL (aparte)
Sigue `deploy/separated/01-databases-notes.md` (sección PostgreSQL).
- [ ] Crear recurso `unistyles-postgres` (user `unistyles`, db `unistyles_db`).
- [ ] Activar **backups automáticos** (diario).
- [ ] Ejecutar `database/init.sql` una vez (tablas del backend).
- [ ] Copiar la **Postgres URL (Internal)**.

### Fase 2 — Redis (aparte)
Sigue `deploy/separated/01-databases-notes.md` (sección Redis).
- [ ] Crear recurso `unistyles-redis` (con `REDIS_PASSWORD`).
- [ ] Copiar la **Redis URL (Internal)**.

### Fase 3 — Directus / CMS (aparte)
- [ ] **+ New Resource → Docker Image** → `directus/directus:11`.
- [ ] Nombre: `unistyles-directus`.
- [ ] Pegar variables de `deploy/separated/directus.env.example`
      (rellenando los `REEMPLAZAR_…` con tus secretos y los hosts internos de
      Postgres/Redis).
- [ ] Dominio: `cms.unistylescuracao.com` · Puerto del contenedor: `8055`.
- [ ] Volumen persistente: `/directus/uploads` (para que las fotos no se pierdan).
- [ ] Deploy. Esperar a ver `Server started at http://0.0.0.0:8055`.

### Fase 4 — Backend / API (aparte)
- [ ] **+ New Resource → Application → Public/Private Repository** (tu repo Git).
- [ ] Base Directory: `/services/backend` · Dockerfile: `Dockerfile`.
- [ ] Nombre: `unistyles-backend`.
- [ ] Pegar variables de `deploy/separated/backend.env.example` (con la
      `DATABASE_URL` y `REDIS_URL` internas que copiaste).
- [ ] Dominio: `api.unistylescuracao.com` · Puerto del contenedor: `3000`.
- [ ] Deploy. Verificar `https://api.unistylescuracao.com/health` → JSON `healthy`.

### Fase 5 — Frontend / Tienda (aparte)
- [ ] **+ New Resource → Application → tu repo Git**.
- [ ] Base Directory: `/services/frontend` · Dockerfile: `Dockerfile`.
- [ ] Nombre: `unistyles-frontend`.
- [ ] Pegar las 3 variables de `deploy/separated/frontend.build-args.example`
      en **Build-time Environment Variables** (¡no en las normales!).
- [ ] Dominio: `unistylescuracao.com` · Puerto del contenedor: `80`.
- [ ] Deploy.

### Fase 6 — Recuperar los 285 productos
Con Directus ya arriba, desde tu laptop:
```bash
DIRECTUS_URL=https://cms.unistylescuracao.com \
DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
DIRECTUS_ADMIN_PASSWORD=<tu DIRECTUS_ADMIN_PASSWORD> \
node services/directus/bootstrap.js          # crea las colecciones

DIRECTUS_URL=https://cms.unistylescuracao.com \
DIRECTUS_ADMIN_EMAIL=admin@unistylescuracao.com \
DIRECTUS_ADMIN_PASSWORD=<tu DIRECTUS_ADMIN_PASSWORD> \
node deploy/scripts/migrate-strapi-to-directus.js   # carga los 285 productos
```

### Fase 7 — Probar todo
- [ ] `https://unistylescuracao.com` → tienda carga con productos.
- [ ] `https://api.unistylescuracao.com/health` → `healthy`.
- [ ] `https://cms.unistylescuracao.com/admin` → entras a Directus.

### Fase 8 — Apagar el bloque viejo
Solo cuando TODO lo de arriba esté en verde:
- [ ] En Coolify, parar y borrar el recurso "Docker Compose" viejo (el de 5-en-1).
- [ ] Borrar también el recurso `postgresql-database` huérfano del falso comienzo.

---

## ¿Qué falta para darte los clics exactos?

Para rellenar los hosts internos reales (`REEMPLAZAR_HOST_POSTGRES`,
`REEMPLAZAR_HOST_REDIS`) necesito una captura de tu panel real en
`cloud.unistylescuracao.com` mostrando los recursos ya creados. Con eso te paso
las URLs internas exactas listas para copiar y pegar.
