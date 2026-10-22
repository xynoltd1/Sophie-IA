import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { instantDepuisHeureLocale } from "@/lib/crm/timezone";
import {
  nombre,
  texte,
  vrai,
  type SophieTool,
  type ToolContext,
  type ToolOutcome,
} from "./tool-types";

/**
 * Outils de Sophie qui écrivent dans le CRM.
 *
 * Trois principes, et ils expliquent la plupart des choix de ce fichier.
 *
 * **Sophie n'écrit jamais ce qu'elle n'a pas entendu.** Chaque champ vient d'un
 * argument explicite. Aucun n'est déduit, complété ou embelli. Un champ inconnu
 * reste vide (section 15) : un nom inventé dans un CRM est pire qu'un nom
 * manquant, parce qu'il a l'air vrai.
 *
 * **Les écritures sont réversibles et traçables.** Tout passe par une activité,
 * pour que l'artisan puisse reconstituer ce qui s'est dit et quand.
 *
 * **Une erreur métier n'interrompt pas l'appel.** Elle revient comme un texte
 * que Sophie peut prononcer, jamais comme une panne. Au téléphone, un silence
 * vaut un raccrochage.
 */

/** Trace une action de Sophie. Ne lève jamais : un journal n'arbitre rien. */
async function activite(
  context: ToolContext,
  type: string,
  resume: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("activities").insert({
      organization_id: context.organizationId,
      actor_kind: "SOPHIE",
      type,
      subject_type: "call",
      subject_id: context.callId,
      summary: resume,
      metadata: { ...metadata, providerCallId: context.providerCallId },
      correlation_id: null,
    });
  } catch {
    /* le journal ne doit jamais faire échouer l'action qu'il décrit */
  }
}

/**
 * Retrouve le contact de l'appelant, ou le crée.
 *
 * Trois sources, dans cet ordre.
 *
 * **1. Le contact déjà rattaché à cet appel.** Une fois identifié, il ne change
 * plus pendant la conversation. C'est aussi ce qui permet à tous les outils
 * suivants de travailler même quand le numéro est masqué : il a suffi qu'il
 * soit connu une fois.
 *
 * **2. Le numéro de l'appelant**, venu du réseau. C'est la seule donnée d'un
 * appel qu'on ne peut pas mal entendre.
 *
 * **3. Un numéro dicté par le client.** Nécessaire dans deux cas bien réels :
 * l'appelant masque son numéro — ce qui arrive tous les jours — et l'essai
 * depuis le navigateur, qui n'en a aucun. Moins fiable que le réseau, puisqu'il
 * passe par la reconnaissance vocale, d'où sa dernière place.
 *
 * Un contact créé ici est marqué provisoire : il n'a pas encore de nom, et
 * l'artisan doit pouvoir distinguer « client connu » de « numéro vu une fois ».
 */
async function contactDeLAppelant(
  context: ToolContext,
  numeroDicte?: string | null,
): Promise<string | null> {
  const admin = createAdminClient();

  if (context.callId) {
    const { data: appel } = await admin
      .from("calls")
      .select("contact_id")
      .eq("id", context.callId)
      .maybeSingle();

    if (appel?.contact_id) return appel.contact_id as string;
  }

  const numero = context.callerNumber ?? (numeroDicte ?? null);
  if (!numero) return null;

  const { data: existant } = await admin.rpc("find_contact_by_phone", {
    org_id: context.organizationId,
    numero,
  });

  if (typeof existant === "string" && existant.length > 0) return existant;

  const { data, error } = await admin
    .from("contacts")
    .insert({
      organization_id: context.organizationId,
      phone: numero,
      source: "SOPHIE",
      is_provisional: true,
    })
    .select("id")
    .single();

  if (error) {
    // Course entre deux outils appelés presque en même temps : l'index unique
    // sur le numéro a tranché. On relit plutôt que d'échouer.
    const { data: concurrent } = await admin.rpc("find_contact_by_phone", {
      org_id: context.organizationId,
      numero,
    });
    return typeof concurrent === "string" && concurrent.length > 0 ? concurrent : null;
  }

  return (data?.id as string | undefined) ?? null;
}

/** Rattache l'appel au contact, pour que la fiche contact montre l'historique. */
async function lierAppelAuContact(context: ToolContext, contactId: string): Promise<void> {
  if (!context.callId) return;
  const admin = createAdminClient();
  await admin.from("calls").update({ contact_id: contactId }).eq("id", context.callId);
}

// ---------------------------------------------------------------------------
// identify_caller
// ---------------------------------------------------------------------------

