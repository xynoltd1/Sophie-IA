import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Carte,
  Chiffre,
  Tableau,
  TitreSection,
} from "@/components/admin/surface";
import { Histogramme } from "@/components/admin/chart";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/states";
import {
  LIBELLES_USAGE,
  PERIODES,
  consommationTotale,
  dureeLisible,
  periodeDepuis,
  statsPlateforme,
} from "@/lib/platform/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appels et consommation — Plateforme" };

/**
 * Consommation par entreprise.
 *
 * C'est l'écran qui servira à facturer le jour où la facturation existera.
 * En attendant, il sert à savoir qui coûte cher — information utile pour
 * fixer un prix, et seule façon honnête de le fixer : à partir de la
 * consommation réelle, pas d'une estimation.
 */
export default async function ConsommationPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await requirePlatformAdmin();
  const { periode: brut } = await searchParams;
  const periode = periodeDepuis(brut);
  const depuis = new Date(Date.now() - periode.jours * 86_400_000);

  const admin = createAdminClient();

  const [{ stats }, consommation, parOrganisation, organisations] =
    await Promise.all([
      statsPlateforme(periode.jours),
      consommationTotale(depuis),
      admin
        .from("usage_records")
        .select("organization_id, kind, quantity")
        .gte("occurred_at", depuis.toISOString())
        .limit(5000),
      admin.from("organizations").select("id, name").is("deleted_at", null),
    ]);

  const nomOrganisation = new Map<string, string>(
    ((organisations.data ?? []) as { id: string; name: string }[]).map((o) => [
      o.id,
      o.name,
    ]),
  );

  const cumul = new Map<string, Record<string, number>>();
  for (const ligne of (parOrganisation.data ?? []) as {
    organization_id: string;
    kind: string;
    quantity: number;
  }[]) {
    const courant = cumul.get(ligne.organization_id) ?? {};
    courant[ligne.kind] =
      (courant[ligne.kind] ?? 0) + Number(ligne.quantity ?? 0);
    cumul.set(ligne.organization_id, courant);
  }

  const lignes = [...cumul.entries()]
    .map(([id, valeurs]) => ({
      id,
      nom: nomOrganisation.get(id) ?? "Entreprise supprimée",
      minutes: Math.round(valeurs.VOICE_MINUTES ?? 0),
      sms: Math.round(valeurs.SMS_SENT ?? 0),
      resumes: Math.round(valeurs.AI_USAGE ?? 0),
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Appels et consommation
        </h1>
        <nav aria-label="Période" className="flex gap-2">
          {PERIODES.map((p) => (
            <Chip
              key={p.cle}
              href={`/admin/consommation?periode=${p.cle}`}
              actif={p.cle === periode.cle}
            >
              {p.libelle}
            </Chip>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre libelle="Appels reçus" valeur={stats.calls_total} />
        <Chiffre
          libelle="Temps au téléphone"
          valeur={dureeLisible(stats.calls_duration_seconds)}
        />
        <Chiffre libelle="SMS envoyés" valeur={stats.messages_sent} />
        <Chiffre
          libelle="Coût total"
          indisponible="Les tarifs des fournisseurs ne sont pas dans le produit."
        />
      </div>

      <section>
        <TitreSection>Par nature</TitreSection>
        {consommation.length === 0 ? (
          <Carte>
            <p className="text-sm text-ink-soft">
              Rien de consommé sur la période.
            </p>
          </Carte>
        ) : (
          <Carte>
            <Histogramme
              titre="Consommation par nature"
              points={consommation.map((ligne) => ({
                label: LIBELLES_USAGE[ligne.kind]?.nom ?? ligne.kind,
                valeur: Math.round(ligne.total),
              }))}
            />
          </Carte>
        )}
      </section>

      <section>
        <TitreSection detail="Trié par minutes d’appel, du plus gros consommateur au plus petit.">
          Par entreprise
        </TitreSection>
        {lignes.length === 0 ? (
          <EmptyState
            title="Aucune consommation"
            description="Elle se remplit quand de vrais appels arrivent et que de vrais SMS partent."
          />
        ) : (
          <Tableau entetes={["Entreprise", "Minutes", "SMS", "Résumés"]}>
            {lignes.map((ligne) => (
              <tr key={ligne.id}>
                <td className="px-4 py-3 font-medium">{ligne.nom}</td>
                <td className="tabular px-4 py-3">{ligne.minutes}</td>
                <td className="tabular px-4 py-3">{ligne.sms}</td>
                <td className="tabular px-4 py-3">{ligne.resumes}</td>
              </tr>
            ))}
          </Tableau>
        )}
      </section>
    </div>
  );
}
