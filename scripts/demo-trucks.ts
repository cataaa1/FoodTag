import { PERMISSIONS } from "../lib/constants/permissions";

/**
 * Los tres foodtrucks de demo. Entre los tres cubren todo lo que se puede
 * configurar en la app, para poder mostrarla sin tener que cargar nada a mano:
 *
 *                     La Smasheria      Taco Loco          Dulce Ruta
 *   logo              si                no (emoji)         no (emoji)
 *   portada           si                si                 no (solo color)
 *   sonido beeper     classic           marcado            soft
 *   modificaciones    permitidas        deshabilitadas     permitidas
 *   cooldown retiro   15s               60s                0s
 *   zona horaria      Buenos Aires      Buenos Aires       Cordoba
 *   horarios          todos los dias    cierra lun y mar   cierra domingo
 *   estado            abierto           segun horario      en pausa manual
 *   roles extra       encargado,        caja y cocina      -
 *                     plancha
 *
 * Y en el menu: categorias ocultas, productos agotados, variantes agotadas,
 * productos con y sin variantes, opciones marcadas y desmarcadas por defecto.
 */

type Permission = (typeof PERMISSIONS)[number];

export type DemoVariant = { name: string; priceCents: number; available?: boolean };

export type DemoItem = {
  name: string;
  description: string;
  priceCents: number;
  available?: boolean;
  variants?: DemoVariant[];
  /** Opciones del producto. `true` = marcada por defecto. */
  modifiers?: Array<[label: string, defaultChecked: boolean]>;
};

export type DemoCategory = { name: string; visible?: boolean; items: DemoItem[] };

export type DemoStaff = {
  email: string;
  fullName: string;
  role: string;
  active?: boolean;
};

export type DemoOrderLine = {
  item: string;
  variant?: string;
  quantity?: number;
  /** Mismo formato que arma el menu del cliente: "Sin pickles, Con jalapeños". */
  notes?: string;
  /** Estado del item dentro del pedido (el kanban avanza item por item). */
  status?: "pending" | "preparing" | "ready" | "delivered";
};

export type DemoOrder = {
  customer: { name: string; phone: string };
  minutesAgo: number;
  status: "pending" | "preparing" | "ready" | "delivered" | "cancelled";
  paymentStatus?: "pending" | "approved";
  tipPercent?: 0 | 5 | 10 | 15;
  lines: DemoOrderLine[];
  /** Minutos que tardo en estar listo, para ready/delivered. */
  prepMinutes?: number;
  /** El staff re-llamo al cliente desde el kanban hace N minutos. */
  pulseMinutesAgo?: number;
  cancelReason?: string;
  refundPending?: boolean;
  modificationRequest?: {
    lineIndex: number;
    modifierLabels: string[];
    status?: "pending" | "approved" | "rejected";
    staffResponse?: string;
  };
};

/** Domingo (0) a sabado (6). `null` = cerrado ese dia. */
export type DemoHours = Array<[opensAt: string, closesAt: string] | null>;

export type DemoTruck = {
  name: string;
  slug: string;
  brandIcon: string;
  primaryColor: string;
  /** Segundo color del degrade de la portada. */
  accentColor: string;
  withLogo: boolean;
  withHero: boolean;
  timezone: string;
  beepSoundId: "classic" | "soft" | "marcado";
  customerPickupCooldownSeconds: number;
  allowOrderModifications: boolean;
  address: string;
  publicTagline: string;
  instagramHandle: string | null;
  pausedReason?: string;
  hours: DemoHours;
  customRoles: Array<{ name: string; permissions: Permission[] }>;
  staff: DemoStaff[];
  menu: DemoCategory[];
  orders: DemoOrder[];
  /**
   * Pedidos ya entregados por dia de servicio, para que el dashboard y el
   * historial tengan datos: los 6 dias anteriores y lo que va de hoy.
   */
  historyOrdersPerDay: [min: number, max: number];
};

