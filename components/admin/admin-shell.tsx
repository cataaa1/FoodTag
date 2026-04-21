"use client";

import { Clock3, LayoutDashboard, MenuSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/menu",
    label: "Gestión de menú",
    icon: MenuSquare,
  },
  {
    href: "/admin/hours",
    label: "Horarios",
    icon: Clock3,
  },
] as const;

export function AdminShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar/95 px-5 py-6 lg:block">
          <div className="mb-8 flex items-center gap-3 border-b border-sidebar-border pb-6">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-2xl text-primary-foreground shadow-lg">
              🚚
            </div>
            <div>
              <p className="text-lg font-black tracking-tight">FoodTag</p>
              <p className="text-xs text-muted-foreground">Admin · El Smash</p>
            </div>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-3xl border border-sidebar-border bg-card px-4 py-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" />
              Truck activo
            </div>
            <p className="text-sm text-muted-foreground">
              Base lista para menú, horarios y permisos de staff.
            </p>
            <Button
              className="mt-4 w-full"
              size="sm"
              type="button"
              variant={darkMode ? "secondary" : "default"}
              onClick={() => setDarkMode((value) => !value)}
            >
              {darkMode ? "Usar modo claro" : "Usar modo oscuro"}
            </Button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 px-5 py-4 backdrop-blur md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
                  Panel administrativo
                </p>
                <h1 className="text-2xl font-black tracking-tight">{title}</h1>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              </div>
              <div className="flex gap-3">
                <Button asChild variant="secondary">
                  <Link href="/menu">Ver menú público</Link>
                </Button>
                <Button type="button" onClick={() => setDarkMode((value) => !value)}>
                  {darkMode ? "Claro" : "Oscuro"}
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-5 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
