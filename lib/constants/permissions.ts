export const PERMISSIONS = [
  "menu.read",
  "menu.write",
  "menu.toggle",
  "orders.read",
  "orders.advance",
  "orders.pulse",
  "orders.cancel",
  "orders.approve_mod",
  "hours.write",
  "users.manage",
  "users.write",
  "roles.manage",
  "dashboard.view",
  "settings.write",
] as const;

export const SYSTEM_ROLES = {
  admin: PERMISSIONS,
  cajero: [
    "orders.read",
    "orders.advance",
    "orders.pulse",
    "orders.cancel",
    "orders.approve_mod",
    "menu.toggle",
    "dashboard.view",
  ],
  cocina: ["orders.read", "orders.advance", "menu.toggle"],
} as const;
