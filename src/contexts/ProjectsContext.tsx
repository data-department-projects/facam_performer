import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { preloadAllData } from "@/hooks/useDataPreloader";
import type { Project, ProjectMilestone, Deliverable } from "@/data/projects";

interface ProjectsContextType {
  projects:              Project[];
  addProject:            (project: Project) => void;
  updateProject:         (updated: Project) => void;
  deleteProject:         (id: string) => void;
  updateMilestoneDeadline: (projectId: string, milestoneId: string, deadline: string) => void;
  updateMilestoneStatus:   (projectId: string, milestoneId: string, status: ProjectMilestone["status"]) => void;
  submitDeliverable:       (projectId: string, milestoneId: string, submittedBy: string, link: string) => { success: boolean; error?: string };
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export const useProjects = (): ProjectsContextType => {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside ProjectsProvider");
  return ctx;
};

// ── Persistance Supabase ─────────────────────────────────────────────────────

const saveProject = async (p: Project): Promise<void> => {
  const { id, ...rest } = p;
  const { error } = await supabase
    .from("app_projects")
    .upsert({ id, data: rest as unknown as Record<string, unknown> });

  if (error?.code === "42501" || error?.message?.includes("row-level security")) {
    // RLS violation — log sans bloquer l'UI
    await supabase.rpc("log_security_violation" as never, {
      _violation_type:  "rls_bypass_attempt",
      _target_table:    "app_projects",
      _target_action:   "upsert",
      _details:         { project_id: id, error: error.message },
    });
  }
};

// ── Provider ─────────────────────────────────────────────────────────────────

export const ProjectsProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    preloadAllData().then(cached => {
      if (cached.projects) {
        setProjects(
          cached.projects.map(row => ({
            ...(row.data as Omit<Project, "id">),
            id: row.id,
          }))
        );
      }
    });
  }, []);

  const addProject = useCallback((project: Project): void => {
    setProjects(prev => [...prev, project]);
    saveProject(project);
  }, []);

  const updateProject = useCallback((updated: Project): void => {
    setProjects(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    saveProject(updated);
  }, []);

  const deleteProject = useCallback((id: string): void => {
    setProjects(prev => prev.filter(p => p.id !== id));
    supabase.from("app_projects").delete().eq("id", id).then();
  }, []);

  const updateMilestoneDeadline = useCallback((
    projectId: string,
    milestoneId: string,
    deadline: string
  ): void => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const updated: Project = {
          ...p,
          milestones: p.milestones.map(m => {
            if (m.id !== milestoneId || m.deadlineLocked) return m;
            return { ...m, deadline, deadlineLocked: true };
          }),
        };
        saveProject(updated);
        return updated;
      })
    );
  }, []);

  const updateMilestoneStatus = useCallback((
    projectId: string,
    milestoneId: string,
    status: ProjectMilestone["status"]
  ): void => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const updated: Project = {
          ...p,
          milestones: p.milestones.map(m => (m.id === milestoneId ? { ...m, status } : m)),
        };
        saveProject(updated);
        return updated;
      })
    );
  }, []);

  const submitDeliverable = useCallback((
    projectId: string,
    milestoneId: string,
    submittedBy: string,
    link: string
  ): { success: boolean; error?: string } => {
    let result: { success: boolean; error?: string } = { success: false, error: "" };

    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;

        const updated: Project = {
          ...p,
          milestones: p.milestones.map(m => {
            if (m.id !== milestoneId) return m;
            if (!m.deadline) {
              result = { success: false, error: "Aucune deadline définie pour ce jalon." };
              return m;
            }

            const hoursUntilDeadline =
              (new Date(m.deadline).getTime() - Date.now()) / (1000 * 60 * 60);

            if (hoursUntilDeadline < 0) {
              result = { success: false, error: "La deadline est dépassée." };
              return m;
            }
            if (hoursUntilDeadline > 24) {
              result = {
                success: false,
                error: `Le dépôt n'est possible que dans les 24h précédant la deadline (${Math.round(hoursUntilDeadline)}h restantes).`,
              };
              return m;
            }

            const deliverable: Deliverable = {
              id:          `del-${Date.now()}`,
              submittedBy,
              link,
              submittedAt: new Date().toISOString(),
            };
            result = { success: true };
            return { ...m, deliverables: [...(m.deliverables ?? []), deliverable] };
          }),
        };

        if (result.success) saveProject(updated);
        return updated;
      })
    );

    return result;
  }, []);

  return (
    <ProjectsContext.Provider value={{
      projects,
      addProject,
      updateProject,
      deleteProject,
      updateMilestoneDeadline,
      updateMilestoneStatus,
      submitDeliverable,
    }}>
      {children}
    </ProjectsContext.Provider>
  );
};
