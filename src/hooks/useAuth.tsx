import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  sessionExpired: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, session: null, loading: true, isAdmin: false, sessionExpired: false, signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // Capture referral param if present
    try {
      const p = new URLSearchParams(window.location.search);
      const ref = p.get("ref");
      if (ref) localStorage.setItem("pending_referral", ref);
    } catch {}

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") setSessionExpired(false);
      if (event === "SIGNED_OUT") setSessionExpired(true);
      if (s?.user) {
        setTimeout(() => {
          supabase.from("user_roles").select("role").eq("user_id", s.user.id).eq("role", "admin").maybeSingle()
            .then(({ data }) => setIsAdmin(!!data));
          // Apply pending referral once
          const ref = localStorage.getItem("pending_referral");
          if (ref && ref !== s.user.id) {
            supabase.rpc("apply_referral" as any, { _referrer: ref })
              .then(({ error }) => { if (!error) localStorage.removeItem("pending_referral"); else if (/already/i.test(error.message)) localStorage.removeItem("pending_referral"); });
          }
        }, 0);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.expires_at) return;
    const remaining = Math.max(0, session.expires_at * 1000 - Date.now());
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.auth.refreshSession();
      if (!data.session) {
        setSessionExpired(true);
        await supabase.auth.signOut();
      }
    }, remaining + 1000);
    return () => window.clearTimeout(timer);
  }, [session?.expires_at]);

  useEffect(() => {
    const refreshWhenVisible = async () => {
      if (document.visibilityState !== "visible" || !session) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) setSessionExpired(true);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [session]);

  const signOut = async () => { sessionStorage.removeItem("bio_verified_session"); await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, sessionExpired, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
