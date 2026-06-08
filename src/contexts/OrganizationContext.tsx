import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ServiceItem } from "@/data/departments";
import { preloadAllData } from "@/hooks/useDataPreloader";

type UntypedRpc = (fn: string, params: Record<string, unknown>) => Promise<{ error: Error | null }>;

export interface FutureDirection {
  name: string;
  responsible: string;
  role: string;
}

export interface Organization {
  name: string;
  titleToday: string;
  titleTomorrow: string;
  descriptionToday: string;
  descriptionTomorrow: string;
  leader: string;
  leaderDirection: string;
  leaderRoleToday: string;
  leaderRoleTomorrow: string;
  nameChangesTomorrow: boolean;
  newName: string;
  decomposesTomorrow: boolean;
  futureDirections: FutureDirection[];
  standaloneServices: ServiceItem[];
  fridayDeadlineEnabled: boolean;
  securityAcknowledgedAt: string | null;
}

const defaultOrg: Organization = {
  name: "",
  titleToday: "",
  titleTomorrow: "",
  descriptionToday: "",
  descriptionTomorrow: "",
  leader: "",
  leaderDirection: "",
  leaderRoleToday: "",
  leaderRoleTomorrow: "",
  nameChangesTomorrow: false,
  newName: "",
  decomposesTomorrow: false,
  futureDirections: [],
  standaloneServices: [],
  fridayDeadlineEnabled: false,
  securityAcknowledgedAt: null,
};

interface OrganizationContextType {
  organization: Organization;
  updateOrganization: (org: Organization) => void;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export const useOrganization = () => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be inside OrganizationProvider");
  return ctx;
};

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const [organization, setOrganization] = useState<Organization>(defaultOrg);

  useEffect(() => {
    preloadAllData().then(cached => {
      if (cached.organization) {
        setOrganization(cached.organization as unknown as Organization);
      }
    });
  }, []);

  const updateOrganization = useCallback((org: Organization) => {
    setOrganization(org);
    supabase.from("app_organization").upsert({ id: "main", data: org as unknown as Json }).then(({ error }) => {
      if (error?.code === "42501" || error?.message?.includes("row-level security")) {
        const rpc = supabase.rpc as unknown as UntypedRpc;
        rpc("log_security_violation", {
          _violation_type: "rls_bypass_attempt",
          _target_table: "app_organization",
          _target_action: "upsert",
          _details: { error: error.message },
        });
      }
    });
  }, []);

  return (
    <OrganizationContext.Provider value={{ organization, updateOrganization }}>
      {children}
    </OrganizationContext.Provider>
  );
};
