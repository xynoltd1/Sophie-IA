import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sophie IA",
  description:
    "Sophie répond à vos clients pendant que vous travaillez : appels qualifiés, rendez-vous proposés, messages centralisés.",
  applicationName: "Sophie IA",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sophie", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b6e58",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