const SMASH: DemoTruck = {
  name: "La Smashería",
  slug: "la-smasheria",
  brandIcon: "🍔",
  primaryColor: "#EA580C",
  accentColor: "#F59E0B",
  withLogo: true,
  withHero: true,
  timezone: "America/Argentina/Buenos_Aires",
  beepSoundId: "classic",
  customerPickupCooldownSeconds: 15,
  allowOrderModifications: true,
  address: "Plaza Serrano, Palermo Soho",
  publicTagline: "Smash burgers a la plancha · Plaza Serrano",
  instagramHandle: "@lasmasheria",
  hours: [
    ["12:00:00", "23:30:00"],
    ["11:00:00", "23:59:00"],
    ["11:00:00", "23:59:00"],
    ["11:00:00", "23:59:00"],
    ["11:00:00", "23:59:00"],
    ["11:00:00", "23:59:00"],
    ["11:00:00", "23:59:00"],
  ],
  customRoles: [
    {
      name: "encargado",
      permissions: [
        "menu.read",
        "menu.write",
        "menu.toggle",
        "orders.read",
        "orders.advance",
        "orders.pulse",
        "orders.cancel",
        "orders.approve_mod",
        "hours.write",
        "dashboard.view",
      ],
    },
    { name: "plancha", permissions: ["orders.read", "orders.advance"] },
  ],
  staff: [
    { email: "admin@lasmasheria.foodtag.ar", fullName: "Martina Gómez", role: "admin" },
    { email: "encargado@lasmasheria.foodtag.ar", fullName: "Diego Ferreyra", role: "encargado" },
    { email: "caja@lasmasheria.foodtag.ar", fullName: "Lucas Benítez", role: "cajero" },
    { email: "cocina@lasmasheria.foodtag.ar", fullName: "Sofía Romero", role: "cocina" },
    { email: "plancha@lasmasheria.foodtag.ar", fullName: "Nahuel Paz", role: "plancha" },
    {
      email: "temporada@lasmasheria.foodtag.ar",
      fullName: "Julián Ortiz (temporada)",
      role: "cajero",
      active: false,
    },
  ],
  menu: [
    {
      name: "Hamburguesas",
      items: [
        {
          name: "Classic Smash",
          description: "Medallones aplastados en la plancha, cheddar, pickles y salsa de la casa",
          priceCents: 8_900_00,
          variants: [
            { name: "Simple", priceCents: 8_900_00 },
            { name: "Doble", priceCents: 11_500_00 },
            { name: "Triple", priceCents: 13_900_00, available: false },
          ],
          modifiers: [
            ["Con pickles", true],
            ["Con salsa de la casa", true],
            ["Con cebolla", true],
            ["Con bacon", false],
            ["Con cheddar extra", false],
          ],
        },
        {
          name: "Oklahoma",
          description: "Cebolla en pluma smasheada junto con la carne, cheddar y mostaza",
          priceCents: 9_800_00,
          variants: [
            { name: "Simple", priceCents: 9_800_00 },
            { name: "Doble", priceCents: 12_400_00 },
          ],
          modifiers: [
            ["Con mostaza", true],
            ["Con pickles", false],
          ],
        },
        {
          name: "Crispy Chicken",
          description: "Pollo frito crocante, coleslaw y mayo de ajo ahumado",
          priceCents: 9_200_00,
          modifiers: [
            ["Con coleslaw", true],
            ["Con mayo ahumada", true],
            ["Con jalapeños", false],
          ],
        },
        {
          name: "Veggie Smash",
          description: "Medallón de garbanzos y hongos, cheddar vegano y tomate",
          priceCents: 8_600_00,
          modifiers: [
            ["Con tomate", true],
            ["Con lechuga", true],
          ],
        },
        {
          name: "BBQ Bacon",
          description: "Doble carne, bacon, aros de cebolla y barbacoa",
          priceCents: 12_900_00,
          available: false,
        },
      ],
    },
    {
      name: "Combos",
      items: [
        {
          name: "Combo Classic",
          description: "Classic Smash doble + papas medianas + gaseosa",
          priceCents: 15_900_00,
          modifiers: [
            ["Con bacon", false],
            ["Papas con cheddar", false],
          ],
        },
        {
          name: "Combo Pareja",
          description: "Dos Classic Smash simples + papas grandes + dos gaseosas",
          priceCents: 26_500_00,
        },
      ],
    },
    {
      name: "Papas",
      items: [
        {
          name: "Papas fritas",
          description: "Corte bastón, doble cocción, sal en escamas",
          priceCents: 4_200_00,
          variants: [
            { name: "Medianas", priceCents: 4_200_00 },
            { name: "Grandes", priceCents: 5_600_00 },
          ],
        },
        {
          name: "Papas Cheddar & Bacon",
          description: "Con cheddar fundido, bacon crocante y verdeo",
          priceCents: 6_800_00,
          modifiers: [
            ["Con bacon", true],
            ["Con verdeo", true],
          ],
        },
        {
          name: "Aros de cebolla",
          description: "Rebozados en cerveza, con dip de barbacoa",
          priceCents: 5_200_00,
        },
      ],
    },
    {
      name: "Bebidas",
      items: [
        {
          name: "Gaseosa",
          description: "Coca-Cola, Sprite o Fanta · lata 354ml",
          priceCents: 2_500_00,
          modifiers: [["Con hielo", true]],
        },
        {
          name: "Limonada de la casa",
          description: "Con menta y jengibre",
          priceCents: 3_800_00,
          variants: [
            { name: "500ml", priceCents: 3_800_00 },
            { name: "1 litro", priceCents: 6_500_00 },
          ],
        },
        { name: "Agua mineral", description: "500ml, con o sin gas", priceCents: 2_000_00 },
      ],
    },
    {
      name: "Postres",
      items: [
        {
          name: "Cookie de chocolate",
          description: "Tibia, con chips de chocolate amargo",
          priceCents: 3_200_00,
        },
        {
          name: "Milkshake",
          description: "Vainilla, chocolate o dulce de leche",
          priceCents: 5_900_00,
          available: false,
        },
      ],
    },
    {
      name: "Fuera de carta",
      visible: false,
      items: [
        {
          name: "Burger del mes",
          description: "Provoleta, morrones asados y chimichurri. Se activa los viernes.",
          priceCents: 13_500_00,
        },
      ],
    },
  ],
  orders: [
    {
      customer: { name: "Valentina", phone: "1155550101" },
      minutesAgo: 2,
      status: "pending",
      tipPercent: 10,
      lines: [
        { item: "Classic Smash", variant: "Doble", notes: "Sin pickles, Con bacon" },
        { item: "Papas fritas", variant: "Grandes" },
        { item: "Gaseosa", quantity: 2 },
      ],
    },
    {
      customer: { name: "Tomás", phone: "1155550102" },
      minutesAgo: 4,
      status: "pending",
      tipPercent: 0,
      lines: [{ item: "Combo Pareja" }, { item: "Cookie de chocolate", quantity: 2 }],
    },
    {
      customer: { name: "Camila", phone: "1155550103" },
      minutesAgo: 7,
      status: "preparing",
      tipPercent: 15,
      lines: [
        { item: "Oklahoma", variant: "Doble", status: "ready" },
        { item: "Crispy Chicken", notes: "Con jalapeños", status: "preparing" },
        { item: "Papas Cheddar & Bacon", status: "pending" },
      ],
      // Ya pago y quiere sacarle la mayo al Crispy Chicken: espera aprobacion.
      modificationRequest: { lineIndex: 1, modifierLabels: ["Con coleslaw", "Con jalapeños"] },
    },
    {
      customer: { name: "Joaquín", phone: "1155550104" },
      minutesAgo: 9,
      status: "preparing",
      tipPercent: 5,
      lines: [
        { item: "Veggie Smash", notes: "Sin tomate", status: "preparing" },
        { item: "Limonada de la casa", variant: "500ml", status: "ready" },
      ],
    },
    {
      customer: { name: "Agustina", phone: "1155550105" },
      minutesAgo: 14,
      status: "ready",
      tipPercent: 10,
      prepMinutes: 9,
      lines: [{ item: "Combo Classic", notes: "Papas con cheddar" }, { item: "Aros de cebolla" }],
    },
    {
      customer: { name: "Federico", phone: "1155550106" },
      minutesAgo: 18,
      status: "ready",
      tipPercent: 0,
      prepMinutes: 8,
      // No vino a retirar: el staff lo volvio a llamar desde el kanban.
      pulseMinutesAgo: 3,
      lines: [{ item: "Classic Smash", variant: "Simple" }, { item: "Agua mineral" }],
    },
    {
      customer: { name: "Rocío", phone: "1155550107" },
      minutesAgo: 20,
      status: "delivered",
      tipPercent: 10,
      prepMinutes: 10,
      lines: [{ item: "Crispy Chicken" }, { item: "Papas fritas", variant: "Medianas" }],
    },
    {
      customer: { name: "Bruno", phone: "1155550108" },
      minutesAgo: 35,
      status: "cancelled",
      tipPercent: 5,
      cancelReason: "Se cortó el gas de la plancha; se le ofreció esperar y prefirió cancelar",
      refundPending: true,
      lines: [{ item: "Classic Smash", variant: "Doble", quantity: 2 }],
    },
    {
      // Pago sin confirmar: no aparece en el kanban (regla de pago pre-cocina).
      customer: { name: "Micaela", phone: "1155550109" },
      minutesAgo: 1,
      status: "pending",
      paymentStatus: "pending",
      tipPercent: 10,
      lines: [{ item: "Oklahoma", variant: "Simple" }],
    },
    {
      customer: { name: "Santiago", phone: "1155550110" },
      minutesAgo: 60,
      status: "delivered",
      tipPercent: 15,
      prepMinutes: 12,
      lines: [{ item: "Combo Classic" }, { item: "Combo Classic", notes: "Con bacon" }],
    },
  ],
  historyOrdersPerDay: [14, 24],
};

