"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { AccountPanel, useAdminSession } from "@/components/admin/account-panel";
import { AdminShell } from "@/components/admin/admin-shell";
import { useTransientMessage } from "@/hooks/use-transient-message";
import { CUSTOM_SOUND_STORAGE_KEY, playBeeperSound } from "@/lib/utils/beeper";
import { optimizeImageFile } from "@/lib/utils/client-image";
import { getContrastColor, normalizeHexColor } from "@/lib/utils/color";
import { fetchJson } from "@/lib/utils/http";

type TruckSettings = {
  id: string;
  name: string;
  address: string;
  logoUrl: string | null;
  brandIcon: string;
  heroImageUrl: string | null;
  publicTagline: string;
  instagramHandle: string | null;
  primaryColor: string;
  timezone: string;
  beepSoundId: string;
  allowOrderModifications: boolean;
  customerPickupCooldownSeconds: number;
};

type SettingsForm = {
  name: string;
  address: string;
  logoUrl: string | null;
  brandIcon: string;
  heroImageUrl: string | null;
  publicTagline: string;
  instagramHandle: string;
  primaryColor: string;
  timezone: string;
  beepSoundId: string;
  allowOrderModifications: boolean;
  customerPickupCooldownSeconds: number;
};

const EMPTY_FORM: SettingsForm = {
  name: "",
  address: "",
  logoUrl: null,
  brandIcon: "🚚",
  heroImageUrl: null,
  publicTagline: "",
  instagramHandle: "",
  primaryColor: "#F97316",
  timezone: "America/Argentina/Buenos_Aires",
  beepSoundId: "classic",
  allowOrderModifications: true,
  customerPickupCooldownSeconds: 15,
};

const TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Cordoba",
  "America/Montevideo",
] as const;

const BRAND_ICON_OPTIONS = ["🚚", "🍔", "🍟", "🌮", "🍕", "🥪", "🥤", "🔥"] as const;
const BEEP_SOUND_OPTIONS = [
  { id: "classic", label: "Classic — firme y clásico" },
  { id: "soft", label: "Soft — suave y corto" },
  { id: "marcado", label: "Marcado — insistente y brillante" },
  { id: "custom", label: "Personalizado (importar archivo)" },
] as const;
const MAX_IMAGE_UPLOAD_BYTES = 1_600_000;
const MAX_IMAGE_DIMENSION = 1600;

function settingsToForm(settings: TruckSettings): SettingsForm {
  return {
    name: settings.name,
    address: settings.address,
    logoUrl: settings.logoUrl,
    brandIcon: settings.brandIcon,
    heroImageUrl: settings.heroImageUrl,
    publicTagline: settings.publicTagline,
    instagramHandle: settings.instagramHandle ?? "",
    primaryColor: settings.primaryColor,
    timezone: settings.timezone,
    beepSoundId: settings.beepSoundId,
    allowOrderModifications: settings.allowOrderModifications,
    customerPickupCooldownSeconds: settings.customerPickupCooldownSeconds,
  };
}

