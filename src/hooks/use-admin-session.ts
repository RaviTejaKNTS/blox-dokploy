"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let mounted = true;

    async function bootstrap() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setSession(session ?? null);
      setLoading(false);

      if (session) {
        const { data } = await supabase
          .from("admin_users")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!mounted) return;
        setRole(data?.role ?? null);
      } else {
        setRole(null);
      }
    }

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      if (nextSession) {
        const { data } = await supabase
          .from("admin_users")
          .select("role")
          .eq("user_id", nextSession.user.id)
          .maybeSingle();
        if (!mounted) return;
        setRole(data?.role ?? null);
      } else {
        setRole(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, role, loading };
}
