import { buildTruckStatus } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";
import type { OpeningHours, TruckConfig } from "@/lib/types/domain";

export type PublicTruck = {
  slug: string;
  name: string;
  address: string;
  publicTagline: string;
  brandIcon: string;
  primaryColor: string;
  isOpen: boolean;
  todayHoursLabel: string;
  nextOpeningLabel: string | null;
  paused: boolean;
};

type Row = {
  id: string;
  name: string;
  slug: string | null;
  brand_icon: string;
  primary_color: string;
  timezone: string;
  paused_manual_at: string | null;
  paused_reason: string | null;
  address: string | null;
  public_tagline: string | null;
};

type HoursRow = {
  id: string;
  truck_id: string;
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  closed: number;
};

/**
 * Todos los foodtrucks para la pantalla de eleccion del cliente.
 *
 * No lleva sesion ni truck activo a proposito: es justamente la vista de quien
 * todavia no eligio. Solo devuelve datos publicos, los mismos que veria al
 * escanear el QR de cada uno.
 *
 * Se excluyen los que no tienen slug: sin el no hay URL a la que mandarlos.
 */
export async function listPublicTrucks(): Promise<PublicTruck[]> {
  const db = getDb();

  const [truckResult, hoursResult] = await Promise.all([
    db.execute(`
      select
        truck_config.id, truck_config.name, truck_config.slug,
        truck_config.brand_icon, truck_config.primary_color, truck_config.timezone,
        truck_config.paused_manual_at, truck_config.paused_reason,
        truck_profile.address, truck_profile.public_tagline
      from truck_config
      left join truck_profile on truck_profile.truck_config_id = truck_config.id
      where truck_config.slug is not null and truck_config.slug <> ''
      order by truck_config.name asc
    `),
    db.execute("select * from opening_hours"),
  ]);

  const hoursByTruck = new Map<string, OpeningHours[]>();
  for (const row of hoursResult.rows as unknown as HoursRow[]) {
    const entry: OpeningHours = {
      id: row.id,
      weekday: row.weekday,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      closed: Boolean(row.closed),
    };
    const current = hoursByTruck.get(row.truck_id);
    if (current) current.push(entry);
    else hoursByTruck.set(row.truck_id, [entry]);
  }

  return (truckResult.rows as unknown as Row[]).map((row) => {
    // buildTruckStatus ya sabe resolver abierto/cerrado, pausa y proximo horario;
    // se le arma un TruckConfig minimo porque el resto no se usa en el listado.
    const config = {
      id: row.id,
      name: row.name,
      slug: row.slug ?? "",
      address: row.address ?? "",
      heroImageUrl: null,
      publicTagline: row.public_tagline ?? "",
      instagramHandle: null,
      brandIcon: row.brand_icon,
      allowOrderModifications: true,
      logoUrl: null,
      primaryColor: row.primary_color,
      timezone: row.timezone,
      mpAccessTokenEncrypted: null,
      tipDefaultsJson: [],
      beepSoundId: "classic",
      customerPickupCooldownSeconds: 15,
      pausedManualAt: row.paused_manual_at,
      pausedReason: row.paused_reason,
      brandingVersion: "",
    } satisfies TruckConfig;

    const status = buildTruckStatus(config, hoursByTruck.get(row.id) ?? []);

    return {
      slug: config.slug,
      name: config.name,
      address: config.address,
      publicTagline: config.publicTagline,
      brandIcon: config.brandIcon,
      primaryColor: config.primaryColor,
      isOpen: status.isOpen,
      todayHoursLabel: status.todayHoursLabel,
      nextOpeningLabel: status.nextOpeningLabel,
      paused: status.paused,
    };
  });
}
