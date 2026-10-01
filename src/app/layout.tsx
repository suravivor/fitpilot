import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/lib/auth";
import { dirFor, type Locale } from "@/i18n";

export const runtime = "edge";

// Loaded as a plain stylesheet link (not next/font/google) so the build
// doesn't need to reach fonts.googleapis.com at build time — only the
// visitor's browser does, at runtime, same as any other CDN asset.
const RUBIK_STYLESHEET_URL =
  "https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800;900&display=swap";

export const metadata: Metadata = {
  title: "FitPilot — המאמן האישי החכם שלך",
  description: "FitPilot: AI-powered personal fitness & nutrition coach",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth().catch(() => null);
  const locale = (session?.user?.locale as Locale) ?? "he";
  const dir = dirFor(locale);

  return (
    <html lang={locale} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={RUBIK_STYLESHEET_URL} />
      </head>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
