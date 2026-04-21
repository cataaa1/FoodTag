import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { SYSTEM_ROLES } from "../lib/constants/permissions";
import { getServerEnv } from "../lib/config/env";

loadEnv({ path: ".env.local" });

async function main() {
  const env = getServerEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const seedRoles = Object.entries(SYSTEM_ROLES).map(([name, permissions]) => ({
    name,
    is_system: true,
    permissions_json: permissions,
  }));

  const { error: roleError } = await supabase
    .from("role")
    .upsert(seedRoles, { onConflict: "name" });

  if (roleError) {
    throw roleError;
  }

  const { data: adminRole, error: adminRoleError } = await supabase
    .from("role")
    .select("id")
    .eq("name", "admin")
    .single();

  if (adminRoleError) {
    throw adminRoleError;
  }

  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email: env.SEED_ADMIN_EMAIL ?? "admin@foodtag.ar",
      password: env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!",
      email_confirm: true,
      user_metadata: {
        full_name: env.SEED_ADMIN_FULL_NAME ?? "Admin FoodTag",
      },
    });

  if (userError && !userError.message.toLowerCase().includes("already")) {
    throw userError;
  }

  const adminEmail = env.SEED_ADMIN_EMAIL ?? "admin@foodtag.ar";
  const { data: usersPage, error: listUsersError } = await supabase.auth.admin.listUsers();

  if (listUsersError) {
    throw listUsersError;
  }

  const adminUser =
    userData.user ??
    usersPage.users.find((user) => user.email?.toLowerCase() === adminEmail.toLowerCase());

  if (!adminUser) {
    throw new Error("No se pudo localizar el admin inicial");
  }

  const { error: staffUserError } = await supabase.from("staff_user").upsert(
    {
      id: adminUser.id,
      email: adminEmail,
      full_name: env.SEED_ADMIN_FULL_NAME ?? "Admin FoodTag",
      role_id: adminRole.id,
      active: true,
    },
    { onConflict: "id" },
  );

  if (staffUserError) {
    throw staffUserError;
  }

  const { data: existingConfig } = await supabase
    .from("truck_config")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!existingConfig) {
    const { error: configError } = await supabase.from("truck_config").insert({
      name: "FoodTag Truck",
      primary_color: "#F97316",
      timezone: "America/Argentina/Buenos_Aires",
      tip_defaults_json: [0, 5, 10, 15],
      beep_sound_id: "classic",
    });

    if (configError) {
      throw configError;
    }
  }

  const defaultHours = [
    { weekday: 0, opens_at: null, closes_at: null, closed: true },
    { weekday: 1, opens_at: "12:00:00", closes_at: "23:00:00", closed: false },
    { weekday: 2, opens_at: "12:00:00", closes_at: "23:00:00", closed: false },
    { weekday: 3, opens_at: "12:00:00", closes_at: "23:00:00", closed: false },
    { weekday: 4, opens_at: "12:00:00", closes_at: "23:30:00", closed: false },
    { weekday: 5, opens_at: "12:00:00", closes_at: "23:59:00", closed: false },
    { weekday: 6, opens_at: "18:00:00", closes_at: "23:59:00", closed: false },
  ];

  const { error: hoursError } = await supabase
    .from("opening_hours")
    .upsert(defaultHours, { onConflict: "weekday" });

  if (hoursError) {
    throw hoursError;
  }

  console.log("Seed completado con éxito");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
