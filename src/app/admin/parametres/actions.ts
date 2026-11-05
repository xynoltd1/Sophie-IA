"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { enregistrerReglages } from "@/lib/config/platform";
import { journaliserAdmin } from "@/lib/platform/audit";

export interface ParametresState {
  error?: string;
  success?: string;
  avertissement?: string;
}

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  title: z.string().trim().min(10).max(120),
  description: z.string().trim().min(50).max(300),
  canonical: z.string().trim().url(),
  locale: z.string().trim().min(2).max(10),
  og_image: z.string().trim().url().or(z.literal("")),
  contact_email: z.string().trim().email().or(z.literal("")),
  support_email: z.string().trim().email().or(z.literal("")),
});

/**
 * Enregistre les réglages du site public.
 *
 * ## Les bornes ne sont pas décoratives
 *
 * Un titre de plus de 120 caractères est coupé dans les résultats Google ;
 * une description de moins de 50 ne dit rien. Les refuser ici évite de
 * découvrir le problème trois semaines plus tard dans Search Console.
 *
 * ## Changer l'adresse canonique ne déplace pas le site
 *
 * Le formulaire écrit une adresse ; il ne crée ni enregistrement DNS, ni
 * domaine sur Vercel, ni adresse de retour OAuth chez Google. Saisir un
 * domaine qui n'est pas configuré ailleurs donne un site qui se déclare à une
 * adresse où il ne répond pas — et Google suit la déclaration. L'écran le dit
 * au moment où ça arrive.
 */
export async function enregistrerSite(
  _prev: ParametresState,
  formData: FormData,
): Promise<ParametresState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    title: formData.get("title"),
    description: formData.get("description"),
    canonical: formData.get("canonical"),
    locale: formData.get("locale"),
    og_image: formData.get("og_image") ?? "",
    contact_email: formData.get("contact_email") ?? "",
    support_email: formData.get("support_email") ?? "",
  });

  if (!parsed.success) {
    const premier = parsed.error.issues[0];
    return {
      error:
        premier?.path[0] === "description"
          ? "La description doit faire entre 50 et 300 caractères."
          : premier?.path[0] === "title"
            ? "Le titre doit faire entre 10 et 120 caractères."
            : premier?.path[0] === "canonical"
              ? "L’adresse canonique doit être une adresse complète, avec https://."
              : "Un champ est invalide.",
    };
  }

  const { userId } = await requirePlatformAdmin();

  const valeurs = {
    ...parsed.data,
    canonical: parsed.data.canonical.replace(/\/$/, ""),
  };

  const ok = await enregistrerReglages("site", valeurs, userId);
  if (!ok) return { error: "Les réglages n’ont pas pu être enregistrés." };

  await journaliserAdmin({
    actorUserId: userId,
    action: "settings.site",
    resourceType: "platform_settings",
    resourceId: "site",
    details: { canonical: valeurs.canonical },
  });

  revalidatePath("/admin/parametres");
  revalidatePath("/");

  const attendu = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const avertissement =
    attendu && attendu !== valeurs.canonical
      ? `L’adresse canonique (${valeurs.canonical}) ne correspond pas au domaine servi (${attendu}). Le site va se déclarer à une adresse où il ne répond pas, et Google suivra la déclaration. Configurez d’abord le domaine sur Vercel et le DNS, ainsi que l’adresse de retour OAuth chez Google.`
      : undefined;

  return {
    success:
      "Enregistré. Les pages publiques utilisent ces valeurs d’ici une minute, sans redéploiement.",
    avertissement,
  };
}

const analytics = z.object({
  enabled: z.enum(["true", "false"]),
  exclude_internal: z.enum(["true", "false"]),
});

export async function enregistrerAnalytics(
  _prev: ParametresState,
  formData: FormData,
): Promise<ParametresState> {
  const parsed = analytics.safeParse({
    enabled: formData.get("enabled"),
    exclude_internal: formData.get("exclude_internal"),
  });

  if (!parsed.success) return { error: "Réglage invalide." };

  const { userId } = await requirePlatformAdmin();

  const ok = await enregistrerReglages(
    "analytics",
    {
      enabled: parsed.data.enabled === "true",
      exclude_internal: parsed.data.exclude_internal === "true",
    },
    userId,
  );

  if (!ok) return { error: "Le réglage n’a pas pu être enregistré." };

  await journaliserAdmin({
    actorUserId: userId,
    action: "settings.analytics",
    resourceType: "platform_settings",
    resourceId: "analytics",
  });

  revalidatePath("/admin/parametres");
  return { success: "Enregistré." };
}
