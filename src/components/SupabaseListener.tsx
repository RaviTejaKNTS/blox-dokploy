"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function SupabaseListener() {
  useEffect(() => {
    const supabase = supabaseBrowser();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        await fetch("/auth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ event: _event, session }),
        });
      } catch (error) {
        console.error("Failed to sync Supabase auth session", error);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}

