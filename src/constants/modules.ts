/**
 * Modules de la plateforme FACAM PERFORMER.
 * Source de vérité unique — utilisée dans AuthContext et partout où
 * la liste des modules doit être référencée.
 */

export const ADMIN_MODULES = [
  "dashboard",
  "orgchart",
  "roadmap",
  "gantt",
  "comites",
  "projects",
  "projectscomites",
  "search",
  "timeentry",
  "admin",
  "etpadmin",
  "reports",
  "hrperformance",
  "dept_objectives",
  "project_costs",
  "weekly_analysis",
  "badgemanagement",
] as const;

export type ModuleKey = (typeof ADMIN_MODULES)[number];

export const OBJECTIVE_CATEGORIES = [
  { value: "performance",    label: "Performance" },
  { value: "development",    label: "Développement" },
  { value: "leadership",     label: "Leadership" },
  { value: "innovation",     label: "Innovation" },
  { value: "collaboration",  label: "Collaboration" },
  { value: "general",        label: "Général" },
] as const;

export type ObjectiveCategory = (typeof OBJECTIVE_CATEGORIES)[number]["value"];
