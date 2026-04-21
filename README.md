# FoodTag

FoodTag es una web app de pedidos autoservicio para food trucks construida con Next.js App Router y SQLite local.

## Estado actual

Este baseline implementa **Fase 0 + Fase 1** y un primer corte funcional de **Fase 2** del PRD:

- Scaffold completo con Next.js, Tailwind v4, shadcn/ui, Vitest y TypeScript estricto.
- Persistencia local con SQLite en `data/foodtag.sqlite`.
- Auth staff local con email/password, hash PBKDF2 y cookie httpOnly firmada.
- Sesion cliente con JWT httpOnly, carrito persistente en el dispositivo y ticket con polling.
- Migraciones para `truck_config`, `opening_hours`, `category`, `menu_item`, `menu_variant`, `role`, `staff_user`, `audit_log`, `customer`, `customer_order`, `order_item` y contador diario de tickets.
- Seed de roles del sistema y admin inicial.
- APIs iniciales:
  - `GET /api/menu`
  - `GET /api/customer/truck-status`
  - `GET/POST /api/customer/session`
  - `POST /api/customer/order`
  - `GET /api/customer/order/:id`
  - `POST /api/staff/login`
  - CRUD admin para categorias, items, variantes, horarios y pausa manual.
- UI inicial de:
  - `/menu`
  - `/cart`
  - `/ticket/[id]`
  - `/staff/login`
  - `/admin`
  - `/admin/menu`
  - `/admin/hours`

## Setup

```bash
npm install
cp .env.example .env.local
```

Completa `.env.local` con secretos locales largos para:

```env
CUSTOMER_JWT_SECRET=
STAFF_SESSION_SECRET=
```

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run db:migrate
npm run seed
```

## Base de datos local

Para crear la DB local y cargar el admin inicial:

```bash
npm run seed
```

El archivo SQLite se crea en:

```text
data/foodtag.sqlite
```

Ese archivo queda ignorado por Git para evitar commitear datos locales.

## Credenciales iniciales

Por defecto, el seed crea:

```text
email: admin@foodtag.ar
password: ChangeMe123!
```

Podes cambiarlo antes de correr el seed con:

```env
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_ADMIN_FULL_NAME=
```

## Notas

- No hay dependencia externa de base de datos ni auth.
- El pedido de Fase 2 es mock: crea una orden real en SQLite, pero no procesa pago.
- El pago real, Kanban staff y beeper accionado desde cocina quedan para las fases siguientes.
