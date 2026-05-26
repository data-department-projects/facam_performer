import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles, refreshProfiles } from "@/hooks/useProfiles";
import { useObjectives, STATUS_LABELS, STATUS_COLORS, OBJECTIVE_CATEGORIES, type Objective, type ObjectiveStatus } from "@/hooks/useObjectives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Target, Plus, Send, CheckCircle2, Eye, Pencil, Trash2, ChevronRight, ChevronLeft, Users2, BarChart3, Award, ClipboardCheck, Play, UserPlus, DollarSign, Wallet, MessageSquarePlus } from "lucide-react";
import ObjectiveFormDialog from "./ObjectiveFormDialog";
import ObjectiveEvalDialog from "./ObjectiveEvalDialog";
import ObjectiveChangeRequestDialog from "./ObjectiveChangeRequestDialog";
import ObjectiveDetailDialog from "./ObjectiveDetailDialog";
import ObjectiveChangeRequestBadge from "./ObjectiveChangeRequestBadge";
import ManagerObjectiveRequests from "./ManagerObjectiveRequests";
import { useObjectiveChangeRequests } from "@/hooks/useObjectiveChangeRequests";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const HRPerformanceView = () => {
  const { user, isAdmin, profile } = useAuth();
  const profiles = useProfiles();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingObj, setEditingObj] = useState<Objective | null>(null);
  const [evalObj, setEvalObj] = useState<{ obj: Objective; mode: "s1" | "s2" } | null>(null);
  const [editingBudget, setEditingBudget] = useState<{ userId: string; value: string } | null>(null);
  const [showOwnForm, setShowOwnForm] = useState(false);
  const [editingOwnObj, setEditingOwnObj] = useState<Objective | null>(null);
  const [changeRequestObj, setChangeRequestObj] = useState<Objective | null>(null);
  const [detailObj, setDetailObj] = useState<Objective | null>(null);
  const [managerBudgets, setManagerBudgets] = useState<Record<string, number>>({});

  // Determine if current user is a manager (non-admin)
  const isManager = !isAdmin && !!profile?.is_manager;
  const canManage = isAdmin || isManager;

  // Fetch manager_bonus_budget from base profiles table (admin/manager access only)
  useEffect(() => {
    const fetchBudgets = async () => {
      if (!canManage) return;
      if (isAdmin) {
        const { data } = await supabase.from("profiles").select("user_id, manager_bonus_budget").eq("is_manager", true) as any;
        if (data) {
          const map: Record<string, number> = {};
          for (const row of data) map[row.user_id] = row.manager_bonus_budget || 0;
          setManagerBudgets(map);
        }
      } else if (isManager && user) {
        // Manager can only see own budget (own-row policy)
        const { data } = await supabase.from("profiles").select("user_id, manager_bonus_budget").eq("user_id", user.id).single() as any;
        if (data) setManagerBudgets({ [data.user_id]: data.manager_bonus_budget || 0 });
      }
    };
    fetchBudgets();
  }, [canManage, isAdmin, isManager, user]);

  // Get subordinates: admin and managers only see their direct reports (hierarchy_user_id)
  const subordinates = useMemo(() => {
    if (!user) return [];
    if (isAdmin || isManager) return profiles.filter(p => p.hierarchy_user_id === user.id && p.full_name);
    return [];
  }, [isAdmin, isManager, user, profiles]);

  // For managers, get their own managers list (to show budget allocation)
  const managerProfiles = useMemo(() => {
    return profiles.filter(p => p.is_manager && p.full_name);
  }, [profiles]);

  const viewUserId = (canManage) ? selectedUserId : user?.id || null;

  const userHook = useObjectives(viewUserId || undefined, selectedYear);
  // For admin: load all objectives; for manager: we'll filter by subordinate IDs
  const allHook = useObjectives(isAdmin ? undefined : (isManager ? undefined : (user?.id || undefined)), selectedYear);
  // Manager's own objectives hook (always called, but only used for managers)
  const ownHook = useObjectives(isManager ? user?.id : undefined, selectedYear);

  const objectives = viewUserId ? userHook.objectives : [];
  const { createObjective, updateObjective, deleteObjective, submitForValidation, validateObjectives, startS1Review, startS2Evaluation, completeEvaluation } = userHook;

  // Filter allHook objectives to only subordinates for managers
  const filteredAllObjectives = useMemo(() => {
    if (isAdmin) return allHook.objectives;
    if (isManager) {
      const subIds = new Set(subordinates.map(s => s.user_id));
      return allHook.objectives.filter(o => subIds.has(o.user_id));
    }
    return allHook.objectives;
  }, [isAdmin, isManager, allHook.objectives, subordinates]);

  const objectivesByUser = useMemo(() => {
    if (!canManage) return {};
    const map: Record<string, Objective[]> = {};
    filteredAllObjectives.forEach(o => {
      if (!map[o.user_id]) map[o.user_id] = [];
      map[o.user_id].push(o);
    });
    return map;
  }, [canManage, filteredAllObjectives]);

  const getProfileName = (userId: string) => {
    const p = profiles.find(p => p.user_id === userId);
    return p?.full_name || "—";
  };

  const getCategoryLabel = (cat: string) => OBJECTIVE_CATEGORIES.find(c => c.value === cat)?.label || cat;

  // Fetch change request statuses for all visible objectives
  const allVisibleObjectiveIds = useMemo(() => {
    const ids = new Set<string>();
    objectives.forEach(o => ids.add(o.id));
    filteredAllObjectives.forEach(o => ids.add(o.id));
    if (isManager) ownHook.objectives.forEach(o => ids.add(o.id));
    return Array.from(ids);
  }, [objectives, filteredAllObjectives, isManager, ownHook.objectives]);

  const { requestsByObjective, refetch: refetchChangeRequests } = useObjectiveChangeRequests(allVisibleObjectiveIds);

  const totalBonus = objectives.reduce((s, o) => s + (o.bonus || 0), 0);
  const avgAchievement = objectives.length > 0
    ? objectives.reduce((s, o) => s + o.achievement_pct, 0) / objectives.length
    : 0;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const source = canManage ? filteredAllObjectives : objectives;
    source.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [canManage, filteredAllObjectives, objectives]);

  const canEdit = (obj: Objective) => {
    if (isAdmin) return true;
    if (isManager) {
      const subIds = new Set(subordinates.map(s => s.user_id));
      return subIds.has(obj.user_id);
    }
    return obj.created_by === user?.id && (obj.status === "draft" || obj.status === "pending_validation");
  };

  const canDelete = (obj: Objective) => {
    if (isAdmin) return true;
    if (isManager) {
      const subIds = new Set(subordinates.map(s => s.user_id));
      return subIds.has(obj.user_id) && (obj.status === "draft" || obj.status === "pending_validation");
    }
    return obj.user_id === user?.id && (obj.status === "draft" || obj.status === "pending_validation");
  };

  const hasDrafts = objectives.some(o => o.status === "draft");
  const hasValidated = objectives.some(o => o.status === "validated");
  const hasS1 = objectives.some(o => o.status === "s1_review");
  const hasS2 = objectives.some(o => o.status === "s2_evaluation");
  const hasDraftsOrPending = objectives.some(o => o.status === "draft" || o.status === "pending_validation");

  const handleCreate = async (data: Partial<Objective>) => {
    const targetUserId = viewUserId || user?.id;
    if (!targetUserId) return;
    await createObjective({ ...data, user_id: targetUserId });
  };

  const handleEdit = async (data: Partial<Objective>) => {
    if (!editingObj) return;
    await updateObjective(editingObj.id, data);
    setEditingObj(null);
  };

  const handleEvalSave = async (id: string, updates: Partial<Objective>) => {
    await updateObjective(id, updates);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const getGroupActions = (objs: Objective[]) => {
    const hasDraftOrPend = objs.some(o => o.status === "draft" || o.status === "pending_validation");
    const hasVal = objs.some(o => o.status === "validated");
    const hasS1r = objs.some(o => o.status === "s1_review");
    const hasS2e = objs.some(o => o.status === "s2_evaluation");
    return { hasDraftOrPend, hasVal, hasS1r, hasS2e };
  };

  const handleBulkAction = async (userId: string, fromStatuses: ObjectiveStatus[], toStatus: ObjectiveStatus, extra?: Record<string, any>) => {
    const updates: any = { status: toStatus, ...extra };
    const { error } = await supabase
      .from("objectives")
      .update(updates)
      .eq("user_id", userId)
      .eq("year", selectedYear)
      .in("status", fromStatuses);
    if (!error) {
      toast.success("Objectifs mis à jour");
      allHook.refetch();
      if (viewUserId === userId) userHook.refetch();
    }
  };

  const handleSaveBudget = async (managerId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const { error } = await supabase
      .from("profiles")
      .update({ manager_bonus_budget: numValue } as any)
      .eq("user_id", managerId);
    if (!error) {
      toast.success("Budget bonus mis à jour");
      setEditingBudget(null);
      setManagerBudgets(prev => ({ ...prev, [managerId]: numValue }));
      setTimeout(() => { refreshProfiles(); }, 300);
    } else {
      toast.error("Erreur lors de la mise à jour du budget");
    }
  };

  // --- Budget allocation section (Admin only) ---
  const renderBudgetAllocation = () => {
    if (!isAdmin) return null;
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Budget Bonus par Manager — {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Manager</TableHead>
                <TableHead className="text-[10px] text-center">Collaborateurs</TableHead>
                <TableHead className="text-[10px] text-center">Budget alloué (F CFA)</TableHead>
                <TableHead className="text-[10px] text-center">Bonus distribué</TableHead>
                <TableHead className="text-[10px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managerProfiles.map(mgr => {
                const subs = profiles.filter(p => p.hierarchy_user_id === mgr.user_id);
                const subIds = new Set(subs.map(s => s.user_id));
                const mgrObjectives = filteredAllObjectives.filter(o => subIds.has(o.user_id));
                const totalDistributed = mgrObjectives.reduce((s, o) => s + (o.bonus || 0), 0);
                const budget = managerBudgets[mgr.user_id] || 0;
                const isEditingBdg = editingBudget?.userId === mgr.user_id;

                return (
                  <TableRow key={mgr.user_id}>
                    <TableCell>
                      <span className="text-xs font-medium">{mgr.full_name}</span>
                      {mgr.poste && <p className="text-[10px] text-muted-foreground">{mgr.poste}</p>}
                    </TableCell>
                    <TableCell className="text-center text-xs">{subs.length}</TableCell>
                    <TableCell className="text-center">
                      {isEditingBdg ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Input
                            type="number"
                            className="h-7 w-32 text-xs text-center"
                            value={editingBudget!.value}
                            onChange={e => setEditingBudget({ userId: mgr.user_id, value: e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") handleSaveBudget(mgr.user_id, editingBudget!.value); }}
                          />
                          <Button size="sm" className="h-7 text-[10px]" onClick={() => handleSaveBudget(mgr.user_id, editingBudget!.value)}>OK</Button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold">{budget.toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs font-medium ${totalDistributed > budget && budget > 0 ? "text-destructive" : ""}`}>
                        {totalDistributed.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setEditingBudget({ userId: mgr.user_id, value: String(budget) })}>
                        <Pencil className="w-3 h-3 mr-1" /> Modifier
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // --- Manager budget info card ---
  const renderManagerBudgetInfo = () => {
    if (!isManager || !user) return null;
    const myProfile = profiles.find(p => p.user_id === user.id);
    const budget = managerBudgets[user.id] || 0;
    const totalDistributed = filteredAllObjectives.reduce((s, o) => s + (o.bonus || 0), 0);
    const remaining = budget - totalDistributed;

    return (
      <Card className="border-0 shadow-sm bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <div>
                <p className="text-[11px] text-muted-foreground">Budget bonus alloué</p>
                <p className="text-lg font-bold text-foreground">{budget.toLocaleString()} F CFA</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Distribué</p>
              <p className="text-lg font-bold text-foreground">{totalDistributed.toLocaleString()} F CFA</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Restant</p>
              <p className={`text-lg font-bold ${remaining < 0 ? "text-destructive" : "text-foreground"}`}>{remaining.toLocaleString()} F CFA</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // --- Manager's own objectives with full CRUD ---
  const renderManagerOwnObjectives = () => {
    if (!isManager || !user) return null;
    const ownObjs = ownHook.objectives;
    const ownHasDrafts = ownObjs.some(o => o.status === "draft");
    
    const canEditOwn = (obj: Objective) => obj.user_id === user.id && (obj.status === "draft" || obj.status === "pending_validation");
    const canDeleteOwn = (obj: Objective) => obj.user_id === user.id && (obj.status === "draft" || obj.status === "pending_validation");

    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Mes objectifs personnels — {selectedYear}
            </CardTitle>
            <div className="flex items-center gap-2">
              {ownHasDrafts && (
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => ownHook.submitForValidation(user.id)}>
                  <Send className="w-3 h-3" /> Soumettre au DG
                </Button>
              )}
              <Button size="sm" className="text-xs gap-1" onClick={() => setShowOwnForm(true)}>
                <Plus className="w-3 h-3" /> Ajouter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ownObjs.length === 0 ? (
            <div className="py-6 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">Aucun objectif personnel défini pour {selectedYear}</p>
              <Button size="sm" className="mt-3 text-xs gap-1" onClick={() => setShowOwnForm(true)}>
                <Plus className="w-3 h-3" /> Créer mon premier objectif
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Objectif</TableHead>
                  <TableHead className="text-[10px]">Catégorie</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px] text-center">S1</TableHead>
                  <TableHead className="text-[10px] text-center">S2</TableHead>
                  <TableHead className="text-[10px] text-center">Atteinte</TableHead>
                  <TableHead className="text-[10px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ownObjs.map(obj => (
                  <TableRow key={obj.id}>
                    <TableCell>
                      <p className="text-xs font-medium">{obj.title}</p>
                      {obj.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{obj.description}</p>}
                      {obj.deadline && <p className="text-[10px] text-muted-foreground">Échéance: {obj.deadline}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{getCategoryLabel(obj.category)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={`text-[10px] ${STATUS_COLORS[obj.status]}`}>{STATUS_LABELS[obj.status]}</Badge>
                        <ObjectiveChangeRequestBadge requests={requestsByObjective[obj.id]} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-[10px]">
                      {obj.s1_achievement_pct != null ? `${obj.s1_achievement_pct}%` : "—"}
                    </TableCell>
                    <TableCell className="text-center text-[10px]">
                      {obj.final_achievement_pct != null ? `${obj.final_achievement_pct}%` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-bold">{obj.achievement_pct}%</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Détail" onClick={() => setDetailObj(obj)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        {canEditOwn(obj) && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Modifier" onClick={() => setEditingOwnObj(obj)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        {canDeleteOwn(obj) && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Supprimer" onClick={() => ownHook.deleteObjective(obj.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                        {!canEditOwn(obj) && obj.status !== "draft" && obj.status !== "pending_validation" && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 text-amber-600" title="Demander modification" onClick={() => setChangeRequestObj(obj)}>
                            <MessageSquarePlus className="w-3 h-3" /> Demander
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  // --- Overview table (admin sees all, manager sees subordinates) ---
  const renderOverview = () => {
    const displayProfiles = subordinates;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users2 className="w-4 h-4" /> {isAdmin ? "Tous les collaborateurs" : "Mes collaborateurs"} — {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {displayProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {isManager ? "Aucun collaborateur rattaché à votre équipe" : "Aucun collaborateur trouvé"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Collaborateur</TableHead>
                  <TableHead className="text-[10px] text-center">Objectifs</TableHead>
                  <TableHead className="text-[10px] text-center">Statut</TableHead>
                  <TableHead className="text-[10px] text-center">Atteinte</TableHead>
                  {canManage && <TableHead className="text-[10px] text-center">Bonus total</TableHead>}
                  <TableHead className="text-[10px]">Actions workflow</TableHead>
                  <TableHead className="text-[10px] text-right">Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayProfiles.map(p => {
                  const uid = p.user_id;
                  const objs = objectivesByUser[uid] || [];
                  const avgAch = objs.length > 0 ? objs.reduce((s, o) => s + o.achievement_pct, 0) / objs.length : 0;
                  const totalB = objs.reduce((s, o) => s + (o.bonus || 0), 0);
                  const actions = getGroupActions(objs);
                  const mainStatus = objs.length > 0 ? objs[0].status : null;

                  return (
                    <TableRow key={uid}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                            {p.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <span className="text-xs font-medium">{p.full_name}</span>
                            {p.poste && <p className="text-[10px] text-muted-foreground">{p.poste}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium">{objs.length}</TableCell>
                      <TableCell className="text-center">
                        {mainStatus ? (
                          <Badge className={`text-[10px] ${STATUS_COLORS[mainStatus as ObjectiveStatus]}`}>
                            {STATUS_LABELS[mainStatus as ObjectiveStatus]}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold">{objs.length > 0 ? `${avgAch.toFixed(0)}%` : "—"}</TableCell>
                      {canManage && (
                        <TableCell className="text-center text-xs font-medium">{totalB > 0 ? `${totalB.toLocaleString()} F CFA` : "—"}</TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {objs.length === 0 && (
                            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setSelectedUserId(uid)}>
                              <UserPlus className="w-3 h-3" /> Créer objectifs
                            </Button>
                          )}
                          {actions.hasDraftOrPend && (
                            <Button size="sm" className="h-6 text-[10px] gap-1" onClick={() => handleBulkAction(uid, ["draft", "pending_validation"], "validated", { validated_by: user!.id, validated_at: new Date().toISOString() })}>
                              <CheckCircle2 className="w-3 h-3" /> Valider
                            </Button>
                          )}
                          {actions.hasVal && (
                            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => handleBulkAction(uid, ["validated"], "s1_review")}>
                              <Play className="w-3 h-3" /> Revue S1
                            </Button>
                          )}
                          {actions.hasS1r && (
                            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => handleBulkAction(uid, ["s1_review"], "s2_evaluation")}>
                              <Play className="w-3 h-3" /> Éval. S2
                            </Button>
                          )}
                          {actions.hasS2e && (
                            <Button size="sm" className="h-6 text-[10px] gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleBulkAction(uid, ["s2_evaluation"], "completed")}>
                              <Award className="w-3 h-3" /> Finaliser
                            </Button>
                          )}
                          {!actions.hasDraftOrPend && !actions.hasVal && !actions.hasS1r && !actions.hasS2e && objs.length > 0 && objs.every(o => o.status === "completed") && (
                            <Badge className="text-[10px] bg-green-100 text-green-800 border-green-300">✓ Terminé</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedUserId(uid)}>
                          <Eye className="w-3 h-3 mr-1" /> Voir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  // --- Objectives list for a specific user ---
  const renderObjectivesList = () => (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {canManage && selectedUserId && (
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setSelectedUserId(null)}>
              <ChevronLeft className="w-3 h-3" /> Retour
            </Button>
          )}
          <h3 className="text-sm font-semibold">
            {viewUserId && viewUserId !== user?.id ? `Objectifs de ${getProfileName(viewUserId)}` : "Mes objectifs"}
            <span className="text-muted-foreground font-normal ml-2">({objectives.length})</span>
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasDrafts && (viewUserId === user?.id) && !canManage && (
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => submitForValidation(viewUserId!)}>
              <Send className="w-3 h-3" /> Soumettre au manager
            </Button>
          )}
          {canManage && hasValidated && viewUserId && (
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => startS1Review(viewUserId!)}>
              <Play className="w-3 h-3" /> Lancer Revue S1
            </Button>
          )}
          {canManage && hasS1 && viewUserId && (
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => startS2Evaluation(viewUserId!)}>
              <Play className="w-3 h-3" /> Lancer Éval. S2
            </Button>
          )}
          {canManage && hasS2 && viewUserId && (
            <Button size="sm" className="text-xs gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => completeEvaluation(viewUserId!)}>
              <Award className="w-3 h-3" /> Finaliser
            </Button>
          )}
          {(canManage || (viewUserId === user?.id)) && (
            <Button size="sm" className="text-xs gap-1" onClick={() => setShowForm(true)}>
              <Plus className="w-3 h-3" /> Ajouter un objectif
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {objectives.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{objectives.length}</p>
                <p className="text-[10px] text-muted-foreground">Objectifs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-lg font-bold">{avgAchievement.toFixed(0)}%</p>
                <p className="text-[10px] text-muted-foreground">Atteinte moyenne</p>
              </div>
            </CardContent>
          </Card>
          {canManage && (
            <Card>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-lg font-bold">{totalBonus.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Bonus total (F CFA)</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center">
                <Award className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{objectives.filter(o => o.status === "completed").length}</p>
                <p className="text-[10px] text-muted-foreground">Évalués</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Objectives table */}
      {objectives.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Target className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>Aucun objectif défini pour {selectedYear}</p>
            {(canManage || (viewUserId === user?.id)) && (
              <Button size="sm" className="mt-4 text-xs gap-1" onClick={() => setShowForm(true)}>
                <Plus className="w-3 h-3" /> Créer le premier objectif
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Objectif</TableHead>
                  <TableHead className="text-[10px]">Catégorie</TableHead>
                  {canManage && <TableHead className="text-[10px] text-center">Bonus</TableHead>}
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px] text-center">S1</TableHead>
                  <TableHead className="text-[10px] text-center">S2</TableHead>
                  <TableHead className="text-[10px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objectives.map(obj => (
                  <TableRow key={obj.id}>
                    <TableCell>
                      <div>
                        <p className="text-xs font-medium">{obj.title}</p>
                        {obj.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{obj.description}</p>}
                        {obj.deadline && <p className="text-[10px] text-muted-foreground">Échéance: {obj.deadline}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{getCategoryLabel(obj.category)}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-center text-xs font-medium">
                        {(obj.bonus || 0) > 0 ? `${(obj.bonus || 0).toLocaleString()} F CFA` : "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={`text-[10px] ${STATUS_COLORS[obj.status]}`}>
                          {STATUS_LABELS[obj.status]}
                        </Badge>
                        <ObjectiveChangeRequestBadge requests={requestsByObjective[obj.id]} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-[10px]">
                      {obj.s1_achievement_pct != null ? (
                        <span className="font-medium">{obj.s1_achievement_pct}%</span>
                      ) : obj.status === "s1_review" && canManage ? (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => setEvalObj({ obj, mode: "s1" })}>
                          Évaluer
                        </Button>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-[10px]">
                      {obj.final_achievement_pct != null ? (
                        <span className="font-medium">{obj.final_achievement_pct}%</span>
                      ) : obj.status === "s2_evaluation" && canManage ? (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => setEvalObj({ obj, mode: "s2" })}>
                          Évaluer
                        </Button>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Détail" onClick={() => setDetailObj(obj)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        {canManage && (obj.status === "draft" || obj.status === "pending_validation") && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 text-primary" title="Valider" onClick={async () => {
                            const { error } = await supabase
                              .from("objectives")
                              .update({ status: "validated", validated_by: user!.id, validated_at: new Date().toISOString() } as any)
                              .eq("id", obj.id);
                            if (!error) {
                              toast.success("Objectif validé");
                              userHook.refetch();
                              allHook.refetch();
                            }
                          }}>
                            <CheckCircle2 className="w-3 h-3" /> Valider
                          </Button>
                        )}
                        {canManage && obj.status === "validated" && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" title="Lancer Revue S1" onClick={async () => {
                            const { error } = await supabase
                              .from("objectives")
                              .update({ status: "s1_review" } as any)
                              .eq("id", obj.id);
                            if (!error) {
                              toast.success("Revue S1 lancée");
                              userHook.refetch();
                              allHook.refetch();
                            }
                          }}>
                            <Play className="w-3 h-3" /> S1
                          </Button>
                        )}
                        {canManage && obj.status === "s1_review" && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Évaluer S1" onClick={() => setEvalObj({ obj, mode: "s1" })}>
                              <ClipboardCheck className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1" title="Lancer Éval. S2" onClick={async () => {
                              const { error } = await supabase
                                .from("objectives")
                                .update({ status: "s2_evaluation" } as any)
                                .eq("id", obj.id);
                              if (!error) {
                                toast.success("Évaluation S2 lancée");
                                userHook.refetch();
                                allHook.refetch();
                              }
                            }}>
                              <Play className="w-3 h-3" /> S2
                            </Button>
                          </>
                        )}
                        {canManage && obj.status === "s2_evaluation" && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Évaluer S2" onClick={() => setEvalObj({ obj, mode: "s2" })}>
                              <ClipboardCheck className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 text-green-600" title="Finaliser" onClick={async () => {
                              const { error } = await supabase
                                .from("objectives")
                                .update({ status: "completed" } as any)
                                .eq("id", obj.id);
                              if (!error) {
                                toast.success("Objectif finalisé");
                                userHook.refetch();
                                allHook.refetch();
                              }
                            }}>
                              <Award className="w-3 h-3" /> Finaliser
                            </Button>
                          </>
                        )}
                        {canEdit(obj) && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Modifier" onClick={() => setEditingObj(obj)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        {canDelete(obj) && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Supprimer" onClick={() => deleteObjective(obj.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                        {/* Request modification/deletion for validated+ objectives (own or subordinate's) */}
                        {(obj.user_id === user?.id || (canManage && !canEdit(obj))) && ["validated", "s1_review", "s2_evaluation", "completed"].includes(obj.status) && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] gap-1 text-amber-600" title="Demander modification" onClick={() => setChangeRequestObj(obj)}>
                            <MessageSquarePlus className="w-3 h-3" /> Demander
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end">
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status KPI chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as ObjectiveStatus[]).map(s => (
          <Badge key={s} variant="outline" className={`text-[10px] ${statusCounts[s] ? STATUS_COLORS[s] : "opacity-40"}`}>
            {STATUS_LABELS[s]}: {statusCounts[s] || 0}
          </Badge>
        ))}
      </div>


      {/* Budget allocation (Admin only) */}
      {renderBudgetAllocation()}

      {/* Manager budget info */}
      {renderManagerBudgetInfo()}

      {/* Manager's own objectives */}
      {renderManagerOwnObjectives()}

      {/* Manager/Admin: subordinate change requests */}
      {canManage && <ManagerObjectiveRequests />}

      {/* Main content */}
      {canManage && !selectedUserId ? (
        renderOverview()
      ) : canManage && selectedUserId ? (
        renderObjectivesList()
      ) : (
        // Regular collaborator: show their own objectives (read-only, can submit)
        renderObjectivesList()
      )}

      {/* Dialogs */}
      {showForm && (
        <ObjectiveFormDialog open={showForm} onOpenChange={setShowForm} onSave={handleCreate} isAdmin={canManage} title={!canManage ? "Nouvel objectif" : undefined} />
      )}
      {editingObj && (
        <ObjectiveFormDialog open={!!editingObj} onOpenChange={o => { if (!o) setEditingObj(null); }} onSave={handleEdit} objective={editingObj} title="Modifier l'objectif" isAdmin={canManage} />
      )}
      {evalObj && (
        <ObjectiveEvalDialog open={!!evalObj} onOpenChange={o => { if (!o) setEvalObj(null); }} objective={evalObj.obj} mode={evalObj.mode} onSave={handleEvalSave} />
      )}
      {showOwnForm && (
        <ObjectiveFormDialog open={showOwnForm} onOpenChange={setShowOwnForm} onSave={async (data) => {
          if (!user) return;
          await ownHook.createObjective({ ...data, user_id: user.id });
          setShowOwnForm(false);
        }} isAdmin={false} title="Nouvel objectif personnel" />
      )}
      {editingOwnObj && (
        <ObjectiveFormDialog open={!!editingOwnObj} onOpenChange={o => { if (!o) setEditingOwnObj(null); }} onSave={async (data) => {
          await ownHook.updateObjective(editingOwnObj.id, data);
          setEditingOwnObj(null);
        }} objective={editingOwnObj} title="Modifier mon objectif" isAdmin={false} />
      )}
      {changeRequestObj && (
        <ObjectiveChangeRequestDialog
          open={!!changeRequestObj}
          onOpenChange={o => { if (!o) setChangeRequestObj(null); }}
          objective={changeRequestObj}
          onSuccess={() => { setChangeRequestObj(null); userHook.refetch(); ownHook.refetch(); refetchChangeRequests(); }}
        />
      )}
      {detailObj && (
        <ObjectiveDetailDialog
          open={!!detailObj}
          onOpenChange={o => { if (!o) setDetailObj(null); }}
          objective={detailObj}
        />
      )}
    </div>
  );
};

export default HRPerformanceView;
