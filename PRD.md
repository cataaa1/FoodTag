# PRD — FoodTag

> **Estado:** Borrador v1 · **Autor:** beWeb · **Tipo:** MVP single-tenant
> **Documento hermano:** `AGENTS.md` (guía técnica para agentes IA)

---

## 1. Resumen ejecutivo

**FoodTag** es una web app para food trucks que permite a los clientes escanear un único QR pegado en el truck, ver el menú, pagar con Mercado Pago y recibir su pedido por número de ticket. El teléfono del cliente funciona como **beeper digital**: suena y muestra un cartel cuando el pedido está listo para retirar.

FoodTag es además una **PWA instalable**. El cliente puede optar por instalarla como app y así recibir **notificaciones Web Push** aunque cierre la pestaña o bloquee el teléfono. La instalación es opcional: quien no la instale sigue teniendo el beeper in-pestaña funcionando normalmente.

Del otro lado, el staff del food truck opera un tablero **Kanban** con tres columnas (Pendiente → En preparación → Listo) para gestionar los pedidos en tiempo de servicio. El admin tiene un dashboard con gestión completa de menú, usuarios, roles, horarios y métricas.

Es un MVP **single-tenant, single-truck**. Producto académico/interno de **beWeb**, sucesor conceptual de MesaQR pero adaptado a la operativa de food truck: **sin mesas, sin pedidos colaborativos, sin pedidos post-pago**. El pago es obligatorio antes de que el pedido entre a cocina.

## 2. Objetivos

### Objetivos del producto

1. Eliminar la cola en la caja: el cliente pide y paga desde su celular.
2. Dar feedback claro al cliente sobre el estado de su pedido sin que tenga que estar preguntando.
3. Simplificar el flujo de cocina con una única vista Kanban.
4. Permitir al operador del food truck gestionar menú y disponibilidad en tiempo real (ej: marcar un ítem como agotado a mitad del servicio).

### Objetivos de aprendizaje (proyecto beWeb)

1. Aplicar Next.js 15 + Supabase + Mercado Pago en un caso distinto a MesaQR.
2. Modelar un sistema de notificaciones **multi-capa** (sonido in-pestaña + Web Push para quienes instalan la PWA + fallback manual del staff).
3. Construir una **PWA instalable** con Service Worker y Web Push (VAPID).
4. Construir un sistema de roles y permisos configurable por admin.

### No-objetivos (MVP)

- Multi-truck / multi-tenant.
- Impresión térmica de tickets.
- Facturación AFIP.
- Pedidos para envío / delivery.
- Reservas o pre-pedidos programados.
- Notificaciones por SMS o WhatsApp automáticas (el staff las manda manualmente desde el Kanban si hace falta).
- Service Worker con caching offline (el SW solo se usa para Web Push).
- Fidelidad, cupones, descuentos complejos.
- Stock por unidades (solo toggle disponible/agotado).

## 3. Personas y roles

### Clientes (comensales)

- Escanean el QR del food truck.
- Ingresan **nombre y número de teléfono** (obligatorios, para identificación y contacto de respaldo).
- Eligen ítems del menú, pagan, reciben un número de ticket.
- Dejan la pestaña abierta como beeper hasta ser llamados.

### Staff

Roles **por defecto** en el MVP:

| Rol       | Permisos principales |
|-----------|----------------------|
| **admin** | Todo. Gestiona menú, usuarios, roles, horarios, dashboard, Kanban. |
| **cajero** | Ve Kanban, puede cancelar pedidos pre-cocina, aprueba modificaciones, marca pagos en efectivo si aplica a futuro. |
| **cocina** | Ve Kanban, mueve pedidos entre columnas, toggle "agotado" sobre ítems del menú. |

El admin puede **crear roles adicionales** combinando permisos granulares (ver sección 9). No se pueden eliminar los tres roles por defecto.

## 4. Alcance funcional

### 4.1. Cliente — flujo de pedido

