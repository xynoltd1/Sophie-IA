import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL, siteIndexable } from "@/lib/seo/site";

export const metadata: Metadata = {
  // Sans cette base, chaque adresse de partage et chaque canonique devrait
  // etre ecrite en entier dans chaque page. Une seule oubliee suffit a ce que
  // Google indexe une page sous la mauvaise adresse.
  metadataBase: new URL(SITE_URL),
  // Hors production, rien ne s'indexe. Chaque page publique peut assouplir
  // cette regle pour elle-meme ; aucune ne peut l'assouplir par oubli.
  robots: siteIndexable()
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
  // Jeton de propriete Search Console. Absent, la balise n'est pas emise :
  // une balise de verification vide n'est pas neutre, Google la lit comme une
  // tentative ratee.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
