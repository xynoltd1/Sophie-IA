import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Se connecter — Sophie IA" };

export default function LoginPage() {
  return (
    <>
      <LoginForm />
      <p className="text-sm text-ink-soft">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="font-medium text-signal underline underline-offset-4">
          Creer mon compte
        </Link>
      </p>
    </>
  );
}
