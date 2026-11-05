import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_ENREGISTREMENTS } from "@/lib/calls/recording-path";

/**
 * Les purges de conservation.
 *
 * Six traitements, chacun isolé. Une purge bloquée retarde les autres d'une
 * journée ; elle ne doit jamais les empêcher. Chaque passe écrit dans
 * `retention_runs` : une purge sans trace ne peut ni se prouver à un client
 * qui demande l'effacement de ses données, ni se diagnostiquer quand elle
 * échoue depuis trois semaines.
 *
 * L'ordre n'est pas indifférent. Les fichiers partent avant les lignes qui les
 * désignent : l'inverse laisserait des objets que plus rien ne référence, donc
 * que plus rien ne supprimera jamais.
 */

export type GenrePurge =
  "AUDIO" | "TRANSCRIPT" | "SUMMARY" | "CALL_EVENT" | "MESSAGE" | "CALL_TRASH";

export interface RapportPurge {
  genre: GenrePurge;
  traites: number;
  erreur?: string;
}

/** Consigne la passe. Ne lève jamais : un journal n'arbitre rien. */
async function consigner(
  genre: GenrePurge,
  nombre: number,
  erreur?: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("record_retention_run", {
      genre,
      nombre,
      issue: erreur ? "ERROR" : "SUCCESS",
      message: erreur ?? null,
    });
  } catch {
    /* ne rien faire : le journal ne doit pas casser la purge */
  }
}

async function executer(
  genre: GenrePurge,
  travail: () => Promise<number>,
): Promise<RapportPurge> {
  try {
    const traites = await travail();
    await consigner(genre, traites);
    return { genre, traites };
  } catch (cause) {
    const erreur = cause instanceof Error ? cause.message : "échec inconnu";
    await consigner(genre, 0, erreur);
    console.error("[rétention] purge échouée", genre, erreur);
    return { genre, traites: 0, erreur };
  }
}

export async function executerPurges(): Promise<RapportPurge[]> {
  const admin = createAdminClient();

  return [
    // 1. Enregistrements arrivés à échéance (ADR-013, 30 jours au plus).
    await executer("AUDIO", async () => {
      const { data, error } = await admin.rpc("expired_recordings", {
        limite: 100,
      });
      if (error) throw new Error(error.message);

      const lignes = (data ?? []) as {
        call_id: string;
        recording_path: string;
      }[];
      if (lignes.length === 0) return 0;

      const { error: suppression } = await admin.storage
        .from(BUCKET_ENREGISTREMENTS)
        .remove(lignes.map((l) => l.recording_path));
      if (suppression) throw new Error(suppression.message);

      const { error: maj } = await admin
        .from("calls")
        .update({
          recording_path: null,
          recording_bytes: null,
          recording_expires_at: null,
          recording_status: "NOT_APPLICABLE",
        })
        .in(
          "id",
          lignes.map((l) => l.call_id),
        );
      if (maj) throw new Error(maj.message);

      return lignes.length;
    }),

    // 2. La corbeille des appels, passé trente jours.
    await executer("CALL_TRASH", async () => {
      const { data, error } = await admin.rpc("calls_to_purge", {
        limite: 100,
      });
      if (error) throw new Error(error.message);

      const lignes = (data ?? []) as {
        call_id: string;
        recording_path: string | null;
      }[];
      if (lignes.length === 0) return 0;

      const fichiers = lignes
        .map((l) => l.recording_path)
        .filter((chemin): chemin is string => Boolean(chemin));

      if (fichiers.length > 0) {
        const { error: suppression } = await admin.storage
          .from(BUCKET_ENREGISTREMENTS)
          .remove(fichiers);
        if (suppression) throw new Error(suppression.message);
      }

      const { error: effacement } = await admin
        .from("calls")
        .delete()
        .in(
          "id",
          lignes.map((l) => l.call_id),
        );
      if (effacement) throw new Error(effacement.message);

      return lignes.length;
    }),

    // 3. Transcriptions.
    await executer("TRANSCRIPT", async () => {
      const { data, error } = await admin.rpc("purge_expired_transcripts", {
        limite: 500,
      });
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : 0;
    }),

    // 4. Résumés et données extraites.
    await executer("SUMMARY", async () => {
      const { data, error } = await admin.rpc("purge_expired_summaries", {
        limite: 500,
      });
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : 0;
    }),

    // 5. Rapports bruts du fournisseur (ils contiennent la transcription).
    await executer("CALL_EVENT", async () => {
      const { data, error } = await admin.rpc("purge_expired_call_events");
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : 0;
    }),

    // 6. Messages, dans les deux tables à la fois.
    await executer("MESSAGE", async () => {
      const { data, error } = await admin.rpc("purge_expired_messages", {
        limite: 500,
      });
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : 0;
    }),
  ];
}
