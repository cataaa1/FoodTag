"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { useTransientMessage } from "@/hooks/use-transient-message";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { fetchJson } from "@/lib/utils/http";

type PermissionKey = (typeof PERMISSIONS)[number];

type AdminSession = {
  permissions: PermissionKey[];
  staffUser: {
    id: string;
    email: string;
    fullName: string;
  };
};

type Role = {
  id: string;
  name: string;
  is_system: boolean;
  permissions: PermissionKey[];
};

type StaffUser = {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  active: boolean;
  created_at: string;
  role_name: string;
};

type RoleForm = {
  id: string;
  name: string;
  permissions: PermissionKey[];
};

type UserForm = {
  id: string;
  email: string;
  fullName: string;
  password: string;
  roleId: string;
  active: boolean;
};

const EMPTY_ROLES: Role[] = [];
const EMPTY_USERS: StaffUser[] = [];

const EMPTY_ROLE_FORM: RoleForm = {
  id: "",
  name: "",
  permissions: [],
};

const EMPTY_USER_FORM: UserForm = {
  id: "",
  email: "",
  fullName: "",
  password: "",
  roleId: "",
  active: true,
};

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "menu.read": "Ver menú",
  "menu.write": "Editar ítems",
  "menu.toggle": "Cambiar disponibilidad",
  "orders.read": "Ver pedidos",
  "orders.advance": "Avanzar estados",
  "orders.pulse": "Llamar cliente",
  "orders.cancel": "Cancelar pedidos",
  "orders.approve_mod": "Aprobar modificaciones",
  "hours.write": "Editar horarios",
  "users.manage": "Ver usuarios",
  "users.write": "Crear y eliminar usuarios",
  "roles.manage": "Editar roles",
  "dashboard.view": "Ver métricas",
  "settings.write": "Editar configuración",
};

