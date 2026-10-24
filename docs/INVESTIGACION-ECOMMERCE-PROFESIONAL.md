# Unistyles Curaçao — Investigación: qué tiene un e-commerce profesional y qué me falta

**Fecha:** 26 de agosto de 2026
**Autora del proyecto:** Paula — Unistyles Curaçao
**Qué es esto:** el documento fuente. Reúne en un solo sitio (a) la línea base verificada del código de Unistyles, (b) el estándar de lo que tiene un e-commerce profesional real, dominio por dominio, (c) los métodos de trabajo, modelado UML/C4 y estrategia de pruebas ya acordados, y (d) el ciclo completo desde crear el proyecto hasta estar en línea y operando.
**Para qué sirve:** es el material que se le entrega a un asistente (ChatGPT) para redactar la investigación completa. Todo dato de código lleva su archivo y línea; todo dato externo lleva su fuente al final.

---

## 0. Cómo usar este documento con ChatGPT

Este archivo NO es la investigación final: es la materia prima verificada para escribirla. La diferencia importa, porque el problema de las versiones anteriores fue documentación escrita por una IA para otra IA, sin nada que se pudiera comprobar.

Reglas para quien redacte a partir de esto:

1. **No inventar estado.** Si una afirmación sobre el código no aparece en la sección 2 con su `archivo:línea`, no se escribe. Si hace falta un dato que no está, se marca como *«pendiente de verificar»*.
2. **No convertir el estándar en logro.** La columna «lo profesional» describe lo que hacen tiendas serias; la columna «Unistyles hoy» describe lo que existe. Nunca mezclarlas.
3. **Español humano.** Frases cortas, sin relleno, sin «en el mundo actual del comercio electrónico».
4. **Cada brecha necesita tres cosas:** qué falta, por qué le cuesta dinero o riesgo a Unistyles, y cuál es la versión mínima aceptable para lanzar.

Prompts sugeridos para pegar junto a este archivo:

> «Con este documento como única fuente de hechos, escribe el capítulo *Estado del arte y análisis de brechas* de mi investigación. Usa las secciones 2 y 3. Cita el archivo y línea cuando hables del código de Unistyles y la fuente cuando hables del estándar. No añadas funcionalidades que no aparezcan aquí.»

> «Con la sección 5, escribe el capítulo *Metodología de pruebas*. Justifica por qué se eligió Testing Trophy y no la pirámide clásica, y define los ocho flujos de extremo a extremo listados.»

> «Con la sección 4, escribe el capítulo *Modelado del sistema*. Para cada diagrama explica qué pregunta responde y qué elementos concretos de Unistyles aparecen en él.»

Correspondencia con los cinco documentos antiguos de `docs/planning/` (julio 2026), para que nada se pierda:

- Documento 1 «Lo que ya está listo» → sección 1 y la columna «Unistyles hoy» de la sección 2.
- Documento 2 «Checklist de finalización» → sección 7 (backlog priorizado).
- Documento 3 «Checklist de research» → sección 9 (preguntas abiertas).
- Documento 4 «Deep research + brainstorming» → sección 2 (el estándar) y sección 8 (métricas).
- Documento 5 «Action plan Double Diamond» → secciones 3 y 6 (métodos y ciclo de vida).

---

## 1. Línea base: qué es Unistyles hoy, verificado

Cifras contadas en el repositorio el 26 de agosto de 2026, no estimadas.

| Pieza | Dato verificado |
|---|---|
| Páginas del frontend | 27 (`services/frontend/src/pages/`, 28 archivos menos `index.js`) |
| Grupos de rutas del backend | 16 archivos, 4.949 líneas (`services/backend/src/routes/`) |
| Ruta más grande | `orders.js`, 541 líneas |
| Capa de controladores | vacía: `services/backend/src/controllers/` tiene 0 archivos |
| Servicios externos programados | Sentoo y WhatsApp (`services/backend/src/services/`) |
| Productos en catálogo | ~285, propiedad de Directus en el mismo Postgres |
| Pruebas automatizadas | 0. Ningún `package.json` define script `test` |
| Integración continua | `.github/workflows/ci.yml` existe: instala, construye y arma imágenes Docker, pero **no ejecuta ninguna prueba** |
| Dependencias frontend | 8 de producción; sin librería de i18n, sin analítica, sin captura de errores |
| Almacenamiento del token de sesión | `localStorage` (`services/frontend/src/contexts/AuthContext.jsx:87`) |

Lo que está genuinamente bien hecho y no hay que tocar: `helmet` con CSP configurada (`services/backend/src/index.js:50`), cuatro limitadores de peticiones, `compression`, identificador de petición, validación de variables de entorno al arrancar, React Query en el cliente, `ErrorBoundary`, rutas protegidas para el perfil, y un checkout transaccional que bloquea filas con `FOR UPDATE` antes de descontar stock (`services/backend/src/routes/orders.js:63`).

---

## 2. El estándar profesional, dominio por dominio

Dieciséis dominios. Cada uno: qué hace una tienda profesional, qué tiene Unistyles con su evidencia, y qué falta.

