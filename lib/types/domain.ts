import type { PERMISSIONS } from "@/lib/constants/permissions";

export type PermissionKey = (typeof PERMISSIONS)[number];

export type TruckConfig = {
  id: string;
  name: string;
  slug: string;
  address: string;
  heroImageUrl: string | null;
  publicTagline: string;
  instagramHandle: string | null;
  brandIcon: string;
  allowOrderModifications: boolean;
  logoUrl: string | null;
  primaryColor: string;
  timezone: string;
  mpAccessTokenEncrypted: string | null;
  tipDefaultsJson: number[];
  beepSoundId: string;
  customerPickupCooldownSeconds: number;
  pausedManualAt: string | null;
  pausedReason: string | null;
  brandingVersion: string;
};

export type OpeningHours = {
  id: string;
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
};

export type Category = {
  id: string;
  name: string;
  position: number;
  visible: boolean;
  createdAt: string;
};

export type MenuVariant = {
  id: string;
  menuItemId: string;
  name: string;
  priceCents: number;
  available: boolean;
  position: number;
};

export type MenuModifier = {
  id: string;
  menuItemId: string;
  label: string;
  defaultChecked: boolean;
  position: number;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  photoUrl: string | null;
  available: boolean;
  hasVariants: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  variants: MenuVariant[];
  modifiers: MenuModifier[];
};

export type Role = {
  id: string;
  name: string;
  isSystem: boolean;
  permissionsJson: PermissionKey[];
};

export type StaffUser = {
  id: string;
  email: string;
  fullName: string;
  truckId: string;
  roleId: string;
  active: boolean;
  createdAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type OrderItemStatus = "pending" | "preparing" | "ready" | "delivered";

export type OrderItem = {
  id: string;
  orderId: string;
  menuItemId: string;
  menuVariantId: string | null;
  quantity: number;
  nameSnapshot: string;
  variantNameSnapshot: string | null;
  unitPriceCents: number;
  lineTotalCents: number;
  status: OrderItemStatus;
  notes: string | null;
};

export type OrderModificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "extra_payment_pending"
  | "extra_payment_rejected";

export type OrderModificationRequest = {
  id: string;
  orderId: string;
  customerId: string;
  status: OrderModificationStatus;
  requestText: string;
  requestItems: OrderModificationRequestItem[];
  staffResponse: string | null;
  extraAmountCents: number;
  mpPreferenceId: string | null;
  mpPaymentId: string | null;
  mpCheckoutUrl: string | null;
  paidAt: string | null;
  resolvedByStaffUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderModificationRequestItem = {
  orderItemId: string;
  itemName: string;
  quantity: number;
  modifierLabels: string[];
};

export type CustomerOrder = {
  id: string;
  truckId: string;
  ticketNumber: number;
  serviceDate: string;
  customerId: string;
  status: OrderStatus;
  paymentStatus: "pending" | "approved" | "rejected" | "cancelled" | "refunded";
  mpPreferenceId: string | null;
  mpPaymentId: string | null;
  paidAt: string | null;
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
  pulseAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  pickedUpAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  refundPending: boolean;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  modificationRequests: OrderModificationRequest[];
};

/**
 * Payload liviano que se pollea cada 5 s. NO incluye imagenes: el logo y el
 * hero se guardan como data URI en la DB y pesan cientos de KB. Van aparte en
 * TruckBranding, que se pide una sola vez y se cachea.
 */
export type TruckStatus = {
  isOpen: boolean;
  nextOpeningLabel: string | null;
  paused: boolean;
  reason: string | null;
  truckName: string;
  address: string;
  publicTagline: string;
  instagramHandle: string | null;
  brandIcon: string;
  primaryColor: string;
  todayHoursLabel: string;
  allowOrderModifications: boolean;
  beepSoundId: string;
  customerPickupCooldownSeconds: number;
  /**
   * Cambia cada vez que se guarda el logo o la foto del landing. Los clientes
   * lo usan para armar la URL del branding, asi que un cambio de identidad
   * invalida solo, sin depender de que ningun cache expire.
   */
  brandingVersion: string;
};

/** Identidad visual del truck. Cambia muy de vez en cuando: se cachea fuerte. */
export type TruckBranding = {
  truckName: string;
  brandIcon: string;
  primaryColor: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
};

export type MenuCategoryWithItems = Category & {
  items: MenuItem[];
};
