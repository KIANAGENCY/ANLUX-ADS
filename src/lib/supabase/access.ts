import type { User } from "@supabase/supabase-js";

type AnluxAccessUser = Pick<User, "app_metadata"> & {
  invited_at?: string | null;
};

/**
 * ANLUX is invite-only.
 *
 * Authorization relies exclusively on server-controlled Supabase fields:
 * - app_metadata.anlux_role for administrators
 * - invited_at for accounts created through the admin invitation flow
 *
 * user_metadata must never be used for authorization because users can edit it.
 */
export function canAccessAnlux(user: AnluxAccessUser): boolean {
  return user.app_metadata?.anlux_role === "admin" || Boolean(user.invited_at);
}