const TACOS: DemoTruck = {
  name: "Taco Loco",
  slug: "taco-loco",
  brandIcon: "🌮",
  primaryColor: "#16A34A",
  accentColor: "#FACC15",
  withLogo: false,
  withHero: true,
  timezone: "America/Argentina/Buenos_Aires",
  beepSoundId: "marcado",
  customerPickupCooldownSeconds: 60,
  allowOrderModifications: false,
  address: "Feria de Mataderos, Av. de los Corrales 6436",
  publicTagline: "Tacos, burritos y nachos · Feria de Mataderos",
  instagramHandle: "@tacoloco.ba",
  hours: [
    ["12:00:00", "20:00:00"],
    null,
    null,
    ["18:00:00", "23:30:00"],
    ["18:00:00", "23:30:00"],
    ["12:00:00", "23:59:00"],
    ["12:00:00", "23:59:00"],
  ],
  customRoles: [
    {
      name: "caja y cocina",
      permissions: ["orders.read", "orders.advance", "orders.pulse", "menu.toggle", "dashboard.view"],
    },
  ],
  staff: [
    { email: "admin@tacoloco.foodtag.ar", fullName: "Ximena Ruiz", role: "admin" },
    { email: "caja@tacoloco.foodtag.ar", fullName: "Emiliano Vera", role: "cajero" },
    { email: "cocina@tacoloco.foodtag.ar", fullName: "Paula Acosta", role: "cocina" },
    { email: "finde@tacoloco.foodtag.ar", fullName: "Ramiro Sosa", role: "caja y cocina" },
  ],
  menu: [
    {
      name: "Tacos",
      items: [
        {
          name: "Tacos al pastor",
          description: "Cerdo adobado, ananá asado, cebolla y cilantro",
          priceCents: 7_500_00,
          variants: [
            { name: "x2", priceCents: 7_500_00 },
            { name: "x3", priceCents: 10_500_00 },
            { name: "x5", priceCents: 16_500_00 },
          ],
          modifiers: [
            ["Con cilantro", true],
            ["Con cebolla", true],
            ["Con salsa picante", false],
          ],
        },
        {
          name: "Tacos de birria",
          description: "Carne braseada 8 horas, queso y consomé para mojar",
          priceCents: 8_900_00,
          variants: [
            { name: "x2", priceCents: 8_900_00 },
            { name: "x3", priceCents: 12_500_00 },
          ],
          modifiers: [
            ["Con consomé", true],
            ["Con salsa picante", false],
          ],
        },
        {
          name: "Tacos de hongos",
          description: "Hongos salteados, porotos negros y pico de gallo",
          priceCents: 7_000_00,
          variants: [
            { name: "x2", priceCents: 7_000_00 },
            { name: "x3", priceCents: 9_800_00, available: false },
          ],
        },
      ],
    },
    {
      name: "Burritos y quesadillas",
      items: [
        {
          name: "Burrito de carne",
          description: "Carne desmechada, arroz, porotos, queso y guacamole",
          priceCents: 9_900_00,
          modifiers: [
            ["Con guacamole", true],
            ["Con arroz", true],
            ["Con jalapeños", false],
            ["Con crema agria", false],
          ],
        },
        {
          name: "Quesadilla",
          description: "Tortilla de trigo con mozzarella y cheddar",
          priceCents: 6_500_00,
          variants: [
            { name: "Solo queso", priceCents: 6_500_00 },
            { name: "Con pollo", priceCents: 8_200_00 },
          ],
        },
      ],
    },
    {
      name: "Para compartir",
      items: [
        {
          name: "Nachos supremos",
          description: "Totopos, cheddar, carne, pico de gallo, guacamole y jalapeños",
          priceCents: 11_000_00,
          modifiers: [
            ["Con jalapeños", true],
            ["Con carne", true],
          ],
        },
        {
          name: "Guacamole con totopos",
          description: "Palta pisada al momento, lima y cilantro",
          priceCents: 6_800_00,
          available: false,
        },
      ],
    },
    {
      name: "Bebidas",
      items: [
        {
          name: "Agua de jamaica",
          description: "Infusión fría de flor de jamaica, 500ml",
          priceCents: 3_500_00,
        },
        { name: "Horchata", description: "Bebida de arroz con canela, 500ml", priceCents: 3_800_00 },
        {
          name: "Cerveza artesanal",
          description: "Pinta de lager mexicana con lima",
          priceCents: 5_500_00,
          modifiers: [["Con sal y limón en el borde", false]],
        },
      ],
    },
    {
      name: "Postres",
      items: [
        {
          name: "Churros",
          description: "Con azúcar y canela",
          priceCents: 4_500_00,
          variants: [
            { name: "x6", priceCents: 4_500_00 },
            { name: "x12", priceCents: 7_900_00 },
          ],
          modifiers: [["Con dulce de leche para mojar", false]],
        },
      ],
    },
  ],
  orders: [
    {
      customer: { name: "Lautaro", phone: "1155550201" },
      minutesAgo: 3,
      status: "pending",
      tipPercent: 10,
      lines: [
        { item: "Tacos al pastor", variant: "x3", notes: "Con salsa picante" },
        { item: "Agua de jamaica" },
      ],
    },
    {
      customer: { name: "Florencia", phone: "1155550202" },
      minutesAgo: 8,
      status: "preparing",
      tipPercent: 15,
      lines: [
        { item: "Tacos de birria", variant: "x3", status: "preparing" },
        { item: "Nachos supremos", status: "ready" },
        { item: "Horchata", quantity: 2, status: "ready" },
      ],
    },
    {
      customer: { name: "Ignacio", phone: "1155550203" },
      minutesAgo: 13,
      status: "ready",
      tipPercent: 5,
      prepMinutes: 10,
      lines: [
        { item: "Burrito de carne", notes: "Sin arroz, Con jalapeños" },
        { item: "Cerveza artesanal" },
      ],
    },
    {
      customer: { name: "Julieta", phone: "1155550204" },
      minutesAgo: 22,
      status: "delivered",
      tipPercent: 0,
      prepMinutes: 11,
      lines: [{ item: "Quesadilla", variant: "Con pollo" }, { item: "Churros", variant: "x6" }],
    },
  ],
  historyOrdersPerDay: [6, 14],
};

