# INVENTORY STATUS — Unistyles Curacao

> **Última actualización:** 2026-04-29
> **Quién lo escribió:** sesión Claude Code de 2026-04-29 con Maria
> **Para qué sirve este doc:** saber en qué punto está el inventario, qué se hizo,
> qué falta, y cómo continuar después de cualquier pausa o reinicio.

---

## ESTADO ACTUAL EN UNA LÍNEA

✅ Datos de productos al día (285 productos, descontinuados borrados, precios nuevos)
✅ Strapi schema y bootstrap listos para sync automático
⏳ Falta deploy/restart de Strapi en producción con `FORCE_RESEED=1` para que la DB en vivo se actualice
⏳ Falta smoke test después de ese deploy

---

## TABLA DE CONTENIDOS

1. [Conteo final por categoría](#1-conteo-final-por-categoría)
2. [Lo que se hizo en esta sesión](#2-lo-que-se-hizo-en-esta-sesión)
3. [Lo que falta hacer](#3-lo-que-falta-hacer)
4. [Pregunta sobre las imágenes](#4-pregunta-sobre-las-imágenes--decisión-pendiente)
5. [Pipeline completo de actualización](#5-pipeline-completo-cuando-cambien-los-catálogos)
6. [Cómo la dueña maneja el inventario](#6-cómo-la-dueña-maneja-el-inventario-después-del-launch)
7. [Cómo deshacer si algo sale mal](#7-cómo-deshacer-si-algo-sale-mal)
8. [Issues conocidos](#8-issues-conocidos)
9. [Estructura de archivos](#9-estructura-de-archivos)

---

## 1. CONTEO FINAL POR CATEGORÍA

| Categoría | Antes | Ahora | Cambio | Razón |
|-----------|:-----:|:-----:|:------:|-------|
| Bras | 20 | **33** | +13 | Catálogo nuevo (77 SKUs agrupados por referencia + 77 variantes color/talla) |
| Panties | 20 | 20 | — | No hay catálogo nuevo, sin cambio |
| Shapewear | 15 | 15 | — | Sin cambio |
| Colonias (perfumes) | 22 | **133** | +111 | Catálogo COLONIAS_UPDATED (todos activos, 0 descontinuados) |
| Cremas | 30 | **33** | +3 | 19 descontinuados (rojos) borrados + nuevos agregados |
| Bloqueador | 14 | **10** | -4 | 5 descontinuados borrados + 4 nuevos sin SKU oficial (auto BLQ-012-015) |
| Desodorantes | 25 | 25 | — | Sin cambio (no hay catálogo nuevo) |
| Limpieza Facial | 9 | **2** | -7 | 4 descontinuados borrados, dejaron solo LF-ES01 y LF-LB03 |
| Accesorios | 14 | 14 | — | Sin cambio |
| **TOTAL** | **169** | **285** | **+116** | |

---

## 2. LO QUE SE HIZO EN ESTA SESIÓN

### a. Análisis de los catálogos Word
- Leídos 5 archivos `.docx` desde `C:\Users\maria\Pictures\Inventory Unistyles images\`:
  - `Copia de CATALOGO_BH_FINAL.docx` (bras, Nancy)
  - `CATALOGO_COLONIAS_UPDATED.docx` (perfumes, Angeli)
  - `CATALOGO_CREMAS_UPDATED.docx` (cremas, Angeli)
  - `CATALOGO_BLOQUEADOR_UPDATED.docx` (bloqueador, Angeli)
  - `CATALOGO_LIMPIEZA_FACIAL_UPDATED.docx` (limpieza facial, Angeli)
- Detectado que el "rojo" en el docx es un **highlight de fondo** (no font color), tipo `WD_COLOR_INDEX.RED`
- Confirmado que el rojo significa **descontinuado, borrar del inventario**

### b. Parser construido y ejecutado
- Script: `scripts/inventory/parse_catalogs.py`
- Reglas:
  - Filas con cualquier celda en rojo → descartadas
  - Bras (BH catalog) agrupados por número de referencia: 1 producto padre + N variantes (color × talla)
  - Otras categorías: 1 fila = 1 producto plano
  - Precios normalizados de "$19", "Xcg 30", "XCG 75" → 19, 30, 75 (XCG)
- Output: `/tmp/inv-parsed/<categoria>.json`

### c. Auditoría y limpieza de imágenes
- Script: `scripts/inventory/match_images_and_audit.py`
- Para cada producto activo, busca su imagen en `frontend/public/images/<carpeta_categoria>/` por nombre
- Imágenes que ya no corresponden a ningún producto activo = huérfanas
- **63 imágenes huérfanas detectadas** — TODAS coincidían 1:1 con productos descontinuados
- Movidas a `backups/orphan-images-20260429_194359/` (no borradas, recuperables)

### d. Imágenes BH (bras) extraídas
- Script: `scripts/inventory/place_bra_images.py`
- 128 fotos del zip BH copiadas a `frontend/public/images/bra/<ref>/` con nombres limpios
- 20 carpetas de referencia (de las 33 referencias en el catálogo, 13 quedan sin imagen)
- Archivo `NOTICE.md` agregado advirtiendo que son brand-owned, sólo para preview de layout

### e. Datos consolidados
- Script: `scripts/inventory/build_seed.py`
- Combina: catálogos parseados nuevos + categorías intactas (panties, shapewear, desodorantes, accesorios)
- Genera:
  - `strapi/src/seed-data.json` — la fuente de verdad para Strapi
  - `frontend/src/data/productData.js` — fallback del frontend cuando `USE_STRAPI=false`

### f. Strapi schema y bootstrap actualizados
- **Componente nuevo**: `strapi/src/components/product/variant.json` — soporta SKU, color, talla, precio, stock e imagen por variante
- **Schema de producto**: agregado atributo `variants` (componente repetible) en `strapi/src/api/product/content-types/product/schema.json`
- **Bootstrap reescrito** (`strapi/src/index.js`):
  - Nuevo modo **sync**: en cada restart actualiza precios/stock/variantes de productos existentes, agrega nuevos, **borra los que ya no están en el seed** (= los rojos)
  - Nuevo modo **force reseed** (env var `FORCE_RESEED=1`): borra todos los productos primero y reseed limpio. Para usar cuando hay cambio mayor de estructura

### g. Frontend build verificado
- `cd frontend && npm run build` → ✅ verde, 557 módulos, 285 productos, sin errores

---

## 3. LO QUE FALTA HACER

### Crítico para el launch (te toca a ti)
1. **Deploy con `FORCE_RESEED=1`** en Vercel (o donde corra Strapi en producción).
   En Vercel: Settings → Environment Variables → agregar `FORCE_RESEED` = `1` → Redeploy.
   Después del primer deploy exitoso, **quita la variable** o ponla en `0` para que los próximos restarts no borren todo.
2. **Smoke test** el sitio en vivo:
   - Home carga
   - Las 9 categorías cargan productos
   - Una página de producto individual carga
   - Carrito agrega y muestra el item
   - Bras muestra variantes (color/talla)
3. **Decidir sobre las imágenes** — ver siguiente sección

### Antes del launch público
- Reemplazar imágenes de bras (`frontend/public/images/bra/`) con fotos propias o licenciadas (las actuales son brand-owned, sólo placeholder)
- Conseguir imagen para CRM-051 "Biomilk sentive piel sensible" (nuevo, no tiene foto)
- Conseguir imágenes para los 13 refs de bras sin foto

### Post-launch (no urgente)
- Si todo funciona, considerar borrar `backups/orphan-images-20260429_194359/` (ahorra ~10 MB)
- Borrar archivos `.backup-*` de seed-data.json y productData.js

---

## 4. PREGUNTA SOBRE LAS IMÁGENES — DECISIÓN PENDIENTE

**Tu pregunta:** "tengo todas las nuevas imágenes en mi PC donde estaba Word document, ¿debería borrar toda la lista y subir éstas?"

**Análisis:**

Los ZIPs en `C:\Users\maria\Pictures\Inventory Unistyles images\` son:

| ZIP | Contenido | ¿Lo extrajimos? | Estado |
|-----|-----------|:---------------:|--------|
| `BH-...zip` | 128 imágenes de bras | ✅ Sí | Ya en `frontend/public/images/bra/` |
| `CATALOGO BLOQUEADOR-...zip` | 12 imágenes + 25 PDFs/docs de research | ❌ No | Imágenes actuales son las viejas (matchearon todas) |
| `DESODORANTES-...zip` | 27 imágenes | ❌ No | Imágenes actuales son las viejas |
| `catalogo cremas-...zip` | 32 imágenes | ❌ No | Imágenes actuales son las viejas |
| `limpieza facial-...zip` | 2 imágenes | ❌ No | Imágenes actuales son las viejas |

**Mi recomendación:** depende de si las imágenes en los zips son **mejores/diferentes** que las actuales en `frontend/public/images/`.

**Tres opciones:**

### Opción A: Dejar como está (recomendado para tonight)
Las imágenes actuales matchean al 100% con los productos activos. Funcionan.
Las del ZIP probablemente son las mismas o muy parecidas.
**Si tu meta es lanzar tonight, esta opción no requiere ninguna acción.**

### Opción B: Reemplazar todas con las del ZIP
Borra las imágenes actuales, extrae los ZIPs nuevos, vuelve a correr el matcher.
**Riesgo:** los nombres pueden no matchear y terminar con productos sin foto.
**Beneficio:** si las del ZIP son fotos profesionales nuevas, el sitio se ve mejor.

### Opción C: Comparar primero, decidir después (mi sugerencia)
Te puedo escribir un script que compara el zip vs lo que ya tenemos:
- Si los nombres son los mismos → seguro reemplazar (igual o mejor calidad)
- Si los nombres son diferentes → revisar manualmente

**Pídelo cuando quieras avanzar con esto. NO es bloqueante para tonight.**

---

## 5. PIPELINE COMPLETO (cuando cambien los catálogos)

Cuando Angeli/Nancy actualicen los Word docs, corre esto en orden:

```bash
# Paso 1: parsear catálogos
python3 scripts/inventory/parse_catalogs.py

# Paso 2: matchear productos a imágenes existentes + detectar huérfanas
python3 scripts/inventory/match_images_and_audit.py

# Paso 3: mover imágenes huérfanas a backups
python3 scripts/inventory/move_orphans.py

# Paso 4: construir seed-data.json + productData.js
python3 scripts/inventory/build_seed.py

# Paso 5: (opcional, sólo si actualizaste el zip BH) reextraer imágenes de bras
python3 scripts/inventory/place_bra_images.py
python3 scripts/inventory/build_seed.py   # rebuild para fijar paths

# Paso 6: validar que el frontend compila
cd frontend && npm run build

# Paso 7: deploy → Strapi sync corre automáticamente al restart
git add -A && git commit -m "inventory: refresh from updated catalogs" && git push
```

---

## 6. CÓMO LA DUEÑA MANEJA EL INVENTARIO DESPUÉS DEL LAUNCH

Login en `https://tudominio.com/cms/admin` (Strapi admin).

### Cambiar precio o stock de un producto
1. Content Manager → Product (en sidebar izquierdo)
2. Busca el producto por nombre
3. Click para abrirlo
4. Cambia `price` o `stockQuantity`
5. Save → Publish

### Marcar producto agotado
1. Abre el producto en Content Manager
2. `inStock` = false (o `stockQuantity` = 0)
3. Save → Publish

### Agregar producto nuevo
1. Content Manager → Product → "Create new entry"
2. Llena: name, slug (auto), price, description, category, brand
3. Sube imagen en el campo `image`
4. Save → Publish

### Agregar variante a un bra (color o talla nueva)
1. Abre el producto bra en Content Manager
2. Scroll hasta `variants`
3. Click "Add a component"
4. Llena: SKU, color, size, price, stockQuantity
5. Save → Publish

### Eliminar producto descontinuado
1. Abre el producto
2. Botón "Delete" (esquina superior derecha)
3. Confirmar

### Cambios cuándo se ven en el sitio
- React Query cachea 5 minutos → cambios aparecen automáticamente en 5 min, o con hard refresh (Ctrl+Shift+R) inmediatamente.

---

## 7. CÓMO DESHACER SI ALGO SALE MAL

### Restaurar seed-data.json y productData.js originales
```bash
ls strapi/src/seed-data.json.backup-*       # ver backups disponibles
ls frontend/src/data/productData.js.backup-*

# Restaura el más reciente:
cp strapi/src/seed-data.json.backup-1746026000 strapi/src/seed-data.json
cp frontend/src/data/productData.js.backup-1746026000 frontend/src/data/productData.js
```

### Restaurar imágenes huérfanas (si borraste algo que necesitabas)
```bash
ls backups/   # ver qué backup queremos restaurar
# Restaura imágenes de cremas, por ejemplo:
mv "backups/orphan-images-20260429_194359/catalogo  cremas/"* "frontend/public/images/catalogo  cremas/"
```

### Revertir Strapi DB después de un FORCE_RESEED malo
- Si tienes backup de Postgres: restáuralo
- Si no: corre `FORCE_RESEED=1` de nuevo después de arreglar `seed-data.json`

### Revertir todo el commit
```bash
git log --oneline -5      # encuentra el commit anterior al cambio
git reset --hard <hash>   # ⚠️ destructivo, sólo si estás segura
```

---

## 8. ISSUES CONOCIDOS

| # | Issue | Severidad | Workaround |
|:-:|-------|:---------:|------------|
| 1 | 13 referencias de bras sin imagen (parser tiene 33 refs, BH zip tiene 20) | media | Mostrarán imagen 404. Agregar fotos en `frontend/public/images/bra/<ref>/main.png` |
| 2 | CRM-051 Biomilk sin imagen (nuevo en catálogo) | baja | Conseguir foto o usar placeholder |
| 3 | Imágenes BH son brand-owned (Leonisa) | **legal** | Reemplazar antes del launch público con fotos propias |
| 4 | 4 bloqueadores con SKU auto BLQ-012 a BLQ-015 (no oficial) | baja | Si quieres SKUs distintos, edítalos en Strapi admin |
| 5 | El frontend aún muestra `color`/`size` flat en bras (no usa el selector de variantes) | media | Trabajo pendiente — para post-launch. Por ahora muestra el primer color/talla del array de variantes |

---

## 9. ESTRUCTURA DE ARCHIVOS

### Scripts del pipeline
```
scripts/inventory/
├── README.md                       # uso técnico de los scripts
├── parse_catalogs.py               # docx → JSON
├── match_images_and_audit.py       # mapea productos a fotos, detecta huérfanas
├── move_orphans.py                 # mueve huérfanas a backups/
├── place_bra_images.py             # extrae BH zip → public/images/bra/
└── build_seed.py                   # construye seed-data.json + productData.js
```

### Archivos modificados de Strapi
```
strapi/src/
├── seed-data.json                       # ⭐ datos de los 285 productos
├── index.js                             # bootstrap con sync + FORCE_RESEED
├── api/product/content-types/product/
│   └── schema.json                      # ahora incluye variants
└── components/product/
    └── variant.json                     # ⭐ nuevo: SKU/color/talla/precio/stock
```

### Frontend
```
frontend/
├── src/data/productData.js              # fallback offline (regenerado)
└── public/images/
    ├── bra/                             # nuevo: BH zip extraído
    │   ├── NOTICE.md                    # advertencia de copyright
    │   ├── 011473/main.png + variantes
    │   ├── 011654/...
    │   └── (20 referencias)
    ├── perfumes/                        # 36 huérfanas movidas
    ├── catalogo  cremas/                # 19 huérfanas movidas
    ├── CATALOGO BLOQUEADOR/             # 4 huérfanas movidas
    └── limpieza facial/                 # 4 huérfanas movidas
```

### Backups
```
backups/
└── orphan-images-20260429_194359/       # 63 imágenes huérfanas, recuperables
    ├── perfumes/                        # 36 archivos
    ├── catalogo  cremas/                # 19 archivos
    ├── CATALOGO BLOQUEADOR/             # 4 archivos
    └── limpieza facial/                 # 4 archivos

strapi/src/seed-data.json.backup-*           # versión anterior antes del refresh
frontend/src/data/productData.js.backup-*    # versión anterior antes del refresh
```

---

## 10. SI LEES ESTE DOC EN UNA SESIÓN NUEVA

Para reanudar el trabajo:

1. Lee `INVENTORY-STATUS.md` (este archivo) — sección **Estado actual**
2. Lee `scripts/inventory/README.md` para el detalle técnico
3. Ejecuta `git status` y `git log --oneline -5` para ver dónde quedó el trabajo
4. Si los scripts cambian: `python3 scripts/inventory/build_seed.py` para regenerar el seed
5. Si el catálogo cambia: corre el pipeline completo (sección 5)

---

**Si tienes dudas sobre algún paso o quieres avanzar con la decisión de imágenes, dímelo y seguimos.**