1. **Escanea QR único del food truck** → abre `/menu` (URL fija, no tiene UUID por mesa).
2. Si el truck está **fuera de horario** o en **pausa manual**: pantalla de cerrado con próximo horario de apertura.
3. Si hay pedido activo en ese dispositivo (vía cookie): redirige a `/ticket/{ticketId}`.
4. Si no: formulario de **datos básicos** → nombre (requerido, 2–40 chars) + teléfono (requerido, validación AR).
5. **Pantalla de menú** con categorías, ítems disponibles, foto, precio. Ítems agotados se muestran tachados y deshabilitados.
6. **Carrito** (state local con Zustand): agregar/quitar ítems, notas por ítem (≤200 chars), ajustar cantidades.
7. **Checkout**: resumen de pedido + selección de **propina** (0% / 5% / 10% / 15% / custom hasta 30%) + total.
8. **"Pagar con Mercado Pago"** → redirección a Checkout Pro.
9. **Post-pago**:
    - Éxito: pedido se crea en estado `pending`, entra al Kanban. Cliente ve `/ticket/{ticketId}` con número de ticket y estado.
    - Fallo: pedido queda `payment_failed`, cliente puede reintentar o cancelar.
    - Abandonado (no vuelve del Checkout): pedido queda `payment_pending` por 15 min, luego se cancela automáticamente.
10. **Pantalla de ticket / beeper**: muestra número grande, estado ("En cola" → "Preparando" → "¡Listo!"), hora estimada aproximada (opcional: "~ 10 min"), botón "Cancelar pedido" (solo disponible si estado `pending` o `payment_pending`).
11. Cuando el staff marca el pedido como **`ready`**, la pestaña del cliente (si está abierta):
    - Reproduce sonido (3 pulsos, respeta mute del sistema pero ignora silencio del sitio).
    - Vibra el dispositivo (`navigator.vibrate` si está disponible).
    - Muestra cartel a pantalla completa: **"¡TICKET #042 LISTO!"** con animación pulsante.
    - El cartel permanece hasta que el cliente lo cierra manualmente o hasta que el staff marca el pedido como entregado.

### 4.2. Staff — Vista cocina por tickets

La cocina opera una pantalla configurable por preferencia del cocinero:

- **Tickets**: todos los pedidos activos aparecen como tickets independientes en una grilla.
- **Kanban**: los mismos tickets se agrupan en columnas por estado global del pedido (`Pendiente`, `En preparación`, `Listo`).

En ambos modos, cada pedido activo muestra número grande, nombre del cliente, notas adicionales y temporizador de antigüedad.

**Acciones por ticket:**

- Avanzar cada ítem por su propio ciclo: `Pendiente` → `En preparación` → `Listo` → `Entregado`.
- Avanzar todos los ítems del ticket con un botón general que actúa sobre el siguiente grupo pendiente.
- **Llamar por número**: botón "Llamar ticket" gatilla el beeper en el cliente cuando el pedido ya está listo. En el cliente se ve como `pulse_at` actualizado, el polling lo detecta y dispara el sonido/cartel.
- **Aprobar modificación**: si el cliente solicitó cambios (ver 4.3), aparece alerta en el ticket; cajero/admin aprueba o rechaza.

Los pedidos **entregados** se archivan automáticamente al completar todos sus ítems. Quedan accesibles desde el historial.

**Polling** cada 5s. Botón "Actualizar" visible y accesible.

### 4.3. Modificaciones de pedido por parte del cliente

Una vez pagado, el cliente **no puede modificar** libremente su pedido. Puede **solicitar** una modificación:

- Agregar/quitar ítems → genera un request visible en el Kanban.
- El cajero/admin lo aprueba o rechaza.
- Si la modificación implica diferencia de precio:
    - A favor del truck: se genera un cobro adicional por Mercado Pago (link/QR enviado por el mismo sistema, el cliente lo ve en `/ticket/{ticketId}`).
    - A favor del cliente: queda como "pendiente de reembolso manual" (sin integración automática en MVP).

**Esto es complejidad opcional.** Ver sección 13, Fase 5. Para el MVP mínimo viable, alcanza con que el cliente pueda **cancelar** su pedido si todavía está en `pending`.

### 4.4. Admin — Dashboard

Secciones:

1. **Home / métricas del día**:
    - Total vendido hoy (ARS).
    - Cantidad de pedidos (pendientes, en prep, listos, entregados, cancelados).
    - Ítem más vendido del día.
    - Ticket promedio.
    - Tiempo promedio de preparación (de `pending` a `ready`).
