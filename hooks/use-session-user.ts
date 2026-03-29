"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** `null` while the first client session check runs; then whether a user is signed in. */
export function useSessionUser() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthed(!!user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { isAuthed };
}
