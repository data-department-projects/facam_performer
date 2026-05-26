export interface ServiceItem {
  name: string;
  responsible?: string;
  responsible2?: string;
  members?: string[];
}

export interface TeamMember {
  name: string;
  role: string;
  services?: string[];
}

export interface Milestone {
  quarter: string;
  title: string;
  description: string;
  status: "done" | "in-progress" | "planned";
}

export interface FutureDepartment {
  name: string;
  role: string;
  responsible: string;
  icon?: string;
  services?: string[];
}

export interface Department {
  id: string;
  name: string;
  nameTomorrow: string;
  nameChangesTomorrow: boolean;
  decomposesTomorrow: boolean;
  futureDepartments: FutureDepartment[];
  newDirectionName: string;
  icon: string;
  color: string;
  head: string;
  head2?: string;
  headRoleToday: string;
  headRoleToday2?: string;
  headRoleTomorrow: string;
  missionToday: string;
  missionTomorrow: string;
  services: ServiceItem[];
  compositionToday: TeamMember[];
  compositionTomorrow: TeamMember[];
  milestones2026: Milestone[];
  milestones2027: Milestone[];
  visibleOnOrgChart?: boolean;
}

export const departments: Department[] = [];

const DEFAULT_NAMES = ["Nouvelle Direction", ""];

/** Returns the best display name for a department, ignoring default placeholder values. */
export const getDepartmentDisplayName = (dept: { name: string; nameTomorrow?: string } | undefined | null): string => {
  if (!dept) return "";
  const tomorrow = dept.nameTomorrow?.trim();
  if (tomorrow && !DEFAULT_NAMES.includes(tomorrow)) return tomorrow;
  return dept.name || "";
};