2. **Kanban** (igual al de staff, con permisos completos).
3. **Menú**:
    - CRUD de categorías (orden, nombre, visible/oculta).
    - CRUD de ítems (nombre, descripción, precio, foto, categoría, disponible toggle, variantes toggle).
    - Sistema de **variantes como toggle**: un ítem puede tener variantes activas (ej: "Hamburguesa — Simple/Doble/Triple"). Cada variante tiene nombre y precio propio. Se habilita/deshabilita desde el admin. Ver sección 8.2.
4. **Horario**:
    - Horarios por día de la semana (apertura/cierre).
    - **Pausa manual** ("cerrar ahora aunque esté en horario"): útil si se acabó el gas, por ejemplo.
5. **Usuarios y roles**:
    - CRUD de usuarios staff (email, nombre, rol, activo/inactivo).
    - CRUD de roles (nombre + permisos granulares).
6. **Historial de pedidos**:
    - Filtros por fecha, estado, cliente, monto.
    - Exportar a CSV (post-MVP, queda como nice-to-have).
7. **Ajustes**:
    - Nombre del truck, logo, color primario.
    - Credenciales Mercado Pago (access token).
    - Propinas sugeridas (valores por defecto).
    - Sonido del beeper (elegir entre 2–3 sonidos predefinidos).

## 5. Flujos principales (diagramas narrados)

### 5.1. Happy path cliente

```
Escanear QR → /menu → Datos (nombre + tel) → Armar carrito →
Checkout con propina → Mercado Pago → Vuelve con status=success →
Pedido entra a Kanban en "Pendiente" → /ticket/#042 abierto (beeper armado) →
Cocina mueve a "En preparación" → cliente ve cambio de estado tras polling →
Cocina mueve a "Listo" → BEEEEP + cartel pantalla completa →
Cliente retira → Staff marca "Entregado" (o se archiva a los 5 min)
```

### 5.2. Pago fallido / abandono

```
Cliente llega al Checkout pero no paga → vuelve con status=failure o no vuelve →
Pedido queda en payment_pending 15 min → job de limpieza (cron) lo marca como cancelled →
Nunca entra al Kanban del staff.
```

### 5.3. Cliente perdió la conexión / cerró pestaña

```
Cocina marca "Listo" → cliente no tiene la pestaña activa →
Staff ve en Kanban: "Cliente no visualizó en 2 min" (badge de alerta) →
Staff usa el teléfono que registró el cliente para avisarle por WhatsApp/llamada (manual, fuera del sistema) →
Al abrir la pestaña de nuevo, el cliente ve el cartel "¡LISTO!" (el estado persiste).
```

### 5.4. Staff llama manualmente por número

```
Cliente está en /ticket/#042 con pestaña activa →
Staff toca "🔔 Llamar ticket" en el Kanban →
Backend actualiza pulse_at del pedido →
Siguiente poll del cliente (≤5s) detecta nuevo pulse_at →
Dispara sonido + vibración + cartel.
```

## 6. Stack técnico

Heredado de MesaQR con ajustes:

- **Framework:** Next.js 15 (App Router) + TypeScript estricto.
- **DB:** Supabase Postgres.
- **Auth staff:** Supabase Auth (email + password) + `@supabase/ssr`.
- **Auth cliente:** JWT custom firmado con `jose`, cookie httpOnly por dispositivo. Dura 24h o hasta que el pedido se cierre.
- **Storage:** Supabase Storage (fotos de menú, logo, íconos PWA).
- **UI:** Tailwind CSS + shadcn/ui + Lucide.
- **State:** Zustand (carrito) + React Query v5 (server state + polling).
- **Validación:** Zod en todos los route handlers y forms.
- **Pagos:** Mercado Pago SDK Node oficial (Checkout Pro).
- **PWA / Push:** `web-push` (server, para envío con VAPID). Service Worker vanilla en `public/sw.js`. Sin `next-pwa` ni Workbox en MVP (no necesitamos caching offline, solo push).
- **Hosting:** Vercel free tier.
- **Node:** 20 LTS.

**Sin realtime.** Polling cada 5s para toda la app. El beeper usa tres capas: sonido in-pestaña (polling), Web Push (Service Worker, solo si el cliente aceptó), y contacto manual del staff (WhatsApp/llamada desde el Kanban).

## 7. Seguridad y autorización

