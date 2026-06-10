import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { logObjectiveChangeAudit } from "@/hooks/useObjectiveAuditLog";
import { fr } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, FileText, Trash2, Pencil, ArrowRight, ShieldAlert, type LucideIcon } from "lucide-react";
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
  manager_status: string | null;
  manager_comment: string | null;
  manager_reviewed_by: string | null;
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

const AdminObjectiveRequests = () => {
  const { user } = useAuth();
  const profiles = useProfiles();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ObjectiveChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  const fetchRequests = async () => {
    setLoading(true);
    // Fetch ALL requests (no manager_status filter)
    const { data, error } = await supabase
      .from("objective_change_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setRequests(data as unknown as ObjectiveChangeRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const getProfileName = (userId: string) =>
    profiles.find(p => p.user_id === userId)?.full_name || "—";

  // Check if a collaborator is a direct subordinate of the DG
  const isDirectSubordinate = (userId: string) => {
    if (!user) return false;
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.hierarchy_user_id === user.id;
  };

  // Group requests by objective + explanation + time
  const groupedRequests = useMemo(() => {
    const groups: { key: string; reqs: ObjectiveChangeRequest[]; userId: string; objectiveId: string; createdAt: string; explanation: string; status: string; managerStatus: string | null; managerComment: string | null; managerReviewedBy: string | null; isDelete: boolean }[] = [];
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
        status: first.status,
        managerStatus: first.manager_status,
        managerComment: first.manager_comment,
        managerReviewedBy: first.manager_reviewed_by,
        isDelete: first.request_type === "deletion",
      });
    }
    return groups;
  }, [requests]);

  // Can the DG act on this group?
  const canDGAct = (group: typeof groupedRequests[0]) => {
    if (group.status !== "pending") return false;
    // Direct subordinate of DG: DG can act directly
    if (isDirectSubordinate(group.userId)) return true;
    // Non-direct: must wait for manager approval
    return group.managerStatus === "approved";
  };

  const handleReview = async (group: typeof groupedRequests[0], status: "approved" | "rejected") => {
    if (!user) return;
    const comment = reviewComments[group.key] || "";
    const isDirect = isDirectSubordinate(group.userId);

    for (const req of group.reqs) {
      const updatePayload: Record<string, unknown> = {
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_comment: comment || null,
      };

      // For direct subordinates, also set manager_status
      if (isDirect && req.manager_status !== "approved") {
        updatePayload.manager_status = status;
        updatePayload.manager_reviewed_by = user.id;
        updatePayload.manager_reviewed_at = new Date().toISOString();
        updatePayload.manager_comment = comment || null;
      }

      const { error } = await supabase
        .from("objective_change_requests")
        .update(updatePayload as import("@/integrations/supabase/types").Database["public"]["Tables"]["objective_change_requests"]["Update"])
        .eq("id", req.id);

      if (error) {
        toast({ title: "Erreur", description: "Impossible de traiter la demande", variant: "destructive" });
        return;
      }

      // If approved, apply the change
      if (status === "approved") {
        if (req.request_type === "deletion") {
          await supabase.from("objectives").delete().eq("id", req.objective_id);
        } else if (req.request_type === "modification" && req.field_name && req.new_value !== null) {
          await supabase.from("objectives").update({ [req.field_name]: req.new_value } as import("@/integrations/supabase/types").Database["public"]["Tables"]["objectives"]["Update"]).eq("id", req.objective_id);
        }
      }

      await logObjectiveChangeAudit({
        change_request_id: req.id,
        objective_id: req.objective_id,
        user_id: req.user_id,
        action: status === "approved" ? "dg_approved" : "dg_rejected",
        actor_id: user.id,
        actor_role: "dg",
        details: { review_comment: comment || null, applied: status === "approved" },
      });
    }

    // Restore objective status to "validated" after DG review
    const firstReq = group.reqs[0];
    await supabase.from("objectives").update({ status: "validated" }).eq("id", firstReq.objective_id);

    toast({
      title: status === "approved" ? "Demande approuvée ✓" : "Demande refusée",
      description: status === "approved" ? "Les modifications ont été appliquées." : "La demande a été refusée.",
    });
    fetchRequests();
  };

  const statusConfig: Record<string, { label: string; icon: LucideIcon; color: string }> = {
    pending: { label: "En attente", icon: Clock, color: "bg-orange-100 text-orange-800" },
    approved: { label: "Approuvée", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
    rejected: { label: "Refusée", icon: XCircle, color: "bg-red-100 text-red-800" },
  };

  const pendingCount = groupedRequests.filter(g => canDGAct(g)).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-xl">Demandes de modification d'objectifs</h2>
        <p className="text-sm text-muted-foreground">
          Validez ou refusez les demandes des collaborateurs
          {pendingCount > 0 && <Badge className="ml-2 bg-orange-100 text-orange-800">{pendingCount} à traiter</Badge>}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Chargement...</p>
      ) : groupedRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune demande de modification</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedRequests.map(group => {
            const cfg = statusConfig[group.status] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            const canAct = canDGAct(group);
            const awaitingManager = group.status === "pending" && !isDirectSubordinate(group.userId) && group.managerStatus !== "approved";
            const managerName = (() => {
              const collabProfile = profiles.find(p => p.user_id === group.userId);
              if (!collabProfile?.hierarchy_user_id) return null;
              return getProfileName(collabProfile.hierarchy_user_id);
            })();

            return (
              <Card key={group.key} className={`transition-shadow ${canAct ? "border-orange-300" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={cfg.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        {awaitingManager && (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-orange-50 text-orange-700 border-orange-200">
                            <ShieldAlert className="w-3 h-3" />
                            En attente du manager{managerName ? ` (${managerName})` : ""}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {group.isDelete ? <><Trash2 className="w-3 h-3" /> Suppression</> : <><Pencil className="w-3 h-3" /> Modification ({group.reqs.length} champ{group.reqs.length > 1 ? "s" : ""})</>}
                        </Badge>
                        <span className="text-xs font-semibold">{getProfileName(group.userId)}</span>
                      </div>

                      {/* Old vs new comparison */}
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

                      {group.managerStatus === "approved" && group.managerComment && (
                        <p className="text-xs bg-blue-50 rounded p-1.5 border border-blue-200">
                          <span className="font-semibold">Commentaire Manager :</span> {group.managerComment}
                          {group.managerReviewedBy && (
                            <span className="text-muted-foreground ml-1">— {getProfileName(group.managerReviewedBy)}</span>
                          )}
                        </p>
                      )}

                      {group.managerStatus === "rejected" && (
                        <p className="text-xs bg-red-50 rounded p-1.5 border border-red-200">
                          <span className="font-semibold">Refusé par le manager</span>
                          {group.managerComment && <span> : {group.managerComment}</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {canAct && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <Textarea
                        value={reviewComments[group.key] || ""}
                        onChange={e => setReviewComments(prev => ({ ...prev, [group.key]: e.target.value }))}
                        placeholder="Commentaire (optionnel)..."
                        className="min-h-[60px] text-xs"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => handleReview(group, "rejected")}
                        >
                          <XCircle className="w-3 h-3" /> Refuser
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => handleReview(group, "approved")}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approuver & Appliquer
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
    </div>
  );
};

export default AdminObjectiveRequests;
