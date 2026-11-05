import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { periodeDepuis, serieQuotidienne } from "@/lib/platform/stats";

export const dynamic = "force-dynamic";

/**
 * Export CSV de la série quotidienne.
 *
 * Le point-virgule plutôt que la virgule, et un BOM en tête : sans les deux,
 * Excel en français ouvre le fichier en une seule colonne et casse les
 * accents. C'est le genre de détail qui décide si un export sert à quelque
 * chose ou finit par être refait à la main.
 */
export async function GET(request: NextRequest) {
  await requirePlatformAdmin();

  const periode = periodeDepuis(
    request.nextUrl.searchParams.get("periode") ?? undefined,
  );
  const serie = await serieQuotidienne(periode.jours);

  const entetes = [
    "jour",
    "appels",
    "appels_en_echec",
    "prospects",
    "rendez_vous",
    "nouvelles_entreprises",
    "minutes",
  ];

  const lignes = serie.map((j) =>
    [
      j.jour,
      j.calls,
      j.calls_failed,
      j.leads,
      j.appointments,
      j.organizations_new,
      String(j.minutes).replace(".", ","),
    ].join(";"),
  );

  const corps = `﻿${entetes.join(";")}\n${lignes.join("\n")}\n`;
  const nom = `sophie-statistiques-${periode.jours}j-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(corps, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nom}"`,
      "cache-control": "no-store",
    },
  });
}
