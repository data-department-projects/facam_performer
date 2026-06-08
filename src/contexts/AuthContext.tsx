import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_MODULES } from "@/constants/modules";
import type { Session, User } from "@supabase/supabase-js";
import type { UserProfile } from "@/types";

export type { UserProfile };

interface AuthContextType {
  user:                  User | null;
  profile:               UserProfile | null;
  isAdmin:               boolean;
  allowedModules:        string[];
  loading:               boolean;
  mustChangePassword:    boolean;
  isRecovery:            boolean;
  isBlocked:             boolean;
  setMustChangePassword: (v: boolean) => void;
  setIsRecovery:         (v: boolean) => void;
  refreshPermissions:    () => Promise<void>;
  signIn:                (email: string, password: string) => Promise<{ error: unknown }>;
  signOut:               () => Promise<void>;
  logSecurityViolation:  (type: string, table?: string, action?: string, details?: Record<string, unknown>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]                         = useState<User | null>(null);
  const [profile, setProfile]                   = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin]                   = useState(false);
  const [allowedModules, setAllowedModules]     = useState<string[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isRecovery, setIsRecovery]             = useState(false);
  const [isBlocked, setIsBlocked]               = useState(false);
  const [loading, setLoading]                   = useState(true);

  const fetchUserData = async (userId: string): Promise<void> => {
    const [profileResult, roleResult, modResult] = await Promise.allSettled([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_module_permissions").select("module").eq("user_id", userId),
    ]);

    const profileData = profileResult.status === "fulfilled" ? profileResult.value.data : null;
    const roleData    = roleResult.status === "fulfilled"    ? (roleResult.value.data ?? []) : [];
    const moduleData  = modResult.status === "fulfilled"     ? (modResult.value.data ?? [])  : [];

    const admin   = roleData.some(r => r.role === "admin");
    const blocked = !!(profileData as UserProfile | null)?.is_blocked;

    setIsBlocked(blocked);
    setProfile(profileData as UserProfile | null);
    setIsAdmin(admin);

    if (admin) {
      setMustChangePassword(false);
      setAllowedModules([...ADMIN_MODULES]);
    } else {
      setMustChangePassword(!!(profileData as UserProfile | null)?.must_change_password);
      setAllowedModules(moduleData.map(m => m.module));
    }
  };

  const resetAuthState = (): void => {
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setAllowedModules([]);
    setMustChangePassword(false);
    setIsRecovery(false);
    setIsBlocked(false);
  };

  const handleSession = async (session: Session | null): Promise<void> => {
    setLoading(true);
    try {
      if (session?.user) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      } else {
        resetAuthState();
      }
    } catch {
      resetAuthState();
    } finally {
      setLoading(false);
    }
  };

  const logSecurityViolation = useCallback(async (
    type: string,
    table?: string,
    action?: string,
    details?: Record<string, unknown>
  ): Promise<void> => {
    try {
      // RPC personnalisé non inclus dans les types auto-générés
      await supabase.rpc("log_security_violation" as never, {
        _violation_type:  type,
        _target_table:    table  ?? null,
        _target_action:   action ?? null,
        _details:         details ?? {},
      });
      if (user) {
        const { data } = await supabase.rpc("is_user_blocked" as never, { _user_id: user.id });
        if (data === true) setIsBlocked(true);
      }
    } catch {
      // Violation non loggable — ne pas propager l'erreur
    }
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      // setTimeout(0) évite les appels Supabase imbriqués dans le callback
      setTimeout(() => void handleSession(session), 0);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => handleSession(session))
      .catch(() => {
        resetAuthState();
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPermissions = useCallback(async (): Promise<void> => {
    if (!user) return;
    await fetchUserData(user.id);
  }, [user]);

  const signIn = async (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, profile, isAdmin, allowedModules, loading,
      mustChangePassword, isRecovery, isBlocked,
      setMustChangePassword, setIsRecovery,
      refreshPermissions, signIn, signOut, logSecurityViolation,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
