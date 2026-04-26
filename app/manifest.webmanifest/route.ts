import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ticket = req.nextUrl.searchParams.get("ticket");
  const token = req.nextUrl.searchParams.get("token");

  const startUrl =
    ticket && token
      ? `/handoff?ticket=${encodeURIComponent(ticket)}&token=${encodeURIComponent(token)}`
      : "/";

  const manifest = {
    name: "FoodTag",
    short_name: "FoodTag",
    description: "Pedidos autoservicio para food trucks con beeper digital.",
    start_url: startUrl,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#F97316",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-store",
    },
  });
}
