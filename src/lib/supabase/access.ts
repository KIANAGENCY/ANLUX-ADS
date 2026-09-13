import type { User } from "@supabase/supabase-js";

type AnluxAccessUser = Pick<User, "app_metadata">;

const ALLOWED_ROLES = new Set(["admin", "member"]);

/**
 * ANLUX is invite-only.
 *
 * Authorization relies exclusively on app_metadata.anlux_role because
 * app_metadata is controlled by trusted server/admin flows. user_metadata must
 * never be used for authorization because authenticated users can edit it.
 */
export function canAccessAnlux(user: AnluxAccessUser): boolean {
  const role = user.app_metadata?.anlux_role;
  return typeof role === "string" && ALLOWED_ROLES.has(role);
}
