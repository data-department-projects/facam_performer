import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { preloadAllData } from "@/hooks/useDataPreloader";
import type { Project, ProjectMilestone, MissionMilestone, CollaboratorMission, ProjectGanttTask, Deliverable } from "@/data/projects";

interface ProjectsContextType {
  projects:              Project[];
  addProject:            (project: Project) => void;
  updateProject:         (updated: Project) => void;
  deleteProject:         (id: string) => void;
  updateMilestoneDeadline: (projectId: string, milestoneId: string, deadline: string) => void;
  updateMilestoneStatus:   (projectId: string, milestoneId: string, status: ProjectMilestone["status"]) => void;
  submitDeliverable:       (projectId: string, milestoneId: string, submittedBy: string, link: string) => { success: boolean; error?: string };
  updateCollaboratorMilestoneStatus: (projectId: string, collabName: string, missionId: string, milestoneId: string, status: MissionMilestone["status"]) => void;
  addCollaboratorMilestone:    (projectId: string, collabName: string, missionId: string, milestone: MissionMilestone) => void;
  removeCollaboratorMilestone: (projectId: string, collabName: string, missionId: string, milestoneId: string) => void;
  addCollaboratorMission:    (projectId: string, collabName: string, mission: CollaboratorMission) => void;
  removeCollaboratorMission: (projectId: string, collabName: string, missionId: string) => void;
  updateCollaboratorMilestone: (projectId: string, collabName: string, missionId: string, milestoneId: string, updates: Partial<MissionMilestone>) => void;
  addGanttTask:    (projectId: string, task: ProjectGanttTask) => void;
  updateGanttTask: (projectId: string, task: ProjectGanttTask) => void;
  removeGanttTask: (projectId: string, taskId: string) => void;
  importGanttTasks:(projectId: string, tasks: ProjectGanttTask[]) => void;
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

  const updateCollaboratorMilestoneStatus = useCallback((
    projectId: string,
    collabName: string,
    missionId: string,
    milestoneId: string,
    status: MissionMilestone["status"]
  ): void => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const updated: Project = {
          ...p,
          collaborators: p.collaborators.map(c => {
            if (c.name !== collabName) return c;
            return {
              ...c,
              missions: (c.missions ?? []).map(m => {
                if (m.id !== missionId) return m;
                return {
                  ...m,
                  milestones: m.milestones.map(ms =>
                    ms.id === milestoneId ? { ...ms, status } : ms
                  ),
                };
              }),
            };
          }),
        };
        saveProject(updated);
        return updated;
      })
    );
  }, []);

  const addCollaboratorMilestone = useCallback((
    projectId: string,
    collabName: string,
    missionId: string,
    milestone: MissionMilestone
  ): void => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const updated: Project = {
          ...p,
          collaborators: p.collaborators.map(c => {
            if (c.name !== collabName) return c;
            return {
              ...c,
              missions: (c.missions ?? []).map(m => {
                if (m.id !== missionId) return m;
                return { ...m, milestones: [...m.milestones, milestone] };
              }),
            };
          }),
        };
        saveProject(updated);
        return updated;
      })
    );
  }, []);

  const removeCollaboratorMilestone = useCallback((
    projectId: string,
    collabName: string,
    missionId: string,
    milestoneId: string
  ): void => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const updated: Project = {
          ...p,
          collaborators: p.collaborators.map(c => {
            if (c.name !== collabName) return c;
            return {
              ...c,
              missions: (c.missions ?? []).map(m => {
                if (m.id !== missionId) return m;
                return {
                  ...m,
                  milestones: m.milestones.filter(ms => ms.id !== milestoneId),
                };
              }),
            };
          }),
        };
        saveProject(updated);
        return updated;
      })
    );
  }, []);

  const updateCollaboratorMilestone = useCallback((
    projectId: string,
    collabName: string,
    missionId: string,
    milestoneId: string,
    updates: Partial<MissionMilestone>
  ): void => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const updated: Project = {
          ...p,
          collaborators: p.collaborators.map(c => {
            if (c.name !== collabName) return c;
            return {
              ...c,
              missions: (c.missions ?? []).map(m => {
                if (m.id !== missionId) return m;
                return {
                  ...m,
                  milestones: m.milestones.map(ms =>
                    ms.id === milestoneId ? { ...ms, ...updates } : ms
                  ),
                };
              }),
            };
          }),
        };
        saveProject(updated);
        return updated;
      })
    );
  }, []);

  const addCollaboratorMission = useCallback((
    projectId: string,
    collabName: string,
    mission: CollaboratorMission
  ): void => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const updated: Project = {
          ...p,
          collaborators: p.collaborators.map(c => {
            if (c.name !== collabName) return c;
            return { ...c, missions: [...(c.missions ?? []), mission] };
          }),
        };
        saveProject(updated);
        return updated;
      })
    );
  }, []);

  const removeCollaboratorMission = useCallback((
    projectId: string,
    collabName: string,
    missionId: string
  ): void => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;
        const updated: Project = {
          ...p,
          collaborators: p.collaborators.map(c => {
            if (c.name !== collabName) return c;
            return { ...c, missions: (c.missions ?? []).filter(m => m.id !== missionId) };
          }),
        };
        saveProject(updated);
        return updated;
      })
    );
  }, []);

  const addGanttTask = useCallback((projectId: string, task: ProjectGanttTask): void => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const updated: Project = { ...p, ganttTasks: [...(p.ganttTasks ?? []), task] };
      saveProject(updated);
      return updated;
    }));
  }, []);

  const updateGanttTask = useCallback((projectId: string, task: ProjectGanttTask): void => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const updated: Project = {
        ...p,
        ganttTasks: (p.ganttTasks ?? []).map(t => t.id === task.id ? task : t),
      };
      saveProject(updated);
      return updated;
    }));
  }, []);

  const removeGanttTask = useCallback((projectId: string, taskId: string): void => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const updated: Project = {
        ...p,
        ganttTasks: (p.ganttTasks ?? []).filter(t => t.id !== taskId),
      };
      saveProject(updated);
      return updated;
    }));
  }, []);

  const importGanttTasks = useCallback((projectId: string, tasks: ProjectGanttTask[]): void => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const updated: Project = {
        ...p,
        ganttTasks: [...(p.ganttTasks ?? []), ...tasks],
      };
      saveProject(updated);
      return updated;
    }));
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
      updateCollaboratorMilestoneStatus,
      addCollaboratorMilestone,
      removeCollaboratorMilestone,
      addCollaboratorMission,
      removeCollaboratorMission,
      updateCollaboratorMilestone,
      addGanttTask,
      updateGanttTask,
      removeGanttTask,
      importGanttTasks,
    }}>
      {children}
    </ProjectsContext.Provider>
  );
};
