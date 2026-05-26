import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  service: string | null;
  poste: string | null;
  is_manager: boolean;
  hierarchy_user_id: string | null;
  category: string;
  badge_number: string | null;
}

let cachedProfiles: Profile[] | null = null;
const listeners: Set<(profiles: Profile[]) => void> = new Set();
let loading = false;

const fetchAndBroadcast = async () => {
  if (loading) return;
  
  // Wait for auth session before fetching
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // Not authenticated yet, don't fetch (would return empty due to RLS)
    return;
  }
  
  loading = true;
  const { data } = await supabase.from("profiles_public" as any).select("user_id, full_name, email, department_id, service, poste, is_manager, hierarchy_user_id, category, badge_number") as { data: Profile[] | null };
  cachedProfiles = (data ?? []).filter((p: Profile) => p.full_name);
  loading = false;
  listeners.forEach(cb => cb(cachedProfiles!));
};

export const refreshProfiles = () => {
  cachedProfiles = null;
  fetchAndBroadcast();
};

export const useProfiles = () => {
  const [profiles, setProfiles] = useState<Profile[]>(cachedProfiles ?? []);

  useEffect(() => {
    const handler = (p: Profile[]) => setProfiles(p);
    listeners.add(handler);

    if (!cachedProfiles) {
      fetchAndBroadcast();
    } else {
      setProfiles(cachedProfiles);
    }

    // Also listen for auth changes to refetch when user logs in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && !cachedProfiles) {
        fetchAndBroadcast();
      } else if (event === 'SIGNED_OUT') {
        cachedProfiles = null;
        setProfiles([]);
      }
    });

    return () => {
      listeners.delete(handler);
      subscription.unsubscribe();
    };
  }, []);

  return profiles;
};

export const useProfileOptions = () => {
  const profiles = useProfiles();
  return profiles.map(p => ({ value: p.full_name, label: p.full_name }));
};
