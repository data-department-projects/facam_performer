import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import { useProjects } from "@/contexts/ProjectsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, FileText, Calendar, AlertTriangle, CheckCircle2, Clock, User, XCircle, ExternalLink, Eye, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface PendingObjectiveRequest {
  id: string;
  user_id: string;
  request_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  explanation: string;
  manager_status: string;
  created_at: string;
}

interface PendingWeeklyValidation {
  id: string;
  user_id: string;
  week_start: string;
  status: string;
  submitted_at: string | null;
}

interface OverdueItem {
  source: "project" | "weekplanner";
  projectId?: string;
  projectName: string;
  projectColor: string;
  collaborator: string;
  mission: string;
  milestone: string;
  deadline: string;
  daysOverdue: number;
  hasDeliverable: boolean;
  refId?: string;
}

interface Acknowledgement {
  action_type: string;
  action_ref_id: string;
  acknowledged_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Titre",
  description: "Description",
  category: "Catégorie",
  deadline: "Date d'échéance",
  kpi_target: "Objectif chiffré",
  kpi_unit: "Unité KPI",
};

const ManagerActionsView = ({ onNavigate }: { onNavigate?: (view: string) => void }) => {
  const { user, isAdmin } = useAuth();
  const profiles = useProfiles();
  const { projects } = useProjects();
  const [pendingObjectiveRequests, setPendingObjectiveRequests] = useState<PendingObjectiveRequest[]>([]);
  const [pendingWeeklyValidations, setPendingWeeklyValidations] = useState<PendingWeeklyValidation[]>([]);
  const [overdueTodos, setOverdueTodos] = useState<OverdueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgements, setAcknowledgements] = useState<Acknowledgement[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const subordinateIds = useMemo(() => {
    if (!user) return [];
    return profiles.filter(p => p.hierarchy_user_id === user.id).map(p => p.user_id);
  }, [profiles, user]);

  const getProfileName = (userId: string) =>
    profiles.find(p => p.user_id === userId)?.full_name || "Inconnu";

  const fetchAcknowledgements = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("action_acknowledgements")
      .select("action_type, action_ref_id, acknowledged_at")
      .eq("user_id", user.id);
    setAcknowledgements((data as Acknowledgement[]) || []);
  }, [user]);

  const isAcknowledged = useCallback((type: string, refId: string) => {
    return acknowledgements.some(a => a.action_type === type && a.action_ref_id === refId);
  }, [acknowledgements]);

  const handleAcknowledge = async (type: string, refId: string) => {
    if (!user) return;
    await supabase.from("action_acknowledgements").upsert({
      user_id: user.id,
      action_type: type,
      action_ref_id: refId,
    }, { onConflict: "user_id,action_type,action_ref_id" });
    setAcknowledgements(prev => [...prev, { action_type: type, action_ref_id: refId, acknowledged_at: new Date().toISOString() }]);
    toast.success("Notification marquée comme lue");
  };

  useEffect(() => {
    if (!user || subordinateIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    const fetchData = async () => {
      let objQuery = supabase
        .from("objective_change_requests")
        .select("id, user_id, request_type, field_name, old_value, new_value, explanation, manager_status, status, created_at")
        .in("user_id", subordinateIds);
      
      if (isAdmin) {
        objQuery = objQuery.eq("status", "pending");
      } else {
        objQuery = objQuery.eq("manager_status", "pending");
      }

      const [objRes, wpRes] = await Promise.all([
        objQuery,
        supabase
          .from("weekly_planner_status")
          .select("id, user_id, week_start, status, submitted_at")
          .in("user_id", subordinateIds)
          .eq("status", "submitted"),
      ]);
      setPendingObjectiveRequests((objRes.data as PendingObjectiveRequest[]) || []);
      setPendingWeeklyValidations((wpRes.data as PendingWeeklyValidation[]) || []);

      const { data: todosData } = await supabase
        .from("weekly_todos")
        .select("*")
        .in("user_id", subordinateIds)
        .eq("has_deliverable", true)
        .eq("completed", false);

      if (todosData) {
        const now = new Date();
        const todoOverdue: OverdueItem[] = [];
        for (const todo of todosData) {
          const weekStart = new Date(todo.week_start);
          const todoDate = new Date(weekStart);
          todoDate.setDate(todoDate.getDate() + (todo.day_of_week - 1));
          if (todoDate >= now) continue;
          const collabName = getProfileName(todo.user_id);
          const projectName = todo.deliverable_linked_to_project && todo.deliverable_project_id
            ? (projects.find(p => p.id === todo.deliverable_project_id)?.name || "Projet")
            : "Week Planner";
          const projectColor = todo.deliverable_linked_to_project && todo.deliverable_project_id
            ? (projects.find(p => p.id === todo.deliverable_project_id)?.color || "#6b7280")
            : "#6b7280";
          todoOverdue.push({
            source: "weekplanner",
            projectName,
            projectColor,
            collaborator: collabName,
            mission: todo.title || "Tâche",
            milestone: todo.deliverable_name || "Livrable",
            deadline: todoDate.toISOString().split("T")[0],
            daysOverdue: Math.floor((now.getTime() - todoDate.getTime()) / 86400000),
            hasDeliverable: false,
            refId: todo.id,
          });
        }
        setOverdueTodos(todoOverdue);
      }

      setLoading(false);
    };
    fetchData();
  }, [user, subordinateIds, isAdmin, projects]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAcknowledgements(); }, [fetchAcknowledgements]);

  // Overdue items from projects
  const overdueItems = useMemo(() => {
    if (!user) return [];
    const now = new Date();
    const subNames = new Set(subordinateIds.map(id => getProfileName(id)));
    const items: OverdueItem[] = [];
    projects.forEach(proj => {
      (proj.collaborators || []).forEach(c => {
        if (!subNames.has(c.name)) return;
        (c.missions || []).forEach(m => {
          (m.milestones || []).forEach(ms => {
            if (!ms.deadline || ms.status === "done") return;
            const dl = parseISO(ms.deadline);
            if (dl >= now) return;
            items.push({
              source: "project",
              projectId: proj.id,
              projectName: proj.name,
              projectColor: proj.color,
              collaborator: c.name,
              mission: m.title || "Mission sans titre",
              milestone: ms.title,
              deadline: ms.deadline,
              daysOverdue: Math.floor((now.getTime() - dl.getTime()) / 86400000),
              hasDeliverable: (ms.deliverables || []).length > 0,
              refId: `${proj.id}_${c.name}_${ms.title}`,
            });
          });
        });
      });
    });
    const allItems = [...items, ...overdueTodos];
    return allItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [projects, subordinateIds, user, overdueTodos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter active (non-acknowledged) items
  const activeObjectiveRequests = pendingObjectiveRequests.filter(r => !isAcknowledged("objective_request", r.id));
  const activeWeeklyValidations = pendingWeeklyValidations.filter(w => !isAcknowledged("weekly_validation", w.id));
  const activeOverdueItems = overdueItems.filter(o => !isAcknowledged("overdue", o.refId || ""));

  // Acknowledged items for history
  const acknowledgedObjectiveRequests = pendingObjectiveRequests.filter(r => isAcknowledged("objective_request", r.id));
  const acknowledgedWeeklyValidations = pendingWeeklyValidations.filter(w => isAcknowledged("weekly_validation", w.id));
  const acknowledgedOverdueItems = overdueItems.filter(o => isAcknowledged("overdue", o.refId || ""));
  const totalAcknowledged = acknowledgedObjectiveRequests.length + acknowledgedWeeklyValidations.length + acknowledgedOverdueItems.length;

  const totalPending = activeObjectiveRequests.length + activeWeeklyValidations.length;

  if (subordinateIds.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <CheckCircle2 className="w-10 h-10 text-accent" />
        <p className="text-sm text-muted-foreground">Aucun collaborateur sous votre responsabilité.</p>
      </div>
    );
  }

  const DismissButton = ({ type, refId, onDone }: { type: string; refId: string; onDone?: () => void }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-accent"
      title="Marquer comme lu"
      onClick={async (e) => {
        e.stopPropagation();
        await handleAcknowledge(type, refId);
        onDone?.();
      }}
    >
      <Eye className="w-3.5 h-3.5" />
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{activeObjectiveRequests.length}</p>
              <p className="text-[11px] text-muted-foreground">Demandes d'objectifs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card border-l-4 border-l-accent">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{activeWeeklyValidations.length}</p>
              <p className="text-[11px] text-muted-foreground">Plannings à valider</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`shadow-card border-l-4 ${activeOverdueItems.length > 0 ? "border-l-destructive" : "border-l-muted-foreground"}`}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeOverdueItems.length > 0 ? "bg-destructive/10" : "bg-muted/50"}`}>
              <AlertTriangle className={`w-5 h-5 ${activeOverdueItems.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className={`text-2xl font-display font-bold ${activeOverdueItems.length > 0 ? "text-destructive" : ""}`}>{activeOverdueItems.length}</p>
              <p className="text-[11px] text-muted-foreground">Jalons en retard</p>
            </div>
          </CardContent>
        </Card>
        {totalAcknowledged > 0 && (
          <Card className="shadow-card border-l-4 border-l-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setShowHistory(!showHistory)}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
                <History className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-muted-foreground">{totalAcknowledged}</p>
                <p className="text-[11px] text-muted-foreground">Consultées</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* History section */}
      {showHistory && totalAcknowledged > 0 && (
        <Card className="shadow-card border border-muted-foreground/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2 text-muted-foreground">
              <History className="w-4 h-4" />
              Historique des notifications consultées ({totalAcknowledged})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {acknowledgedObjectiveRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-muted/20 opacity-70">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      {getProfileName(req.user_id).split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{getProfileName(req.user_id)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {req.request_type === "deletion" ? "Suppression" : "Modification"}{req.field_name ? ` — ${FIELD_LABELS[req.field_name] || req.field_name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground">
                      <Eye className="w-2.5 h-2.5 mr-1" /> Consulté
                    </Badge>
                    <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1" onClick={() => onNavigate?.("hrperformance")}>
                      <ExternalLink className="w-3 h-3" /> Objectifs
                    </Button>
                  </div>
                </div>
              ))}
              {acknowledgedWeeklyValidations.map(wp => (
                <div key={wp.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-muted/20 opacity-70">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent">
                      {getProfileName(wp.user_id).split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{getProfileName(wp.user_id)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Semaine du {format(parseISO(wp.week_start), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground">
                    <Eye className="w-2.5 h-2.5 mr-1" /> Consulté
                  </Badge>
                </div>
              ))}
              {acknowledgedOverdueItems.map((item, idx) => (
                <div key={`ack-overdue-${idx}`} className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-muted/20 opacity-70">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center text-[10px] font-bold text-destructive">
                      {item.collaborator.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{item.collaborator}</p>
                      <p className="text-[10px] text-muted-foreground">{item.projectName} — {item.milestone}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground">
                    <Eye className="w-2.5 h-2.5 mr-1" /> Consulté
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-lg mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="rounded-md text-xs font-medium gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" />
            Tout ({totalPending + activeOverdueItems.length})
          </TabsTrigger>
          <TabsTrigger value="validations" className="rounded-md text-xs font-medium gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Demandes de modification ({activeObjectiveRequests.length})
          </TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-md text-xs font-medium gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Validations Week Planner ({activeWeeklyValidations.length})
          </TabsTrigger>
          <TabsTrigger value="overdue" className="rounded-md text-xs font-medium gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Retards collaborateurs ({activeOverdueItems.length})
          </TabsTrigger>
        </TabsList>

        {/* ═══ TOUT ═══ */}
        <TabsContent value="all">
          <div className="space-y-4">
            {totalPending + activeOverdueItems.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-accent mx-auto" />
                  <p className="text-sm text-muted-foreground">Aucune action en attente — tout est à jour !</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {activeObjectiveRequests.length > 0 && (
                  <Card className="shadow-card border-l-4 border-l-primary">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-display flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Demandes de modification d'objectifs ({activeObjectiveRequests.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {activeObjectiveRequests.map(req => (
                          <div key={req.id} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {getProfileName(req.user_id).split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              <div>
                                <p className="text-xs font-medium">{getProfileName(req.user_id)}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {req.request_type === "deletion" ? "Suppression" : "Modification"}{req.field_name ? ` — ${FIELD_LABELS[req.field_name] || req.field_name}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">{format(parseISO(req.created_at), "dd MMM", { locale: fr })}</span>
                              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
                                <Clock className="w-2.5 h-2.5 mr-1" /> En attente
                              </Badge>
                              <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1 text-primary border-primary/30" onClick={() => onNavigate?.("hrperformance")}>
                                <ExternalLink className="w-3 h-3" /> Objectifs
                              </Button>
                              <DismissButton type="objective_request" refId={req.id} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1 text-primary" onClick={() => onNavigate?.("hrperformance")}>
                          <ExternalLink className="w-3 h-3" /> Traiter dans Objectifs
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {activeWeeklyValidations.length > 0 && (
                  <Card className="shadow-card border-l-4 border-l-accent">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-display flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-accent" />
                        Plannings hebdomadaires à valider ({activeWeeklyValidations.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {activeWeeklyValidations.map(wp => (
                          <div key={wp.id} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent">
                                {getProfileName(wp.user_id).split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              <div>
                                <p className="text-xs font-medium">{getProfileName(wp.user_id)}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Semaine du {format(parseISO(wp.week_start), "d MMM yyyy", { locale: fr })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] border-accent/30 text-accent">
                                <Clock className="w-2.5 h-2.5 mr-1" /> En attente
                              </Badge>
                              <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1 text-accent border-accent/30" onClick={() => onNavigate?.("timeentry:validation")}>
                                <ExternalLink className="w-3 h-3" /> Week Planner
                              </Button>
                              <DismissButton type="weekly_validation" refId={wp.id} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1 text-accent" onClick={() => onNavigate?.("timeentry:validation")}>
                          <ExternalLink className="w-3 h-3" /> Traiter dans Week Planner
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {activeOverdueItems.length > 0 && (
                  <Card className="shadow-card border-l-4 border-l-destructive">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-display flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-4 h-4" />
                        Jalons en retard ({activeOverdueItems.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {activeOverdueItems.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-lg border border-destructive/20 p-3 hover:bg-destructive/5 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center text-[10px] font-bold text-destructive">
                                {item.collaborator.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              <div>
                                <p className="text-xs font-medium">{item.collaborator}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {item.projectName} — {item.milestone}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="text-[9px]">{item.daysOverdue}j de retard</Badge>
                              {!item.hasDeliverable && (
                                <span className="text-[9px] text-destructive flex items-center gap-0.5">
                                  <XCircle className="w-3 h-3" /> Non déposé
                                </span>
                              )}
                              <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1 text-destructive border-destructive/30" onClick={() => onNavigate?.(item.source === "weekplanner" ? "timeentry" : "projectscomites")}>
                                <ExternalLink className="w-3 h-3" /> {item.source === "weekplanner" ? "Week Planner" : "Projets"}
                              </Button>
                              <DismissButton type="overdue" refId={item.refId || ""} />
                            </div>
                          </div>
                        ))}
                        {activeOverdueItems.length > 5 && (
                          <p className="text-[10px] text-muted-foreground text-center pt-1">
                            … et {activeOverdueItems.length - 5} autre(s). Voir l'onglet « Retards collaborateurs » pour le détail.
                          </p>
                        )}
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1 text-destructive" onClick={() => onNavigate?.("projectscomites")}>
                          <ExternalLink className="w-3 h-3" /> Voir dans Projets & Comités
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ═══ DEMANDES DE MODIFICATION D'OBJECTIFS ═══ */}
        <TabsContent value="validations">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Demandes de modification d'objectifs en attente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Chargement...</div>
              ) : activeObjectiveRequests.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-accent mx-auto" />
                  <p className="text-sm text-muted-foreground">Aucune demande en attente — tout est à jour !</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</TableHead>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Type</TableHead>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Champ</TableHead>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Explication</TableHead>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Date</TableHead>
                      <TableHead className="text-[10px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeObjectiveRequests.map(req => (
                      <TableRow key={req.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                              {getProfileName(req.user_id).split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </div>
                            <span className="text-xs font-medium">{getProfileName(req.user_id)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[9px]">
                            {req.request_type === "deletion" ? "Suppression" : "Modification"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {req.field_name ? FIELD_LABELS[req.field_name] || req.field_name : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                          <span className="line-clamp-2">{req.explanation || "—"}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(parseISO(req.created_at), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-primary" onClick={() => onNavigate?.("hrperformance")}>
                              <ExternalLink className="w-3 h-3" /> Traiter
                            </Button>
                            <DismissButton type="objective_request" refId={req.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ VALIDATIONS WEEK PLANNER ═══ */}
        <TabsContent value="weekly">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                Plannings hebdomadaires en attente de validation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Chargement...</div>
              ) : activeWeeklyValidations.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-accent mx-auto" />
                  <p className="text-sm text-muted-foreground">Aucun planning à valider — tout est à jour !</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeWeeklyValidations.map(wp => (
                    <div key={wp.id} className="rounded-lg border border-border p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-[11px] font-bold text-accent">
                          {getProfileName(wp.user_id).split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{getProfileName(wp.user_id)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Semaine du {format(parseISO(wp.week_start), "d MMMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {wp.submitted_at && (
                          <span className="text-[10px] text-muted-foreground">
                            Soumis le {format(parseISO(wp.submitted_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                          </span>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-accent" onClick={() => onNavigate?.("timeentry:validation")}>
                          <ExternalLink className="w-3 h-3" /> Valider
                        </Button>
                        <DismissButton type="weekly_validation" refId={wp.id} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ RETARDS COLLABORATEURS ═══ */}
        <TabsContent value="overdue">
          <Card className={`shadow-card ${activeOverdueItems.length > 0 ? "border-2 border-destructive/30" : ""}`}>
            <CardHeader className={`pb-2 ${activeOverdueItems.length > 0 ? "bg-destructive/5" : ""}`}>
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${activeOverdueItems.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                <span className={activeOverdueItems.length > 0 ? "text-destructive" : ""}>
                  Jalons en retard chez vos collaborateurs {activeOverdueItems.length > 0 ? `(${activeOverdueItems.length})` : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeOverdueItems.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-accent mx-auto" />
                  <p className="text-sm text-muted-foreground">Aucun retard — vos collaborateurs sont à jour !</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Source</TableHead>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Collaborateur</TableHead>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Tâche</TableHead>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Jalon</TableHead>
                      <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Deadline</TableHead>
                      <TableHead className="text-[10px] text-right">Retard</TableHead>
                      <TableHead className="text-[10px] text-right">Livrable</TableHead>
                      <TableHead className="text-[10px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeOverdueItems.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-destructive/5">
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.projectColor }} />
                            <span className="text-xs font-medium">{item.projectName}</span>
                            {item.source === "weekplanner" && (
                              <Badge variant="outline" className="text-[8px] ml-1">WP</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center text-[9px] font-bold text-destructive">
                              {item.collaborator.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </div>
                            <span className="text-xs">{item.collaborator}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.mission}</TableCell>
                        <TableCell className="text-xs font-medium">{item.milestone}</TableCell>
                        <TableCell className="text-xs text-destructive font-semibold whitespace-nowrap">
                          {format(parseISO(item.deadline), "dd MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive" className="text-[9px]">
                            {item.daysOverdue}j
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.hasDeliverable ? (
                            <span className="text-[10px] text-accent flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Déposé
                            </span>
                          ) : (
                            <span className="text-[10px] text-destructive flex items-center justify-end gap-1 font-semibold">
                              <XCircle className="w-3 h-3" /> Non déposé
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-destructive" onClick={() => onNavigate?.(item.source === "weekplanner" ? "timeentry" : "projectscomites")}>
                              <ExternalLink className="w-3 h-3" /> Voir
                            </Button>
                            <DismissButton type="overdue" refId={item.refId || ""} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ManagerActionsView;
