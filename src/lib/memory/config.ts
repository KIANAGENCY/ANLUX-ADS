import "server-only";

/**
 * Historical memory is opt-in. Deploying the code alone never writes to
 * Supabase. Enable only after the reviewed migration and trusted-user seed
 * have been applied successfully.
 */
export function isMemoryEnabled(): boolean {
  return process.env.ANLUX_MEMORY_ENABLED === "true";
}