1. **`service_role_key` solo en server** (`lib/supabase/admin.ts`). Nunca en cliente.
2. **Browser nunca habla directo con Supabase**: todo pasa por route handlers de Next.
3. **RLS activada en todas las tablas** como segunda línea de defensa.
4. **Server-side recalcula totales**. El cliente nunca decide precios, total final o propina final.
5. **Webhook Mercado Pago idempotente** por `external_id`.
6. **Snapshots** de `name_snapshot` y `price_snapshot` en `order_items`.
7. **Rate limiting** en endpoints públicos (crear pedido, crear preference): por IP + por cookie, 10 req/min. Usar middleware simple con `@upstash/ratelimit` o implementación in-memory aceptable para MVP.
8. **Auditoría**: toda modificación/cancelación de pedido por staff registra `actor_user_id`, `action`, `reason`, `at` en `audit_log`.

## 8. Modelo de datos

### 8.1. Entidades principales

```
truck_config            # fila única, config del único truck
  id, name, logo_url, primary_color, mp_access_token_encrypted,
  tip_defaults_json, beep_sound_id, paused_manual_at, paused_reason

opening_hours           # 7 filas, una por día de semana
  id, weekday (0..6), opens_at, closes_at, closed (bool)

category
  id, name, position, visible, created_at

menu_item
  id, category_id, name, description, price_cents, photo_url,
  available (bool), has_variants (bool), created_at, updated_at

menu_variant            # solo si menu_item.has_variants = true
  id, menu_item_id, name, price_cents, available, position

customer                # persistimos nombre + tel para contacto de respaldo
  id, name, phone, created_at
  (una "sesión" del cliente se identifica por JWT en cookie; el customer se
   reutiliza si matchea (name, phone) en las últimas 24h, opcional)

order
  id, ticket_number (int, único por día de servicio),
  service_date (date, YYYY-MM-DD en TZ del truck),
  customer_id, status ('payment_pending'|'payment_failed'|'pending'|
                       'in_progress'|'ready'|'delivered'|'cancelled'),
  subtotal_cents, tip_cents, total_cents,
  mp_preference_id, mp_payment_id, mp_status,
  pulse_at (timestamp — se actualiza al llamar manualmente),
  ready_at, delivered_at, cancelled_at, cancel_reason,
  refund_pending (bool, para tracking manual),
  created_at, updated_at

order_item
  id, order_id, menu_item_id, menu_variant_id (nullable),
  qty, name_snapshot, price_snapshot_cents, notes, created_at

order_modification_request  # cliente pide agregar/quitar post-pago
  id, order_id, type ('add'|'remove'), payload_json,
  status ('pending'|'approved'|'rejected'),
  reviewed_by, reviewed_at, note

staff_user              # alias sobre auth.users + rol
  id (= auth uid), email, full_name, role_id, active, created_at

role
  id, name, is_system (bool — true para admin/cajero/cocina),
  permissions_json

audit_log
  id, actor_user_id, action, target_type, target_id,
  reason, metadata_json, at

mp_webhook_event        # idempotencia
  id, external_id, received_at, processed_at, payload_json

push_subscription       # suscripciones Web Push por pedido
  id, order_id, endpoint (text, unique),
  p256dh (text), auth (text),
  user_agent (text), platform (text nullable — 'android'|'ios'|'desktop'),
  created_at, last_used_at, failed_at (nullable)

beeper_event            # opcional, para debug/analytics
  id, order_id, kind ('auto_ready'|'manual_pulse'|'push_sent'|'push_failed'), at, metadata_json
```

### 8.2. Variantes (toggle)

- `menu_item.has_variants = false` → se pide tal cual.
- `menu_item.has_variants = true` → el cliente **debe** elegir una variante antes de agregar al carrito. El precio efectivo sale de la variante, no del ítem.

Esto se implementa como toggle en el admin sin cambiar el schema dinámicamente.

### 8.3. Numeración de ticket

- Por día de servicio en TZ del truck (ej: `America/Argentina/Buenos_Aires`).
- Secuencia: 1, 2, 3… empieza en 1 cada día a medianoche local.
- Implementado con `SELECT COALESCE(MAX(ticket_number), 0) + 1 FROM order WHERE service_date = today_local FOR UPDATE` dentro de una transacción (o con una secuencia Postgres reseteada por cron a medianoche). Prefiero la primera opción por simplicidad.

