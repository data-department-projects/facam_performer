import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { TimeEntry } from "@/data/projects";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { TimeEntryRow } from "@/types";
import { invalidatePreloadCache } from "@/hooks/useDataPreloader";

interface AddEntryResult {
  success: boolean;
  error?: string;
  completedTaskId?: string;
}

interface TimeTrackingContextType {
  entries: TimeEntry[];
  addEntry: (entry: Omit<TimeEntry, "id" | "hoursWorked" | "createdAt">, userId: string) => Promise<AddEntryResult>;
  getEntriesByProject: (projectId: string) => TimeEntry[];
  getEntriesByCollaborator: (name: string) => TimeEntry[];
  getTotalHoursByProject: (projectId: string) => number;
  getCostByProject: (projectId: string, hourlyRate: number) => number;
  getAvgDurationByProject: (projectId: string) => number;
  refreshEntries: () => void;
}

const TimeTrackingContext = createContext<TimeTrackingContextType | null>(null);

export const useTimeTracking = () => {
  const ctx = useContext(TimeTrackingContext);
  if (!ctx) throw new Error("useTimeTracking must be inside TimeTrackingProvider");
  return ctx;
};

const calcHours = (start: string, end: string): number => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh + em / 60) - (sh + sm / 60));
};

const mapRows = (data: TimeEntryRow[]): TimeEntry[] =>
  data.map(row => ({
    ...(row.data as unknown as TimeEntry),
    id: row.id,
    _user_id: row.user_id,
    _validated: row.validated,
  }));

export const TimeTrackingProvider = ({ children }: { children: ReactNode }) => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_time_entries")
      .select("id, data, user_id, validated");
    if (error) {
      console.error("Load time entries error:", error);
      return;
    }
    if (data) {
      setEntries(mapRows(data));
    }
  }, []);

  // Load entries on mount — TimeTrackingProvider is rendered only after auth
  useEffect(() => {
    load();
  }, [load]);

  const addEntry = useCallback(async (entry: Omit<TimeEntry, "id" | "hoursWorked" | "createdAt">, userId: string): Promise<AddEntryResult> => {
    const hoursWorked = calcHours(entry.startTime, entry.endTime);
    const newEntry: TimeEntry = {
      ...entry,
      id: `te-${Date.now()}`,
      hoursWorked,
      createdAt: new Date().toISOString(),
    };

    const { id, ...rest } = newEntry;
    const { error } = await supabase.from("app_time_entries").upsert({
      id,
      data: rest as unknown as Json,
      user_id: userId,
      validated: true,
    });

    if (error) {
      console.error("Add time entry error:", error);
      return { success: false, error: error.message };
    }

    if (entry.taskId && userId) {
      const { error: todoError } = await supabase
        .from("weekly_todos")
        .update({ completed: true, updated_at: new Date().toISOString() })
        .eq("id", entry.taskId)
        .eq("user_id", userId);

      if (todoError) {
        console.error("Auto-complete weekly todo error:", todoError);
        return { success: false, error: todoError.message };
      }
    }

    invalidatePreloadCache();
    await load();
    return { success: true, completedTaskId: entry.taskId };
  }, [load]);

  const getEntriesByProject = useCallback((projectId: string) => {
    return entries.filter(e => e.projectId === projectId);
  }, [entries]);

  const getEntriesByCollaborator = useCallback((name: string) => {
    return entries.filter(e => e.collaboratorName === name);
  }, [entries]);

  const getTotalHoursByProject = useCallback((projectId: string) => {
    return entries.filter(e => e.projectId === projectId).reduce((s, e) => s + e.hoursWorked, 0);
  }, [entries]);

  const getCostByProject = useCallback((projectId: string, hourlyRate: number) => {
    return getTotalHoursByProject(projectId) * hourlyRate;
  }, [getTotalHoursByProject]);

  const getAvgDurationByProject = useCallback((projectId: string) => {
    const projEntries = entries.filter(e => e.projectId === projectId);
    if (projEntries.length === 0) return 0;
    return projEntries.reduce((s, e) => s + e.hoursWorked, 0) / projEntries.length;
  }, [entries]);

  return (
    <TimeTrackingContext.Provider value={{ entries, addEntry, getEntriesByProject, getEntriesByCollaborator, getTotalHoursByProject, getCostByProject, getAvgDurationByProject, refreshEntries: load }}>
      {children}
    </TimeTrackingContext.Provider>
  );
};
