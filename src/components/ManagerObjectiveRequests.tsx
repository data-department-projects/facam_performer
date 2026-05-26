import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { logObjectiveChangeAudit } from "@/hooks/useObjectiveAuditLog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, FileText, Trash2, Pencil, Send, ArrowRight, Filter } from "lucide-react";
import { OBJECTIVE_CATEGORIES } from "@/hooks/useObjectives";

interface ObjectiveChangeRequest {
  id: string;
  user_id: string;
  objective_id: string;
  request_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  explanation: string;
  status: string;
  manager_status: string;
  manager_comment: string | null;
  manager_reviewed_by: string | null;
  manager_reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Titre",
  description: "Description",
  category: "Catégorie",
  deadline: "Date d'échéance",
  kpi_target: "Objectif chiffré",
  kpi_unit: "Unité KPI",
};

const getCategoryLabel = (val: string) =>
  OBJECTIVE_CATEGORIES.find(c => c.value === val)?.label || val;

const formatDisplayValue = (field: string, value: string | null) => {
  if (!value) return "—";
  if (field === "category") return getCategoryLabel(value);
  return value;
};

const ManagerObjectiveRequests = () => {
  const { user, isAdmin } = useAuth();
  const profiles = useProfiles();
  const [requests, setRequests] = useState<ObjectiveChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);
    const subordinateIds = profiles
      .filter(p => p.hierarchy_user_id === user.id)
      .map(p => p.user_id);

    if (subordinateIds.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Admin uses service-level access, but we query client-side
    const { data, error } = await supabase
      .from("objective_change_requests")
      .select("*")
      .in("user_id", subordinateIds)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data as unknown as ObjectiveChangeRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (profiles.length > 0) fetchRequests();
  }, [user, profiles]);

  const getProfileName = (userId: string) =>
    profiles.find(p => p.user_id === userId)?.full_name || "—";

  // Group requests by objective_id + explanation + time
  const groupedRequests = useMemo(() => {
    const groups: { key: string; reqs: ObjectiveChangeRequest[]; userId: string; objectiveId: string; createdAt: string; explanation: string; managerStatus: string; status: string; managerComment: string | null; isDelete: boolean }[] = [];
    const buckets = new Map<string, ObjectiveChangeRequest[]>();

    for (const req of requests) {
      const timeKey = req.created_at.substring(0, 16);
      const key = `${req.objective_id}_${req.explanation}_${timeKey}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(req);
    }

    for (const [key, reqs] of buckets) {
      const first = reqs[0];
      groups.push({
        key,
        reqs,
        userId: first.user_id,
        objectiveId: first.objective_id,
        createdAt: first.created_at,
        explanation: first.explanation,
        managerStatus: first.manager_status,
        status: first.status,
        managerComment: first.manager_comment,
        isDelete: first.request_type === "deletion",
      });
    }
    return groups;
  }, [requests]);

  const handleManagerReview = async (group: typeof groupedRequests[0], status: "approved" | "rejected") => {
    if (!user) return;
    const comment = comments[group.key] || "";

    for (const req of group.reqs) {
      const updatePayload: any = {
        manager_status: status,
        manager_reviewed_by: user.id,
        manager_reviewed_at: new Date().toISOString(),
        manager_comment: comment || null,
      };

      if (status === "rejected") {
        updatePayload.status = "rejected";
        updatePayload.reviewed_by = user.id;
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.review_comment = `Refusé par le manager: ${comment || "Aucun commentaire"}`;
      }

      // If admin (DG) is reviewing, also apply directly (DG = manager + DG combined)
      if (isAdmin && status === "approved") {
        updatePayload.status = "approved";
        updatePayload.reviewed_by = user.id;
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.review_comment = comment || null;

        // Apply the change
        if (req.request_type === "deletion") {
          await supabase.from("objectives").delete().eq("id", req.objective_id);
        } else if (req.request_type === "modification" && req.field_name && req.new_value !== null) {
          await supabase.from("objectives").update({ [req.field_name]: req.new_value } as any).eq("id", req.objective_id);
        }
      }

      await supabase
        .from("objective_change_requests")
        .update(updatePayload)
        .eq("id", req.id);

      await logObjectiveChangeAudit({
        change_request_id: req.id,
        objective_id: req.objective_id,
        user_id: req.user_id,
        action: isAdmin
          ? (status === "approved" ? "dg_approved" : "dg_rejected")
          : (status === "approved" ? "manager_approved" : "manager_rejected"),
        actor_id: user.id,
        actor_role: isAdmin ? "dg" : "manager",
        details: { manager_comment: comment || null, applied: isAdmin && status === "approved" },
      });
    }

    // Restore objective status to "validated" after review (was set to pending_validation during request)
    const firstReq = group.reqs[0];
    if (status === "rejected") {
      // Rejected: restore to validated
      await supabase.from("objectives").update({ status: "validated" } as any).eq("id", firstReq.objective_id);
    } else if (isAdmin && status === "approved") {
      // DG approved & applied changes: restore to validated
      await supabase.from("objectives").update({ status: "validated" } as any).eq("id", firstReq.objective_id);
    }
    // If non-admin manager approved, keep pending_validation until DG decides

    if (isAdmin) {
      toast.success(
        status === "approved"
          ? "Demande approuvée et modifications appliquées"
          : "Demande refusée"
      );
    } else {
      toast.success(
        status === "approved"
          ? "Demande approuvée et transmise au Directeur Général"
          : "Demande refusée"
      );
    }
    fetchRequests();
  };

  const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
    pending: { label: "En attente", icon: Clock, color: "bg-amber-100 text-amber-800" },
    approved: { label: isAdmin ? "Approuvée & Appliquée" : "Approuvée (transmise au DG)", icon: isAdmin ? CheckCircle2 : Send, color: isAdmin ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800" },
    rejected: { label: "Refusée", icon: XCircle, color: "bg-red-100 text-red-800" },
  };

  // For determining which status to show
  const getGroupDisplayStatus = (group: typeof groupedRequests[0]) => {
    // If final status is set (approved/rejected by DG or by admin directly)
    if (group.status !== "pending") return group.status;
    // Otherwise show manager status
    return group.managerStatus;
  };

  const pendingCount = groupedRequests.filter(g => {
    if (isAdmin) return g.status === "pending" && g.managerStatus === "pending";
    return g.managerStatus === "pending";
  }).length;

  const isPendingForCurrentUser = (group: typeof groupedRequests[0]) => {
    if (isAdmin) return group.status === "pending" && group.managerStatus === "pending";
    return group.managerStatus === "pending";
  };

  const filteredGroups = useMemo(() => {
    if (statusFilter === "all") return groupedRequests;
    return groupedRequests.filter(g => {
      const ds = getGroupDisplayStatus(g);
      return ds === statusFilter;
    });
  }, [groupedRequests, statusFilter]);

  const FILTER_TABS: { value: "all" | "pending" | "approved" | "rejected"; label: string }[] = [
    { value: "all", label: "Toutes" },
    { value: "pending", label: "En attente" },
    { value: "approved", label: "Approuvées" },
    { value: "rejected", label: "Refusées" },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Demandes de modification {isAdmin ? "des collaborateurs" : "de vos collaborateurs"}
          {pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 text-[10px]">{pendingCount} en attente</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1 mt-2">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chargement...</p>
        ) : filteredGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {statusFilter === "all" ? "Aucune demande de modification" : `Aucune demande ${statusFilter === "approved" ? "approuvée" : statusFilter === "rejected" ? "refusée" : "en attente"}`}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map(group => {
              const displayStatus = getGroupDisplayStatus(group);
              const cfg = statusConfig[displayStatus] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              const isPending = isPendingForCurrentUser(group);

              return (
                <Card key={group.key} className={`transition-shadow ${isPending ? "border-amber-300" : ""}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className={`${cfg.color} text-[10px]`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {group.isDelete ? <><Trash2 className="w-3 h-3" /> Suppression</> : <><Pencil className="w-3 h-3" /> Modification ({group.reqs.length} champ{group.reqs.length > 1 ? "s" : ""})</>}
                      </Badge>
                      <span className="text-xs font-semibold">{getProfileName(group.userId)}</span>
                    </div>

                    {/* Show old vs new for each field */}
                    {!group.isDelete && (
                      <div className="bg-muted/50 rounded-lg p-2.5 space-y-2">
                        {group.reqs.map(req => (
                          <div key={req.id} className="text-xs flex items-start gap-2">
                            <span className="font-semibold min-w-[100px] text-muted-foreground">
                              {FIELD_LABELS[req.field_name || ""] || req.field_name}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[10px] font-normal bg-red-50 text-red-700 line-through">
                                {formatDisplayValue(req.field_name || "", req.old_value)}
                              </Badge>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <Badge variant="outline" className="text-[10px] font-normal bg-green-50 text-green-700">
                                {formatDisplayValue(req.field_name || "", req.new_value)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs"><span className="font-semibold">Explication :</span> {group.explanation}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Demandé le {format(new Date(group.createdAt), "dd/MM/yyyy à HH:mm", { locale: fr })}
                    </p>

                    {group.managerComment && !isPending && (
                      <p className="text-xs text-muted-foreground italic">
                        {isAdmin ? "Votre décision" : "Votre commentaire"} : {group.managerComment}
                      </p>
                    )}

                    {/* Show final DG status for non-admin managers */}
                    {!isAdmin && group.managerStatus === "approved" && group.status !== "pending" && (
                      <Badge variant="secondary" className={`text-[10px] ${group.status === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        DG : {group.status === "approved" ? "Approuvée ✓" : "Refusée ✗"}
                      </Badge>
                    )}

                    {isPending && (
                      <div className="space-y-2 border-t border-border pt-2">
                        <Textarea
                          value={comments[group.key] || ""}
                          onChange={e => setComments(prev => ({ ...prev, [group.key]: e.target.value }))}
                          placeholder="Votre commentaire (optionnel)..."
                          className="min-h-[50px] text-xs"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="text-xs gap-1"
                            onClick={() => handleManagerReview(group, "rejected")}
                          >
                            <XCircle className="w-3 h-3" /> Refuser
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs gap-1"
                            onClick={() => handleManagerReview(group, "approved")}
                          >
                            {isAdmin ? (
                              <><CheckCircle2 className="w-3 h-3" /> Approuver & Appliquer</>
                            ) : (
                              <><Send className="w-3 h-3" /> Approuver & Transmettre au DG</>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ManagerObjectiveRequests;
