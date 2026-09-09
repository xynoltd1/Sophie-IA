import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { SectionTitle } from "@/components/ui/sheet";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouveau prospect — Sophie IA" };

export default async function NouveauProspectPage() {
  await requireOrganization();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>Nouveau prospect</SectionTitle>
        <Link href="/app/prospects" className="text-sm text-ink-soft underline underline-offset-4">
          Annuler
        </Link>
      </div>
      <LeadForm />
    </div>
  );
}
