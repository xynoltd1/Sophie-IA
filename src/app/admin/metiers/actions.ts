"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { journaliserAdmin } from "@/lib/platform/audit";

export interface MetierState {
  error?: string;
  success?: string;
}

/**
 * Un service suggéré, tel que l'onboarding le lira.
 *
 * Le schéma est strict parce que ces valeurs finissent dans la bouche de
 * Sophie : une durée absurde ou un nom vide deviendrait une proposition faite à
 * un vrai client.
 */
const serviceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  is_urgent: z.boolean().optional().default(false),
});

const schema = z.object({
  slug: z
    .string()
    .trim()
    .regex(
      /^[a-z][a-z0-9-]{1,48}$/,
      "Identifiant : minuscules, chiffres et tirets.",
    ),
  label: z.string().trim().min(2, "Donnez un nom au métier").max(80),
  defaultAppointmentMinutes: z.coerce.number().int().min(5).max(1440),
  defaultBufferMinutes: z.coerce.number().int().min(0).max(240),
  services: z.string().trim(),
  questions: z.string().trim().optional(),
  urgences: z.string().trim().optional(),
  isPublished: z.boolean(),
});

/** Une ligne par service : « Dépannage fuite | 60 | urgent ». */
function lireServices(
  brut: string,
): { name: string; duration_minutes: number; is_urgent: boolean }[] {
  const services = [];
  for (const ligne of brut.split("\n")) {
    const propre = ligne.trim();
    if (!propre) continue;
    const [nom, duree, urgent] = propre.split("|").map((p) => p.trim());
    const parsed = serviceSchema.safeParse({
      name: nom,
      duration_minutes: duree || 60,
      is_urgent: (urgent ?? "").toLowerCase().startsWith("urgent"),
    });
    if (parsed.success) services.push(parsed.data);
  }
  return services;
}

function lireListe(brut: string | undefined): string[] {
  return (brut ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30);
}

/**
 * Crée ou met à jour un métier, sans toucher au code (section 37).
 *
 * L'écriture passe par le client de session : la policy
 * « metiers: administration plateforme » de la migration 0027 n'autorise que
 * `is_platform_admin()`. La garde applicative et la garde en base disent la
 * même chose, et la seconde est celle qui protège vraiment.
 */
export async function enregistrerMetier(
  _prev: MetierState,
  formData: FormData,
): Promise<MetierState> {
  const { userId } = await requirePlatformAdmin();

  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    label: formData.get("label"),
    defaultAppointmentMinutes: formData.get("defaultAppointmentMinutes") ?? 60,
    defaultBufferMinutes: formData.get("defaultBufferMinutes") ?? 15,
    services: formData.get("services") ?? "",
    questions: formData.get("questions") ?? "",
    urgences: formData.get("urgences") ?? "",
    isPublished: formData.get("isPublished") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const services = lireServices(parsed.data.services);
  if (services.length === 0) {
    return {
      error: "Donnez au moins un service, sous la forme « Nom | 60 | urgent ».",
    };
  }

  const supabase = await createServerSupabase();

  const { error } = await supabase.from("profession_templates").upsert(
    {
      slug: parsed.data.slug,
      label: parsed.data.label,
      is_published: parsed.data.isPublished,
      suggested_services: services,
      qualification_questions: lireListe(parsed.data.questions),
      urgency_categories: lireListe(parsed.data.urgences),
      default_appointment_minutes: parsed.data.defaultAppointmentMinutes,
      default_buffer_minutes: parsed.data.defaultBufferMinutes,
    },
    { onConflict: "slug" },
  );

  if (error) {
    await journaliserAdmin({
      actorUserId: userId,
      action: "PROFESSION_TEMPLATE_UPSERT",
      resourceType: "profession_template",
      resourceId: parsed.data.slug,
      outcome: "ERROR",
      details: { message: error.message },
    });
    return { error: "Le métier n’a pas pu être enregistré." };
  }

  await journaliserAdmin({
    actorUserId: userId,
    action: "PROFESSION_TEMPLATE_UPSERT",
    resourceType: "profession_template",
    resourceId: parsed.data.slug,
    details: { services: services.length, publie: parsed.data.isPublished },
  });

  revalidatePath("/admin/metiers");
  return {
    success: parsed.data.isPublished
      ? "Métier enregistré et publié. Il apparaît dans l’inscription."
      : "Métier enregistré, non publié. Il reste invisible à l’inscription.",
  };
}

/** Publie ou retire un métier de l'inscription. */
export async function basculerPublication(
  slug: string,
  publie: boolean,
): Promise<{ ok: boolean }> {
  const { userId } = await requirePlatformAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from("profession_templates")
    .update({ is_published: publie })
    .eq("slug", slug);

  await journaliserAdmin({
    actorUserId: userId,
    action: publie
      ? "PROFESSION_TEMPLATE_PUBLISH"
      : "PROFESSION_TEMPLATE_UNPUBLISH",
    resourceType: "profession_template",
    resourceId: slug,
    outcome: error ? "ERROR" : "SUCCESS",
  });

  revalidatePath("/admin/metiers");
  return { ok: !error };
}
