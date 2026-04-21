# FoodTag

FoodTag es una web app de pedidos autoservicio para food trucks construida con Next.js App Router y SQLite local.

## Estado actual

Este baseline implementa **Fase 0 + Fase 1** del PRD:

- Scaffold completo con Next.js, Tailwind v4, shadcn/ui, Vitest y TypeScript estricto.
- Persistencia local con SQLite en `data/foodtag.sqlite`.
- Auth staff local con email/password, hash PBKDF2 y cookie httpOnly firmada.
- Migración inicial para `truck_config`, `opening_hours`, `category`, `menu_item`, `menu_variant`, `role`, `staff_user` y `audit_log`.
- Seed de roles del sistema y admin inicial.
- APIs iniciales:
  - `GET /api/menu`
  - `GET /api/customer/truck-status`
  - `POST /api/staff/login`
  - CRUD admin para categorías, ítems, variantes, horarios y pausa manual.
- UI inicial de:
  - `/menu`
  - `/staff/login`
  - `/admin`
  - `/admin/menu`
  - `/admin/hours`

## Setup

```bash
npm install
cp .env.example .env.local
```

Completá `.env.local` con secretos locales largos para:

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

Podés cambiarlo antes de correr el seed con:

```env
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_ADMIN_FULL_NAME=
```

## Notas

- No hay dependencia externa de base de datos ni auth.
- La sesión cliente con JWT, carrito persistente, ticket y beeper real se resuelven en la próxima fase.
