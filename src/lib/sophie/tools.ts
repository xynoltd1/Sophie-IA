import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCalendarFresh } from "@/lib/providers/calendar/service";
import type { VoiceToolDefinition } from "@/lib/providers/voice/types";
import { CRM_TOOLS } from "./tools-crm";
import type { SophieTool as SophieToolType } from "./tool-types";

/**
 * Outils métier de Sophie (section 11).
 *
 * Principe directeur : **Sophie ne produit aucune vérité métier**. Elle mène la
 * conversation ; les disponibilités, les tarifs, les services et l'identité des
 * clients viennent d'ici, où ils sont vérifiés contre la base.
 *
 * Chaque outil valide l'organisation, les données reçues et les règles métier
 * avant de répondre. Un outil ne fait jamais confiance à ce que le modèle lui
 * transmet.
 *
 * Ces endpoints sont neutres vis-à-vis du fournisseur de voix : ils survivront
 * à un changement de prestataire (ADR-020).
 */

export type {
  ToolContext,
  ToolOutcome,
  ToolHandler,
  SophieTool,
} from "./tool-types";

/** Formate une heure pour être prononcée en français. */
function heureParlee(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function jourParle(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  });
}

/**
 * check_availability — l'outil du spike technique.
 *
 * Non destructif : il lit, il n'écrit rien. C'est ce qui en fait le bon
 * candidat pour valider la chaîne complète sans risque.
 *
 * Règle appliquée ici, et non dans les instructions du modèle : si l'agenda
 * externe n'est pas à jour, **aucun créneau n'est proposé** (sections 19 et
 * 43). Sophie annonce alors que le professionnel confirmera. Laisser cette
 * règle au modèle reviendrait à espérer qu'il s'en souvienne.
 */
const checkAvailability: SophieToolType = {
  definition: {
    name: "check_availability",
    description:
      "Donne les créneaux réellement disponibles pour une date. À utiliser avant de " +
      "proposer un rendez-vous. Ne jamais proposer d'horaire sans avoir appelé cet outil.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date souhaitée au format AAAA-MM-JJ.",
        },
        duration_minutes: {
          type: "number",
          description: "Durée de l'intervention en minutes, si elle est connue.",
        },
      },
      required: ["date"],
    },
  },

  async handler(args, context) {
    const date = typeof args.date === "string" ? args.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: "Date invalide. Demandez au client de préciser le jour." };
    }

    const jour = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(jour.getTime())) {
      return { error: "Date invalide." };
    }

    // Une date passée ne peut pas accueillir un rendez-vous, quelle que soit
    // la confiance du modèle dans ce qu'il a compris.
    //
    // Le message rappelle la date du jour, et ce n'est pas du confort : un
    // modèle de langage n'a pas d'horloge. Interprété seul, « lundi prochain »
    // est calculé à partir d'une date imaginaire, souvent celle de son
    // entraînement, et tombe dans le passé. Sans cette précision, Sophie
    // répète la même erreur indéfiniment parce que rien ne la contredit.
    //
    // La date du jour est normalement injectée dans ses instructions par le
    // fournisseur de voix. Ceci est le filet : si cette injection manque ou
    // échoue, l'outil rattrape au lieu de boucler.
    const aujourdHui = new Date();
    aujourdHui.setUTCHours(0, 0, 0, 0);
    if (jour < aujourdHui) {
      return {
        error:
          `Cette date est déjà passée. Nous sommes aujourd'hui le ` +
          `${aujourdHui.toISOString().slice(0, 10)}. Recalculez la date demandée ` +
          `à partir d'aujourd'hui, puis rappelez cet outil.`,
      };
    }

    // Un an est une limite de bon sens pour un artisan. Au-delà, c'est presque
    // toujours une erreur d'année du modèle, pas une vraie demande.
    const limite = new Date(aujourdHui);
    limite.setUTCFullYear(limite.getUTCFullYear() + 1);
    if (jour > limite) {
      return {
        error:
          `Cette date est trop lointaine. Nous sommes aujourd'hui le ` +
          `${aujourdHui.toISOString().slice(0, 10)}. Vérifiez l'année avec le client.`,
      };
    }

    const admin = createAdminClient();

    const { data: org } = await admin
      .from("organizations")
      .select("timezone")
      .eq("id", context.organizationId)
      .maybeSingle();

    const timezone = (org?.timezone as string | undefined) ?? "Europe/Brussels";

    // Fraîcheur de l'agenda AVANT de proposer quoi que ce soit.
    //
    // On tente d'abord une synchronisation : la tâche planifiee ne tourne
    // qu'une fois par jour (ADR-024), elle ne suffit pas a garantir la
    // fraîcheur pendant un appel. Si Google ne répond pas assez vite, on
    // n'insiste pas et la regle ci-dessous s'applique.
    await ensureCalendarFresh(context.organizationId);

    const { data: etatBrut } = await admin.rpc("calendar_sync_state", {
      org_id: context.organizationId,
    });
    const etat = Array.isArray(etatBrut) ? etatBrut[0] : etatBrut;

    if (etat?.connected && !etat?.is_fresh) {
      return {
        result:
          "Les disponibilités ne sont pas vérifiables en ce moment. Proposez au client " +
          "d'indiquer ses préférences, et dites que le professionnel confirmera lui-même.",
      };
    }

    const duree =
      typeof args.duration_minutes === "number" && args.duration_minutes > 0
        ? Math.min(Math.round(args.duration_minutes), 480)
        : null;

    const { data, error } = await admin.rpc("available_slots", {
      org_id: context.organizationId,
      jour: date,
      duree_min: duree,
      intervenant: null,
    });

    if (error) {
      return {
        error:
          "Impossible de consulter l'agenda. Prenez les coordonnées du client et dites " +
          "que le professionnel le rappellera.",
      };
    }

    const creneaux = ((data ?? []) as { creneau: string }[]).map((ligne) => ligne.creneau);

    if (creneaux.length === 0) {
      return {
        result: `Aucun créneau libre le ${jourParle(`${date}T12:00:00Z`, timezone)}. Proposez un autre jour.`,
      };
    }

    // Trois propositions au plus : une liste de vingt horaires est
    // inutilisable à l'oral.
    const proposes = repartir(creneaux, 3).map((iso) => heureParlee(iso, timezone));

    return {
      result:
        `Créneaux disponibles le ${jourParle(`${date}T12:00:00Z`, timezone)} : ` +
        `${proposes.join(", ")}. Proposez-en un ou deux au client, pas la liste entière.`,
    };
  },
};