### A. Identidad y cuentas

**Lo profesional.** Registro con verificación de correo; inicio de sesión resistente a enumeración de usuarios; token de acceso corto guardado en cookie `httpOnly` + `Secure` + `SameSite`, nunca en `localStorage`; token de refresco rotatorio y revocable; recuperación de contraseña completa de punta a punta; cierre de sesión que invalida en servidor; segundo factor al menos para las cuentas de administración; opcionalmente entrada con Google o Apple; registro de eventos de seguridad (inicios de sesión, cambios de contraseña, cambios de correo).

**Unistyles hoy.** Registro, verificación por correo, inicio de sesión, token de refresco con lista negra en Redis (`services/backend/src/routes/auth.js:262`) y respuestas a prueba de enumeración. El backend genera y envía el enlace de recuperación.

**Lo que falta.**
1. **No existe la página `/reset-password`.** El correo llega con un enlace que no lleva a ninguna parte. La función está rota de cara al cliente, no a medias.
2. **El token vive en `localStorage`.** Cualquier script inyectado en la página puede leerlo y suplantar a la clienta. Lo profesional es cookie `httpOnly`.
3. **Sin segundo factor para administración.** La cuenta que puede ver todos los pedidos y todos los datos de clientas se protege solo con una contraseña.
4. **Sin registro de auditoría.** Cero coincidencias de `audit_log` en el código: no hay forma de saber después quién cambió qué.
5. **Sin protección CSRF.** Cero coincidencias de `csrf`. Hoy no es explotable porque el token va en cabecera, pero si se migra a cookies (punto 2) pasa a ser obligatorio el mismo día.

### B. Catálogo, búsqueda y ficha de producto

**Lo profesional.** Una única fuente de verdad del catálogo; búsqueda con tolerancia a erratas y sugerencias; filtros por atributo con recuento de resultados; variantes reales con stock propio por talla y color; galería con zoom; guía de tallas; disponibilidad visible antes de añadir al carrito; productos relacionados; datos estructurados de producto para Google.

**Unistyles hoy.** Directus manda sobre productos, categorías y marcas. Búsqueda con retardo, funcional. Ficha con reseñas, tallas y colores. Variantes existen (`routes/variants.js`).

**Lo que falta.**
1. **El catálogo está duplicado en cuatro sitios:** Directus, `frontend/src/config.js` (categorías escritas a mano), `frontend/src/data/productData.js` y `database/seed-data.json`. Cuatro versiones que se contradicen entre sí es una fuente permanente de bugs.
2. **Doble origen del stock:** `products.stock_quantity` y `product_variants` conviven; nada garantiza que coincidan.
3. **Sin datos estructurados** (`JSON-LD` de tipo `Product` con precio y disponibilidad). Google no puede mostrar precio ni «en stock» en los resultados.
4. **La página de marca solo conoce cinco marcas definidas a mano.**

### C. Carrito y checkout

**Lo profesional.** Carrito persistente entre dispositivos; compra como invitada sin obligación de crear cuenta; costes totales visibles antes del último paso; el mínimo de campos posible; validación en línea, no al enviar; recuperación de carrito abandonado.

**Unistyles hoy.** Carrito lateral con carrito de invitada en Redis y de usuaria en base de datos, con fusión al iniciar sesión. Checkout de tres pasos con cupones y autocompletado de dirección.

**Lo que falta.**
1. **Sin recuperación de carrito abandonado.** Cero coincidencias de `abandoned` en el código. Es la función con mejor relación esfuerzo/ingreso que hoy no existe.
2. **El checkout depende de datos de zonas que en producción todavía no están sembrados**, así que el desplegable de área puede salir vacío.
3. **Discrepancia de método de pago:** el frontend envía `bank` y el backend exige `bank_transfer`.

**Por qué importa, con datos.** La media de abandono de carrito es 70,2 %, y en móvil sube a 80,0 %. De quienes abandonan y sí eran compradoras, el motivo número uno es el coste sorpresa al final (39 %), seguido de la obligación de crear cuenta (24 %). El sitio medio pide 23,5 campos de formulario cuando lo razonable son 12–14. Arreglar solo la experiencia de checkout puede subir la conversión hasta un 35 %.

### D. Pagos

**Lo profesional.** Métodos locales de confianza; el sitio nunca toca ni almacena el número de tarjeta; verificación del webhook contra el proveedor y no confianza en el mensaje entrante; idempotencia para no cobrar dos veces; conciliación diaria; reembolsos desde el panel.

**Unistyles hoy.** Sentoo integrado de verdad (es el método local del Caribe holandés, conectado a MCB y otros bancos, gratis para quien compra), contra-entrega, transferencia bancaria, y el webhook **re-verifica el estado real contra Sentoo** — eso está bien hecho.

