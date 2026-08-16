import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured, setUserAccessToken } from "../lib/supabase";
import { fetchUserRole } from "../lib/role";
import type { Role } from "../lib/types";

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: Role | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function applySession(next: Session | null) {
      setUserAccessToken(next?.access_token ?? null);
      setSession(next);
      setUser(next?.user ?? null);
      if (!next?.user) {
        setRole(null);
        return;
      }
      const nextRole = await fetchUserRole(next.user);
      if (!cancelled) setRole(nextRole);
    }

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session)
        .catch(() => {
          if (!cancelled) setRole(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession).catch(() => {
        if (!cancelled) setRole(null);
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user,
      role,
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const nextRole = await fetchUserRole(data.user);
        if (!nextRole) {
          await supabase.auth.signOut();
          throw new Error("该账号不在管理员名单中，或 role 不是 admin / manager");
        }
        setUserAccessToken(data.session?.access_token ?? null);
        setSession(data.session);
        setUser(data.user);
        setRole(nextRole);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setUserAccessToken(null);
        setSession(null);
        setUser(null);
        setRole(null);
      },
    }),
    [loading, session, user, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
