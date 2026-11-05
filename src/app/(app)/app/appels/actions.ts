"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { can } from "@/lib/auth/permissions";

export interface ResultatCorbeille {
  ok: boolean;
  nombre?: number;
  erreur?: string;
}

/**
 * Mettre des appels à la corbeille.
 *
 * Suppression logique : la ligne reste trente jours, invisible, puis le
 * travail planifié supprime le fichier audio et la ligne. Une erreur reste
 * donc rattrapable pendant un mois.
 *
 * Le contrôle de rôle est fait en base par `trash_calls` — c'est le seul qui
 * protège vraiment. Celui-ci sert à donner un message clair plutôt qu'une
 * erreur SQL.
 */
export async function mettreALaCorbeille(
  ids: string[],
): Promise<ResultatCorbeille> {
  if (ids.length === 0) return { ok: true, nombre: 0 };
  if (ids.length > 100)
    return { ok: false, erreur: "Trop d’appels d’un coup (100 au maximum)." };

  const { activeOrganization } = await requireOrganization();

  if (!can(activeOrganization.role, "organization:update")) {
    return {
      ok: false,
      erreur: "Seul un responsable peut supprimer des appels.",
    };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("trash_calls", {
    org_id: activeOrganization.organization_id,
    ids,
  });

  if (error) {
    return {
      ok: false,
      erreur:
        error.code === "42501"
          ? "Seul un responsable peut supprimer des appels."
          : "La suppression n’a pas abouti.",
    };
  }

  revalidatePath("/app/appels");
  revalidatePath("/app");
  return { ok: true, nombre: typeof data === "number" ? data : ids.length };
}

/** Sortir des appels de la corbeille, tant que la purge n'est pas passée. */
export async function restaurerAppels(
  ids: string[],
): Promise<ResultatCorbeille> {
  if (ids.length === 0) return { ok: true, nombre: 0 };

  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.rpc("restore_calls", {
    org_id: activeOrganization.organization_id,
    ids,
  });

  if (error) return { ok: false, erreur: "La restauration n’a pas abouti." };

  revalidatePath("/app/appels");
  return { ok: true, nombre: typeof data === "number" ? data : ids.length };
}
