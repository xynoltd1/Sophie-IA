/**
 * Types de la base de donnees.
 *
 * A regenerer apres chaque migration :
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * Le fichier est maintenu a la main tant que le projet Supabase n'est pas cree,
 * afin que le typecheck reste utile des la Phase 0.
 */

export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type MemberStatus = "INVITED" | "ACTIVE" | "SUSPENDED";
export type OnboardingStep =
  | "ORGANIZATION"
  | "PROFESSION"
  | "SERVICES"
  | "SCHEDULE"
  | "CALENDAR"
  | "SOPHIE"
  | "PHONE"
  | "DONE";

export type ActorKind = "USER" | "SOPHIE" | "SYSTEM" | "CUSTOMER";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  locale: string;
  is_platform_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  country_calling_code: string;
  timezone: string;
  locale: string;
  currency: string;
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  /** Enregistrement audio des appels. Desactive par defaut. */
  recording_enabled: boolean;
  /** Conservation de l'audio original, en jours. Plafonne a 30 en base. */
  audio_retention_days: number;
  recording_notice_required: boolean;
  recording_notice_text: string | null;
  recording_policy_accepted_at: string | null;
  /** Organisation d'essai : seule elle peut produire des appels de test. */
  is_test_organization: boolean;
  test_mode_enabled_by: string | null;
  test_mode_enabled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  job_title: string | null;
  invited_by: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityRow {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_kind: ActorKind;
  type: string;
  subject_type: string | null;
  subject_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  correlation_id: string | null;
  occurred_at: string;
  created_at: string;
}

/** Ligne renvoyee par la fonction public.my_organizations(). */
export interface MyOrganizationRow {
  organization_id: string;
  name: string;
  slug: string;
  role: MemberRole;
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  /** Enregistrement audio des appels. Desactive par defaut. */
  recording_enabled: boolean;
  /** Conservation de l'audio original, en jours. Plafonne a 30 en base. */
  audio_retention_days: number;
  recording_notice_required: boolean;
  recording_notice_text: string | null;
  recording_policy_accepted_at: string | null;
  /** Organisation d'essai : seule elle peut produire des appels de test. */
  is_test_organization: boolean;
  test_mode_enabled_by: string | null;
  test_mode_enabled_at: string | null;
}