## 9. Permisos granulares

Lista inicial de permisos (cada rol tiene un array):

```
menu.read
menu.write           # CRUD de ítems, categorías, variantes
menu.toggle          # solo prender/apagar disponibilidad (más restringido)
orders.read
orders.advance       # mover entre columnas del Kanban
orders.pulse         # llamar al cliente manualmente
orders.cancel
orders.approve_mod
hours.write
users.manage
roles.manage
dashboard.view
settings.write
```

**Roles por defecto:**

| Rol     | Permisos |
|---------|----------|
| admin   | todos |
| cajero  | `orders.*`, `menu.toggle`, `dashboard.view` |
| cocina  | `orders.read`, `orders.advance`, `menu.toggle` |

El admin puede crear roles custom mezclando los permisos.

## 10. API / endpoints principales

Convención: `{ error: { code, message } }` para errores.

### Cliente (público, con JWT en cookie)

```
POST /api/customer/session        # crea sesión tras ingresar nombre+tel
GET  /api/menu                    # menú público: categorías + ítems disponibles
POST /api/customer/order          # crea orden + preference MP, devuelve init_point
GET  /api/customer/order/:id      # estado del pedido (polling del beeper)
POST /api/customer/order/:id/cancel       # solo si payment_pending/pending
POST /api/customer/order/:id/request-mod  # pide modificación (post-pago)
GET  /api/customer/truck-status   # abierto/cerrado + próximo horario
POST /api/customer/push/subscribe        # registra PushSubscription para un pedido
POST /api/customer/push/unsubscribe      # elimina suscripción
```

### Webhook

```
POST /api/webhooks/mercadopago    # notificaciones de pago, idempotente por external_id
```

### Staff (auth Supabase)

```
GET  /api/staff/kanban            # pedidos activos para cocina
POST /api/staff/orders/:id/advance
POST /api/staff/orders/:id/items/:itemId/advance
POST /api/staff/orders/:id/items/advance-all
POST /api/staff/orders/:id/pulse
POST /api/staff/orders/:id/cancel
POST /api/staff/orders/:id/approve-mod
POST /api/staff/orders/:id/reject-mod
POST /api/staff/orders/:id/deliver
```

### Admin

```
GET/POST/PATCH/DELETE /api/admin/categories[/:id]
GET/POST/PATCH/DELETE /api/admin/menu-items[/:id]
GET/POST/PATCH/DELETE /api/admin/variants[/:id]
GET/PATCH             /api/admin/hours
POST                  /api/admin/truck/pause
POST                  /api/admin/truck/resume
GET/POST/PATCH/DELETE /api/admin/users[/:id]
GET/POST/PATCH/DELETE /api/admin/roles[/:id]
GET                   /api/admin/dashboard/today
GET                   /api/admin/orders/history
PATCH                 /api/admin/settings
```

## 11. UI / pantallas

### Cliente

- `/menu` — landing post-QR: form de datos si es primera vez, o menú si ya hay sesión.
- `/cart` — carrito + checkout + propina.
- `/pay/return` — landing post-Mercado Pago (success/failure/pending).
- `/ticket/[id]` — pantalla de beeper con número grande.

### Staff

- `/staff/login` — login Supabase.
- `/staff/kanban` — vista de cocina con selector entre modo Tickets y modo Kanban, avance por ítem y acción general por pedido.
- `/staff/order/[id]` — detalle del pedido.

### Admin

- `/admin` — dashboard con métricas del día.
- `/admin/menu` — gestión de menú.
- `/admin/hours` — horarios + pausa manual.
- `/admin/users` — gestión de usuarios.
- `/admin/roles` — gestión de roles y permisos.
- `/admin/history` — historial de pedidos.
- `/admin/settings` — ajustes generales.

Todo en **español argentino** (UI). Código y commits en inglés.

## 12. Estrategia de notificaciones (beeper)

El beeper tiene **tres capas** que trabajan en paralelo. Todo cliente, sin hacer nada, recibe la capa 1. Las otras dos son opcionales/fallback.

### 12.1. Capa 1 — Sonido in-pestaña (siempre, para todos)

Funciona sin instalar nada, sin permisos especiales. Requiere que la pestaña siga abierta.

