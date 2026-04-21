import type { PERMISSIONS } from "@/lib/constants/permissions";

export type PermissionKey = (typeof PERMISSIONS)[number];

export type TruckConfig = {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  timezone: string;
  mpAccessTokenEncrypted: string | null;
  tipDefaultsJson: number[];
  beepSoundId: string;
  pausedManualAt: string | null;
  pausedReason: string | null;
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
  roleId: string;
  active: boolean;
  createdAt: string;
};

export type TruckStatus = {
  isOpen: boolean;
  nextOpeningLabel: string | null;
  paused: boolean;
  reason: string | null;
  truckName: string;
  primaryColor: string;
  todayHoursLabel: string;
};

export type MenuCategoryWithItems = Category & {
  items: MenuItem[];
};
