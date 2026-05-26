import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { Project, ProjectMilestone, Deliverable } from "@/data/projects";
import { supabase } from "@/integrations/supabase/client";
import { preloadAllData } from "@/hooks/useDataPreloader";

interface ProjectsContextType {
  projects: Project[];
  addProject: (project: Project) => void;
  updateProject: (updated: Project) => void;
  deleteProject: (id: string) => void;
  updateMilestoneDeadline: (projectId: string, milestoneId: string, deadline: string) => void;
  updateMilestoneStatus: (projectId: string, milestoneId: string, status: ProjectMilestone["status"]) => void;
  submitDeliverable: (projectId: string, milestoneId: string, submittedBy: string, link: string) => { success: boolean; error?: string };
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export const useProjects = () => {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be inside ProjectsProvider");
  return ctx;
};

const saveProject = async (p: Project) => {
  const { id, ...rest } = p;
  const { error } = await supabase.from("app_projects").upsert({ id, data: rest as any });
  if (error?.code === "42501" || error?.message?.includes("row-level security")) {
    // RLS violation — log security event
    await supabase.rpc("log_security_violation" as any, {
      _violation_type: "rls_bypass_attempt",
      _target_table: "app_projects",
      _target_action: "upsert",
      _details: { project_id: id, error: error.message },
    });
  }
};

export const ProjectsProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    preloadAllData().then(cached => {
      if (cached.projects) {
        setProjects(cached.projects.map(row => ({ ...(row.data as any), id: row.id })));
      }
    });
  }, []);

  const persist = (updater: (prev: Project[]) => Project[]) => {
    setProjects(prev => {
      const next = updater(prev);
      // Find changed projects and save them
      next.forEach(p => {
        const old = prev.find(o => o.id === p.id);
        if (!old || old !== p) saveProject(p);
      });
      return next;
    });
  };

  const addProject = useCallback((project: Project) => {
    setProjects(prev => [...prev, project]);
    saveProject(project);
  }, []);

  const updateProject = useCallback((updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    saveProject(updated);
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    supabase.from("app_projects").delete().eq("id", id).then();
  }, []);

  const updateMilestoneDeadline = useCallback((projectId: string, milestoneId: string, deadline: string) => {
    setProjects(prev => {
      const next = prev.map(p => {
        if (p.id !== projectId) return p;
        const updated = {
          ...p,
          milestones: p.milestones.map(m => {
            if (m.id !== milestoneId) return m;
            if (m.deadlineLocked) return m;
            return { ...m, deadline, deadlineLocked: true };
          }),
        };
        saveProject(updated);
        return updated;
      });
      return next;
    });
  }, []);

  const updateMilestoneStatus = useCallback((projectId: string, milestoneId: string, status: ProjectMilestone["status"]) => {
    setProjects(prev => {
      const next = prev.map(p => {
        if (p.id !== projectId) return p;
        const updated = {
          ...p,
          milestones: p.milestones.map(m => m.id === milestoneId ? { ...m, status } : m),
        };
        saveProject(updated);
        return updated;
      });
      return next;
    });
  }, []);

  const submitDeliverable = useCallback((projectId: string, milestoneId: string, submittedBy: string, link: string): { success: boolean; error?: string } => {
    let result: { success: boolean; error?: string } = { success: false, error: "" };
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const updated = {
        ...p,
        milestones: p.milestones.map(m => {
          if (m.id !== milestoneId) return m;
          if (!m.deadline) {
            result = { success: false, error: "Aucune deadline définie pour ce jalon." };
            return m;
          }
          const deadlineDate = new Date(m.deadline);
          const now = new Date();
          const hoursUntilDeadline = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursUntilDeadline < 0) {
            result = { success: false, error: "La deadline est dépassée." };
            return m;
          }
          if (hoursUntilDeadline > 24) {
            result = { success: false, error: `Le dépôt n'est possible que dans les 24h précédant la deadline (${Math.round(hoursUntilDeadline)}h restantes).` };
            return m;
          }
          const deliverable: Deliverable = {
            id: `del-${Date.now()}`,
            submittedBy,
            link,
            submittedAt: new Date().toISOString(),
          };
          result = { success: true };
          return { ...m, deliverables: [...(m.deliverables || []), deliverable] };
        }),
      };
      if (result.success) saveProject(updated);
      return updated;
    }));
    return result;
  }, []);

  return (
    <ProjectsContext.Provider value={{ projects, addProject, updateProject, deleteProject, updateMilestoneDeadline, updateMilestoneStatus, submitDeliverable }}>
      {children}
    </ProjectsContext.Provider>
  );
};
