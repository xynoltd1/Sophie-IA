import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Se connecter — Sophie IA",
  // Une page de connexion dans les resultats de recherche n'apporte rien a
  // personne : elle n'a pas de contenu et detourne les visiteurs de la page
  // qui explique le produit.
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <>
      <LoginForm />
      <p className="text-sm text-ink-soft">
        <Link
          href="/mot-de-passe-oublie"
          className="font-medium text-signal underline underline-offset-4"
        >
          Mot de passe oublié ?
        </Link>
      </p>
      <p className="text-sm text-ink-soft">
        Pas encore de compte ?{" "}
        <Link
          href="/signup"
          className="font-medium text-signal underline underline-offset-4"
        >
          Créer mon compte
        </Link>
      </p>
    </>
  );
}
