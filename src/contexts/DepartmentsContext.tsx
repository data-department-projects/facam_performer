import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { Department } from "@/data/departments";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { preloadAllData } from "@/hooks/useDataPreloader";

type UntypedRpc = (fn: string, params: Record<string, unknown>) => Promise<{ error: Error | null }>;

interface DepartmentsContextType {
  departments: Department[];
  updateDepartment: (updated: Department) => void;
  addDepartment: (dept: Department) => void;
  deleteDepartment: (id: string) => void;
  deleteAllDepartments: () => void;
}

const DepartmentsContext = createContext<DepartmentsContextType | null>(null);

export const useDepartments = () => {
  const ctx = useContext(DepartmentsContext);
  if (!ctx) throw new Error("useDepartments must be inside DepartmentsProvider");
  return ctx;
};

export const DepartmentsProvider = ({ children }: { children: ReactNode }) => {
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    preloadAllData().then(cached => {
      if (cached.departments) {
        setDepartments(cached.departments.map(row => ({ ...(row.data as unknown as Department), id: row.id })));
      }
    });
  }, []);

  const saveDept = async (dept: Department) => {
    const { id, ...rest } = dept;
    const { error } = await supabase.from("app_departments").upsert({ id, data: rest as unknown as Json });
    if (error?.code === "42501" || error?.message?.includes("row-level security")) {
      const rpc = supabase.rpc as unknown as UntypedRpc;
      await rpc("log_security_violation", {
        _violation_type: "rls_bypass_attempt",
        _target_table: "app_departments",
        _target_action: "upsert",
        _details: { department_id: id, error: error.message },
      });
    }
  };

  const updateDepartment = useCallback((updated: Department) => {
    setDepartments(prev => prev.map(d => d.id === updated.id ? updated : d));
    saveDept(updated);
  }, []);

  const addDepartment = useCallback((dept: Department) => {
    setDepartments(prev => [...prev, dept]);
    saveDept(dept);
  }, []);

  const deleteDepartment = useCallback((id: string) => {
    setDepartments(prev => prev.filter(d => d.id !== id));
    supabase.from("app_departments").delete().eq("id", id).then();
  }, []);

  const deleteAllDepartments = useCallback(() => {
    setDepartments(prev => {
      prev.forEach(d => supabase.from("app_departments").delete().eq("id", d.id).then());
      return [];
    });
  }, []);

  return (
    <DepartmentsContext.Provider value={{ departments, updateDepartment, addDepartment, deleteDepartment, deleteAllDepartments }}>
      {children}
    </DepartmentsContext.Provider>
  );
};
