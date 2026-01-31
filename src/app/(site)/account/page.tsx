import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { signOut } from "../login/actions";
import { disableEmailLogin, enableEmailLogin, linkGoogle, linkRoblox, unlinkIdentity, unlinkRoblox, updateDisplayName } from "./actions";

export const dynamic = "force-dynamic";
const ACCOUNT_PATH = "/account";

type AccountPageProps = {
  searchParams?: Promise<{ error?: string | string[]; success?: string | string[] }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(ACCOUNT_PATH)}`);
  }

  const { data: identitiesData } = await supabase.auth.getUserIdentities();
  const identities = identitiesData?.identities ?? user?.identities ?? [];
  const linkedIdentities = identities.filter((identity) => identity.provider !== "email");
  const googleIdentity = linkedIdentities.find((identity) => identity.provider === "google");
  const otherIdentities = linkedIdentities.filter((identity) => identity.provider !== "google");
  const { data: appUser } = await supabase
    .from("app_users")
    .select(
      "email_login_enabled, display_name, roblox_user_id, roblox_username, roblox_display_name, roblox_avatar_url"
    )
    .eq("user_id", user.id)
    .maybeSingle();
  const robloxLink = appUser?.roblox_user_id
    ? {
        roblox_user_id: appUser.roblox_user_id,
        roblox_username: appUser.roblox_username,
        roblox_display_name: appUser.roblox_display_name,
        avatar_url: appUser.roblox_avatar_url
      }
    : null;
  const emailLoginEnabled = appUser?.email_login_enabled === true;
  const displayName =
    appUser?.display_name ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.user_metadata?.display_name ??
    null;
  const identityCount = identities.length;
  const canUnlinkProviders = identityCount > 1;
  const canDisableEmailLogin = linkedIdentities.length > 0;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error ?? null;
  const successMessage = Array.isArray(resolvedSearchParams?.success)
    ? resolvedSearchParams?.success[0]
    : resolvedSearchParams?.success ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="panel overflow-hidden">
        <div className="relative border-b border-border/60 px-6 pb-8 pt-10 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_65%)]" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src="/Bloxodes-dark.png"
                alt="Bloxodes"
                width={948}
                height={319}
                className="hidden h-9 w-auto dark:block"
                priority
              />
              <Image
                src="/Bloxodes-light.png"
                alt="Bloxodes"
                width={948}
                height={319}
                className="block h-9 w-auto dark:hidden"
                priority
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Account</p>
              <h1 className="text-2xl font-semibold text-foreground">Your Bloxodes profile</h1>
              <p className="text-sm text-muted">Manage your login and view your account details.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-8 sm:px-8">
          {user ? (
            <>
              {errorMessage ? (
                <div className="rounded-[var(--radius-lg)] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}
              {successMessage ? (
                <div className="rounded-[var(--radius-lg)] border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {successMessage}
                </div>
              ) : null}

              {!robloxLink ? (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-accent/40 bg-accent/10 px-4 py-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Finish setup</p>
                    <p className="text-sm font-semibold text-foreground">Link your Roblox account</p>
                    <p className="text-sm text-muted">
                      Connect Roblox to unlock Roblox-specific features and personalize your profile.
                    </p>
                  </div>
                  <form action={linkRoblox}>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
                    >
                      Link Roblox
                    </button>
                  </form>
                </div>
              ) : null}

              <div className="grid gap-4 rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-4 text-sm text-foreground sm:grid-cols-3">
                <details className="group rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-3 py-3 sm:col-span-1 sm:bg-transparent sm:p-0 sm:border-0">
                  <summary className="flex list-none items-start justify-between gap-3 cursor-pointer">
                    <span className="space-y-1">
                      <span className="block text-xs uppercase tracking-[0.3em] text-muted">Name</span>
                      <span className="block font-semibold text-foreground">{displayName ?? "—"}</span>
                    </span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted transition group-hover:border-accent group-hover:text-accent">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      >
                        <path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4Z" />
                        <path d="M13 7l4 4" />
                      </svg>
                    </span>
                  </summary>
                  <form action={updateDisplayName} className="mt-3 grid gap-3">
                    <input
                      name="displayName"
                      type="text"
                      minLength={2}
                      maxLength={50}
                      defaultValue={displayName ?? ""}
                      placeholder="Enter your name"
                      className="w-full rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
                    >
                      Save name
                    </button>
                  </form>
                </details>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">Email</p>
                  <p className="font-semibold">{user.email ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">Created</p>
                  <p className="font-semibold">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString("en-US") : "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">Roblox account</p>
                  <p className="mt-2 text-sm text-muted">
                    Link your Roblox account to unlock Roblox-specific features.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground">
                    <div className="flex items-center gap-3">
                      {robloxLink?.avatar_url ? (
                        <Image
                          src={robloxLink.avatar_url}
                          alt={robloxLink.roblox_display_name ?? "Roblox avatar"}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full border border-border/60"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-xs font-semibold text-muted">
                          RBX
                        </div>
                      )}
                      <div>
                        <div className="font-semibold">
                          {robloxLink?.roblox_display_name ?? "Not linked"}
                        </div>
                        <div className="text-xs text-muted">
                          {robloxLink?.roblox_username ? `@${robloxLink.roblox_username}` : "Roblox account not connected"}
                        </div>
                      </div>
                    </div>
                    {robloxLink ? (
                      <form action={unlinkRoblox}>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-border/60 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
                        >
                          Unlink
                        </button>
                      </form>
                    ) : (
                      <form action={linkRoblox}>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-border/60 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
                        >
                          Link Roblox
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">Sign-in methods</p>
                  <p className="mt-2 text-sm text-muted">Keep at least one method active.</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">Email + password</div>
                          <div className="text-xs text-muted">{emailLoginEnabled ? "Enabled" : "Not enabled"}</div>
                        </div>
                        {emailLoginEnabled ? (
                          <form action={disableEmailLogin}>
                            <button
                              type="submit"
                              disabled={!canDisableEmailLogin}
                              className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                canDisableEmailLogin
                                  ? "border-border/60 text-foreground hover:border-accent hover:text-accent"
                                  : "border-border/40 text-muted/70 cursor-not-allowed"
                              }`}
                            >
                              Disable
                            </button>
                          </form>
                        ) : null}
                      </div>
                      {!emailLoginEnabled ? (
                        <form action={enableEmailLogin} className="mt-3 grid gap-3 sm:grid-cols-2">
                          <input
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={8}
                            placeholder="Set password (min 8 chars)"
                            className="w-full rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                          <input
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={8}
                            placeholder="Confirm password"
                            className="w-full rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                          <button
                            type="submit"
                            className="inline-flex w-full items-center justify-center rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent sm:col-span-2"
                          >
                            Enable email login
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground">
                      <div>
                        <div className="font-semibold">Google</div>
                        <div className="text-xs text-muted">{googleIdentity ? "Linked" : "Not linked"}</div>
                      </div>
                      {googleIdentity ? (
                        <form action={unlinkIdentity}>
                          <input type="hidden" name="identityId" value={googleIdentity.id} />
                          <button
                            type="submit"
                            disabled={!canUnlinkProviders}
                            className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              canUnlinkProviders
                                ? "border-border/60 text-foreground hover:border-accent hover:text-accent"
                                : "border-border/40 text-muted/70 cursor-not-allowed"
                            }`}
                          >
                            Unlink
                          </button>
                        </form>
                      ) : (
                        <form action={linkGoogle}>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
                          >
                            Link
                          </button>
                        </form>
                      )}
                    </div>

                    {otherIdentities.length > 0 ? (
                      <div className="space-y-2">
                        {otherIdentities.map((identity) => (
                          <div
                            key={identity.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground"
                          >
                            <div className="font-semibold capitalize">{identity.provider}</div>
                            <form action={unlinkIdentity}>
                              <input type="hidden" name="identityId" value={identity.id} />
                              <button
                                type="submit"
                                disabled={!canUnlinkProviders}
                                className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                  canUnlinkProviders
                                    ? "border-border/60 text-foreground hover:border-accent hover:text-accent"
                                    : "border-border/40 text-muted/70 cursor-not-allowed"
                                }`}
                              >
                                Unlink
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <form action={signOut} className="flex">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="space-y-4 rounded-[var(--radius-lg)] border border-border/60 bg-surface px-4 py-5 text-sm text-muted">
              <p>You’re not signed in yet.</p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-[var(--radius-lg)] border border-border/60 bg-background/70 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
              >
                Go to login
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
