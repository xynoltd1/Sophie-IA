import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EtatDevis } from "./totals";

/**
 * La lecture et l'écriture des devis.
 *
 * ## Pourquoi presque tout passe par le client de session
 *
 * Les politiques d'isolation font le travail : un membre ne voit que les
 * devis de son organisation, et la base le refuse autrement. Utiliser le
 * client d'administration ici reviendrait à contourner cette garantie pour
 * des lectures qui n'en ont aucun besoin.
 *
 * Deux exceptions, et elles sont nommées : l'attribution du numéro et le
 * recalcul des totaux sont des fonctions réservées au serveur, révoquées pour
 * les rôles du navigateur.
 */

export interface DevisResume {
  id: string;
  reference: string | null;
  title: string;
  status: EtatDevis;
  total_incl_cents: number;
  valid_until: string | null;
  created_at: string;
  customer_name: string | null;
  contact: { id: string; display_name: string } | null;
}

export interface LigneEnregistree {
  id: string;
  label: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price_cents: number;
  vat_rate: number;
  sort_order: number;
}

export interface DevisComplet extends DevisResume {
  customer_address: string | null;
  notes: string | null;
  terms: string | null;
  total_excl_cents: number;
  total_vat_cents: number;
  sent_at: string | null;
  decided_at: string | null;
  decline_reason: string | null;
  lead_id: string | null;
  call_id: string | null;
  lignes: LigneEnregistree[];
}

const COLONNES_RESUME =
  "id, reference, title, status, total_incl_cents, valid_until, created_at, customer_name, contacts(id, display_name)";

/**
 * Le contact rattaché arrive tantôt seul, tantôt dans un tableau selon la
 * façon dont la jointure est typée. On normalise ici plutôt que de forcer le
 * type : un devis sans contact est un cas courant, pas une anomalie.
 */
type ContactJoint =
  | { id: string; display_name: string }
  | { id: string; display_name: string }[]
  | null
  | undefined;

type LigneBrute = Record<string, unknown> & { contacts?: ContactJoint };

function premierContact(joint: ContactJoint): DevisResume["contact"] {
  if (!joint) return null;
  const valeur = Array.isArray(joint) ? joint[0] : joint;
  return valeur ? { id: valeur.id, display_name: valeur.display_name } : null;
}

function versResume(ligne: LigneBrute): DevisResume {
  return {
    id: ligne.id as string,
    reference: (ligne.reference as string | null) ?? null,
    title: ligne.title as string,
    status: ligne.status as EtatDevis,
    total_incl_cents: (ligne.total_incl_cents as number) ?? 0,
    valid_until: (ligne.valid_until as string | null) ?? null,
    created_at: ligne.created_at as string,
    customer_name: (ligne.customer_name as string | null) ?? null,
    contact: premierContact(ligne.contacts),
  };
}

export async function listerDevis(
  organizationId: string,
  filtre?: EtatDevis,
): Promise<DevisResume[]> {
  const supabase = await createServerSupabase();

  let requete = supabase
    .from("quotes")
    .select(COLONNES_RESUME)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filtre) requete = requete.eq("status", filtre);

  const { data } = await requete;
  return (data ?? []).map((ligne) => versResume(ligne as LigneBrute));
}

export async function lireDevis(id: string): Promise<DevisComplet | null> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("quotes")
    .select(
      `${COLONNES_RESUME}, customer_address, notes, terms, total_excl_cents, total_vat_cents, sent_at, decided_at, decline_reason, lead_id, call_id,
       quote_lines(id, label, description, quantity, unit, unit_price_cents, vat_rate, sort_order)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const brute = data as unknown as LigneBrute & {
    quote_lines?: LigneEnregistree[];
  };

  return {
    ...versResume(brute),
    customer_address: (brute.customer_address as string | null) ?? null,
    notes: (brute.notes as string | null) ?? null,
    terms: (brute.terms as string | null) ?? null,
    total_excl_cents: (brute.total_excl_cents as number) ?? 0,
    total_vat_cents: (brute.total_vat_cents as number) ?? 0,
    sent_at: (brute.sent_at as string | null) ?? null,
    decided_at: (brute.decided_at as string | null) ?? null,
    decline_reason: (brute.decline_reason as string | null) ?? null,
    lead_id: (brute.lead_id as string | null) ?? null,
    call_id: (brute.call_id as string | null) ?? null,
    lignes: [...(brute.quote_lines ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  };
}

/**
 * Attribue le numéro au moment de l'envoi.
 *
 * Jamais à la création : un brouillon abandonné laisserait un trou dans la
 * série, et une série trouée est exactement ce qu'on cherche à éviter en
 * numérotant.
 */
export async function attribuerNumero(devisId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("assign_quote_reference", {
    devis: devisId,
  });

  if (error) return null;
  return (data as string | null) ?? null;
}

/** Les services de l'entreprise, pour pré-remplir une ligne. */
export async function servicesPourDevis(organizationId: string): Promise<
  {
    id: string;
    name: string;
    unit_price_cents: number | null;
    vat_rate: number | null;
  }[]
> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("services")
    .select("id, name, quote_unit_price_cents, quote_vat_rate")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? []).map((service) => ({
    id: service.id as string,
    name: service.name as string,
    unit_price_cents: (service.quote_unit_price_cents as number | null) ?? null,
    vat_rate: (service.quote_vat_rate as number | null) ?? null,
  }));
}