- Sonidos alojados en `/public/beep/{id}.mp3`. 3 opciones precargadas (`classic.mp3`, `soft.mp3`, `marcado.mp3`). El admin elige cuál se usa; el cliente no lo configura.
- En `/ticket/[id]`:
    - Al montar el componente, precargar el audio y pedir `AudioContext.resume()` tras el primer gesto del usuario (requerido por iOS Safari).
    - Polling React Query cada 5s a `/api/customer/order/:id`.
    - Si la respuesta cambia `status` a `ready` **o** `pulse_at` es más reciente que el último visto localmente, disparar beeper.
    - Reproducir sonido 3 veces con 500ms de gap.
    - Vibrar `[400, 200, 400, 200, 400]` si `navigator.vibrate` existe.
    - Mostrar overlay fullscreen: fondo pulsante, número de ticket gigante, mensaje "¡LISTO PARA RETIRAR!", botón "OK" para cerrar.
    - Persistir en `localStorage` el último `pulse_at` visto, para que al reabrir la pestaña tras refresh no se dispare de nuevo si ya se consumió.

**Limitación aceptada:** si el cliente silencia el sitio, bloquea autoplay, cierra la pestaña, o está en iOS con Bajo Consumo, el sonido puede fallar. Por eso existen las capas 2 y 3.

### 12.2. Capa 2 — PWA instalable + Web Push (opcional, por decisión del cliente)

Para clientes que aceptan instalar la app. Funciona con pestaña cerrada y teléfono bloqueado. Requiere que el cliente:

1. Instale la PWA (Android: prompt nativo; iOS: "Agregar a pantalla de inicio" manual).
2. Acepte el permiso de notificaciones.

**Flujo del cliente:**

- `public/manifest.json` con nombre, íconos, `display: standalone`, theme color del truck.
- `public/sw.js` Service Worker servido desde la raíz (scope máximo). Se registra en el layout del cliente solo si el navegador soporta Service Worker + Push API + Notification API.
- A los **10 segundos** de estar en `/ticket/[id]` (tiempo suficiente para que el cliente "entienda" que el pedido es real y querría un aviso), se muestra un **banner no intrusivo** en la parte inferior: *"¿Querés recibir el aviso aunque cierres la pestaña? Instalá FoodTag como app."*
    - Android Chrome / Edge: captura `beforeinstallprompt` y lo dispara al tocar "Sí". Tras instalación exitosa, pide permiso de notificaciones con otro tap.
    - iOS Safari: al tocar "Sí", muestra un modal con instrucciones visuales ("Tocá el botón compartir → Agregar a pantalla de inicio"). Detecta luego si corre en modo `standalone` y pide permiso.
    - Desktop: igual a Android.
- Si el cliente acepta el permiso, se crea una `PushSubscription` con `VAPID_PUBLIC_KEY` y se envía al servidor vía `POST /api/customer/push/subscribe`. Se asocia a `order_id` para que el servidor sepa a quién notificar.
- El banner se puede cerrar con una X y **no vuelve a aparecer** en ese pedido (se persiste decisión en `localStorage`).

**Flujo del servidor:**

- Cuando un pedido pasa a `ready` o recibe un `pulse`:
    1. Se actualiza DB (lo que ya hace).
    2. Se busca `push_subscription` asociada al pedido.
    3. Si existe, se envía Web Push con `web-push`, firmada con VAPID, con payload:
        ```json
        {
          "type": "ready" | "pulse",
          "ticket": 42,
          "title": "¡Ticket #42 listo!",
          "body": "Pasá a retirar.",
          "tag": "order-<id>"
        }
        ```
    4. Si la `PushSubscription` devuelve 410/404 (gone/expired), se elimina de la DB.
- El envío es **fire-and-forget** (no bloquea la respuesta al staff). Se registra en `beeper_event` para debug.

**Service Worker (`public/sw.js`):**

- Escucha evento `push` → dispara `self.registration.showNotification(title, { body, tag, icon, badge, vibrate, requireInteraction: true })`.
- Escucha `notificationclick` → abre/focusa la PWA en `/ticket/{id}`.
- **No cachea nada.** No implementa estrategia offline. `self.skipWaiting()` + `clients.claim()` para updates inmediatos.
- Tampoco se usa para polling en background ni nada más.