const identifyCaller: SophieTool = {
  definition: {
    name: "identify_caller",
    description:
      "Indique si l'appelant est déjà connu de l'entreprise, et son nom s'il l'est. " +
      "À utiliser au tout début de l'appel, avant de demander son nom.",
    parameters: { type: "object", properties: {}, required: [] },
  },

  async handler(_args, context): Promise<ToolOutcome> {
    if (!context.callerNumber) {
      // Numéro masqué, ou essai depuis le navigateur. Sophie doit le demander
      // plutôt que de faire comme si l'appelant était inconnu : sans numéro,
      // rien ne pourra être rattaché à une fiche client.
      return {
        result:
          "Le numéro de l'appelant ne s'affiche pas. Demandez-lui son nom et son numéro " +
          "de téléphone, puis enregistrez-les avec save_caller_details.",
      };
    }

    const admin = createAdminClient();

    const { data: contactId } = await admin.rpc("find_contact_by_phone", {
      org_id: context.organizationId,
      numero: context.callerNumber,
    });

    if (typeof contactId !== "string" || contactId.length === 0) {
      return { result: "Ce numéro est inconnu. Demandez le nom de l'appelant." };
    }

    const { data: contact } = await admin
      .from("contacts")
      .select("full_name, company_name, is_provisional, city")
      .eq("id", contactId)
      .maybeSingle();

    await lierAppelAuContact(context, contactId);

    const nom = (contact?.full_name ?? contact?.company_name) as string | null;

    if (!nom || contact?.is_provisional) {
      return {
        result:
          "Ce numéro a déjà appelé, mais son nom n'est pas enregistré. Demandez le nom.",
      };
    }

    return {
      result:
        `L'appelant est ${nom}${contact?.city ? `, à ${contact.city}` : ""}. ` +
        "Saluez-le par son nom. Ne lui redemandez pas ses coordonnées.",
    };
  },
};

// ---------------------------------------------------------------------------
// save_caller_details
// ---------------------------------------------------------------------------

const saveCallerDetails: SophieTool = {
  definition: {
    name: "save_caller_details",
    description:
      "Enregistre les coordonnées données par l'appelant. N'appeler qu'avec ce que " +
      "l'appelant a réellement dit. Ne jamais deviner ni compléter une information.",
    parameters: {
      type: "object",
      properties: {
        full_name: { type: "string", description: "Nom et prénom tels qu'énoncés." },
        address_line1: { type: "string", description: "Rue et numéro." },
        postal_code: { type: "string", description: "Code postal." },
        city: { type: "string", description: "Commune." },
        email: { type: "string", description: "Adresse e-mail, si elle est donnée." },
        phone: {
          type: "string",
          description:
            "Numéro de téléphone dicté par l'appelant. À demander uniquement si son " +
            "numéro ne s'affiche pas.",
        },
      },
      required: [],
    },
  },

  async handler(args, context): Promise<ToolOutcome> {
    const numeroDicte = texte(args, "phone");
    const contactId = await contactDeLAppelant(context, numeroDicte);

    if (!contactId) {
      return {
        error:
          "Le numéro de l'appelant ne s'affiche pas. Demandez-lui son numéro de " +
          "téléphone, puis rappelez cet outil avec le champ phone.",
      };
    }

    // Seuls les champs réellement fournis sont écrits. Un `undefined` laisse la
    // valeur existante intacte : un appel où le client ne redonne pas son
    // adresse ne doit pas l'effacer.
    const champs: Record<string, string> = {};
    for (const nom of ["full_name", "address_line1", "postal_code", "city", "email"]) {
      const valeur = texte(args, nom);
      if (valeur) champs[nom] = valeur;
    }

    if (Object.keys(champs).length === 0) {
      return { error: "Aucune coordonnée reçue. Reposez la question au client." };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("contacts")
      .update({
        ...champs,
        // Dès qu'un nom est connu, le contact n'est plus un simple numéro.
        ...(champs.full_name ? { is_provisional: false } : {}),
      })
      .eq("id", contactId)
      .eq("organization_id", context.organizationId);

    if (error) {
      return {
        error: "Les coordonnées n'ont pas pu être enregistrées. Poursuivez l'appel.",
      };
    }

    await lierAppelAuContact(context, contactId);
    await activite(context, "CONTACT_UPDATED", `Coordonnées mises à jour par Sophie`, {
      champs: Object.keys(champs),
    });

    return { result: "Coordonnées enregistrées. Continuez." };
  },
};

// ---------------------------------------------------------------------------
// create_lead
// ---------------------------------------------------------------------------

const createLead: SophieTool = {
  definition: {
    name: "create_lead",
    description:
      "Enregistre la demande du client : ce dont il a besoin, où, et quand. " +
      "À utiliser dès que la demande est comprise, même si aucun rendez-vous n'est pris.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Résumé court de la demande, par exemple « Fuite sous l'évier ».",
        },
        description: {
          type: "string",
          description: "Ce que le client a décrit, dans ses termes.",
        },
        address_line1: { type: "string", description: "Adresse de l'intervention." },
        postal_code: { type: "string", description: "Code postal de l'intervention." },
        city: { type: "string", description: "Commune de l'intervention." },
        requested_date: {
          type: "string",
          description: "Date souhaitée au format AAAA-MM-JJ, si le client en donne une.",
        },
        urgent: {
          type: "boolean",
          description: "Vrai seulement si le client décrit une situation urgente.",
        },
      },
      required: ["title"],
    },
  },

  async handler(args, context): Promise<ToolOutcome> {
    const titre = texte(args, "title");
    if (!titre) {
      return { error: "La demande n'est pas claire. Faites préciser le client." };
    }

    const contactId = await contactDeLAppelant(context);
    const urgent = vrai(args, "urgent");
    const dateSouhaitee = texte(args, "requested_date");

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("leads")
      .insert({
        organization_id: context.organizationId,
        contact_id: contactId,
        title: titre.slice(0, 200),
        description: texte(args, "description"),
        address_line1: texte(args, "address_line1"),
        postal_code: texte(args, "postal_code"),
        city: texte(args, "city"),
        requested_at:
          dateSouhaitee && /^\d{4}-\d{2}-\d{2}$/.test(dateSouhaitee)
            ? `${dateSouhaitee}T00:00:00Z`
            : null,
        priority: urgent ? "URGENT" : "NORMAL",
        status: "NEW",
        source: "SOPHIE",
      })
      .select("id")
      .single();

    if (error) {
      return {
        error:
          "La demande n'a pas pu être enregistrée. Prenez les coordonnées du client et " +
          "dites que le professionnel le rappellera.",
      };
    }

    if (contactId) await lierAppelAuContact(context, contactId);

    await activite(context, "LEAD_CREATED", titre, {
      leadId: data?.id,
      urgent,
    });

    return {
      result: urgent
        ? "Demande urgente enregistrée. Le professionnel est prévenu immédiatement."
        : "Demande enregistrée.",
    };
  },
};

