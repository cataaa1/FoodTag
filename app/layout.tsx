import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";

import { BrandThemeProvider } from "@/components/providers/brand-theme-provider";
import { SwRegistration } from "@/components/providers/sw-registration";
import { QueryProvider } from "@/components/providers/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "FoodTag",
  description: "Pedidos autoservicio para food trucks con beeper digital.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FoodTag",
  },
};

export const viewport: Viewport = {
  themeColor: "#F97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="antialiased">
        <TooltipProvider>
          <QueryProvider>
            <BrandThemeProvider>
              <SwRegistration />
              {children}
            </BrandThemeProvider>
          </QueryProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
