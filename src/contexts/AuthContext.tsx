import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRow } from "@/integrations/supabase/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { setLanguage } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (userId: string) => {
      const [{ data: p }, { data: role }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      ]);
      setProfile((p as ProfileRow) ?? null);
      setIsAdmin(!!role);
      if (p?.language) setLanguage(p.language);
    },
    [setLanguage],
  );

  useEffect(() => {
    let active = true;

    const apply = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      if (s?.user) await loadProfile(s.user.id);
      else {
        setProfile(null);
        setIsAdmin(false);
      }
      if (active) setLoading(false);
    };

    // Ekki kalla á supabase innan úr onAuthStateChange sjálfu (veldur deadlock); fresta með setTimeout.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => apply(s), 0);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => apply(s));

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, profile, isAdmin, loading, refreshProfile, signOut }),
    [session, profile, isAdmin, loading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
