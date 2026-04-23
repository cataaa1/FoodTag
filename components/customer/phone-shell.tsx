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
        "w-full rounded-[14px] bg-[#f97316] px-6 py-4 text-[17px] font-black tracking-[-0.2px] text-white shadow-[0_4px_16px_rgba(249,115,22,0.35)] transition active:scale-[0.98] active:bg-[#c2410c] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