**Lo que falta.**
1. **El número de cuenta bancaria sigue siendo un marcador de posición:** `accountNumber: 'XXXX-XXXX-XXXX'` en `services/backend/src/routes/payments.js:429`. Quien elija transferencia hoy no puede pagar.
2. **Sin reembolsos operativos.** Existe alguna mención de `refund` pero no un flujo completo desde el panel.
3. **Sin conciliación.** Nadie compara al final del día lo que dice Sentoo con lo que dice la base de datos.
4. **PCI DSS.** Desde el 31 de marzo de 2025 son obligatorios los requisitos 6.4.3 y 11.6.1: hay que mantener un inventario de todos los scripts que cargan en la página de pago, autorizarlos y verificar su integridad, y detectar manipulaciones de la página y de las cabeceras tal como las recibe el navegador. Unistyles carga hoy Font Awesome desde `cdnjs.cloudflare.com` y fuentes desde Google en `services/frontend/index.html` — son exactamente el tipo de script de terceros que ese requisito obliga a inventariar.

### E. Ciclo de vida del pedido y post-compra

**Lo profesional.** Estados del pedido con historial fechado y quién lo cambió; correo o WhatsApp en cada cambio; factura descargable; política de devoluciones con número de autorización (RMA), instrucciones y etiqueta; reembolso ligado a la devolución; página de seguimiento sin necesidad de iniciar sesión.

**Unistyles hoy.** Pedidos transaccionales con número propio, página `/track-order` por número de pedido, chatbot de WhatsApp que consulta el estado.

**Lo que falta.**
1. **`order_status_history` está diseñada pero no está viva.** La tabla existe en `database/init.v2.sql:310`, y además con dos disparadores que la rellenan solos al crear un pedido y al cambiar su estado. Lo que pasa es que v2 no es el esquema que corre en producción, y ningún código del backend la lee todavía. Así que hoy, en la tienda real, solo se sabe el estado actual y no cómo llegó ahí: ante una queja no hay forma de reconstruir qué pasó. No hay que diseñarla — hay que migrar a v2 y usarla.
2. **Sin facturas.** Cero coincidencias de `invoice` o `factura`. Ninguna clienta puede descargar comprobante.
3. **Sin devoluciones ni RMA.** No existe el flujo. Y es caro: el 79 % de las compradoras abandona si no se le ofrece su método de devolución preferido, y el 76 % dice que devoluciones fáciles y gratis deciden dónde compran.
4. **Sin franjas horarias ni confirmación de entrega.**

### F. Inventario

**Lo profesional.** Una sola fuente de stock; reserva del stock mientras dura el pago para no vender dos veces lo mismo; aviso de bajo stock; entradas de mercancía registradas; historial de movimientos.

**Unistyles hoy.** Descuento de stock dentro de la transacción de compra con bloqueo de fila — correcto.

**Lo que falta.** El doble origen ya mencionado (producto contra variante); sin alertas de stock bajo; sin registro de movimientos; sin reserva temporal durante el pago con Sentoo (si la clienta tarda en pagar, otra puede llevarse la última pieza).

### G. Delivery y logística

**Lo profesional.** Zonas y tarifas editables sin tocar código; asignación de repartidor; pantalla de despacho; seguimiento en vivo; prueba de entrega; optimización de ruta.

**Unistyles hoy.** Y esto está mucho más construido de lo que parecía: mapa interactivo de Curaçao con las tres zonas dibujadas, detección de zona por GPS, autocompletado de dirección real, tarifas y umbral de envío gratis por zona (5 / 10 / 25 XCG; gratis desde 75 / 100 / 150), y el pedido guarda zona y coordenadas.

**Lo que falta.** Toda la capa operativa: quién entrega, cómo se le avisa, cómo ve la clienta que va en camino, y un panel para que Paula edite zonas y tarifas sin tocar código.

### H. Marketing, retención y analítica

**Lo profesional.** Analítica de embudo; correos transaccionales y de ciclo de vida; boletín con doble confirmación y baja en un clic; reseñas verificadas de compra; programa de referidas; píxeles de campaña.

**Unistyles hoy.** Cupones seguros ante concurrencia, reseñas, alta al boletín, chatbot de WhatsApp completo en papiamentu.

**Lo que falta.**
1. **Cero analítica.** No hay `gtag` ni equivalente. Ahora mismo es imposible saber en qué paso se cae la clienta, y por lo tanto imposible priorizar con datos.
2. **Boletín sin doble confirmación ni baja** (`routes/newsletter.js` son 43 líneas).
3. **Formulario de contacto muerto:** `services/frontend/src/pages/Contact.jsx:97` es literalmente `onSubmit={(e) => e.preventDefault()}`. La clienta escribe, pulsa enviar, no pasa nada y nadie se entera.
4. **Reseñas con bug de tipo:** `reviews.product_id` es UUID contra productos con id entero.

### I. Contenido y CMS

**Lo profesional.** Quien lleva el negocio edita productos, textos, banners y páginas legales sin programar; imágenes con recorte y formatos modernos; borradores y programación.

**Unistyles hoy.** Directus instalado y con el catálogo dentro.

**Lo que falta.** Los textos de las páginas de contenido siguen escritos en el código; las imágenes se sirven tal cual, sin variantes de tamaño ni WebP/AVIF.

### J. SEO y rendimiento

