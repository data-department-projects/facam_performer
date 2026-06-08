import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types";

export type { Profile };

// Cache module-level — partagé entre tous les composants qui utilisent useProfiles
let cachedProfiles: Profile[] | null = null;
const listeners = new Set<(profiles: Profile[]) => void>();
let isFetching = false;

const fetchAndBroadcast = async (): Promise<void> => {
  if (isFetching) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return; // RLS bloquerait la requête de toute façon

  isFetching = true;

  const { data } = await supabase
    // Vue Supabase non incluse dans les types auto-générés
    .from("profiles_public" as never)
    .select("user_id, full_name, email, department_id, service, poste, is_manager, hierarchy_user_id, category, badge_number");

  cachedProfiles = ((data ?? []) as unknown as Profile[]).filter(p => p.full_name);
  isFetching = false;
  listeners.forEach(cb => cb(cachedProfiles!));
};

export const refreshProfiles = (): void => {
  cachedProfiles = null;
  fetchAndBroadcast();
};

export const useProfiles = (): Profile[] => {
  const [profiles, setProfiles] = useState<Profile[]>(cachedProfiles ?? []);

  useEffect(() => {
    const handler = (p: Profile[]) => setProfiles(p);
    listeners.add(handler);

    if (cachedProfiles) {
      setProfiles(cachedProfiles);
    } else {
      fetchAndBroadcast();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_IN" && !cachedProfiles) {
        fetchAndBroadcast();
      } else if (event === "SIGNED_OUT") {
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
