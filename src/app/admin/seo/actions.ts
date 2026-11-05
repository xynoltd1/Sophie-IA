"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { journaliserAdmin } from "@/lib/platform/audit";
import { cheminAutorise } from "@/lib/seo/pages";
import { enregistrerReglages } from "@/lib/config/platform";
import { choisirPropriete, deconnecter } from "@/lib/seo/search-console";

export interface SeoState {
  error?: string;
  success?: string;
  avertissement?: string;
}

const pageSchema = z.object({
  path: z.string().trim().min(1),
  title: z.string().trim().max(120),
  description: z.string().trim().max(300),
  priority: z.coerce.number().min(0).max(1),
  indexable: z.boolean(),
  in_sitemap: z.boolean(),
  published: z.boolean(),
});

/**
 * Enregistre le référencement d'une page publique.
 *
 * ## Le chemin n'est pas un champ libre
 *
 * Une page n'existe que si un fichier la rend. Laisser saisir un chemin
 * quelconque produirait un plan du site qui annonce à Google des adresses
 * répondant 404 — une erreur que Search Console met des semaines à oublier.
 * Le chemin est donc choisi dans la liste du code, vérifié ici, et vérifié une
 * seconde fois par une contrainte de la table.
 *
 * ## Un titre vide n'est pas une erreur
 *
 * Il signifie « garde la valeur du site ». C'est le cas le plus fréquent :
 * seule la page d'accueil mérite souvent un titre propre.
 */
export async function enregistrerPage(
  _etat: SeoState,
  formData: FormData,
): Promise<SeoState> {
  const { userId } = await requirePlatformAdmin();

  const lecture = pageSchema.safeParse({
    path: formData.get("path"),
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    priority: formData.get("priority") ?? 0.5,
    indexable: formData.get("indexable") === "on",
    in_sitemap: formData.get("in_sitemap") === "on",
    published: formData.get("published") === "on",
  });

  if (!lecture.success) {
    return { error: "Valeurs refusées. Vérifiez les longueurs." };
  }

  const page = lecture.data;

  if (!cheminAutorise(page.path)) {
    return {
      error:
        "Ce chemin n’est pas une page publique connue du code. Rien n’a été enregistré.",
    };
  }

  const description = page.description.trim();
  if (description && description.length < 50) {
    return {
      error:
        "Une description de moins de 50 caractères ne dit rien dans un résultat Google. Laissez le champ vide pour reprendre celle du site.",
    };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("seo_pages").upsert(
      {
        path: page.path,
        title: page.title.trim() || null,
        description: description || null,
        indexable: page.indexable,
        in_sitemap: page.in_sitemap,
        published: page.published,
        priority: page.priority,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "path" },
    );

    if (error) return { error: `Enregistrement refusé : ${error.message}` };

    await journaliserAdmin({
      actorUserId: userId,
      action: "seo_page.update",
      resourceType: "seo_pages",
      resourceId: page.path,
      outcome: "SUCCESS",
    });

    revalidatePath("/admin/seo");
    revalidatePath("/sitemap.xml");
    revalidatePath(page.path);

    return {
      success: "Enregistré.",
      avertissement: !page.indexable
        ? "Cette page porte maintenant un noindex : Google la retirera de ses résultats."
        : !page.in_sitemap
          ? "Cette page n’est plus annoncée dans le plan du site. Elle reste indexable si Google la trouve autrement."
          : undefined,
    };
  } catch (cause) {
    return {
      error:
        cause instanceof Error ? cause.message : "Enregistrement impossible.",
    };
  }
}

const TYPES_IMAGE = ["image/png", "image/jpeg", "image/webp"];
const TAILLE_MAX = 2 * 1024 * 1024;