**Lo profesional.** Título y descripción distintos por página; Open Graph para redes; `robots.txt`; `sitemap.xml`; URLs canónicas; datos estructurados; renderizado en servidor o pre-renderizado para que los buscadores vean el contenido; y las tres métricas de Core Web Vitals en verde.

**Unistyles hoy.** Un solo `<title>` y una sola `<meta description>` para todo el sitio, en `services/frontend/index.html`.

**Lo que falta.**
1. **No existen `robots.txt` ni `sitemap.xml`** en `services/frontend/public/`.
2. **Sin metadatos por página ni Open Graph.** Compartir un producto en WhatsApp o Instagram no muestra ni foto ni nombre del producto.
3. **Es una SPA de Vite sin renderizado en servidor:** el buscador recibe un `<div id="root">` vacío.
4. **Sin medición de Core Web Vitals.** Los umbrales son LCP < 2,5 s, INP < 200 ms y CLS < 0,1, y se aprueba si el 75 % de las visitas los cumple. INP es la que más se falla hoy: el 43 % de los sitios no llega. Y el impacto es dinero: 0,1 s menos de carga en móvil subió la conversión un 8,4 % en el estudio de Google y Deloitte; los sitios que aprueban las tres tienen 24 % menos de rebote.

### K. Accesibilidad e idioma

**Lo profesional.** WCAG 2.2 nivel AA: navegación completa con teclado, etiquetas asociadas a cada campo, texto alternativo en imágenes de producto, contraste suficiente, ARIA en carrito y menús dinámicos. Y el idioma que la clienta realmente usa.

**Unistyles hoy.** Hay algún `aria-label` suelto en varios componentes. El chatbot de WhatsApp responde en papiamentu.

**Lo que falta.**
1. **Sin auditoría de accesibilidad y sin `lang` correcto:** `index.html` declara `lang="en"` para un sitio que sirve a un público cuya lengua materna es papiamentu en un ~81 %.
2. **Sin internacionalización.** Cero librería de i18n: la interfaz está en inglés y cambiar de idioma implicaría reescribir textos a mano.
3. **Contexto legal:** la Ley Europea de Accesibilidad entró en vigor el 28 de junio de 2025 y exige nivel AA vía EN 301 549 a quien vende a la Unión Europea. Curaçao es país autónomo del Reino, no territorio UE, así que **no aplica directamente**; conviene decirlo así de claro en la investigación y adoptar WCAG 2.2 AA por calidad y alcance de mercado, no por obligación. Que en Alemania se haya multado a un comercio con 150.000 € por fallos de texto alternativo en el checkout marca el listón que el sector considera aceptable.

### L. Back-office y administración

**Lo profesional.** Panel con pedidos filtrables, cambio de estado, ficha de clienta, gestión de stock, cupones, zonas, informes y usuarios con permisos por rol.

**Unistyles hoy.** `routes/admin.js` (265 líneas) con gestión de usuarios, pedidos y estadísticas.

**Lo que falta.**
1. **La ruta `/admin` no está protegida en el cliente:** `services/frontend/src/App.jsx:78` la declara sin envolver en ruta protegida, a diferencia del perfil.
2. **Los botones «ver» del panel son maquetas sin función.**
3. **Sin panel de zonas de entrega, sin gestión de stock, sin informes exportables.**
4. **Contraseña de administración por defecto** incluida como hash en `database/init.sql`. Hay que rotarla antes de abrir.

### M. Seguridad transversal

**Lo profesional.** Se mide contra OWASP Top 10:2025, que en su edición actual coloca en primer lugar el **control de acceso roto**, en segundo la **mala configuración**, y añade dos categorías nuevas: **fallos de la cadena de suministro de software** (dependencias, sistema de construcción, CI/CD, plataformas de terceros) y **mal manejo de condiciones excepcionales** (errores no capturados, estados de fallo inseguros).

**Unistyles hoy.** bcrypt, consultas parametrizadas, permisos de administración verificados contra base de datos, helmet con CSP, CORS con lista blanca, cuatro limitadores de peticiones, y webhook de pago re-verificado. Es una base seria.

**Lo que falta, mapeado al Top 10:**
- *A01 control de acceso*: `/admin` sin proteger en cliente.
- *A02 mala configuración*: contraseña de administración por defecto en el esquema.
- *A03 cadena de suministro*: sin `npm audit` ni Dependabot en el CI; scripts de terceros cargados desde CDN sin control de integridad.
- *A04 autenticación*: token en `localStorage`, sin segundo factor.
- *A09 registro y monitorización*: hay `winston`, pero sin destino centralizado, sin alertas y sin registro de auditoría.
- *A10 condiciones excepcionales*: hay `errorHandler`, pero sin captura de errores en producción (no hay Sentry ni equivalente) nadie se entera de los fallos reales de las clientas.

### N. Legal y cumplimiento en Curaçao

**Lo profesional.** Política de privacidad real que describe qué se recoge y por cuánto tiempo; base legal del tratamiento; derecho de acceso, corrección y borrado ejecutable de verdad; aviso y control de cookies; términos de venta; política de devoluciones y de envíos.

**Unistyles hoy.** Existen las páginas de Términos y Privacidad con texto estático.

