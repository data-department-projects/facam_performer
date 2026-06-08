export interface Deliverable {
  id: string;
  submittedBy: string;
  link: string;
  submittedAt: string; // ISO date
}

export interface ProjectMilestone {
  id: string;
  quarter: string;
  title: string;
  description: string;
  status: "done" | "in-progress" | "planned";
  deadline?: string; // ISO date string
  deadlineLocked?: boolean; // true after first modification
  deliverables?: Deliverable[];
  createdAt?: string; // ISO date string - date de création
}

export interface MissionMilestone {
  id: string;
  title: string;
  quarter: string;
  status: "done" | "in-progress" | "planned";
  deadline?: string;
  deliverables?: Deliverable[];
}

export interface CollaboratorMission {
  id: string;
  title: string;
  description?: string;
  milestones: MissionMilestone[];
}

export interface ProjectCollaborator {
  name: string;
  role: string;
  department?: string;
  missions?: CollaboratorMission[];
}

export interface TimeEntry {
  id: string;
  projectId: string;
  taskId?: string;
  taskTitle?: string;
  collaboratorName: string;
  date: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  createdAt: string;
  comment?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  objective: string;
  projectLead: string[];
  departmentIds: string[];
  responsibles: string[];
  collaborators: ProjectCollaborator[];
  color: string;
  milestones: ProjectMilestone[];
  status?: string;
  createdAt?: string; // ISO date string - date de création
  isNew?: boolean; // true until first save, allows free editing
}

export const projects: Project[] = [];
