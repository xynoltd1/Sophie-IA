import { Sheet, SectionTitle } from "@/components/ui/sheet";

export const metadata = { title: "Sophie — Sophie IA" };

export default function SophiePage() {
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Sophie</SectionTitle>
      <Sheet>
        <p className="font-semibold">Sophie ne repond pas encore</p>
        <p className="mt-1 text-sm text-ink-soft">
          Sa voix, son vocabulaire, ses connaissances et ses regles de prise d’appel se
          configurent ici. Cette partie est construite en Phase 1 ; la prise d’appel reelle
          arrive en Phase 4.
        </p>
      </Sheet>
    </div>
  );
}