**Lo que falta.**
1. **La ley aplicable es la Landsverordening bescherming persoonsgegevens de Curaçao**, en vigor desde el 1 de octubre de 2013, supervisada por el CBP, con multas administrativas de hasta NAf 10.000 por infracción. Se parece al RGPD pero **no es el RGPD** — la investigación no debe citar el RGPD como si aplicase.
2. **Sin gestión de consentimiento ni aviso de cookies:** cero coincidencias de `consent`.
3. **Sin mecanismo de acceso o borrado de datos** para una clienta que lo pida.
4. **Sin política de retención:** los datos de pedidos se guardan indefinidamente sin criterio escrito.
5. **Transferencias fuera de Curaçao:** el proveedor de correo, el de hosting y Meta reciben datos personales; la ordenanza exige nivel adecuado de protección o salvaguardas.

### O. Calidad y pruebas

**Lo profesional.** Ver sección 5 completa.

**Unistyles hoy.** Cero pruebas. `.github/workflows/ci.yml` construye y comprueba `/health`, pero no ejecuta ni una sola prueba porque no existe ninguna.

### P. Despliegue, observabilidad y operación

**Lo profesional.** Configuración en variables de entorno; construcción reproducible; despliegue automático desde la rama principal; migraciones versionadas y numeradas sin colisión; respaldos probados; monitor de disponibilidad; panel de errores; plan de recuperación escrito.

**Unistyles hoy.** Docker, Coolify en proceso, `.env.coolify.example`, `deploy/scripts/backup-db.sh`, CI que construye imágenes.

**La pila de alojamiento, que hasta ahora no estaba escrita en ningún sitio.** Son tres capas y conviene nombrarlas por separado porque cada una falla distinto:

1. **Contabo — el servidor físico (VPS).** Es la máquina alquilada: CPU, memoria, disco, dirección IP y ancho de banda. Contabo no sabe nada de Unistyles; solo entrega un Linux encendido. Lo que se rompe aquí: disco lleno, memoria agotada, la máquina caída, o alguien entrando por SSH.
2. **Coolify — el orquestador.** Corre *encima* del VPS de Contabo. Es quien construye las imágenes Docker, las levanta, renueva los certificados TLS, guarda las variables de entorno y expone los cinco recursos (frontend, backend, Directus, Postgres, Redis). Lo que se rompe aquí: un despliegue que falla, una variable mal puesta, un certificado que no renueva.
3. **Los cinco contenedores** — la aplicación en sí.

**Lo que falta en esta capa, y no estaba en ningún documento anterior:**
- **Contabo no se menciona en ninguna parte del repositorio.** Cero coincidencias en documentación, `.yml` o ejemplos de entorno. Nadie que llegue nuevo al proyecto sabe dónde vive el sitio.
- **Sin endurecimiento del servidor documentado:** cortafuegos con solo 22/80/443 abiertos, SSH solo por clave y sin contraseña, `fail2ban`, actualizaciones de seguridad automáticas. Es la superficie más expuesta de todo el proyecto y no hay nada escrito.
- **Sin snapshots del VPS.** El respaldo de `backup-db.sh` cubre la base de datos, no la máquina. Si se corrompe el servidor entero, no hay vuelta atrás rápida.
- **Sin límites de recursos por contenedor.** Cinco servicios en una sola máquina: Directus o Postgres pueden comerse la memoria y tumbar el checkout.
- **Sin vigilancia del disco.** Las imágenes Docker viejas de cada despliegue llenan el disco con el tiempo; sin `docker system prune` agendado y sin alerta de espacio, el sitio se cae un día sin aviso.
- **Sin plan de recuperación escrito:** qué se hace, y en qué orden, si Contabo se cae o si Coolify no arranca.

*Pendiente de verificar:* plan concreto de Contabo (CPU, RAM, disco), región del centro de datos, y si hay snapshots contratados. Esos datos hay que rellenarlos a mano — no están en el código.

**Lo que falta.**
1. **Dos esquemas de base de datos conviviendo:** `database/init.sql` (12 tablas, es el que corre en producción) y `database/init.v2.sql` (15 tablas, mejor hecho, con restricciones CHECK, precios congelados en el pedido y claves foráneas correctas). Hay que declarar v2 oficial, escribir la migración de avance y archivar v1.
2. **Migraciones con número repetido:** `001_add_coupons_and_variants.sql` y `001_add_whatsapp_messages.sql` comparten el 001. Cualquier ejecutor de migraciones ordenado por nombre puede aplicarlas en orden equivocado.
3. **~1.300 líneas de backend huérfanas:** `routes/products.js` (302), `perfumes.js` (526) y `skincare.js` (441) no las llama el frontend, que solo usa `/api/perfumes/quiz/results` y obtiene los productos de Directus. Es código que hay que mantener, revisar y asegurar sin que aporte nada.
4. **El respaldo no está agendado ni se ha probado nunca una restauración.** Un respaldo que no se ha restaurado no es un respaldo.
5. **Sin monitor de disponibilidad ni panel de errores.**

---

## 3. Métodos de trabajo elegidos y por qué

