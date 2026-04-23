# AGENTS.md — FoodTag

Guía de trabajo para Agentes IA en este repositorio. Leer **antes** de cualquier sesión.

## Contexto del proyecto

**FoodTag** es una web app de pedidos autoservicio para food trucks. Los clientes escanean **un único QR** pegado en el truck, ven el menú, arman el pedido **desde un solo celular** (sin sesión colaborativa), pagan con Mercado Pago Checkout Pro, y reciben un número de ticket. El teléfono del cliente funciona como **beeper digital**: suena y muestra un cartel a pantalla completa cuando el pedido está listo para retirar.

FoodTag es además una **PWA instalable** con **Web Push** opcional. El cliente puede elegir instalar la app para recibir notificaciones aunque cierre la pestaña. Si no la instala, sigue funcionando con sonido in-pestaña.

El staff opera un **tablero Kanban con tres columnas** (Pendiente → En preparación → Listo) con sincronización **por polling cada 5 segundos** (sin realtime en MVP). El admin tiene dashboard con gestión de menú, horarios, usuarios y **roles con permisos granulares configurables**.

Es un MVP **single-tenant, single-truck**, producto académico/interno de **beWeb**, sucesor conceptual de MesaQR. La diferencia clave con MesaQR: **no hay mesas, no hay pedidos colaborativos, el pago es obligatorio antes de que el pedido entre a cocina**, y **hay PWA + Web Push**.

Ver `PRD.md` para la especificación completa.

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript estricto
- **DB:** Supabase Postgres (acceso server-side con `service_role_key`)
- **Auth staff:** Supabase Auth (email + password) + `@supabase/ssr`
- **Auth cliente:** JWT custom firmado con `jose`, cookie httpOnly por dispositivo
- **Storage de imágenes:** Supabase Storage
- **UI:** Tailwind CSS + shadcn/ui + Lucide
- **State:** Zustand (carrito local) + React Query v5 (server state + polling)
- **Validación:** Zod en todos los route handlers y forms
- **Pagos:** Mercado Pago SDK Node oficial (Checkout Pro)
- **PWA / Push:** `manifest.json` + Service Worker vanilla en `public/sw.js` + `web-push` (server) con VAPID. **Sin `next-pwa` ni Workbox** (no cacheamos para offline, solo push).
- **Hosting:** Vercel (free tier)
- **Node:** 20 LTS

**Sin realtime en MVP.** Sincronización por **polling de 5 segundos** con React Query. El beeper tiene tres capas: sonido in-pestaña (capa 1, siempre), Web Push si el cliente instaló la PWA (capa 2, opcional), contacto manual del staff desde el Kanban (capa 3, fallback).

## Reglas de oro

