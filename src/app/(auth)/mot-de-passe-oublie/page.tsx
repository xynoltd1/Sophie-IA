import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Mot de passe oublié — Zelicall" };

export default function MotDePasseOubliePage() {
  return (
    <>
      <ForgotForm />
      <p className="text-sm text-ink-soft">
        <Link
          href="/login"
          className="font-medium text-signal underline underline-offset-4"
        >
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}
