import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import type { MyOrganizationRow } from "@/types/database";

export const ACTIVE_ORG_COOKIE = "sophie_org";

export interface SessionContext {
  user: User;
  organizations: MyOrganizationRow[];
  activeOrganization: MyOrganizationRow | null;
}

/** Utilisateur authentifie, ou null. Valide le jeton aupres de Supabase. */
export async function getUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Contexte complet : utilisateur, organisations, organisation active.
 *
 * L'organisation active est memorisee dans un cookie, mais ce cookie n'est
 * jamais une autorisation : la valeur est toujours confrontee a la liste des
 * organisations reellement accessibles, qui vient de la base sous RLS.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("my_organizations");
  if (error) throw new Error(`Lecture des organisations impossible : ${error.message}`);

  const organizations = (data ?? []) as MyOrganizationRow[];
  const cookieStore = await cookies();
  const requested = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const activeOrganization =
    organizations.find((o) => o.organization_id === requested) ?? organizations[0] ?? null;

  return { user, organizations, activeOrganization };
}

/** Variante stricte : redirige si l'utilisateur n'est pas connecte. */
export async function requireSession(): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return context;
}

/**
 * Variante stricte : exige une organisation active.
 * Renvoie vers l'onboarding si l'utilisateur n'a pas encore d'entreprise.
 */
export async function requireOrganization(): Promise<
  SessionContext & { activeOrganization: MyOrganizationRow }
> {
  const context = await requireSession();
  if (!context.activeOrganization) redirect("/onboarding");
  return { ...context, activeOrganization: context.activeOrganization };
}
