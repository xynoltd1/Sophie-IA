import { SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Agenda — Sophie IA" };

export default function AgendaPage() {
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Agenda</SectionTitle>
      <EmptyState
        title="Agenda non connecte"
        description="Une fois Google Calendar relie, Sophie lira vos vraies disponibilites et ne proposera jamais un creneau qui n’existe pas."
      />
    </div>
  );
}
