import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { EntitySource, LeadPriority, TaskStatus } from "@/types/database";
import type { TacheListee, VueTaches } from "./tasks";

export type { TacheListee, VueTaches } from "./tasks";

/**
 * La lecture des tâches.
 *
 * Les tâches existaient déjà : Sophie en crée pendant un appel (« demandez-lui
 * de me rappeler demain »), la fiche contact en affiche quelques-unes. Mais
 * aucun écran ne les montrait toutes. L'accueil annonçait « 3 tâches en
 * retard » et renvoyait vers un filtre de prospects qui ne connaissait pas ce
 * mot : le compte était juste, le lien ne menait nulle part.
 *
 * Quatre vues, dans l'ordre où un artisan s'en sert : ce qui est en retard, ce
 * qui est pour aujourd'hui, le reste à faire, et l'archive.
 */

/**
 * Fin de la journée courante dans le fuseau de l'entreprise.
 *
 * « Aujourd'hui » n'est pas « dans les 24 heures ». Une tâche due ce soir et
 * une tâche due demain matin ne demandent pas la même chose, et l'écart entre
 * les deux est précisément ce qu'un fuseau décale.
 */
function finDeJournee(timezone: string): Date {
  const maintenant = new Date();
  const jour = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);

  // On passe par le même raisonnement que `instantDepuisHeureLocale` : estimer,
  // mesurer l'écart, corriger. Le détour évite de recoder le décalage.
  const estimation = new Date(`${jour}T23:59:59Z`);
  const vuDansLeFuseau = new Date(
    estimation.toLocaleString("en-US", { timeZone: timezone }),
  );
  const vuEnUTC = new Date(
    estimation.toLocaleString("en-US", { timeZone: "UTC" }),
  );
  return new Date(
    estimation.getTime() + (vuEnUTC.getTime() - vuDansLeFuseau.getTime()),
  );
}

export async function listerTaches(
  organizationId: string,
  vue: VueTaches,
  timezone: string,
): Promise<TacheListee[]> {
  const supabase = await createServerSupabase();

  let requete = supabase
    .from("tasks")
    .select(
      "id, title, description, due_at, priority, status, source, completed_at, contacts(id, display_name)",
    )
    .eq("organization_id", organizationId);

  const maintenant = new Date().toISOString();

  if (vue === "faites") {
    requete = requete
      .in("status", ["DONE", "CANCELLED"])
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(100);
  } else if (vue === "retard") {
    requete = requete
      .eq("status", "OPEN")
      .not("due_at", "is", null)
      .lt("due_at", maintenant)
      .order("due_at", { ascending: true });
  } else if (vue === "aujourdhui") {
    requete = requete
      .eq("status", "OPEN")
      .not("due_at", "is", null)
      .lte("due_at", finDeJournee(timezone).toISOString())
      .order("due_at", { ascending: true });
  } else {
    // « À faire » inclut les tâches sans échéance : ce sont celles qu'on oublie.
    requete = requete
      .eq("status", "OPEN")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200);
  }

  const { data } = await requete;

  return ((data ?? []) as unknown as RawTache[]).map((ligne) => ({
    id: ligne.id,
    title: ligne.title,
    description: ligne.description,
    due_at: ligne.due_at,
    priority: ligne.priority,
    status: ligne.status,
    source: ligne.source,
    completed_at: ligne.completed_at,
    contact: ligne.contacts
      ? { id: ligne.contacts.id, display_name: ligne.contacts.display_name }
      : null,
  }));
}

interface RawTache {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: LeadPriority;
  status: TaskStatus;
  source: EntitySource;
  completed_at: string | null;
  contacts: { id: string; display_name: string } | null;
}
