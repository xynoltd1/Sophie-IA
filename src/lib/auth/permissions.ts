import type { MemberRole } from "@/types/database";

/**
 * Permissions applicatives.
 *
 * Ce module est la reference cote interface (masquer un bouton, orienter une
 * navigation). Il ne remplace JAMAIS le controle serveur : chaque action
 * sensible est revalidee par RLS et par les policies de la base.
 */

export const PERMISSIONS = [
  "organization:update",
  "organization:delete",
  "members:read",
  "members:invite",
  "members:update_role",
  "members:remove",
  "billing:manage",
  "sophie:configure",
  "calls:read",
  "calls:listen_audio",
  "appointments:approve",
  "leads:manage",
  "tasks:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<MemberRole, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: [
    "organization:update",
    "members:read",
    "members:invite",
    "members:update_role",
    "sophie:configure",
    "calls:read",
    "calls:listen_audio",
    "appointments:approve",
    "leads:manage",
    "tasks:manage",
  ],
  MEMBER: [
    "members:read",
    "calls:read",
    "calls:listen_audio",
    "appointments:approve",
    "leads:manage",
    "tasks:manage",
  ],
};

export function can(role: MemberRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: MemberRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/** Hierarchie des roles : un ADMIN ne peut pas modifier un OWNER. */
const ROLE_RANK: Record<MemberRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

export function outranks(actor: MemberRole, target: MemberRole): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}
