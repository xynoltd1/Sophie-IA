import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet } from "@/components/ui/sheet";
import { ReponseProposition } from "./reponse";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Votre rendez-vous",
  // Un lien qui circule par SMS ne doit pas finir dans un moteur de recherche.
  robots: { index: false, follow: false },
};

/**
 * Page de réponse du client à une proposition d'horaire (section 23).
 *
 * Elle est publique parce que le client n'a pas de compte, et elle ne montre
 * presque rien : l'entreprise, l'objet, l'ancien et le nouvel horaire. Ni
 * téléphone, ni adresse, ni notes. Un lien de SMS peut être transféré, lu sur
 * un écran verrouillé, ou retrouvé dans un historique : il ne doit jamais
 * devenir une fiche client.
 */
export default async function PageProposition({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServerSupabase();

  const { data } = await supabase.rpc("proposal_by_token", { jeton: token });
  const proposition = (Array.isArray(data) ? data[0] : data) as
    | {
        appointment_id: string;
        organization_name: string;
        title: string;
        current_starts_at: string;
        proposed_starts_at: string | null;
        proposed_ends_at: string | null;
        status: string;
        expires_at: string | null;
        timezone: string | null;
      }
    | undefined;

  if (!proposition) {
    return (
      <Cadre>
        <p className="font-medium">Ce lien n’est plus valable.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Le rendez-vous a peut-être déjà été réglé. Contactez directement l’entreprise.
        </p>
      </Cadre>
    );
  }

  const fuseau = proposition.timezone ?? "Europe/Brussels";
  const expire =
    proposition.expires_at !== null && new Date(proposition.expires_at).getTime() < Date.now();

  if (proposition.status !== "CHANGE_PROPOSED" || expire) {
    return (
      <Cadre>
        <p className="font-medium">
          {expire ? "Cette proposition a expiré." : "Cette proposition a déjà reçu une réponse."}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Contactez {proposition.organization_name} pour convenir d’un horaire.
        </p>
      </Cadre>
    );
  }

  return (
    <Cadre>
      <p className="text-sm text-ink-soft">{proposition.organization_name}</p>
      <h1 className="mt-1 font-display text-xl font-semibold">{proposition.title}</h1>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <p className="text-sm text-ink-soft">Horaire prévu</p>
          <p className="text-sm line-through">{lisible(proposition.current_starts_at, fuseau)}</p>
        </div>
        <div>
          <p className="text-sm text-ink-soft">Nouvel horaire proposé</p>
          <p className="font-medium first-letter:uppercase">
            {proposition.proposed_starts_at ? lisible(proposition.proposed_starts_at, fuseau) : "—"}
          </p>
        </div>
      </div>

      <ReponseProposition token={token} />

      <p className="mt-4 text-sm text-ink-soft">
        Votre réponse est transmise directement à l’entreprise.
      </p>
    </Cadre>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-8">
      <Sheet className="w-full">{children}</Sheet>
    </main>
  );
}

function lisible(iso: string, timezone: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  })} à ${date.toLocaleTimeString("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  })}`;
}