**Sonido de la notificación push:**

- **En capa 2 NO controlamos el sonido de la notificación**: lo elige el sistema operativo del dispositivo (sonido default de notificaciones del teléfono).
- Esto es una limitación del estándar Notification API actual. Solo podemos indicar `silent: false` y `vibrate`.
- Cuando el usuario toca la notificación y la PWA se abre, si el pedido sigue en `ready` se dispara la capa 1 (nuestro sonido custom + cartel fullscreen).

### 12.3. Capa 3 — Fallback manual del staff (siempre disponible)

Para el caso en que las dos capas anteriores fallaron o el cliente simplemente no reaccionó.

- El Kanban muestra un **badge de alerta** en pedidos que están en `ready` hace más de 2 minutos sin que se haya detectado interacción del cliente (ej: la pestaña del cliente dejó de hacer polling hace rato).
- El detalle del pedido muestra nombre + teléfono con dos botones destacados:
    - **"WhatsApp"** → link `wa.me/<telefono>?text=<mensaje>` pre-llenado con "Hola {nombre}! Tu pedido #{ticket} ya está listo, te esperamos en el truck."
    - **"Llamar"** → link `tel:<telefono>`.
- También el botón **"🔔 Llamar ticket"** (pulse) sigue disponible para que el staff gatille remotamente el beeper si la pestaña del cliente está abierta.

### 12.4. Soporte por plataforma (resumen)

| Plataforma           | Capa 1 (in-pestaña) | Capa 2 (PWA + Push) |
|----------------------|---------------------|---------------------|
| Android Chrome       | Sí                  | Sí, sin instalar explícito (aunque se recomienda) |
| Android Firefox      | Sí                  | Sí                  |
| iOS Safari ≥ 16.4    | Sí                  | **Solo si el usuario agrega a pantalla de inicio** |
| iOS Chrome/Firefox   | Sí                  | No (usan WebKit igual que Safari) |
| Desktop Chrome/Edge  | Sí                  | Sí                  |
| Desktop Firefox      | Sí                  | Sí                  |
| Desktop Safari       | Sí                  | Sí (sin requerir instalación) |

**Nota sobre iOS:** la fricción de "agregar a pantalla de inicio" en iOS es real. El cliente que no haga ese paso no recibe Web Push, solo tiene capa 1 y capa 3. La UI explica esto claramente y no lo oculta.

## 13. Fases de desarrollo

### Fase 0 — Setup (1 sprint)
- Proyecto Next.js + Tailwind + shadcn.
- Supabase setup (staging).
- Auth Supabase para staff, primer admin seedeado.
- Variables de entorno y estructura de carpetas.
- Generación de VAPID keys (para usar en Fase 6).

### Fase 1 — Menú público y admin (1–2 sprints)
- Modelo de datos para categorías, ítems, variantes.
- CRUD admin de menú.
- Vista pública `/menu`.
- Horarios y pausa manual.

### Fase 2 — Sesión cliente + carrito + pedido sin pago (1 sprint)
- JWT cliente con nombre + teléfono.
- Zustand para carrito.
- Creación de orden en estado `pending` (sin pago por ahora, para desarrollo).
- Pantalla de ticket con polling y beeper capa 1 (sonido in-pestaña + cartel fullscreen).

### Fase 3 — Kanban staff (1 sprint)
- `/staff/kanban` con tres columnas.
- Acciones de avanzar/cancelar/pulse.
- Botones WhatsApp/Llamar en detalle de pedido (capa 3).
- Polling 5s.
- Roles por defecto aplicados.

### Fase 4 — Integración Mercado Pago (1 sprint)
- Checkout Pro con preference.
- Webhook idempotente.
- Flujo completo pago → Kanban.
- Propinas.

### Fase 5 — Modificaciones post-pago y aprobaciones (1 sprint)
- Request de modificación del cliente.
- Aprobación/rechazo por staff.
- Cobro adicional / reembolso manual flag.

### Fase 6 — PWA + Web Push (1 sprint)
- `manifest.json` + íconos en múltiples tamaños.
- Service Worker en `public/sw.js` con handlers de `push` y `notificationclick`.
- Banner de instalación en `/ticket/[id]` con flujo diferenciado Android / iOS.
- `PushSubscription` + endpoints `subscribe`/`unsubscribe`.
- Envío de push desde el servidor al disparar `ready` o `pulse`.
- QA específico: Chrome Android, Safari iOS (agregando a home), Firefox Android, Chrome desktop.