export function SettingsManager() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const customSoundRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customSoundName, setCustomSoundName] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(CUSTOM_SOUND_STORAGE_KEY) ? "Sonido importado" : null;
  });
  useTransientMessage(feedback, () => setFeedback(null));
  useTransientMessage(error, () => setError(null), 4_200);

  const sessionQuery = useAdminSession();
  const canWriteSettings = Boolean(
    sessionQuery.data?.permissions.includes("settings.write"),
  );
  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => fetchJson<{ settings: TruckSettings }>("/api/admin/settings"),
    // Sin settings.write el endpoint responde 403: ni lo pedimos.
    enabled: canWriteSettings,
  });

  useEffect(() => {
    if (settingsQuery.data?.settings) {
      setForm(settingsToForm(settingsQuery.data.settings));
    }
  }, [settingsQuery.data?.settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ settings: TruckSettings }>("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          instagramHandle: form.instagramHandle.trim() || null,
        }),
      }),
    onSuccess: async (data) => {
      setError(null);
      setFeedback("Configuración guardada");
      setForm(settingsToForm(data.settings));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "settings"] }),
        queryClient.invalidateQueries({ queryKey: ["truck-status"] }),
        queryClient.invalidateQueries({ queryKey: ["public-menu"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "today"] }),
      ]);
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No pudimos guardar la configuración",
      );
    },
  });

  function updateForm<TField extends keyof SettingsForm>(
    field: TField,
    value: SettingsForm[TField],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function importHeroImage(file: File | undefined) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Usá una imagen JPG, PNG o WEBP");
      return;
    }

    if (file.size > 2_000_000) {
      setError("La imagen no puede superar los 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      updateForm("heroImageUrl", String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  function importLogoImage(file: File | undefined) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Usá una imagen JPG, PNG o WEBP");
      return;
    }

    if (file.size > 2_000_000) {
      setError("La imagen no puede superar los 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      updateForm("logoUrl", String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  void importHeroImage;
  void importLogoImage;

  async function importImage(
    field: "heroImageUrl" | "logoUrl",
    file: File | undefined,
  ) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFeedback(null);
      setError("Usá una imagen JPG, PNG o WEBP");
      return;
    }

    try {
      const optimized = await optimizeImageFile(file, {
        maxBytes: MAX_IMAGE_UPLOAD_BYTES,
        maxDimension: MAX_IMAGE_DIMENSION,
      });

      setError(null);
      setFeedback(
        `Imagen optimizada a ${optimized.width}x${optimized.height} para que no pese más de 1.6MB`,
      );
      updateForm(field, optimized.dataUrl);
    } catch (imageError) {
      setFeedback(null);
      setError(
        imageError instanceof Error
          ? imageError.message
          : "No pudimos preparar la imagen",
      );
    }
  }

  // Cajero y cocina tambien entran aca: es su unica salida para cerrar sesion
  // o cambiar de cuenta. Ven solo el bloque de cuenta, sin los ajustes del truck.
  if (sessionQuery.isSuccess && !canWriteSettings) {
    return (
      <AdminShell
        subtitle="Tu cuenta y preferencias de este dispositivo"
        title="Configuración"
      >
        {error ? (
          <div className="mb-5 rounded-[10px] border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-3 text-[13px] font-bold text-[#ef4444]">
            {error}
          </div>
        ) : null}

        <div className="max-w-3xl">
          <Panel eyebrow="Cuenta" title="Sesión y preferencias">
            <AccountPanel onError={setError} />
          </Panel>
          <p className="mt-4 text-[13px] leading-5 text-[#999]">
            Los ajustes del foodtruck (branding, horarios, pagos) los administra
            una cuenta con permiso de configuración.
          </p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      action={
        <button
          className="admin-primary-button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          type="button"
        >
          {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      }
      subtitle="Datos públicos, branding y ajustes operativos"
      title="Configuración"
    >
      {feedback ? (
        <div className="mb-5 rounded-[10px] border border-[#22c55e]/25 bg-[#22c55e]/10 px-4 py-3 text-[13px] font-bold text-[#16a34a]">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 rounded-[10px] border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-3 text-[13px] font-bold text-[#ef4444]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Panel eyebrow="Landing público" title="Datos del foodtruck">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre visible">
                <input
                  className="admin-input"
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="El Smash del Barrio"
                  value={form.name}
                />
              </Field>
              <Field label="Dirección">
                <input
                  className="admin-input"
                  onChange={(event) => updateForm("address", event.target.value)}
                  placeholder="Av. Corrientes 1500"
                  value={form.address}
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <Field label="Texto secundario">
                <input
                  className="admin-input"
                  onChange={(event) => updateForm("publicTagline", event.target.value)}
                  placeholder="Food Truck · Av. Corrientes 1500"
                  value={form.publicTagline}
                />
              </Field>
              <Field label="Instagram">
                <input
                  className="admin-input"
                  onChange={(event) => updateForm("instagramHandle", event.target.value)}
                  placeholder="@foodtag"
                  value={form.instagramHandle}
                />
              </Field>
            </div>
            <div className="mt-4 rounded-[16px] border border-[#f0ddd0] bg-[#fff8f1] p-4 dark:border-[#2e2e2e] dark:bg-[#242424]">
              <div className="flex flex-wrap items-center gap-4">
                <BrandMark
                  brandIcon={form.brandIcon}
                  logoUrl={form.logoUrl}
                  primaryColor={form.primaryColor}
                />
                <div className="min-w-[220px] flex-1">
                  <p className="mb-2 text-xs font-bold text-[#555] dark:text-[#a0a0a0]">
                    Icono o logo de marca
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {BRAND_ICON_OPTIONS.map((icon) => {
                      const selected = form.brandIcon === icon && !form.logoUrl;

                      return (
                        <button
                          className={
                            selected
                              ? "flex size-9 items-center justify-center rounded-[10px] border-2 text-lg"
                              : "flex size-9 items-center justify-center rounded-[10px] border border-[#e8d4c4] bg-white text-lg dark:border-[#3a3a3a] dark:bg-[#1a1a1a]"
                          }
                          key={icon}
                          onClick={() => {
                            updateForm("brandIcon", icon);
                            updateForm("logoUrl", null);
                          }}
                          style={
                            selected
                              ? {
                                  borderColor: form.primaryColor,
                                  backgroundColor: `${normalizeHexColor(form.primaryColor)}22`,
                                }
                              : undefined
                          }
                          type="button"
                        >
                          {icon}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="admin-muted-button"
                      onClick={() => logoInputRef.current?.click()}
                      type="button"
                    >
                      Importar logo
                    </button>
                    {form.logoUrl ? (
                      <button
                        className="admin-muted-button"
                        onClick={() => updateForm("logoUrl", null)}
                        type="button"
                      >
                        Usar icono
                      </button>
                    ) : null}
                  </div>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => void importImage("logoUrl", event.target.files?.[0])}
                    ref={logoInputRef}
                    type="file"
                  />
                </div>
              </div>
            </div>
          </Panel>

          <Panel eyebrow="Imagen" title="Foto del landing del menú">
            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="relative h-[180px] overflow-hidden rounded-[18px] bg-[#1c1009]">
                {form.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="Foto del foodtruck"
                    className="size-full object-cover"
                    src={form.heroImageUrl}
                  />
                ) : (
                  <div
                    className="flex size-full flex-col items-center justify-center gap-2"
                    style={{
                      background: `linear-gradient(135deg, ${normalizeHexColor(form.primaryColor)} 0%, ${normalizeHexColor(form.primaryColor)} 45%, ${normalizeHexColor(form.primaryColor)}33 100%)`,
                    }}
                  >
                    <BrandMark
                      brandIcon={form.brandIcon}
                      logoUrl={form.logoUrl}
                      primaryColor={form.primaryColor}
                    />
                    <span className="text-[11px] font-black uppercase tracking-[1.4px] text-white/65">
                      Sin foto cargada
                    </span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(to_top,rgba(0,0,0,0.45),transparent)]" />
              </div>
              <div className="flex flex-col justify-center">
                <p className="mb-3 text-sm leading-6 text-[#555] dark:text-[#a0a0a0]">
                  Esta imagen aparece arriba del formulario inicial del cliente.
                  Conviene usar una foto horizontal del truck, hamburguesas o fachada.
                </p>
                <p className="mb-3 text-xs font-semibold text-[#777] dark:text-[#b4b4b4]">
                  La adaptamos automáticamente hasta {MAX_IMAGE_DIMENSION}px y 1.6MB.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="admin-primary-button"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    Importar foto
                  </button>
                  <button
                    className="admin-muted-button"
                    onClick={() => updateForm("heroImageUrl", null)}
                    type="button"
                  >
                    Quitar foto
                  </button>
                </div>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void importImage("heroImageUrl", event.target.files?.[0])}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
            </div>
          </Panel>

          <Panel eyebrow="Operación" title="Ajustes generales">
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Color principal">
                <div className="flex gap-2">
                  <input
                    aria-label="Color principal"
                    className="h-[42px] w-14 rounded-[10px] border border-[#e8e8e8] bg-white p-1"
                    onChange={(event) => updateForm("primaryColor", event.target.value)}
                    type="color"
                    value={form.primaryColor}
                  />
                  <input
                    className="admin-input"
                    onChange={(event) => updateForm("primaryColor", event.target.value)}
                    value={form.primaryColor}
                  />
                </div>
              </Field>
              <Field label="Zona horaria">
                <select
                  className="admin-input"
                  onChange={(event) => updateForm("timezone", event.target.value)}
                  value={form.timezone}
                >
                  {TIMEZONES.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sonido beeper">
                <div className="flex gap-2">
                  <select
                    className="admin-input flex-1"
                    onChange={(e) => {
                      updateForm("beepSoundId", e.target.value);
                      playBeeperSound(e.target.value);
                    }}
                    value={form.beepSoundId}
                  >
                    {BEEP_SOUND_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="admin-muted-button shrink-0"
                    onClick={() => playBeeperSound(form.beepSoundId)}
                    title="Probar sonido"
                    type="button"
                  >
                    ▶ Probar
                  </button>
                </div>
                {form.beepSoundId === "custom" ? (
                  <div className="mt-2">
                    <input
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const dataUrl = reader.result as string;
                          try {
                            localStorage.setItem(CUSTOM_SOUND_STORAGE_KEY, dataUrl);
                            setCustomSoundName(file.name);
                            playBeeperSound("custom");
                          } catch {
                            setError("No pudimos guardar el sonido. El archivo puede ser demasiado grande.");
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }}
                      ref={customSoundRef}
                      type="file"
                    />
                    <button
                      className="admin-muted-button w-full text-center"
                      onClick={() => customSoundRef.current?.click()}
                      type="button"
                    >
                      {customSoundName ? `📁 ${customSoundName}` : "Importar archivo de audio…"}
                    </button>
                    {customSoundName ? (
                      <p className="mt-1 text-[11px] text-[#999]">
                        El sonido se guarda en este navegador. Volvé a importarlo si usás otro dispositivo.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Field>
              <Field label="Cooldown retiro cliente (seg)">
                <input
                  className="admin-input"
                  max={300}
                  min={0}
                  onChange={(event) =>
                    updateForm(
                      "customerPickupCooldownSeconds",
                      Number(event.target.value || 0),
                    )
                  }
                  step={1}
                  type="number"
                  value={form.customerPickupCooldownSeconds}
                />
              </Field>
            </div>
            <div className="mt-4 rounded-[16px] border border-[#f0ddd0] bg-[#fff8f1] p-4 dark:border-[#2e2e2e] dark:bg-[#242424]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#111] dark:text-[#f5f5f5]">
                    Permitir cambios después de pedir
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#555] dark:text-[#a0a0a0]">
                    Si está activo, el cliente puede pedir modificaciones mientras
                    el pedido siga pendiente. Al pasar a preparación se bloquea.
                  </p>
                </div>
                <button
                  aria-pressed={form.allowOrderModifications}
                  className={
                    form.allowOrderModifications
                      ? "relative h-7 w-14 rounded-full transition"
                      : "relative h-7 w-14 rounded-full bg-[#d7c7ba] transition"
                  }
                  onClick={() =>
                    updateForm(
                      "allowOrderModifications",
                      !form.allowOrderModifications,
                    )
                  }
                  style={
                    form.allowOrderModifications
                      ? { backgroundColor: normalizeHexColor(form.primaryColor) }
                      : undefined
                  }
                  type="button"
                >
                  <span
                    className={
                      form.allowOrderModifications
                        ? "absolute right-1 top-1 size-5 rounded-full bg-white shadow transition"
                        : "absolute left-1 top-1 size-5 rounded-full bg-white shadow transition"
                    }
                  />
                </button>
              </div>
            </div>
          </Panel>

          <Panel eyebrow="Cuenta" title="Sesión y preferencias">
            <AccountPanel onError={setError} />
          </Panel>
        </div>

        <PreviewCard form={form} />
      </div>
    </AdminShell>
  );
}

function Panel({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-[#e8e8e8] bg-white p-5 dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
      <p
        className="mb-1 text-[11px] font-black uppercase tracking-[1px]"
        style={{ color: "var(--admin-accent)" }}
      >
        {eyebrow}
      </p>
      <h2 className="mb-4 text-base font-black text-[#111] dark:text-[#f5f5f5]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-[#555] dark:text-[#a0a0a0]">
        {label}
      </span>
      {children}
    </label>
  );
}

function BrandMark({
  brandIcon,
  logoUrl,
  primaryColor,
}: {
  brandIcon: string;
  logoUrl: string | null;
  primaryColor: string;
}) {
  return (
    <div
      className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] text-[30px] shadow-[0_6px_18px_rgba(0,0,0,0.18)]"
      style={{
        backgroundColor: normalizeHexColor(primaryColor),
        color: getContrastColor(primaryColor),
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="Logo del foodtruck" className="size-full object-cover" src={logoUrl} />
      ) : (
        brandIcon
      )}
    </div>
  );
}

function PreviewCard({ form }: { form: SettingsForm }) {
  return (
    <aside className="rounded-[24px] border border-[#e8e8e8] bg-white p-4 shadow-[0_12px_35px_rgba(0,0,0,0.08)] dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[1px] text-[#999]">
            Vista previa
          </p>
          <div className="mt-1 flex items-center gap-2">
            <BrandMark
              brandIcon={form.brandIcon}
              logoUrl={form.logoUrl}
              primaryColor={form.primaryColor}
            />
            <h2 className="text-base font-black">Landing cliente</h2>
          </div>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-black"
          style={{
            backgroundColor: form.primaryColor,
            color: getContrastColor(form.primaryColor),
          }}
        >
          /menu
        </span>
      </div>

      <div className="overflow-hidden rounded-[28px] border-[10px] border-[#111] bg-[#fff8f1]">
        <div className="relative h-[190px] overflow-hidden bg-[#1c1009]">
          {form.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full object-cover" src={form.heroImageUrl} />
          ) : (
            <div
              className="flex size-full flex-col items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${normalizeHexColor(form.primaryColor)} 0%, ${normalizeHexColor(form.primaryColor)} 45%, ${normalizeHexColor(form.primaryColor)}33 100%)`,
              }}
            >
              <BrandMark
                brandIcon={form.brandIcon}
                logoUrl={form.logoUrl}
                primaryColor={form.primaryColor}
              />
              <span className="text-[10px] font-bold uppercase tracking-[2px] text-white/60">
                Foto del truck
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_top,#fff8f1,transparent)]" />
          <div className="absolute inset-x-0 bottom-3 px-4 text-center">
            <h3 className="text-[21px] font-black tracking-[-0.5px] text-[#1c1009]">
              {form.name || "El Smash del Barrio"}
            </h3>
            <p className="text-xs font-medium text-[#9a7560]">
              {form.publicTagline || `Food Truck · ${form.address}`}
            </p>
          </div>
        </div>
        <div className="px-5 py-5">
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-[#fff1e6] px-4 py-3">
            <span className="text-xl">👋</span>
            <p className="text-[13px] leading-5 text-[#6b4e35]">
              Pedí desde acá y te avisamos cuando esté listo.
            </p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-[#6b4e35]">
            📍 {form.address || "Av. Corrientes 1500"}
          </div>
        </div>
      </div>
    </aside>
  );
}
