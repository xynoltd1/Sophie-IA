import { SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Appels — Sophie IA" };

export default function AppelsPage() {
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Appels et messages</SectionTitle>
      <EmptyState
        title="Aucun appel enregistre"
        description="Chaque appel affichera l’enregistrement audio, le resume de Sophie et la transcription complete."
      />
    </div>
  );
}
