import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, XCircle, Clock, FileText } from "lucide-react";

interface ModificationRequest {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  project_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  explanation: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
}

const AdminModificationRequests = () => {
  const { user, isAdmin } = useAuth();
  const { projects, updateProject } = useProjects();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ModificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("modification_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data as ModificationRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchRequests();
  }, [isAdmin]);

  const handleReview = async (reqId: string, status: "approved" | "rejected") => {
    if (!user) return;
    const comment = reviewComments[reqId] || "";
    
    const { error } = await supabase
      .from("modification_requests")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_comment: comment || null,
      })
      .eq("id", reqId);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de traiter la demande", variant: "destructive" });
      return;
    }

    // If approved, apply the modification
    if (status === "approved") {
      const req = requests.find(r => r.id === reqId);
      if (req) {
        const project = projects.find(p => p.id === req.project_id);
        if (project) {
          if (req.entity_type === "project") {
            updateProject({ ...project, [req.field_name]: req.new_value });
          } else if (req.entity_type === "milestone") {
            updateProject({
              ...project,
              milestones: project.milestones.map(m =>
                m.id === req.entity_id ? { ...m, [req.field_name]: req.new_value } : m
              ),
            });
          }
        }
      }
    }

    toast({
      title: status === "approved" ? "Modification approuvée ✓" : "Modification refusée",
      description: status === "approved" ? "La modification a été appliquée." : "La demande a été refusée.",
    });
    fetchRequests();
  };

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || projectId;
  };

  const statusConfig = {
    pending: { label: "En attente", icon: Clock, color: "bg-amber-100 text-amber-800" },
    approved: { label: "Approuvée", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
    rejected: { label: "Refusée", icon: XCircle, color: "bg-red-100 text-red-800" },
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-xl">Demandes de modification</h2>
        <p className="text-sm text-muted-foreground">
          Validez ou refusez les demandes de modification des responsables
          {pendingCount > 0 && <Badge className="ml-2 bg-amber-100 text-amber-800">{pendingCount} en attente</Badge>}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Chargement...</p>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune demande de modification</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const cfg = statusConfig[req.status];
            const StatusIcon = cfg.icon;
            return (
              <Card key={req.id} className={`transition-shadow ${req.status === "pending" ? "border-amber-300" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={cfg.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <span className="text-xs font-semibold">{getProjectName(req.project_id)}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {req.entity_type === "project" ? "Projet" : "Jalon"}
                        </Badge>
                      </div>
                      <div className="bg-muted/50 rounded p-2 text-xs space-y-0.5">
                        <p><span className="font-semibold">Champ :</span> {req.field_name}</p>
                        <p><span className="font-semibold">Avant :</span> {req.old_value || "—"}</p>
                        <p><span className="font-semibold">Après :</span> {req.new_value || "—"}</p>
                      </div>
                      <p className="text-xs"><span className="font-semibold">Explication :</span> {req.explanation}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Demandé le {format(new Date(req.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                      </p>
                      {req.review_comment && (
                        <p className="text-xs text-muted-foreground italic">Commentaire DG : {req.review_comment}</p>
                      )}
                    </div>
                  </div>

                  {req.status === "pending" && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <Textarea
                        value={reviewComments[req.id] || ""}
                        onChange={e => setReviewComments(prev => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder="Commentaire (optionnel)..."
                        className="min-h-[60px] text-xs"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => handleReview(req.id, "rejected")}
                        >
                          <XCircle className="w-3 h-3" /> Refuser
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => handleReview(req.id, "approved")}
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

export default AdminModificationRequests;
