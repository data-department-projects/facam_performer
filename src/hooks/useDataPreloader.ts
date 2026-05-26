import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PreloadedData {
  departments: any[] | null;
  projects: any[] | null;
  committees: any[] | null;
  timeEntries: any[] | null;
  organization: any | null;
  globalDesign: any | null;
  moduleDesigns: any | null;
}

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
      departments: depts.data,
      projects: projects.data,
      committees: committees.data,
      timeEntries: timeEntries.data,
      organization: org.data?.data ?? null,
      globalDesign: design.data?.data ?? null,
      moduleDesigns: moduleDesigns.data?.data ?? null,
    };
    cachedData = result;
    loadingPromise = null;
    return result;
  });

  return loadingPromise;
};

export const invalidatePreloadCache = () => {
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
