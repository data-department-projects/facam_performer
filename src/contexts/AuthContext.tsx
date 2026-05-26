import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  service: string | null;
  is_manager: boolean;
  hierarchy_user_id: string | null;
  skip_personal_planning?: boolean;
  must_change_password?: boolean;
  is_blocked?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  allowedModules: string[];
  loading: boolean;
  mustChangePassword: boolean;
  isRecovery: boolean;
  isBlocked: boolean;
  setMustChangePassword: (v: boolean) => void;
  setIsRecovery: (v: boolean) => void;
  refreshPermissions: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  logSecurityViolation: (type: string, table?: string, action?: string, details?: Record<string, any>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [profileResult, roleResult, modResult] = await Promise.allSettled([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_module_permissions").select("module").eq("user_id", userId),
    ]);

    const profileResponse = profileResult.status === "fulfilled" ? profileResult.value : null;
    const roleResponse = roleResult.status === "fulfilled" ? roleResult.value : null;
    const moduleResponse = modResult.status === "fulfilled" ? modResult.value : null;

    if (profileResult.status === "rejected") {
      console.error("Profile fetch failed:", profileResult.reason);
    } else if (profileResponse?.error) {
      console.error("Profile fetch failed:", profileResponse.error);
    }

    if (roleResult.status === "rejected") {
      console.error("Role fetch failed:", roleResult.reason);
    } else if (roleResponse?.error) {
      console.error("Role fetch failed:", roleResponse.error);
    }

    if (modResult.status === "rejected") {
      console.error("Module permissions fetch failed:", modResult.reason);
    } else if (moduleResponse?.error) {
      console.error("Module permissions fetch failed:", moduleResponse.error);
    }

    const profileData = profileResponse?.data;
    const roleData = roleResponse?.data ?? [];
    const moduleData = moduleResponse?.data ?? [];
    const admin = roleData?.some(r => r.role === "admin") ?? false;

    // Check if user is blocked
    const blocked = !!profileData?.is_blocked;
    setIsBlocked(blocked);

    setProfile(profileData ? (profileData as UserProfile) : null);
    setIsAdmin(admin);

    if (admin) {
      setMustChangePassword(false);
      setAllowedModules(["dashboard", "orgchart", "roadmap", "gantt", "comites", "projects", "projectscomites", "search", "timeentry", "admin", "etpadmin", "reports", "hrperformance", "dept_objectives", "project_costs", "weekly_analysis", "badgemanagement"]);
    } else {
      setMustChangePassword(!!profileData?.must_change_password);
      setAllowedModules(moduleData.map(m => m.module) ?? []);
    }
  };

  const resetAuthState = () => {
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setAllowedModules([]);
    setMustChangePassword(false);
    setIsRecovery(false);
    setIsBlocked(false);
  };

  const fetchUserDataWithTimeout = async (userId: string, _timeoutMs = 5000) => {
    try {
      await fetchUserData(userId);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      setProfile(null);
      setIsAdmin(false);
      setAllowedModules([]);
      setMustChangePassword(false);
      setIsBlocked(false);
    }
  };

  const handleSession = async (session: Session | null) => {
    setLoading(true);
    try {
      if (session?.user) {
        setUser(session.user);
        await fetchUserDataWithTimeout(session.user.id);
      } else {
        resetAuthState();
      }
    } catch (error) {
      console.error("Session handling failed:", error);
      resetAuthState();
    } finally {
      setLoading(false);
    }
  };

  // Log security violations via secure RPC
  const logSecurityViolation = useCallback(async (
    type: string, table?: string, action?: string, details?: Record<string, any>
  ) => {
    try {
      await supabase.rpc("log_security_violation" as any, {
        _violation_type: type,
        _target_table: table || null,
        _target_action: action || null,
        _details: details || {},
      });
      // Re-check blocked status
      if (user) {
        const { data } = await supabase.rpc("is_user_blocked" as any, { _user_id: user.id });
        if (data === true) {
          setIsBlocked(true);
        }
      }
    } catch (e) {
      console.error("Security violation log failed:", e);
    }
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsRecovery(true);
        }
        setTimeout(() => {
          void handleSession(session);
        }, 0);
      }
    );

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => handleSession(session))
      .catch((error) => {
        console.error("Initial session fetch failed:", error);
        resetAuthState();
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const refreshPermissions = useCallback(async () => {
    if (!user) return;
    await fetchUserDataWithTimeout(user.id);
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin, allowedModules, loading, mustChangePassword, isRecovery, isBlocked, setMustChangePassword, setIsRecovery, refreshPermissions, signIn, signOut, logSecurityViolation }}>
      {children}
    </AuthContext.Provider>
  );
};
