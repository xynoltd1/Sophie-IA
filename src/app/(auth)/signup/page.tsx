import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Creer un compte — Sophie IA" };

export default function SignupPage() {
  return (
    <>
      <SignupForm />
      <p className="text-sm text-ink-soft">
        Vous avez deja un compte ?{" "}
        <Link href="/login" className="font-medium text-signal underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </>
  );
}
