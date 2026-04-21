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
    <main className="min-h-screen bg-[#e8e0d8] px-3 py-5 text-[#1c1009] md:flex md:items-center md:justify-center md:px-6">
      <section
        className={cn(
          "relative mx-auto flex h-[812px] w-full max-w-[375px] flex-col overflow-hidden rounded-[40px] bg-[#fff8f1] shadow-[0_30px_80px_rgba(0,0,0,0.30),0_0_0_1px_rgba(0,0,0,0.10)]",
          className,
        )}
      >
        {children}
      </section>
    </main>
  );
}

export function StatusBar() {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between px-5 text-[15px] font-black">
      <span>9:41</span>
      <div className="flex items-center gap-1.5 text-[#1c1009]">
        <svg width="17" height="12" viewBox="0 0 17 12" aria-hidden="true">
          <rect x="0" y="3" width="3" height="9" rx="1" fill="currentColor" opacity=".4" />
          <rect x="4.5" y="2" width="3" height="10" rx="1" fill="currentColor" opacity=".6" />
          <rect x="9" y="0" width="3" height="12" rx="1" fill="currentColor" />
          <rect x="13.5" y="0" width="3" height="12" rx="1" fill="currentColor" opacity=".3" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
          <path d="M8 2.5C10.2 2.5 12.2 3.4 13.6 4.9L15 3.5C13.2 1.6 10.7.5 8 .5 5.3.5 2.8 1.6 1 3.5l1.4 1.4C3.8 3.4 5.8 2.5 8 2.5z" fill="currentColor" opacity=".4" />
          <path d="M8 5.5c1.4 0 2.7.6 3.6 1.5L13 5.6C11.7 4.2 9.9 3.5 8 3.5s-3.7.7-5 2.1l1.4 1.4C5.3 6.1 6.6 5.5 8 5.5z" fill="currentColor" opacity=".7" />
          <circle cx="8" cy="10" r="1.5" fill="currentColor" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" aria-hidden="true">
          <rect x="0" y="1" width="22" height="10" rx="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <rect x="1.5" y="2.5" width="17" height="7" rx="2" fill="currentColor" />
          <path d="M23 4.5v3c.8-.4 1.3-1 1.3-1.5S23.8 4.9 23 4.5z" fill="currentColor" opacity=".4" />
        </svg>
      </div>
    </div>
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
