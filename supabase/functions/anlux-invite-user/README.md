# ANLUX invitation function

This Edge Function is the trusted invite-only entry point for ANLUX Ads.

- Requires a valid Supabase JWT.
- Only users with `app_metadata.anlux_role = admin` may invite.
- New invitees are assigned `app_metadata.anlux_role = member` by the trusted server flow.
- The production origin is restricted to `https://anlux-ads.vercel.app`.
- The invite redirects to `/reset-password` so the invited user can establish a password before signing in.

Do not use `user_metadata` for authorization decisions.
