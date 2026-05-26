import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChangeRequestSummary {
  objective_id: string;
  status: string;           // "pending" | "approved" | "rejected"
  manager_status: string;   // "pending" | "approved" | "rejected"
  request_type: string;
  field_name: string | null;
  explanation: string;
  review_comment: string | null;
  manager_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/**
 * Fetches all change requests for a given set of objective IDs.
 * Returns a map: objectiveId -> latest requests summary
 */
export const useObjectiveChangeRequests = (objectiveIds: string[]) => {
  const [requestsByObjective, setRequestsByObjective] = useState<Record<string, ChangeRequestSummary[]>>({});
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (objectiveIds.length === 0) {
      setRequestsByObjective({});
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("objective_change_requests")
      .select("objective_id, status, manager_status, request_type, field_name, explanation, review_comment, manager_comment, created_at, reviewed_at")
      .in("objective_id", objectiveIds)
      .order("created_at", { ascending: false });

    const map: Record<string, ChangeRequestSummary[]> = {};
    (data || []).forEach((r: any) => {
      if (!map[r.objective_id]) map[r.objective_id] = [];
      map[r.objective_id].push(r);
    });
    setRequestsByObjective(map);
    setLoading(false);
  }, [objectiveIds.join(",")]);

  useEffect(() => { fetch(); }, [fetch]);

  return { requestsByObjective, loading, refetch: fetch };
};

/**
 * Returns the most relevant status for display:
 * - If any request is pending -> "pending"
 * - If latest batch was approved -> "approved"
 * - If latest batch was rejected -> "rejected"
 * - null if no requests
 */
export const getChangeRequestStatus = (requests: ChangeRequestSummary[] | undefined): {
  status: "pending" | "approved" | "rejected" | null;
  latestRequests: ChangeRequestSummary[];
} => {
  if (!requests || requests.length === 0) return { status: null, latestRequests: [] };
  
  const hasPending = requests.some(r => r.status === "pending");
  if (hasPending) {
    return { status: "pending", latestRequests: requests.filter(r => r.status === "pending") };
  }

  // Get latest batch (same created_at group)
  const latest = requests[0];
  const latestBatch = requests.filter(r => r.created_at === latest.created_at);
  
  return {
    status: latest.status as "approved" | "rejected",
    latestRequests: latestBatch,
  };
};
