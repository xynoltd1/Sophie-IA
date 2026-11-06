"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { LONGUEUR_MAX, verifierModele } from "@/lib/sophie/greeting";

export interface AccueilState {
  error?: string;
  success?: string;
  avertissement?: string;
}

const texte = z
  .string()
  .trim()
  .max(LONGUEUR_MAX)
  .transform((v) => v || "");

const schema = z.object({
  assistant_name: z.string().trim().min(2).max(40),
  spoken_name: z.string().trim().max(60),
  greeting: texte,
  greeting_morning: texte,
  greeting_evening: texte,
  greeting_closed: texte,
  notice_position: z.enum(["APRES_ACCUEIL", "AVANT_ACCUEIL"]),
});

/**
 * Enregistre l'accueil téléphonique de l'entreprise.
 *
 * ## Ce qui est refusé, et ce qui ne l'est pas
 *
 * Refusé : une formule trop longue pour être écoutée, trop courte pour dire
 * quelque chose, ou qui utilise une variable qui n'existe pas. Dans les trois
 * cas, l'erreur serait découverte au téléphone par un client.
 *
 * **Pas refusé : l'oubli de la mention « assistante virtuelle ».** Elle est
 * ajoutée automatiquement au moment de parler. Refuser l'enregistrement
 * apprendrait à l'artisan à écrire la formule magique ; l'ajouter nous-mêmes
 * garantit qu'elle est dite, y compris dans les formules écrites avant
 * aujourd'hui. L'écran le dit en clair plutôt que de le faire en silence.
 *
 * ## Ce que cette action ne touche pas
 *
 * `disclose_ai` reste verrouillé à vrai en base, et aucun champ d'ici ne
 * l'atteint. La position de l'annonce se règle ; son existence non.
 */
export async function enregistrerAccueil(
  _prev: AccueilState,
  formData: FormData,
): Promise<AccueilState> {
  const { activeOrganization } = await requireOrganization();

  if (!can(activeOrganization.role, "organization:update")) {
    return { error: "Votre rôle ne permet pas de modifier l’accueil." };
  }

  const lecture = schema.safeParse({
    assistant_name: formData.get("assistant_name") ?? "",
    spoken_name: formData.get("spoken_name") ?? "",
    greeting: formData.get("greeting") ?? "",
    greeting_morning: formData.get("greeting_morning") ?? "",
    greeting_evening: formData.get("greeting_evening") ?? "",
    greeting_closed: formData.get("greeting_closed") ?? "",
    notice_position: formData.get("notice_position") ?? "APRES_ACCUEIL",
  });

  if (!lecture.success) {
    return {
      error:
        "Le nom de l’assistante fait entre 2 et 40 caractères, et chaque formule 400 au maximum.",
    };
  }

  const valeurs = lecture.data;

  const problemes = [
    ...verifierModele(valeurs.greeting, "la formule principale"),
    ...verifierModele(valeurs.greeting_morning, "la formule du matin"),
    ...verifierModele(valeurs.greeting_evening, "la formule du soir"),
    ...verifierModele(valeurs.greeting_closed, "la formule hors horaires"),
  ];

  if (problemes.length > 0) {
    return {
      error: problemes
        .map((p) => `${p.champ.replace(/^la /, "Dans la ")} : ${p.message}`)
        .join(" "),
    };
  }

  const supabase = await createServerSupabase();

  const { error } = await supabase.from("sophie_configurations").upsert(
    {
      organization_id: activeOrganization.organization_id,
      assistant_name: valeurs.assistant_name,
      // À partir d'ici, ce nom appartient à l'entreprise. Aucune migration de
      // renommage ne doit plus l'écraser, même si elle retape le nom par
      // défaut : l'avoir vu et conservé est un choix.
      assistant_name_source: "CUSTOM",
      spoken_name: valeurs.spoken_name || null,
      greeting: valeurs.greeting || null,
      greeting_morning: valeurs.greeting_morning || null,
      greeting_evening: valeurs.greeting_evening || null,
      greeting_closed: valeurs.greeting_closed || null,
      notice_position: valeurs.notice_position,
      greeting_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );

  if (error) return { error: `Enregistrement refusé : ${error.message}` };

  revalidatePath("/app/sophie/accueil");
  revalidatePath("/app/sophie");

  return {
    success:
      "Enregistré. Le prochain appel reçu utilisera cette formule : elle est lue au moment où le téléphone sonne, sans redéploiement.",
  };
}
