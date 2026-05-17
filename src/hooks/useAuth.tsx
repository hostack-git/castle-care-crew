import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { hostackSupabase } from "@/integrations/hostack/client";
import { getUserAccess } from "@/lib/hostack-admin.functions";

type Profile = {
  id: string;
  full_name: string | null;
  nationality: string | null;
  language: "en" | "pt" | "es" | "de" | "gd";
  phone: string | null;
  email: string | null;
  passport_number: string | null;
  passport_url: string | null;
  avatar_url: string | null;
  bio: string | null;
  onboarded: boolean;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isRoomManager: boolean;
  isVolunteer: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRoomManager, setIsRoomManager] = useState(false);
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyAnonymousVolunteer = (currentUser: User) => {
    setUser(currentUser);
    setIsVolunteer(true);
    setProfile(null);
    setIsAdmin(false);
    setIsRoomManager(false);
    setLoading(false);
  };

  const loadProfile = async (currentUser: User) => {
    if (currentUser.email === null || !currentUser.email) {
      applyAnonymousVolunteer(currentUser);
      return;
    }

    setIsVolunteer(false);
    try {
      const res = await getUserAccess({ data: { userId: currentUser.id } });
      setProfile((res.profile as Profile | null) ?? null);
      setIsAdmin(res.isAdmin);
      setIsRoomManager(res.isRoomManager);
    } catch (e) {
      console.error("getUserAccess failed", e);
      setProfile(null);
      setIsAdmin(false);
      setIsRoomManager(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user);
  };

  useEffect(() => {
    // Auth listener FIRST (sync)
    const { data: sub } = hostackSupabase.auth.onAuthStateChange((_e: string, s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Anonymous volunteer: skip staff/role queries (RLS blocks them)
        if (s.user.email === null || !s.user.email) {
          applyAnonymousVolunteer(s.user);
          return;
        } else {
          setIsVolunteer(false);
          // defer profile load to avoid deadlocks
          setTimeout(() => loadProfile(s.user), 0);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsRoomManager(false);
        setIsVolunteer(false);
      }
    });

    hostackSupabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        if (s.user.email === null || !s.user.email) {
          applyAnonymousVolunteer(s.user);
          return;
        } else {
          setIsVolunteer(false);
          loadProfile(s.user).finally(() => setLoading(false));
        }
      } else {
        setIsVolunteer(false);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await hostackSupabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <Ctx.Provider value={{ user, session, profile, isAdmin, isRoomManager, isVolunteer, loading, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