const PERMISSION_GROUPS: Array<{ title: string; permissions: PermissionKey[] }> = [
  {
    title: "Menú",
    permissions: ["menu.read", "menu.write", "menu.toggle"],
  },
  {
    title: "Pedidos",
    permissions: [
      "orders.read",
      "orders.advance",
      "orders.cancel",
      "orders.pulse",
      "orders.approve_mod",
    ],
  },
  {
    title: "Horarios",
    permissions: ["hours.write"],
  },
  {
    title: "Usuarios",
    permissions: ["users.manage", "users.write", "roles.manage"],
  },
  {
    title: "Dashboard",
    permissions: ["dashboard.view", "settings.write"],
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(seed: string) {
  const value = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hue = value % 360;
  return {
    background: `hsl(${hue}, 50%, 85%)`,
    color: `hsl(${hue}, 50%, 35%)`,
  };
}

export function UsersManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [roleForm, setRoleForm] = useState<RoleForm>(EMPTY_ROLE_FORM);
  const [userForm, setUserForm] = useState<UserForm>(EMPTY_USER_FORM);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useTransientMessage(feedback, () => setFeedback(null));
  useTransientMessage(error, () => setError(null), 4_200);

  const rolesQuery = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => fetchJson<{ roles: Role[] }>("/api/admin/roles"),
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "staff-users"],
    queryFn: () => fetchJson<{ users: StaffUser[] }>("/api/admin/staff-users"),
  });
  const sessionQuery = useQuery({
    queryKey: ["admin", "session"],
    queryFn: () => fetchJson<AdminSession>("/api/admin/session"),
  });

  const roles = rolesQuery.data?.roles ?? EMPTY_ROLES;
  const users = usersQuery.data?.users ?? EMPTY_USERS;
  const permissions = sessionQuery.data?.permissions ?? [];
  const canWriteUsers = permissions.includes("users.write");

  useEffect(() => {
    if (!showUserModal || userForm.id || userForm.roleId || !roles.length) {
      return;
    }

    setUserForm((current) => ({
      ...current,
      roleId: roles[0]?.id ?? "",
    }));
  }, [roles, showUserModal, userForm.id, userForm.roleId]);

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "staff-users"] }),
    ]);
  }

  const roleMutation = useMutation({
    mutationFn: async (form: RoleForm = roleForm) => {
      const body = {
        name: form.name,
        permissions: form.permissions,
      };

      if (form.id) {
        return fetchJson(`/api/admin/roles/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      return fetchJson("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setError(null);
      setFeedback("Rol guardado");
      setRoleForm(EMPTY_ROLE_FORM);
      setShowRoleModal(false);
      await refreshAll();
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(mutationError instanceof Error ? mutationError.message : "No pudimos guardar el rol");
    },
  });

  const userMutation = useMutation({
    mutationFn: async (form: UserForm = userForm) => {
      const body = {
        email: form.email,
        fullName: form.fullName,
        roleId: form.roleId,
        active: form.active,
        ...(form.password ? { password: form.password } : {}),
      };

      if (form.id) {
        return fetchJson(`/api/admin/staff-users/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      return fetchJson("/api/admin/staff-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, password: form.password }),
      });
    },
    onSuccess: async () => {
      setError(null);
      setFeedback("Usuario guardado");
      setUserForm(EMPTY_USER_FORM);
      setShowUserModal(false);
      await refreshAll();
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(
        mutationError instanceof Error ? mutationError.message : "No pudimos guardar el usuario",
      );
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) =>
      fetchJson(`/api/admin/roles/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setError(null);
      setFeedback("Rol eliminado");
      await refreshAll();
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(
        mutationError instanceof Error ? mutationError.message : "No pudimos eliminar el rol",
      );
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => fetchJson(`/api/admin/staff-users/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setError(null);
      setFeedback("Usuario eliminado");
      await refreshAll();
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(
        mutationError instanceof Error ? mutationError.message : "No pudimos eliminar el usuario",
      );
    },
  });

  function openNewUser() {
    setError(null);
    setUserForm({ ...EMPTY_USER_FORM, roleId: roles[0]?.id ?? "" });
    setShowUserModal(true);
  }

  function openNewRole() {
    setRoleForm(EMPTY_ROLE_FORM);
    setShowRoleModal(true);
  }

  function openEditRole(role: Role) {
    setRoleForm({
      id: role.id,
      name: role.name,
      permissions: role.permissions,
    });
    setShowRoleModal(true);
  }

  return (
    <AdminShell
      action={
        activeTab === "users" ? (
          canWriteUsers ? (
            <button className="admin-primary-button" onClick={openNewUser} type="button">
              + Nuevo usuario
            </button>
          ) : null
        ) : (
          <button className="admin-primary-button" onClick={openNewRole} type="button">
            + Nuevo rol
          </button>
        )
      }
      subtitle="Usuarios internos y permisos operativos"
      title="Usuarios y roles"
    >
      {feedback ? (
        <div className="brand-accent-notice mb-5 rounded-[10px] border px-4 py-3 text-[13px] font-bold">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 rounded-[10px] border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-3 text-[13px] font-bold text-[#ef4444]">
          {error}
        </div>
      ) : null}

      <div className="mb-5 flex w-fit gap-1 rounded-[10px] bg-[#f2f2f2] p-1 dark:bg-[#242424]">
        <TabButton
          active={activeTab === "users"}
          label="Usuarios"
          onClick={() => setActiveTab("users")}
        />
        <TabButton
          active={activeTab === "roles"}
          label="Roles y permisos"
          onClick={() => setActiveTab("roles")}
        />
      </div>

      {activeTab === "users" ? (
        <UsersTable
          canDeleteUsers={canWriteUsers}
          onDelete={(user) => deleteUserMutation.mutate(user.id)}
          users={users}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              onDelete={() => deleteRoleMutation.mutate(role.id)}
              onEdit={() => openEditRole(role)}
              role={role}
            />
          ))}
        </div>
      )}

      {showUserModal ? (
        <UserModal
          form={userForm}
          isLoadingRoles={rolesQuery.isLoading}
          onChange={setUserForm}
          onClose={() => {
            setShowUserModal(false);
            setUserForm(EMPTY_USER_FORM);
          }}
          onSubmit={() => userMutation.mutate(userForm)}
          roles={roles}
        />
      ) : null}

      {showRoleModal ? (
        <RoleModal
          form={roleForm}
          onChange={setRoleForm}
          onClose={() => setShowRoleModal(false)}
          onSubmit={() => roleMutation.mutate(roleForm)}
        />
      ) : null}
    </AdminShell>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "rounded-lg bg-white px-[18px] py-2 text-[13px] font-bold text-[#111] shadow-[0_1px_4px_rgba(0,0,0,0.1)] transition dark:bg-[#1a1a1a] dark:text-[#f5f5f5]"
          : "rounded-lg px-[18px] py-2 text-[13px] font-bold text-[#999] transition"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function UsersTable({
  canDeleteUsers,
  onDelete,
  users,
}: {
  canDeleteUsers: boolean;
  onDelete: (user: StaffUser) => void;
  users: StaffUser[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            {canDeleteUsers ? <TableHead /> : null}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr className="hover:bg-[#f2f2f2] dark:hover:bg-[#242424]" key={user.id}>
              <td className="border-b border-[#e8e8e8] px-4 py-[13px] dark:border-[#2e2e2e]">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
                    style={avatarColor(user.id)}
                  >
                    {initials(user.full_name)}
                  </div>
                  <span className="font-bold text-[#111] dark:text-[#f5f5f5]">
                    {user.full_name}
                  </span>
                </div>
              </td>
              <td className="ticket-font border-b border-[#e8e8e8] px-4 py-[13px] text-xs text-[#555] dark:border-[#2e2e2e] dark:text-[#a0a0a0]">
                {user.email}
              </td>
              <td className="border-b border-[#e8e8e8] px-4 py-[13px] dark:border-[#2e2e2e]">
                <span className="brand-accent-chip rounded-md px-2.5 py-1 text-[11px] font-bold">
                  {user.role_name}
                </span>
              </td>
              <td className="border-b border-[#e8e8e8] px-4 py-[13px] dark:border-[#2e2e2e]">
                <StatusBadge active={user.active} />
              </td>
              {canDeleteUsers ? (
                <td className="border-b border-[#e8e8e8] px-4 py-[13px] text-right dark:border-[#2e2e2e]">
                  <button
                    className="rounded-lg bg-[#ef4444]/10 px-3 py-1.5 text-xs font-semibold text-[#ef4444]"
                    onClick={() => onDelete(user)}
                    type="button"
                  >
                    Eliminar
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHead({ children }: { children?: React.ReactNode }) {
  return (
    <th className="bg-[#f2f2f2] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-[#999] dark:bg-[#242424]">
      {children}
    </th>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="rounded-md px-2.5 py-1 text-[11px] font-bold"
      style={{
        background: active ? "rgba(34,197,94,0.1)" : "#f2f2f2",
        color: active ? "#22c55e" : "#999",
      }}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function RoleCard({
  onDelete,
  onEdit,
  role,
}: {
  onDelete: () => void;
  onEdit: () => void;
  role: Role;
}) {
  return (
    <article className="rounded-xl border border-[#e8e8e8] bg-white p-5 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-[#111] dark:text-[#f5f5f5]">
            {role.name}
          </h2>
          <div className="text-[11px] text-[#999]">
            {role.is_system ? "🔒 Rol protegido" : "Rol personalizado"}
          </div>
        </div>
        <span className="brand-accent-chip rounded-lg px-2.5 py-1 text-[11px] font-bold">
          {role.name}
        </span>
      </div>

      {PERMISSION_GROUPS.map((group) => (
        <div className="mb-3" key={group.title}>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.5px] text-[#999]">
            {group.title}
          </div>
          {group.permissions.map((permission) => {
            const has = role.permissions.includes(permission);
            const protectedAdmin = role.name.toLowerCase() === "admin";

            return (
              <label
                className="mb-1 flex cursor-pointer items-center gap-2"
                key={permission}
                style={{ opacity: protectedAdmin ? 0.7 : 1 }}
              >
                <input
                  checked={has}
                  className="brand-accent-checkbox size-3.5"
                  disabled
                  readOnly
                  type="checkbox"
                />
                <span
                  className="text-xs"
                  style={{
                    color: has ? "var(--foreground)" : "var(--muted-foreground)",
                    fontWeight: has ? 500 : 400,
                  }}
                >
                  {PERMISSION_LABELS[permission]}
                </span>
              </label>
            );
          })}
        </div>
      ))}

      <div className="mt-4 flex gap-2">
        <button className="admin-muted-button flex-1" onClick={onEdit} type="button">
          Editar
        </button>
        {!role.is_system ? (
          <button
            className="rounded-[10px] bg-[#ef4444]/10 px-4 py-2.5 text-[13px] font-semibold text-[#ef4444]"
            onClick={onDelete}
            type="button"
          >
            Eliminar
          </button>
        ) : null}
      </div>
    </article>
  );
}

function UserModal({
  form,
  isLoadingRoles,
  onChange,
  onClose,
  onSubmit,
  roles,
}: {
  form: UserForm;
  isLoadingRoles: boolean;
  onChange: React.Dispatch<React.SetStateAction<UserForm>>;
  onClose: () => void;
  onSubmit: () => void;
  roles: Role[];
}) {
  const passwordTooShort = !form.id && form.password.length < 8;
  const disabled =
    isLoadingRoles ||
    roles.length === 0 ||
    !form.fullName.trim() ||
    !form.email.trim() ||
    !form.roleId ||
    passwordTooShort;

  return (
    <ModalFrame onClose={onClose} title={form.id ? "Editar usuario" : "Nuevo usuario"}>
      <div className="space-y-3.5">
        <Field label="Nombre completo">
          <input
            className="admin-input"
            onChange={(event) =>
              onChange((current) => ({ ...current, fullName: event.target.value }))
            }
            placeholder="Cocina Turno Noche"
            value={form.fullName}
          />
          {passwordTooShort ? (
            <p className="mt-1.5 text-[11px] font-semibold text-[#ef4444]">
              La contraseÃ±a debe tener al menos 8 caracteres.
            </p>
          ) : null}
        </Field>
        <Field label="Email">
          <input
            className="admin-input"
            onChange={(event) =>
              onChange((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="cocina@foodtag.ar"
            type="email"
            value={form.email}
          />
        </Field>
        <Field label={form.id ? "Nueva contraseña" : "Contraseña"}>
          <input
            className="admin-input"
            minLength={form.id ? undefined : 8}
            onChange={(event) =>
              onChange((current) => ({ ...current, password: event.target.value }))
            }
            placeholder={form.id ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}
            type="password"
            value={form.password}
          />
        </Field>
        <Field label="Rol">
          <select
            className="admin-input"
            disabled={isLoadingRoles || roles.length === 0}
            onChange={(event) =>
              onChange((current) => ({ ...current, roleId: event.target.value }))
            }
            value={form.roleId}
          >
            <option value="">Elegí un rol</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </Field>
        <ToggleRow
          checked={form.active}
          label="Usuario activo"
          onChange={(checked) => onChange((current) => ({ ...current, active: checked }))}
        />
      </div>
      <div className="mt-6 flex gap-2.5">
        <button
          className="admin-primary-button flex-[2] disabled:opacity-50"
          disabled={disabled}
          onClick={onSubmit}
          type="button"
        >
          Guardar usuario
        </button>
        <button className="admin-muted-button flex-1" onClick={onClose} type="button">
          Cancelar
        </button>
      </div>
      {disabled && passwordTooShort ? (
        <p className="mt-2 text-center text-[11px] font-semibold text-[#999]">
          CompletÃ¡ una contraseÃ±a de 8 caracteres o mÃ¡s para habilitar el guardado.
        </p>
      ) : null}
    </ModalFrame>
  );
}

function RoleModal({
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  form: RoleForm;
  onChange: React.Dispatch<React.SetStateAction<RoleForm>>;
  onClose: () => void;
  onSubmit: () => void;
}) {
  function togglePermission(permission: PermissionKey) {
    onChange((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((entry) => entry !== permission)
        : [...current.permissions, permission],
    }));
  }

  return (
    <ModalFrame onClose={onClose} title={form.id ? "Editar rol" : "Nuevo rol"}>
      <Field label="Nombre del rol">
        <input
          className="admin-input"
          onChange={(event) =>
            onChange((current) => ({ ...current, name: event.target.value }))
          }
          placeholder="Encargado de turno"
          value={form.name}
        />
      </Field>
      <div className="mt-4 space-y-3">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.5px] text-[#999]">
              {group.title}
            </div>
            <div className="grid gap-1.5">
              {group.permissions.map((permission) => (
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#f2f2f2] px-3 py-2 dark:bg-[#242424]"
                  key={permission}
                >
                  <input
                    checked={form.permissions.includes(permission)}
                    className="brand-accent-checkbox size-3.5"
                    onChange={() => togglePermission(permission)}
                    type="checkbox"
                  />
                  <span className="text-xs font-medium text-[#555] dark:text-[#a0a0a0]">
                    {PERMISSION_LABELS[permission]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-2.5">
        <button className="admin-primary-button flex-[2]" onClick={onSubmit} type="button">
          Guardar rol
        </button>
        <button className="admin-muted-button flex-1" onClick={onClose} type="button">
          Cancelar
        </button>
      </div>
    </ModalFrame>
  );
}

function ModalFrame({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-5"
      onClick={onClose}
    >
      <div
        className="scrollable max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[20px] bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.25)] dark:bg-[#1a1a1a]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#111] dark:text-[#f5f5f5]">
            {title}
          </h2>
          <button
            className="flex size-8 items-center justify-center rounded-lg bg-[#f2f2f2] text-lg text-[#555] dark:bg-[#242424] dark:text-[#a0a0a0]"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
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

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#f2f2f2] px-3 py-2 dark:bg-[#242424]">
      <span className="text-xs font-bold text-[#555] dark:text-[#a0a0a0]">{label}</span>
      <button
        className="admin-toggle"
        data-checked={checked}
        onClick={() => onChange(!checked)}
        type="button"
      >
        <span className="admin-toggle-thumb" />
      </button>
    </div>
  );
}
