"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

type AdminRole = string | null | undefined;

async function fetchAdminRole(client: ReturnType<typeof supabaseBrowser>, userId: string) {
  try {
    const { data, error } = await client
      .from("admin_users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch admin role", error);
      return null;
    }
    return data?.role ?? null;
  } catch (error) {
    console.error("Failed to fetch admin role", error);
    return null;
  }
}

export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AdminRole>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(session ?? null);

        if (session) {
          setRole(undefined);
          const roleValue = await fetchAdminRole(supabase, session.user.id);
          if (!mounted) return;
          setRole(roleValue);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Failed to bootstrap admin session", error);
        if (mounted) {
          setSession(null);
          setRole(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setLoading(true);
      try {
        setSession(nextSession ?? null);
        if (nextSession) {
          setRole(undefined);
          const roleValue = await fetchAdminRole(supabase, nextSession.user.id);
          if (!mounted) return;
          setRole(roleValue);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Failed to handle auth state change", error);
        if (mounted) {
          setSession(null);
          setRole(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, role, loading };
}