Esto ya está decidido; la investigación debe justificarlo, no reabrirlo.

| Ámbito | Método elegido | Razón |
|---|---|---|
| Proceso | Kanban + Shape Up | Equipo de una persona: límite de trabajo en curso y lotes de tiempo fijo con alcance variable |
| Investigación | Double Diamond + DOT Framework | Double Diamond ordena las fases; DOT obliga a triangular biblioteca, campo y laboratorio |
| Arquitectura | Monolito modular por capas | Ruta → controlador → servicio → repositorio. Hoy todo vive en las rutas |
| Modelado | C4 + tres diagramas UML + ERD | Suficiente para entender el sistema sin el coste del UML completo |
| Decisiones | ADR (registro de decisión de arquitectura) | Una página por decisión: contexto, opciones, elección, consecuencias |
| Alcance | MoSCoW + historias de usuaria | Ya en uso en el documento 2 de julio |
| Calidad | Testing Trophy | Sección 5 |
| Despliegue | 12-Factor + rama única + CI | Configuración en entorno, todo a `master`, la CI decide |
| Datos | Directus como fuente única del catálogo | Elimina la duplicación en cuatro sitios |

Descartados a propósito, y conviene escribir por qué: Scrum (no hay equipo que sincronizar), Clean/Hexagonal/Onion (el coste no se recupera en este tamaño), microservicios, Kubernetes, UML completo, y TDD por ahora — primero hace falta que exista alguna prueba.

---

## 4. Modelado: qué diagramas y qué debe aparecer en cada uno

Cinco diagramas. Cada uno responde una pregunta concreta; si no responde ninguna, sobra.

**1. C4 nivel 1 — Contexto.** *¿Quién usa el sistema y con qué se habla por fuera?*
Actores: clienta, Paula como administradora, repartidor. Sistemas externos: Sentoo, WhatsApp Business de Meta, servidor de correo SMTP, OpenStreetMap y Nominatim.

**2. C4 nivel 2 — Contenedores.** *¿De qué piezas se compone por dentro?*
Frontend React/Vite, backend Node/Express, Directus, PostgreSQL (compartido: Directus es dueño del catálogo, el backend de las tablas de comercio), Redis (carritos de invitada, lista negra de tokens), Socket.IO. Este diagrama es el que hace evidente el riesgo número uno: si solo se publica Directus, se ve el catálogo pero no se puede comprar.

**3. ERD — Modelo entidad-relación.** *¿Cómo se guardan los datos?*
Basado en `database/init.v2.sql`. Debe marcar explícitamente la frontera de propiedad entre las tablas de Directus (`products`, `categories`, `brands`) y las de comercio, y señalar los defectos conocidos: `reviews.product_id` UUID contra entero, `order_items.variant_id` entero contra UUID, doble origen de stock.

**4. Diagrama de secuencia — Compra con Sentoo.** *¿Qué pasa exactamente, y en qué orden, al pagar?*
Clienta → checkout → backend crea el pedido en transacción con bloqueo de stock → llamada a Sentoo → redirección → vuelta a `/payment/callback` → webhook entrante → **backend re-verifica contra Sentoo** → Socket.IO actualiza la pantalla. Ese paso de re-verificación es la decisión de diseño que hay que destacar.

**5. Diagrama de estados — Pedido.** *¿Qué le puede pasar a un pedido y qué transiciones son ilegales?*
Pendiente → pagado → preparando → en reparto → entregado, más cancelado y reembolsado. Este diagrama es el que justifica la tabla `order_status_history` que hoy no existe.

Diagrama opcional si la investigación necesita cubrir procesos: **diagrama de actividad de la devolución**, que hoy no se puede dibujar porque el proceso no existe — y precisamente por eso vale la pena diseñarlo antes de programarlo.

---

## 5. Estrategia de pruebas

Se elige el **Testing Trophy** y no la pirámide clásica. Motivo: en una tienda de este tamaño casi todos los bugs reales están en las costuras — ruta con base de datos, componente con estado, checkout con Redis — no dentro de funciones puras aisladas. El Trophy pone el peso en las pruebas de integración, que es donde están los fallos, y añade una base de análisis estático que atrapa gratis una clase entera de errores. Para servicios con lógica de negocio profunda la pirámide sigue teniendo sentido; este no es el caso.

**Capa 1 — Estático.** ESLint y comprobación de tipos con JSDoc, `npm audit` y Dependabot en la CI. Coste casi cero, atrapa errores de nombre y dependencias vulnerables (cubre A03 del OWASP Top 10).

**Capa 2 — Unitarias, con Vitest.** Solo lo que tiene lógica de verdad y merece aislarse: cálculo de tarifa de envío por zona y umbral de envío gratis, validación y aplicación de cupones, detección de zona por coordenadas, y el algoritmo de recomendación del quiz de perfumes.

**Capa 3 — Integración, el grueso.** Supertest contra Express con Postgres y Redis reales en contenedor —la CI ya los levanta, así que la infraestructura está—. Aquí va: registro y verificación, ciclo completo del token de refresco, fusión del carrito de invitada al iniciar sesión, checkout con stock insuficiente, checkout con dos compras simultáneas de la última unidad, cupón aplicado dos veces, y el webhook de pago con un mensaje falsificado (debe rechazarlo porque re-verifica).