### Fase 7 — Dashboard y roles custom (1 sprint)
- Métricas del día.
- CRUD de roles con permisos granulares.
- Historial de pedidos con filtros.

### Fase 8 — Pulido y hardening (½ sprint)
- Rate limiting.
- Cron de cancelación automática de `payment_pending`.
- QA cross-browser completo.
- Documentación de operación.

## 14. Fuera de alcance (explícito)

- Multi-truck.
- Realtime (Supabase Realtime, WebSockets, Server-Sent Events).
- Service Worker con caching offline (el SW solo se usa para push).
- Notificaciones automáticas por SMS o WhatsApp (staff lo hace manualmente).
- Delivery / envío a domicilio.
- Reservas / pre-pedidos.
- Impresión térmica.
- Facturación AFIP.
- Pagos parciales / split bill.
- Stock por unidad (solo toggle disponible/agotado).
- Multi-idioma.
- Offline mode.
- Fidelidad / cupones / descuentos.
- App nativa (iOS/Android). La PWA instalable cubre el caso de uso en MVP.

## 15. Métricas de éxito del MVP

- 100% de los pedidos pagados con éxito entran al Kanban en ≤ 10s tras webhook.
- La capa 1 del beeper (sonido in-pestaña) dispara correctamente en Chrome Android y Safari iOS con pestaña activa en ≥ 95% de los casos de prueba.
- La capa 2 (Web Push) se entrega en ≤ 15s desde que el staff mueve a `ready`, para clientes que aceptaron la instalación y el permiso.
- Al menos el 20% de los clientes que ven el banner de instalación aceptan instalar la PWA (indicador de producto, no de tech).
- Tiempo de carga inicial de `/menu` en 4G < 2.5s (LCP).
- Cero casos de doble cobro por webhook duplicado.
- Cero envíos duplicados de push por pedido (dedup por `tag`).
- El admin puede crear un rol custom y asignarlo a un usuario en ≤ 2 minutos sin ayuda.

## 16. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Cliente silencia el sitio y no escucha el beeper | Cartel visual pantalla completa + Web Push (si instaló PWA) + staff llama por número en voz alta + botón WhatsApp/Llamar en el Kanban. |
| Cliente en iOS no instala la PWA y no recibe Web Push | La capa 1 sigue funcionando en la pestaña. La capa 3 (contacto manual del staff) es el fallback final. |
| Webhook MP no llega | Polling del cliente también consulta estado; job cada minuto reconcilia preferences pendientes contra la API de MP. |
| Latencia de polling hace que el cliente vea "Listo" con delay de 5s | Aceptable. Para clientes con Web Push, la push llega casi instantánea. |
| Service Worker queda con versión vieja "pegada" | `self.skipWaiting()` + `clients.claim()` en cada instalación. SW no cachea nada, solo push. |
| `PushSubscription` se vuelve inválida (cliente desinstaló, navegador la revocó) | El servidor captura respuesta 404/410 del push service, marca `failed_at` y deja de usarla. |
| Numeración de ticket duplicada por race condition | Transacción con `FOR UPDATE` + índice único `(service_date, ticket_number)`. |
| Admin se bloquea a sí mismo creando roles mal | No permitir editar el rol propio ni quitarle `users.manage` al último admin. Validación server-side. |
| Cliente cierra pestaña, no instaló PWA, y nunca vuelve | Tenemos nombre + teléfono registrados. Staff puede contactar por WhatsApp/llamada desde el Kanban. |

## 17. Preguntas abiertas

- ¿Queremos que el cliente pueda dejar calificación / feedback tras retirar? (Post-MVP.)
- ¿Necesitamos soporte para descuentos puntuales (ej: combo del día) en el MVP, o lo dejamos afuera? **Decisión actual: afuera.**
- ¿El teléfono del cliente se valida con OTP o confiamos en lo que ingresa? **Decisión actual: confiamos, validamos solo formato.**
- ¿Hay un tope de items por pedido? **Decisión actual: 20 ítems distintos / 99 por ítem.**