/**
 * Téléverse l'image de partage.
 *
 * ## Pourquoi un vrai fichier et pas une adresse
 *
 * Une adresse saisie à la main pointe vers un fichier que personne ne
 * surveille. Le jour où il disparaît, chaque lien partagé perd son image sans
 * que rien ne le signale. Ici le fichier nous appartient.
 *
 * ## Le chemin n'est pas choisi par le navigateur
 *
 * Le nom envoyé par le formulaire est ignoré. Un nom de fichier venant du
 * client est une adresse qu'il contrôle : il pourrait écrire ailleurs dans le
 * bucket. Le chemin est construit ici.
 *
 * ## Les dimensions ne sont pas vérifiées
 *
 * Il faudrait décoder l'image côté serveur pour les connaître. L'écran
 * annonce donc la taille attendue (1200 × 630) et montre le résultat : une
 * image mal proportionnée se voit immédiatement dans l'aperçu.
 */
export async function televerserImagePartage(
  _etat: SeoState,
  formData: FormData,
): Promise<SeoState> {
  const { userId } = await requirePlatformAdmin();

  const fichier = formData.get("image");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { error: "Aucun fichier choisi." };
  }

  if (!TYPES_IMAGE.includes(fichier.type)) {
    return { error: "Format refusé. Attendu : PNG, JPEG ou WebP." };
  }

  if (fichier.size > TAILLE_MAX) {
    return {
      error: `Fichier trop lourd (${Math.round(fichier.size / 1024)} ko). Maximum 2 Mo.`,
    };
  }

  const extension =
    fichier.type === "image/png"
      ? "png"
      : fichier.type === "image/webp"
        ? "webp"
        : "jpg";

  // Le nom change à chaque envoi : les caches des réseaux sociaux gardent
  // longtemps l'ancienne image sous une même adresse.
  const chemin = `partage/og-${Date.now()}.${extension}`;

  try {
    const admin = createAdminClient();
    const { error } = await admin.storage
      .from("public-assets")
      .upload(chemin, fichier, { contentType: fichier.type, upsert: false });

    if (error) return { error: `Envoi refusé : ${error.message}` };

    const { data } = admin.storage.from("public-assets").getPublicUrl(chemin);
    const url = data.publicUrl;

    const cible = String(formData.get("cible") ?? "site");

    if (cible === "site") {
      await enregistrerReglages("site", { og_image: url }, userId);
      revalidatePath("/");
    } else {
      if (!cheminAutorise(cible)) {
        return {
          error:
            "Image envoyée, mais le chemin de page est inconnu : elle n’a pas été rattachée.",
        };
      }
      await admin.from("seo_pages").upsert(
        {
          path: cible,
          og_image: url,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: "path" },
      );
      revalidatePath(cible);
    }

    await journaliserAdmin({
      actorUserId: userId,
      action: "seo_image.upload",
      resourceType: "public-assets",
      resourceId: chemin,
      outcome: "SUCCESS",
    });

    revalidatePath("/admin/seo");
    return { success: "Image en place." };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Envoi impossible.",
    };
  }
}

export async function choisirProprieteConsole(
  _etat: SeoState,
  formData: FormData,
): Promise<SeoState> {
  const { userId } = await requirePlatformAdmin();

  const propriete = String(formData.get("propriete") ?? "").trim();
  if (!propriete) return { error: "Aucune propriété choisie." };

  try {
    await choisirPropriete(propriete);
    await journaliserAdmin({
      actorUserId: userId,
      action: "search_console.property",
      resourceType: "search_console_connection",
      outcome: "SUCCESS",
      details: { propriete },
    });
    revalidatePath("/admin/seo");
    return { success: "Propriété choisie." };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Choix impossible.",
    };
  }
}

export async function deconnecterConsole(): Promise<void> {
  const { userId } = await requirePlatformAdmin();
  await deconnecter();
  await journaliserAdmin({
    actorUserId: userId,
    action: "search_console.disconnect",
    resourceType: "search_console_connection",
    outcome: "SUCCESS",
  });
  revalidatePath("/admin/seo");
}
