import { Sheet } from "@/components/ui/sheet";
import { FormulaireInvitation } from "./formulaire";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Invitation — Sophie IA",
  robots: { index: false },
};

/**
 * Page d'acceptation d'une invitation.
 *
 * Rien n'est fait au chargement : l'adhésion passe par un bouton. Un lien
 * visité par un aperçu de messagerie ne doit pas faire entrer quelqu'un dans
 * une entreprise.
 */
export default async function PageInvitation({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-8">
      <Sheet className="w-full">
        <h1 className="font-display text-xl font-semibold">
          Rejoindre une entreprise
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Vous avez été invité à rejoindre une entreprise sur Sophie IA.
          Connectez-vous avec l’adresse qui a reçu l’invitation, puis confirmez.
        </p>
        <FormulaireInvitation token={token} />
      </Sheet>
    </main>
  );
}