/**
 * get_business_information — ce que Sophie a le droit de dire de l'entreprise.
 *
 * Elle ne récite que ce que le professionnel a saisi. Rien n'est déduit, rien
 * n'est calculé (section 9).
 */
const getBusinessInformation: SophieToolType = {
  definition: {
    name: "get_business_information",
    description:
      "Donne les informations vérifiées de l'entreprise : services proposés, indications " +
      "de prix, zone d'intervention. À utiliser dès qu'un client pose une question sur " +
      "l'activité. Ne jamais répondre de mémoire.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["services", "zone", "horaires"],
          description: "Sujet de la question du client.",
        },
      },
      required: ["topic"],
    },
  },

  async handler(args, context) {
    const admin = createAdminClient();
    const topic = typeof args.topic === "string" ? args.topic : "services";

    if (topic === "services") {
      const { data } = await admin
        .from("services")
        .select("name, duration_minutes, price_indication, is_urgent")
        .eq("organization_id", context.organizationId)
        .eq("is_active", true)
        .order("sort_order");

      const services = (data ?? []) as {
        name: string;
        price_indication: string | null;
        is_urgent: boolean;
      }[];

      if (services.length === 0) {
        return {
          result:
            "Aucun service n'est enregistré. Prenez la demande du client et transmettez-la.",
        };
      }

      return {
        result: services
          .map((service) => {
            // Le tarif est un texte saisi par le professionnel. Sophie le
            // répète tel quel et ne calcule jamais un prix.
            const prix = service.price_indication
              ? ` — tarif annoncé : ${service.price_indication}`
              : " — aucun tarif communiqué, dites que le professionnel établira un devis";
            return `${service.name}${prix}${service.is_urgent ? " (traité en urgence)" : ""}`;
          })
          .join(" ; "),
      };
    }

    if (topic === "zone") {
      const { data } = await admin
        .from("business_profiles")
        .select("service_area_description, service_area_radius_km, city")
        .eq("organization_id", context.organizationId)
        .maybeSingle();

      const description = data?.service_area_description as string | null;
      const rayon = data?.service_area_radius_km as number | null;

      if (!description && !rayon) {
        return {
          result:
            "La zone d'intervention n'est pas renseignée. Demandez l'adresse du client et " +
            "dites que le professionnel confirmera s'il se déplace.",
        };
      }

      return {
        result:
          description ??
          `Interventions dans un rayon d'environ ${rayon} kilomètres autour de ${data?.city ?? "l'entreprise"}.`,
      };
    }

    const { data } = await admin
      .from("business_hours")
      .select("weekday, is_open, opens_at, closes_at")
      .eq("organization_id", context.organizationId)
      .is("member_id", null)
      .order("weekday");

    const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    const ouverts = ((data ?? []) as {
      weekday: number;
      is_open: boolean;
      opens_at: string | null;
      closes_at: string | null;
    }[])
      .filter((ligne) => ligne.is_open)
      .map(
        (ligne) =>
          `${jours[ligne.weekday - 1]} de ${ligne.opens_at?.slice(0, 5)} à ${ligne.closes_at?.slice(0, 5)}`,
      );

    return {
      result:
        ouverts.length > 0
          ? `Horaires : ${ouverts.join(", ")}.`
          : "Les horaires ne sont pas renseignés. Prenez la demande et transmettez-la.",
    };
  },
};

export const SOPHIE_TOOLS: readonly SophieToolType[] = [
  checkAvailability,
  getBusinessInformation,
  ...CRM_TOOLS,
];

export function findTool(name: string): SophieToolType | undefined {
  return SOPHIE_TOOLS.find((tool) => tool.definition.name === name);
}

export function toolDefinitions(): VoiceToolDefinition[] {
  return SOPHIE_TOOLS.map((tool) => tool.definition);
}

/** Répartit `n` éléments sur toute l'étendue plutôt que de prendre les premiers. */
function repartir<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const pas = (items.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => items[Math.round(i * pas)] as T);
}
