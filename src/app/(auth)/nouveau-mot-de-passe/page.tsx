import { ResetForm } from "./reset-form";

export const metadata = { title: "Nouveau mot de passe — Zelicall" };

/**
 * Page d'arrivée d'un lien de récupération.
 *
 * Elle ne vérifie pas elle-même la session : `/auth/callback` a déjà échangé
 * le code et posé les cookies avant d'arriver ici. Si le lien était mort,
 * l'action le dira au moment d'enregistrer, avec un message qui explique quoi
 * faire — plutôt qu'une redirection muette vers la connexion, qui est
 * exactement ce qui nous a fait perdre du temps.
 */
export default function NouveauMotDePassePage() {
  return <ResetForm />;
}
