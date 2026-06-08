import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { Committee } from "@/data/committees";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { preloadAllData } from "@/hooks/useDataPreloader";

type UntypedRpc = (fn: string, params: Record<string, unknown>) => Promise<{ error: Error | null }>;

interface CommitteesContextType {
  committees: Committee[];
  updateCommittee: (updated: Committee) => void;
  addCommittee: (c: Committee) => void;
  deleteCommittee: (id: string) => void;
}

const CommitteesContext = createContext<CommitteesContextType | null>(null);

export const useCommittees = () => {
  const ctx = useContext(CommitteesContext);
  if (!ctx) throw new Error("useCommittees must be inside CommitteesProvider");
  return ctx;
};

export const CommitteesProvider = ({ children }: { children: ReactNode }) => {
  const [committees, setCommittees] = useState<Committee[]>([]);

  useEffect(() => {
    preloadAllData().then(cached => {
      if (cached.committees) {
        setCommittees(cached.committees.map(row => ({ ...(row.data as unknown as Committee), id: row.id })));
      }
    });
  }, []);

  const saveCommittee = async (c: Committee) => {
    const { id, ...rest } = c;
    const { error } = await supabase.from("app_committees").upsert({ id, data: rest as unknown as Json });
    if (error?.code === "42501" || error?.message?.includes("row-level security")) {
      const rpc = supabase.rpc as unknown as UntypedRpc;
      await rpc("log_security_violation", {
        _violation_type: "rls_bypass_attempt",
        _target_table: "app_committees",
        _target_action: "upsert",
        _details: { committee_id: id, error: error.message },
      });
    }
  };

  const updateCommittee = useCallback((updated: Committee) => {
    setCommittees(prev => prev.map(c => c.id === updated.id ? updated : c));
    saveCommittee(updated);
  }, []);

  const addCommittee = useCallback((c: Committee) => {
    setCommittees(prev => [...prev, c]);
    saveCommittee(c);
  }, []);

  const deleteCommittee = useCallback((id: string) => {
    setCommittees(prev => prev.filter(c => c.id !== id));
    supabase.from("app_committees").delete().eq("id", id).then();
  }, []);

  return (
    <CommitteesContext.Provider value={{ committees, updateCommittee, addCommittee, deleteCommittee }}>
      {children}
    </CommitteesContext.Provider>
  );
};
