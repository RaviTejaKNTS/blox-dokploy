# Roblox-Only Auth Migration Plan (No Supabase Auth)

## Goal
Move to Roblox OAuth as the only login method and stop using Supabase Auth for user identity, while keeping Supabase as the database.

## Non-Goals
- Enterprise-grade IAM or fine-grained admin permissions.
- Multi-provider login (Google/email).
- Full moderation tooling redesign.

## Target End State
- Users authenticate only with Roblox OAuth.
- App creates and validates its own session cookie.
- User data access is enforced by server-side session checks.
- `app_users.role` is used for UI labeling (for example, admin badge in comments), not broad database privileges.
- Supabase remains the database and storage layer, not the auth provider.

## Full End-to-End Process
1. User clicks `Log in with Roblox`.
2. App redirects to Roblox OAuth authorize endpoint with `state` + PKCE.
3. Roblox redirects back to `/auth/roblox/callback/login` with authorization code.
4. App exchanges code for token and fetches Roblox profile (`sub`, username, display name, avatar).
5. App upserts user in `public.app_users` keyed by `roblox_user_id`.
6. App issues an app session (HTTP-only secure cookie, signed; optional DB-backed session record).
7. Protected APIs call `requireSessionUser()` and use that user id for reads/writes.
8. Public routes keep working anonymously.
9. Logout clears session cookie (and invalidates DB session if using session table).

## Architecture
- Identity source: Roblox OAuth/OIDC.
- Session source of truth: app cookie (signed; short TTL, renewable).
- Authorization layer: server route guards (and optional RLS if you later map custom JWT claims).
- Database access:
  - Client-side anon reads only for truly public data.
  - User-private writes/reads through server routes using service role, scoped by session user id.

## Data Model Changes
1. `public.app_users`
   - Keep `role`, `display_name`, Roblox profile columns.
   - Ensure unique `roblox_user_id`.
   - Decouple from Supabase Auth dependency:
     - Remove hard FK dependency on `auth.users(id)` for `user_id`.
     - Keep `user_id` as internal app UUID key.
2. Add optional `public.app_sessions` (recommended)
   - `id`, `user_id`, `created_at`, `expires_at`, `revoked_at`, `ip_hash`, `user_agent`.
   - Allows logout-all/revocation and incident response.
3. Remove auth-user sync triggers/functions tied to `auth.users` once migration is complete.
4. Update RLS posture
   - Remove blanket admin full-access policy pattern.
   - Keep RLS for public tables if useful, but do not rely on `auth.uid()` for app identity in private tables unless custom JWT mapping is added later.

## Code Migration Map
- Replace login UX:
  - `src/app/(site)/login/page.tsx`
  - `src/app/(site)/login/actions.ts`
- Introduce app session helpers:
  - `src/lib/auth/app-session.ts` (new)
  - `src/lib/auth/roblox-login.ts` (new)
  - `src/lib/auth/session-user.ts` (new)
- Replace Supabase-auth checks in routes:
  - `src/app/api/comments/session/route.ts`
  - `src/app/api/comments/route.ts`
  - `src/app/api/comments/[id]/route.ts`
  - `src/app/api/checklists/session/route.ts`
  - `src/app/api/checklists/progress/route.ts`
  - `src/app/api/quizzes/session/route.ts`
  - `src/app/api/quizzes/progress/route.ts`
  - `src/app/api/account/avatar/route.ts`
  - `src/app/actions/preferences.ts`
- Simplify account page to Roblox-first model:
  - `src/app/(site)/account/page.tsx`
- Decommission unused callback:
  - `src/app/auth/callback/route.ts` (Google/email callback)
  - `src/app/auth/roblox/callback/route.ts` (legacy Roblox-link callback)

## Phase Plan

## Phase 1: Foundation (Roblox auth + app session)
### Scope
- Build Roblox-only login start/callback/logout flow.
- Create session cookie utilities (`sign`, `verify`, `expiry`, `rotation`).
- Upsert `app_users` by `roblox_user_id`.
- Keep existing Supabase-auth-protected APIs unchanged temporarily while user-data routes migrate.