1. **TypeScript estricto.** `strict: true`, `noUncheckedIndexedAccess: true`. Nunca `any`. Si hace falta escapar el tipo, usar `unknown` y validar con Zod.
2. **Validar todo input con Zod.** En cada route handler, parsear `body`, `params` y `searchParams` con un schema. Si falla, devolver `400` con mensaje claro.
3. **Server-side recalcula totales.** El cliente nunca decide precios, subtotales, propinas o total final. Siempre se recalcula desde la DB antes de crear la `preference` de Mercado Pago.
4. **El browser nunca habla directo con Supabase.** Toda lectura/escritura del cliente pasa por route handlers de Next.js. Para staff, usar `@supabase/ssr` que mantiene la sesión en cookies httpOnly.
5. **`service_role_key` solo en server.** Nunca importarla en componentes cliente ni exponerla. Vive en `lib/supabase/admin.ts`.
6. **RLS activada en todas las tablas** como segunda línea de defensa. Default-deny. La autorización primaria vive en route handlers.
7. **Polling con React Query.** Usar `refetchInterval: 5000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true`. Pausar polling cuando no aplica (sin sesión, pedido cerrado, etc.). Excepción documentada: `/ticket/[id]` puede bajar a 3000ms si hace falta para el beeper.
8. **Snapshots de precio/nombre.** Cuando un ítem del menú entra a una orden, se copian `name_snapshot` y `price_snapshot_cents`. Cambios futuros del menú no afectan órdenes pasadas. Idem variantes.
9. **Idempotencia en webhooks.** El webhook de Mercado Pago debe ser idempotente: si llega dos veces el mismo `external_id`, se registra en `mp_webhook_event` y no se procesa dos veces. Usar índice único.
10. **Pago obligatorio pre-cocina.** Un pedido en `payment_pending`, `payment_failed` o `cancelled` **jamás** aparece en el Kanban del staff. Sólo `pending`, `in_progress`, `ready`, `delivered`.
11. **Permisos server-side.** Toda acción del staff verifica permiso granular (ej: `orders.advance`) antes de ejecutar. Permisos vienen del `role_id` del `staff_user`. Nunca confiar en la UI para ocultar: la UI oculta por UX, el servidor rechaza por seguridad.
12. **UI en español argentino.** Todo el texto visible en español. Código, comentarios, commits, nombres de variables y de tablas en inglés.
13. **Auditoría.** Toda modificación/cancelación de pedidos por staff queda en `audit_log` con `actor_user_id`, `action`, `reason`, `metadata_json`, `at`.
14. **Numeración de ticket segura.** Generar `ticket_number` dentro de una transacción con `SELECT ... FOR UPDATE` o usar `advisory_lock` por `service_date` para evitar races. Índice único en `(service_date, ticket_number)`.
15. **Service Worker solo para push.** `public/sw.js` no cachea nada, no implementa estrategias offline. Solo maneja `push` y `notificationclick`. Usar `self.skipWaiting()` + `clients.claim()` para que los updates sean inmediatos.
16. **VAPID keys solo en server.** `VAPID_PRIVATE_KEY` nunca va al cliente. Solo `NEXT_PUBLIC_VAPID_PUBLIC_KEY` se expone (está diseñada para ser pública).
17. **Instalación PWA es opt-in.** Nunca forzar la instalación ni pedir permisos de notificación en el load. El banner aparece a los 10s de estar en `/ticket/[id]`, y se puede cerrar para no volver a aparecer en ese pedido.
18. **Push con dedup por `tag`.** Todas las notificaciones push del mismo pedido usan `tag: "order-<id>"` para que si llegan varias (ej: `ready` + `pulse`), no se apilen en la barra de notificaciones.
19. **Limpieza de `PushSubscription` inválidas.** Si el envío de push devuelve 404/410, marcar la subscription con `failed_at` y no volver a usarla. Idealmente correrlo en try/catch para no tirar el flujo principal del staff.

## Convenciones de código

### Naming

- **Archivos:** `kebab-case.ts` para utils, `PascalCase.tsx` para componentes React.
- **Componentes:** `PascalCase`.
- **Variables y funciones:** `camelCase`.
- **Tipos:** `PascalCase`. Preferir `type` sobre `interface` salvo para extensión.
- **Constantes globales:** `UPPER_SNAKE_CASE`.
- **Tablas DB:** `snake_case` singular (`order`, `menu_item`). Cuando un nombre colisione con keyword SQL, usar comillas dobles en la migración o pluralizar (`orders` si hace falta).
- **Columnas DB:** `snake_case`.
- **Rutas API:** `kebab-case` (`/api/customer/order/:id/request-mod`).

### Estructura de route handlers

```ts
// app/api/customer/order/route.ts
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession } from '@/lib/auth/customer-jwt';
import { supabaseAdmin } from '@/lib/supabase/admin';

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        variantId: z.string().uuid().nullable(),
        qty: z.number().int().min(1).max(99),
        notes: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(20),
  tipCents: z.number().int().min(0).max(50_000),
});

export async function POST(req: NextRequest) {
  const session = await getCustomerSession(req);
  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: parsed.error.message } },
      { status: 400 }
    );
  }

  // 1. Traer precios reales desde DB
  // 2. Recalcular subtotal + tip + total server-side
  // 3. Crear order en status 'payment_pending'
  // 4. Crear preference en Mercado Pago
  // 5. Devolver init_point
}
```

### Patrón de polling con React Query