**Capa 4 — Extremo a extremo, con Playwright.** Pocas y solo de lo que si se rompe cuesta dinero. Ocho flujos:
1. Buscar producto → ficha → añadir al carrito → checkout como invitada → contra-entrega.
2. Compra con Sentoo en entorno de pruebas hasta la pantalla de confirmación.
3. Registro → verificación → inicio de sesión → el carrito de invitada sobrevive.
4. Recuperar contraseña de punta a punta (hoy imposible: no existe la página).
5. Detección de zona de entrega y cálculo de tarifa en el checkout.
6. Aplicar un cupón y ver el total recalculado.
7. Seguimiento de pedido por número, sin sesión iniciada.
8. Acceso a `/admin` sin ser administradora: debe ser rechazado (hoy fallaría).

Vitest y Playwright son la combinación de referencia hoy: en la encuesta State of JavaScript 2025 Vitest tiene la retención más alta de todas las herramientas de prueba con 96 %, por delante de Playwright con 91 %.

**Regla de la CI.** Ninguna prueba que dependa de servicios externos reales. Sentoo, Meta y SMTP van simulados. El flujo 2 corre contra el entorno de pruebas de Sentoo, y en un trabajo aparte que puede fallar sin bloquear.

**Definición de terminado, aplicable desde ya.** El primer objetivo no es un porcentaje de cobertura: es que los ocho flujos de extremo a extremo pasen en verde. La cobertura se mide después, y solo sobre la capa 3.

---

## 6. De crear el proyecto a estar en línea: el ciclo completo

Doce fases. Es el esqueleto del capítulo de metodología.

1. **Descubrir.** Entrevistas a 5–8 clientas, análisis de competencia local, revisión de los pedidos que ya llegan por WhatsApp. Entregable: hallazgos y 2–3 perfiles de clienta con evidencia.
2. **Definir.** Convertir hallazgos en enunciados de problema, priorizar con MoSCoW, fijar el alcance mínimo de lanzamiento y los indicadores.
3. **Modelar.** Los cinco diagramas de la sección 4 y los primeros ADR.
4. **Fijar los datos.** Declarar `init.v2.sql` oficial, escribir la migración de avance con sus cláusulas `USING`, renumerar migraciones, archivar v1.
5. **Limpiar.** Borrar las ~1.300 líneas huérfanas, eliminar el catálogo duplicado dejando solo Directus, extraer controladores y servicios de las rutas gordas.
6. **Cerrar los bloqueadores.** La lista P0 de la sección 7.
7. **Poner red de seguridad.** Escribir las pruebas de la sección 5 y activar que la CI las ejecute de verdad.
8. **Endurecer.** Segundo factor de administración, token en cookie `httpOnly`, `npm audit` en CI, registro de auditoría, inventario de scripts de la página de pago.
9. **Cumplir.** Política de privacidad conforme a la ordenanza de Curaçao, aviso de cookies, procedimiento de acceso y borrado, política de retención escrita.
10. **Medir.** Analítica de embudo, captura de errores, monitor de disponibilidad, Core Web Vitals en campo.
11. **Ensayar el lanzamiento.** Restaurar un respaldo en un entorno limpio, compra de prueba de punta a punta con dinero real y su reembolso, y ensayo de vuelta atrás.
12. **Abrir y operar.** Guardia las primeras 72 horas, revisión semanal de embudo y errores, y ciclos de dos semanas a partir de ahí.

---

## 7. Backlog priorizado

**P0 — sin esto no se abre.**
1. Frontend, backend y Directus desplegados juntos y hablándose (si solo hay Directus: se ve, no se compra).
2. Sembrar los barrios de las zonas de entrega en la base de datos de producción.
3. Número de cuenta bancaria real en `payments.js:429`.
4. Rotar la contraseña de administración por defecto.
5. Proteger `/admin` en cliente y confirmar la verificación en servidor.
6. Arreglar el bug de tipo de las reseñas, o desactivar reseñas.
7. Crear la página `/reset-password`, o esconder el enlace de «olvidé mi contraseña».
8. Arreglar el formulario de contacto (`Contact.jsx:97`) o quitarlo.
9. Igualar el método de pago `bank` / `bank_transfer`.
10. Claves reales de Sentoo, y una compra de prueba completa con reembolso.
11. Respaldo diario agendado y una restauración probada.
12. Endurecer el VPS de Contabo: cortafuegos, SSH solo por clave, actualizaciones automáticas.

**P1 — primeras dos semanas.**
Analítica de embudo · captura de errores · metadatos y Open Graph por página, `robots.txt` y `sitemap.xml` · las ocho pruebas de extremo a extremo con la CI ejecutándolas · `order_status_history` · aviso de cookies y política de privacidad conforme a la ordenanza local · token fuera de `localStorage` · segundo factor de administración · declarar v2 oficial y renumerar migraciones · snapshots del VPS, límites de recursos por contenedor y alerta de espacio en disco.

