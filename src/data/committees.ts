export interface CommitteeMember {
  name: string;
  role: string;
  departmentId?: string;
}

export interface CommitteeMeeting {
  id: string;
  date: string;
  time?: string;
  time_end?: string;
  link: string;
  institution?: string;
}

export interface Committee {
  id: string;
  name: string;
  icon: string;
  purpose: string;
  responsible: string;
  responsibleIds?: string[];
  frequency: "hebdomadaire" | "bimensuel" | "mensuel" | "trimestriel" | "semestriel" | "annuel" | "ponctuel";
  linkedDepartmentIds: string[];
  members: CommitteeMember[];
  guests?: string[];
  institutions?: string[];
  meetings?: CommitteeMeeting[];
}

export const frequencyLabels: Record<Committee["frequency"], string> = {
  hebdomadaire: "Hebdomadaire",
  bimensuel: "Bimensuel",
  mensuel: "Mensuel",
  trimestriel: "Trimestriel",
  semestriel: "Semestriel",
  annuel: "Annuel",
  ponctuel: "Ponctuel",
};

export const committees: Committee[] = [];