```ts
// components/customer/use-ticket-status.ts
export function useTicketStatus(ticketId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      const res = await fetch(`/api/customer/order/${ticketId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<TicketStatus>;
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    enabled,
  });
}
```

### Patrón del beeper en el cliente

```ts
// components/customer/beeper.tsx
// Al detectar cambio de status a 'ready' O pulse_at más reciente:
// 1. Reproducir audio 3 veces con gap de 500ms
// 2. navigator.vibrate?.([400, 200, 400, 200, 400])
// 3. Mostrar overlay fullscreen
// 4. Persistir lastPulseAt en localStorage para no redisparar tras refresh
```

### Errores

Formato uniforme en toda la API:

```ts
{ error: { code: string, message: string } }
```

Códigos: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_INPUT`, `CONFLICT`, `OUT_OF_STOCK`, `TRUCK_CLOSED`, `ALREADY_PAID`, `INTERNAL`.

### Imports

Orden: librerías externas → alias internos (`@/...`) → relativos. Separados por línea en blanco.

## Estructura de carpetas

```
app/
  (public)/
    menu/
    cart/
    ticket/[id]/
    pay/return/
  (staff)/
    staff/login/
    staff/kanban/
    staff/order/[id]/
  (admin)/
    admin/
    admin/menu/
    admin/hours/
    admin/users/
    admin/roles/
    admin/history/
    admin/settings/
  api/
    customer/
      push/
        subscribe/
        unsubscribe/
    staff/
    admin/
    webhooks/mercadopago/
components/
  ui/                 # shadcn components
  customer/
    beeper.tsx
    install-pwa-banner.tsx
    push-permission-prompt.tsx
  staff/
  admin/
lib/
  auth/
    customer-jwt.ts
    staff-session.ts
    permissions.ts
  push/
    vapid.ts          # claves VAPID desde env
    send.ts           # función sendPushToOrder(orderId, payload)
    subscriptions.ts  # CRUD de push_subscription
  supabase/
    admin.ts          # service_role_key
    server.ts         # @supabase/ssr server client
    client.ts         # browser client (solo auth, no data)
  mercadopago/
    client.ts
    preference.ts
    webhook.ts
  validators/         # schemas Zod compartidos
  utils/
supabase/
  migrations/
public/
  manifest.json       # PWA manifest
  sw.js               # Service Worker (solo push, sin caching)
  beep/
    classic.mp3
    soft.mp3
    marcado.mp3
  icons/              # íconos PWA en 192, 256, 384, 512
    icon-192.png
    icon-512.png
    icon-maskable-512.png
middleware.ts
```

## Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Completar con credenciales de Supabase y Mercado Pago de sandbox

# 3. Aplicar migraciones a Supabase (staging)
npx supabase db push

# 4. Seedear primer admin + truck_config + horarios + roles por defecto
npm run seed