**P2 — semanas 3 a 8.**
Recuperación de carrito abandonado · devoluciones con RMA y reembolso · facturas descargables · panel de zonas de entrega · gestión de stock y alerta de bajo stock · datos estructurados de producto · auditoría de accesibilidad WCAG 2.2 AA · decidir el idioma con datos y montar i18n · borrar el código huérfano y extraer controladores.

**P3 — después.**
Asignación de repartidor y pantalla de despacho · seguimiento en vivo · franjas horarias · optimización de ruta · referidas · entrada con Google · renderizado en servidor.

---

## 8. Métricas: cómo se sabrá si funciona

Sin analítica ninguna de estas se puede medir hoy; por eso instalarla es P1 y no P2.

**Negocio.** Tasa de conversión de visita a pedido · valor medio del pedido contra los umbrales de envío gratis de 75/100/150 XCG · tasa de abandono de carrito, con la referencia del sector en 70,2 % general y 80,0 % en móvil · reparto entre pedido por web y pedido por WhatsApp · compra repetida a 90 días, que en un mercado de ~185.000 personas con crecimiento cercano a cero pesa más que captar tráfico nuevo.

**Producto.** Caída paso a paso del checkout · búsquedas sin resultados · productos vistos sin añadir al carrito · número de campos del formulario, con objetivo de 12–14.

**Técnicas.** LCP < 2,5 s, INP < 200 ms, CLS < 0,1 en el percentil 75 de visitas reales · disponibilidad · tasa de error 5xx · tasa de éxito de pagos en Sentoo · tiempo de recuperación tras un fallo.

**Calidad.** Los ocho flujos en verde · CI que ejecuta pruebas y no solo construye · cero vulnerabilidades altas en `npm audit`.

---

## 9. Preguntas abiertas de investigación

Las que hay que responder con clientas reales, no en el código.

1. ¿En qué idioma quiere comprar la clienta? El papiamentu es lengua materna del ~81 % de la población y la interfaz está hoy en inglés. Es la decisión con mayor efecto en el rediseño y se está tomando por inercia.
2. ¿Qué método de pago prefiere de verdad? Sentoo tiene el respaldo del banco local y es gratis para quien compra, pero la confianza no se deduce, se pregunta.
3. ¿Compra sola en el sitio o prefiere cerrar por WhatsApp? Define cuánto invertir en el checkout frente al chatbot.
4. ¿Qué frena la compra en línea en Curaçao — desconfianza, envío o pago?
5. ¿Los umbrales de envío gratis (75/100/150 XCG) coinciden con el ticket medio real?
6. ¿La barrera de la talla en lencería justifica probador virtual, guía ampliada o cambios gratis?
7. ¿Qué política de devoluciones se puede sostener operativamente en una isla?

---

## 10. Fuentes

- OWASP Top 10:2025 — https://owasp.org/Top10/2025/
- PCI Security Standards Council, requisitos de comercio electrónico vigentes tras el 31 de marzo de 2025 — https://blog.pcisecuritystandards.org/coffee-with-the-council-podcast-guidance-for-pci-dss-e-commerce-requirements-effective-after-31-march-2025
- PCI DSS 4.0.1, cambios en el requisito 6.4.3 — https://www.feroot.com/blog/pci-4-0-1-has-arrived/
- Abandono de carrito, meta-análisis de Baymard (70,22 %) y desglose por dispositivo y sector — https://eightx.co/blog/average-ecommerce-cart-abandonment-rate-by-vertical-2026 · https://www.zipchat.ai/blog/cart-abandonment-benchmarks-and-causes
- Optimización de checkout y campos de formulario — https://growth-engines.com/insights/ecommerce/ecommerce-checkout-optimization
- Core Web Vitals 2026, umbrales e impacto en conversión — https://www.corewebvitals.io/core-web-vitals · https://neogenmedia.com/blog/core-web-vitals
- Gestión de devoluciones y RMA — https://www.shopify.com/blog/ecommerce-returns-management · https://www.ringly.io/blog/ecommerce-returns-management
- Ley Europea de Accesibilidad y WCAG 2.2 AA en comercio electrónico — https://www.siteimprove.com/blog/european-accessibility-act-e-commerce/ · https://www.levelaccess.com/compliance-overview/european-accessibility-act-eaa/
- Landsverordening bescherming persoonsgegevens de Curaçao — https://www.dlapiperdataprotection.com/?t=law&c=CW · https://www.cbs.cw/landsverordening-bescherming-persoonsgegevens
- Testing Trophy frente a pirámide de pruebas — https://www.baytechconsulting.com/blog/test-pyramid-vs-testing-trophy-whats-the-difference
- Vitest y Playwright, adopción y reparto de capas — https://testdino.com/blog/javascript-testing-frameworks · https://www.browserstack.com/guide/vitest-vs-playwright

Datos de mercado de Curaçao 2025 (población ~185.000, 126.000 usuarios de internet, 192.000 conexiones móviles, papiamentu ~81 %): tomados del documento 4 de `docs/planning/`, julio 2026.