// ---------------------------------------------------------------------------
// create_task
// ---------------------------------------------------------------------------

const createTask: SophieTool = {
  definition: {
    name: "create_task",
    description:
      "Crée un rappel pour le professionnel, par exemple quand le client demande à être " +
      "rappelé. À utiliser pour toute action que le professionnel doit faire lui-même.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Action à faire, par exemple « Rappeler M. Martin ».",
        },
        description: { type: "string", description: "Précisions utiles." },
        due_date: {
          type: "string",
          description: "Date au format AAAA-MM-JJ, si le client en indique une.",
        },
        due_time: {
          type: "string",
          description: "Heure au format HH:MM, si le client en indique une.",
        },
        urgent: {
          type: "boolean",
          description: "Vrai si le client demande à être rappelé rapidement.",
        },
      },
      required: ["title"],
    },
  },

  async handler(args, context): Promise<ToolOutcome> {
    const titre = texte(args, "title");
    if (!titre) return { error: "Précisez ce que le professionnel doit faire." };

    const contactId = await contactDeLAppelant(context);

    const date = texte(args, "due_date");
    const heure = texte(args, "due_time");

    // Une échéance incomplète vaut mieux qu'une échéance inventée : sans heure,
    // on vise le début de journée, et l'artisan tranchera.
    let echeance: string | null = null;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const h = heure && /^\d{2}:\d{2}$/.test(heure) ? heure : "08:00";
      echeance = `${date}T${h}:00Z`;
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("tasks")
      .insert({
        organization_id: context.organizationId,
        contact_id: contactId,
        title: titre.slice(0, 200),
        description: texte(args, "description"),
        due_at: echeance,
        priority: vrai(args, "urgent") ? "URGENT" : "NORMAL",
        status: "OPEN",
        source: "SOPHIE",
      })
      .select("id")
      .single();

    if (error) {
      return { error: "Le rappel n'a pas pu être créé. Dites-le au client honnêtement." };
    }

    await activite(context, "TASK_CREATED", titre, { taskId: data?.id });

    return { result: "C'est noté, le professionnel sera prévenu." };
  },
};

// ---------------------------------------------------------------------------
// create_pending_appointment
// ---------------------------------------------------------------------------