### Deliverables
- New Roblox login button on `/login`.
- Working callback that creates app session without requiring prior Supabase auth user.
- Session helper library and middleware/route guard utility.
- Migration SQL for `app_users` decoupling and optional `app_sessions`.

### Exit Criteria
- New user can sign in with Roblox and reach `/account`.
- Existing user with matching `roblox_user_id` is mapped to same app profile.
- No Google/email options shown in UI.

## Phase 2: User Data Route Migration
### Scope
- Replace `supabase.auth.getUser()` calls with `requireSessionUser()` in all user-data APIs.
- Move sensitive reads/writes to server-side service-role queries with explicit `eq("user_id", sessionUserId)` scoping.
- Keep guest comment behavior unchanged.

### Deliverables
- Migrated comments, checklists, quizzes, account/avatar, preferences routes.
- Shared auth guard + helper for route handlers.
- Regression tests for “read own data only” behavior.

### Exit Criteria
- User-specific features work end-to-end without Supabase Auth session.
- Cross-user access attempts fail consistently.

## Phase 3: Cleanup, Policy Alignment, Hardening
### Scope
- Remove deprecated Google/email/account-link code.
- Remove Supabase Auth callback route and unused identity-link UI.
- Remove broad admin DB privileges; keep admin UI badge only.
- Document operational runbook for Roblox OAuth outages and key rotation.

### Deliverables
- Cleaned account/login code paths.
- SQL migration removing blanket admin-full-access policies where not needed.
- Updated docs and env var requirements.

### Exit Criteria
- No runtime dependency on Supabase Auth for app identity.
- Admin role only affects presentation-level behavior unless explicitly designed otherwise.

## Phase 4: Schema Finalization (No Legacy Login Columns)
### Scope
- Remove legacy login columns from `public.app_users` (`email`, `email_login_enabled`).
- Remove `auth.users` sync triggers/functions (`handle_new_user`, `sync_app_user_on_auth_update`).
- Repoint `user_checklist_progress.user_id` and `user_quiz_progress.user_id` foreign keys to `public.app_users(user_id)`.

### Deliverables
- SQL migration finalizing Roblox-only identity schema.
- Roblox callback code path writing only Roblox-backed profile fields.
- Updated schema snapshot reflecting no dependency on Supabase Auth user records.

### Exit Criteria
- New Roblox users can save checklist and quiz progress without existing `auth.users` rows.
- `public.app_users` no longer contains email-login columns.

## Security Baseline (Minimal but Required)
- `state` and PKCE in Roblox OAuth.
- HTTP-only, `Secure`, `SameSite=Lax` session cookie.
- Signed cookie payload with strong secret (`AUTH_SESSION_SECRET`).
- Session TTL (for example 7 days) + refresh window.
- CSRF protection for mutation endpoints (origin check or CSRF token).
- Rate limiting on login/callback endpoints.
- Never expose service-role key to client.

## Testing Plan
- Happy path: new Roblox user login, existing user login.
- Session expiry and logout behavior.
- Unauthorized access blocked for private endpoints.
- Guest flows still function where expected (for example comments).
- Admin badge rendering still works from `app_users.role`.

## Rollout Plan
1. Deploy Phase 1 (Roblox OAuth + app sessions).
2. Migrate user-data routes in Phase 2 and validate feature behavior.
3. Apply Phase 3 cleanup (remove legacy login/callback code and admin-wide RLS policies).
4. Deploy Phase 4 schema finalization migration.
5. Monitor login success, session errors, and user-specific write/read endpoints.

## Rollback Plan
- Revert to previous app deployment if login breaks.
- Keep migration rollback scripts ready for policy/table changes.
- Preserve `app_users` data compatibility during transition.

## Open Questions Before Implementation
1. Should sessions be stateless cookies only, or DB-backed (`app_sessions`)?
2. What should be session duration and idle timeout?
3. Do you want all existing non-Roblox users blocked immediately, or soft-migrated on first Roblox login?
4. Should admin role be visible only in comments, or anywhere else in UI?
