import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppDataRow, TimeEntryRow } from "@/types";

export interface PreloadedData {
  departments:   AppDataRow[] | null;
  projects:      AppDataRow[] | null;
  committees:    AppDataRow[] | null;
  timeEntries:   TimeEntryRow[] | null;
  organization:  unknown;
  globalDesign:  unknown;
  moduleDesigns: unknown;
}

// Cache module-level — évite les fetches redondants entre contextes/composants
let cachedData: PreloadedData | null = null;
let loadingPromise: Promise<PreloadedData> | null = null;

export const preloadAllData = async (): Promise<PreloadedData> => {
  if (cachedData) return cachedData;
  if (loadingPromise) return loadingPromise;

  loadingPromise = Promise.all([
    supabase.from("app_departments").select("id, data"),
    supabase.from("app_projects").select("id, data"),
    supabase.from("app_committees").select("id, data"),
    supabase.from("app_time_entries").select("id, data, user_id, validated"),
    supabase.from("app_organization").select("data").eq("id", "main").maybeSingle(),
    supabase.from("app_organization").select("data").eq("id", "global_design").maybeSingle(),
    supabase.from("app_organization").select("data").eq("id", "module_designs").maybeSingle(),
  ]).then(([depts, projects, committees, timeEntries, org, design, moduleDesigns]) => {
    const result: PreloadedData = {
      departments:   (depts.data       as AppDataRow[]  | null),
      projects:      (projects.data    as AppDataRow[]  | null),
      committees:    (committees.data  as AppDataRow[]  | null),
      timeEntries:   (timeEntries.data as TimeEntryRow[] | null),
      organization:  org.data?.data          ?? null,
      globalDesign:  design.data?.data       ?? null,
      moduleDesigns: moduleDesigns.data?.data ?? null,
    };
    cachedData = result;
    loadingPromise = null;
    return result;
  });

  return loadingPromise;
};

export const invalidatePreloadCache = (): void => {
  cachedData = null;
  loadingPromise = null;
};

export const usePreloadedData = () => {
  const [data, setData] = useState<PreloadedData | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    if (cachedData) {
      setData(cachedData);
      setLoading(false);
      return;
    }
    preloadAllData().then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  return { data, loading };
};