const CAFE: DemoTruck = {
  name: "Dulce Ruta",
  slug: "dulce-ruta",
  brandIcon: "☕",
  primaryColor: "#DB2777",
  accentColor: "#F9A8D4",
  withLogo: false,
  withHero: false,
  timezone: "America/Argentina/Cordoba",
  beepSoundId: "soft",
  customerPickupCooldownSeconds: 0,
  allowOrderModifications: true,
  address: "Parque Sarmiento, Córdoba",
  publicTagline: "Café de especialidad y pastelería · Parque Sarmiento",
  instagramHandle: null,
  pausedReason: "Volvemos en 15 minutos: estamos horneando otra tanda de medialunas",
  hours: [
    null,
    ["08:00:00", "20:00:00"],
    ["08:00:00", "20:00:00"],
    ["08:00:00", "20:00:00"],
    ["08:00:00", "20:00:00"],
    ["08:00:00", "21:00:00"],
    ["09:00:00", "21:00:00"],
  ],
  customRoles: [],
  staff: [
    { email: "admin@dulceruta.foodtag.ar", fullName: "Carolina Medina", role: "admin" },
    { email: "caja@dulceruta.foodtag.ar", fullName: "Mateo Quiroga", role: "cajero" },
  ],
  menu: [
    {
      name: "Cafetería",
      items: [
        {
          name: "Flat white",
          description: "Doble ristretto con leche texturizada",
          priceCents: 3_900_00,
          variants: [
            { name: "Chico", priceCents: 3_900_00 },
            { name: "Grande", priceCents: 4_800_00 },
          ],
          modifiers: [
            ["Con leche de almendras", false],
            ["Con shot extra", false],
            ["Con azúcar", true],
          ],
        },
        {
          name: "Latte",
          description: "Espresso con mucha leche y espuma fina",
          priceCents: 3_700_00,
          variants: [
            { name: "Chico", priceCents: 3_700_00 },
            { name: "Mediano", priceCents: 4_300_00 },
            { name: "Grande", priceCents: 4_900_00 },
          ],
          modifiers: [
            ["Con leche de almendras", false],
            ["Con jarabe de vainilla", false],
          ],
        },
        { name: "Espresso", description: "Blend de Brasil y Colombia", priceCents: 2_600_00 },
        {
          name: "Cold brew",
          description: "Extracción en frío de 18 horas",
          priceCents: 4_500_00,
          modifiers: [
            ["Con hielo", true],
            ["Con tónica", false],
          ],
        },
      ],
    },
    {
      name: "Pastelería",
      items: [
        {
          name: "Medialunas",
          description: "De manteca, recién horneadas",
          priceCents: 1_200_00,
          available: false,
          variants: [
            { name: "x1", priceCents: 1_200_00 },
            { name: "x3", priceCents: 3_300_00 },
            { name: "x6", priceCents: 6_200_00 },
          ],
        },
        {
          name: "Cheesecake de frutos rojos",
          description: "Porción, base de galletita y coulis casero",
          priceCents: 5_400_00,
        },
        { name: "Budín de limón", description: "Porción con glaseado de limón", priceCents: 2_900_00 },
      ],
    },
    {
      name: "Salado",
      items: [
        {
          name: "Tostado",
          description: "Pan de campo, jamón cocido y queso",
          priceCents: 5_800_00,
          modifiers: [
            ["Con jamón", true],
            ["Con tomate", false],
          ],
        },
        {
          name: "Avocado toast",
          description: "Palta, huevo poché y semillas",
          priceCents: 7_200_00,
          modifiers: [["Con huevo", true]],
        },
      ],
    },
    {
      name: "Sin TACC",
      items: [
        { name: "Alfajor sin TACC", description: "De maicena, apto celíacos", priceCents: 2_400_00 },
        { name: "Brownie sin TACC", description: "Con nueces, apto celíacos", priceCents: 3_600_00 },
      ],
    },
  ],
  orders: [
    {
      customer: { name: "Marina", phone: "3515550301" },
      minutesAgo: 5,
      status: "preparing",
      tipPercent: 10,
      lines: [
        { item: "Latte", variant: "Grande", notes: "Con leche de almendras", status: "ready" },
        { item: "Avocado toast", status: "preparing" },
      ],
    },
    {
      customer: { name: "Gonzalo", phone: "3515550302" },
      minutesAgo: 11,
      status: "ready",
      tipPercent: 5,
      prepMinutes: 6,
      lines: [
        { item: "Flat white", variant: "Chico", notes: "Sin azúcar" },
        { item: "Budín de limón" },
      ],
      modificationRequest: {
        lineIndex: 0,
        modifierLabels: ["Con shot extra"],
        status: "rejected",
        staffResponse: "Ya estaba listo cuando llegó el pedido, perdón",
      },
    },
  ],
  historyOrdersPerDay: [10, 18],
};

export const DEMO_TRUCKS: DemoTruck[] = [SMASH, TACOS, CAFE];