const createPendingAppointment: SophieTool = {
  definition: {
    name: "create_pending_appointment",
    description:
      "Réserve un créneau à titre provisoire, après que le client a choisi une heure " +
      "proposée par check_availability. Ne jamais appeler sans avoir appelé " +
      "check_availability juste avant.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format AAAA-MM-JJ." },
        time: { type: "string", description: "Heure de début au format HH:MM." },
        duration_minutes: {
          type: "number",
          description: "Durée en minutes. 60 si elle n'est pas connue.",
        },
        title: { type: "string", description: "Objet de l'intervention." },
      },
      required: ["date", "time"],
    },
  },

  async handler(args, context): Promise<ToolOutcome> {
    const date = texte(args, "date");
    const heure = texte(args, "time");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: "Date invalide. Faites répéter le jour au client." };
    }
    if (!heure || !/^\d{2}:\d{2}$/.test(heure)) {
      return { error: "Heure invalide. Faites répéter l'heure au client." };
    }

    const duree = Math.min(Math.max(Math.round(nombre(args, "duration_minutes") ?? 60), 15), 480);

    const admin = createAdminClient();

    // L'heure dictée est une heure MURALE : celle de la pendule du client. La
    // convertir dans le fuseau de l'organisation est indispensable — sans ça,
    // elle est lue comme de l'heure universelle et le rendez-vous se décale de
    // tout l'écart horaire du pays.
    const { data: org } = await admin
      .from("organizations")
      .select("timezone")
      .eq("id", context.organizationId)
      .maybeSingle();

    const timezone = (org?.timezone as string | undefined) ?? "Europe/Brussels";

    const debut = instantDepuisHeureLocale(date, heure, timezone);
    if (!debut) {
      return { error: "Date ou heure incompréhensible. Faites répéter le client." };
    }

    const fin = new Date(debut.getTime() + duree * 60_000);
    const contactId = await contactDeLAppelant(context);

    const { data, error } = await admin.rpc("book_appointment", {
      org_id: context.organizationId,
      titre: texte(args, "title") ?? "Rendez-vous pris par Sophie",
      debut: debut.toISOString(),
      fin: fin.toISOString(),
      contact: contactId,
      lead: null,
      service: null,
      intervenant: null,
      // Toujours provisoire (section 22). C'est l'artisan qui confirme, pas
      // Sophie : elle ne connaît ni les imprévus du chantier, ni le client.
      statut: "PENDING_APPROVAL",
      duree_hold: null,
    });

    if (error) {
      // La contrainte d'exclusion en base a parlé : le créneau vient d'être
      // pris par quelqu'un d'autre, entre la proposition et l'acceptation.
      // Deux appels simultanés ne peuvent pas réserver la même heure, et c'est
      // la base qui l'empêche, jamais l'IA (section 20).
      return {
        error:
          "Ce créneau vient d'être pris. Rappelez check_availability pour en proposer " +
          "un autre au client.",
      };
    }

    if (contactId) await lierAppelAuContact(context, contactId);

    await activite(context, "APPOINTMENT_PROPOSED", `Rendez-vous provisoire le ${date} à ${heure}`, {
      appointmentId: data,
      date,
      heure,
      duree,
    });

    return {
      result:
        `Créneau retenu le ${date} à ${heure}. Dites au client que le professionnel ` +
        "confirmera, et qu'il recevra un message. N'affirmez pas que c'est définitif.",
    };
  },
};

// ---------------------------------------------------------------------------
// request_human_transfer
// ---------------------------------------------------------------------------

const requestHumanTransfer: SophieTool = {
  definition: {
    name: "request_human_transfer",
    description:
      "Demande à passer l'appel à une personne. À utiliser si le client insiste pour " +
      "parler à quelqu'un, ou si la situation dépasse ce que Sophie peut traiter.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Pourquoi le transfert est demandé." },
      },
      required: [],
    },
  },

  async handler(args, context): Promise<ToolOutcome> {
    const admin = createAdminClient();

    const { data: config } = await admin
      .from("sophie_configurations")
      .select("transfer_number_e164, transfer_number")
      .eq("organization_id", context.organizationId)
      .maybeSingle();

    const numero = (config?.transfer_number_e164 ?? config?.transfer_number) as string | null;

    await activite(context, "TRANSFER_REQUESTED", texte(args, "reason") ?? "Transfert demandé", {
      possible: Boolean(numero),
    });

    if (!numero) {
      // Dire la vérité plutôt que de promettre un transfert qui n'aura pas
      // lieu : un client qu'on fait patienter pour rien rappelle en colère.
      return {
        result:
          "Aucun transfert n'est possible pour le moment. Dites-le simplement au client, " +
          "prenez ses coordonnées et créez un rappel avec create_task.",
      };
    }

    return {
      result: `Transfert possible vers ${numero}. Annoncez-le au client avant de transférer.`,
    };
  },
};

export const CRM_TOOLS: readonly SophieTool[] = [
  identifyCaller,
  saveCallerDetails,
  createLead,
  createTask,
  createPendingAppointment,
  requestHumanTransfer,
] as const;
