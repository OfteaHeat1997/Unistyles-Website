# Bases de datos separadas (PostgreSQL + Redis) en Coolify

> Estas dos son **recursos gestionados** de Coolify (sección *Databases*).
> Son las piezas que **nunca** deben volver a borrarse. Por eso van primero.

## 1) PostgreSQL (recurso "unistyles-postgres")

Al crearlo en Coolify (**+ New Resource → Databases → PostgreSQL**), configura:

| Campo en Coolify | Valor |
|---|---|
| Name | `unistyles-postgres` |
| Username (Postgres User) | `unistyles` |
| Password | *(tu `DB_PASSWORD` del gestor de contraseñas)* |
| Database (Initial DB) | `unistyles_db` |
| Image / Version | `postgres:16-alpine` |

Después de crearlo:
- **Activa los backups automáticos** (pestaña *Backups* → programa uno diario).
  Esto es lo que faltaba antes y lo que evita perder los productos otra vez.
- Copia la **"Postgres URL (Internal)"** que Coolify muestra — la necesitas
  para el backend y para Directus. El host interno NO es `postgres` ni
  `localhost`; es un nombre tipo `xxxxxxxx` que Coolify asigna.

### ⚠️ Paso obligatorio: cargar el esquema del backend una vez

El archivo `database/init.sql` crea las tablas del backend (usuarios, pedidos,
pagos, cupones…). Antes corría solo; ahora hay que ejecutarlo una vez contra la
base de datos nueva. Desde tu laptop (o por SSH al servidor):

```bash
# Opción A — desde tu laptop, usando la URL PÚBLICA temporal de Coolify
#   (activa "Make it publicly available" en el recurso Postgres, copia el host y puerto)
psql "postgresql://unistyles:<DB_PASSWORD>@<HOST_PUBLICO>:<PUERTO>/unistyles_db" \
  -f database/init.sql

# Opción B — por SSH dentro del servidor (más seguro, sin abrir puerto público)
ssh root@157.173.193.90
docker exec -i $(docker ps --format '{{.Names}}' | grep unistyles-postgres) \
  psql -U unistyles -d unistyles_db < database/init.sql
```

Si vuelves a verlo decir `already exists`, no pasa nada: significa que ya estaba.

## 2) Redis (recurso "unistyles-redis")

**+ New Resource → Databases → Redis**:

| Campo en Coolify | Valor |
|---|---|
| Name | `unistyles-redis` |
| Password | *(tu `REDIS_PASSWORD` del gestor de contraseñas)* |
| Image / Version | `redis:7-alpine` |

Después: copia la **"Redis URL (Internal)"**. La usan el backend (`REDIS_URL`)
y Directus (`REDIS`).

---

## Recordatorio: todo en UN servidor está bien

Tus 5 recursos separados corren en el **mismo** servidor ("Unistyles Server",
157.173.193.90 — 6 núcleos, 11.7 GB RAM). Eso es correcto y suficiente.

- "Separado" = **recursos/contenedores independientes**, no servidores distintos.
- Si un recurso se cae, los demás siguen porque cada uno es su propio contenedor.
- No necesitas pagar varios servidores. Uno solo, bien organizado, basta.