# 5. Levantar dev server
npm run dev
```

Variables de entorno mínimas (ver `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CUSTOMER_JWT_SECRET=
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CONTACT_EMAIL=      # obligatorio por spec de web-push (mailto:)
```

Para generar las VAPID keys iniciales: `npx web-push generate-vapid-keys`. Se generan una sola vez por entorno (staging y prod tienen keys distintas) y se guardan en Vercel como env vars.

## Comandos importantes

```bash
npm run dev          # dev server con turbopack
npm run build        # build de producción
npm run lint         # eslint
npm run typecheck    # tsc --noEmit (correr antes de cada commit)
npm run test         # vitest
npm run seed         # seed de staging (admin, truck_config, roles, horarios)
npx supabase db push # aplicar migraciones
```

## Antes de hacer commit

1. `npm run typecheck` debe pasar sin errores.
2. `npm run lint` debe pasar sin warnings.
3. Si tocaste el schema, agregá una migración nueva en `supabase/migrations/`. **Nunca** edites una migración ya commiteada.
4. Si agregaste un endpoint, verificá que tiene: auth, validación Zod, manejo de errores, y (si es de staff) chequeo de permiso granular.
5. Si agregaste una pantalla con datos vivos, verificá que usa polling con React Query y tiene botón "↻ Actualizar" visible.
6. Si tocaste algo de pagos o el webhook, corré los tests de idempotencia.

## Cómo trabajamos con Agentes IA

- **Una tarea por sesión.** Antes de pedir código, validar el plan: qué archivos se van a tocar, qué endpoints, qué tablas, qué permisos.
- **Fases incrementales.** El PRD tiene fases (0 a 7). Trabajamos una a la vez, no saltamos.
- **PRD primero.** Cualquier cambio funcional importante se discute y se actualiza en `PRD.md` antes de codear.
- **Preguntas antes que asunciones.** Si algo del PRD es ambiguo, preguntar antes de codear.
- **No tocar producción de Supabase sin avisar.** Las migraciones se aplican primero a staging.
- **Tests de webhooks y pagos son prioridad.** Nunca mergear cambios en `/api/webhooks/mercadopago` sin test de idempotencia pasando.

## Decisiones tomadas (no reabrir sin justificación)

- **Next.js App Router** sobre Pages Router.
- **Supabase** como DB + Auth + Storage (un solo proveedor).
- **Polling cada 5s con React Query** en lugar de Supabase Realtime. La migración a realtime queda en TODO post-MVP.
- **Sin Prisma** en MVP (cliente Supabase + tipos generados alcanzan).
- **Sin NestJS, sin Redis, sin colas.**
- **El browser nunca habla directo con Supabase.** Todo pasa por route handlers.
- **JWT custom para cliente** (no Supabase Auth, para no inflar la tabla de usuarios de Supabase con un registro por pedido).
- **URL del QR físico = URL fija del truck** (no tiene ID variable, es `/menu`). El QR se imprime una sola vez.
- **Un solo QR, una sesión por celular, un ticket por sesión.** Sin pedidos colaborativos.
- **Numeración de ticket reinicia cada día** en la TZ del truck.
- **`name_snapshot` y `price_snapshot_cents`** en `order_item`. Idem para variantes.
- **Pago obligatorio antes de entrar al Kanban.** No hay pedidos "a pagar al retirar" en MVP.
- **Beeper en tres capas:**
    - Capa 1: `<audio>` HTML + `navigator.vibrate` + cartel fullscreen, con polling 5s. Siempre activa.
    - Capa 2: PWA instalable + Web Push con Service Worker. Opt-in del cliente (banner que aparece a los 10s en `/ticket/[id]`).
    - Capa 3: Staff contacta manualmente desde el Kanban (botones WhatsApp y Llamar con el teléfono del cliente).
- **Service Worker vanilla, sin Workbox.** No cachea nada, solo maneja push.
- **Roles con permisos granulares configurables por admin.** Tres roles por defecto (admin, cajero, cocina) no se pueden eliminar.
- **Reembolsos: manuales en MVP.** El sistema marca `refund_pending = true`, un humano resuelve fuera del sistema.
- **Modificaciones post-pago: requieren aprobación de staff.** No son libres.

## Lo que NO hace este MVP (no agregar sin discutir)

Ver sección 14 del PRD. Los grandes ausentes:

- Multi-truck / multi-tenant.
- Realtime.
- Service Worker con caching offline (el SW solo maneja push).
- Notificaciones SMS o WhatsApp automáticas.
- Delivery, envío a domicilio.
- Reservas, pre-pedidos programados.
- Impresión térmica.
- Facturación AFIP.
- Pagos parciales / split bill.
- Stock por unidad (sólo toggle disponible/agotado).
- Multi-idioma.
- Offline mode.
- Fidelidad, cupones, descuentos complejos.
- App nativa (la PWA instalable cubre el caso).

## Referencias rápidas

- PRD completo: `./PRD.md`
- Esquema DB: `./supabase/migrations/`
- Proyecto hermano (MesaQR): https://github.com/cataaa1/QRorder
- Mercado Pago Checkout Pro: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing
- Mercado Pago Webhooks: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
- Supabase con Next.js (SSR): https://supabase.com/docs/guides/auth/server-side/nextjs
- Next.js App Router: https://nextjs.org/docs/app
- React Query v5: https://tanstack.com/query/latest
- shadcn/ui: https://ui.shadcn.com
- Web Audio y autoplay (iOS): https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- Web Push API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- Notification API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API
- `web-push` (npm): https://github.com/web-push-libs/web-push
- PWA en Safari iOS: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- Web App Manifest: https://developer.mozilla.org/en-US/docs/Web/Manifest
