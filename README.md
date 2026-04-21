# FoodTag

FoodTag es una web app de pedidos autoservicio para food trucks construida con Next.js App Router, Supabase y Mercado Pago.

## Estado actual

Este baseline implementa **Fase 0 + Fase 1** del PRD:

- Scaffold completo con Next.js 15, Tailwind v4, shadcn/ui, Vitest y TypeScript estricto.
- Auth staff con Supabase SSR y middleware para `/staff` y `/admin`.
- Migración inicial para `truck_config`, `opening_hours`, `category`, `menu_item`, `menu_variant`, `role`, `staff_user` y `audit_log`.
- Seed de roles del sistema y admin inicial.
- APIs iniciales:
  - `GET /api/menu`
  - `GET /api/customer/truck-status`
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

Completá `.env.local` con tus credenciales de Supabase y Mercado Pago.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run seed
```

## Base de datos

Aplicá primero la migración de `supabase/migrations/202604200001_initial_foodtag.sql` en staging y luego corré:

```bash
npm run seed
```

## Notas

- El repo original `D:\FoodTag` estaba bloqueado en solo lectura para este proceso, así que esta implementación quedó en un mirror temporal de trabajo.
- La sesión cliente con JWT, carrito persistente, ticket y beeper real se resuelven en la próxima fase.
