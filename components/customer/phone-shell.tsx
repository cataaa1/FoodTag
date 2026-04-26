"use client";

import { cn } from "@/lib/utils";

export function PhoneShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className="min-h-dvh bg-[#fff8f1] text-[#1c1009]">
      <section
        className={cn(
          "relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#fff8f1] pt-[env(safe-area-inset-top)]",
          className,
        )}
      >
        {children}
      </section>
    </main>
  );
}

export function PrimaryPhoneButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "phone-primary-button",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
