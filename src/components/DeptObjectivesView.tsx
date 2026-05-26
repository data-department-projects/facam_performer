import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useDeptObjectives, type DeptObjective } from "@/hooks/useDeptObjectives";
import { STATUS_LABELS, STATUS_COLORS, OBJECTIVE_CATEGORIES, type Objective, type ObjectiveStatus } from "@/hooks/useObjectives";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Target, Plus, CheckCircle2, Pencil, Trash2, ChevronRight, ChevronDown, Award, ClipboardCheck, Play, Building2, BarChart3, Calendar, TrendingUp, Trophy, Coins } from "lucide-react";
import ObjectiveFormDialog from "./ObjectiveFormDialog";
import ObjectiveEvalDialog from "./ObjectiveEvalDialog";
import DeptObjectiveKpisDialog from "./DeptObjectiveKpisDialog";
import DeptObjectiveInlineKpis from "./DeptObjectiveInlineKpis";

const getCategoryLabel = (v: string) => OBJECTIVE_CATEGORIES.find(c => c.value === v)?.label || v;

// --- Stat Card Sub-component ---
const StatCard = ({ icon: Icon, value, label, colorClass }: { icon: any; value: string | number; label: string; colorClass: string }) => (
  <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow duration-300">
    <CardContent className="p-0">
      <div className="flex items-center gap-3 p-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-display font-bold tracking-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// --- Objective Card Sub-component ---
const ObjectiveCard = ({
  obj, isAdmin, onEval, onEdit, onDelete, onKpi, canEdit, canDelete,
}: {
  obj: DeptObjective;
  isAdmin: boolean;
  onEval: (mode: "s1" | "s2") => void;
  onEdit: () => void;
  onDelete: () => void;
  onKpi: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) => {
  const achievement = obj.final_achievement_pct ?? obj.s1_achievement_pct ?? obj.achievement_pct ?? 0;

  return (
    <div className="group relative rounded-xl border border-border/60 bg-card p-4 hover:shadow-[var(--shadow-card)] transition-all duration-200 hover:border-primary/20">
      {/* Top row: title + status + actions */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="text-sm font-display font-semibold text-foreground">{obj.title}</h4>
            <Badge className={`text-[10px] px-2 py-0 ${STATUS_COLORS[obj.status]}`}>
              {STATUS_LABELS[obj.status]}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-2 py-0 border-border/50">
              {getCategoryLabel(obj.category)}
            </Badge>
          </div>
          {obj.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{obj.description}</p>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onKpi}>
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Indicateurs</p></TooltipContent>
            </Tooltip>
            {obj.status === "s1_review" && isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEval("s1")}>
                    <ClipboardCheck className="w-3.5 h-3.5 text-accent" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">Évaluer S1</p></TooltipContent>
              </Tooltip>
            )}
            {obj.status === "s2_evaluation" && isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEval("s2")}>
                    <ClipboardCheck className="w-3.5 h-3.5 text-accent" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">Évaluer S2</p></TooltipContent>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}>
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">Modifier</p></TooltipContent>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDelete}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">Supprimer</p></TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 flex-wrap mt-3 text-[11px]">
        {obj.deadline && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{obj.deadline}</span>
          </div>
        )}
        {obj.s1_achievement_pct != null && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">S1:</span>
            <span className="font-semibold text-foreground">{obj.s1_achievement_pct}%</span>
          </div>
        )}
        {obj.final_achievement_pct != null && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">S2:</span>
            <span className="font-semibold text-foreground">{obj.final_achievement_pct}%</span>
          </div>
        )}
        {isAdmin && (obj.bonus || 0) > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Coins className="w-3 h-3" />
            <span>{(obj.bonus || 0).toLocaleString()} F CFA</span>
          </div>
        )}
        {obj.final_achievement_pct != null && (obj.bonus || 0) > 0 && (
          <div className="flex items-center gap-1 text-primary font-bold">
            <Trophy className="w-3 h-3" />
            <span>{Math.round((obj.bonus || 0) * (obj.final_achievement_pct / 100)).toLocaleString()} F CFA acquis</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-2">
        <Progress value={achievement} className="h-1.5 flex-1" />
        <span className="text-[11px] font-semibold text-foreground min-w-[32px] text-right">{achievement}%</span>
      </div>

      {/* Inline KPIs */}
      <DeptObjectiveInlineKpis objectiveId={obj.id} kpiUnit={obj.kpi_unit} />
    </div>
  );
};

// --- Main View ---
const DeptObjectivesView = () => {
  const { user, isAdmin, profile } = useAuth();
  const { departments } = useDepartments();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const { objectives, loading, create, update, remove, bulkUpdateStatus } = useDeptObjectives(selectedYear);

  const [showForm, setShowForm] = useState(false);
  const [editingObj, setEditingObj] = useState<DeptObjective | null>(null);
  const [evalObj, setEvalObj] = useState<{ obj: DeptObjective; mode: "s1" | "s2" } | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [kpiObjId, setKpiObjId] = useState<{ id: string; title: string } | null>(null);

  const userDeptHead = useMemo(() => {
    if (isAdmin) return null;
    if (!profile) return null;
    return departments.find(d => d.head === profile.full_name);
  }, [isAdmin, profile, departments]);

  const objByDept = useMemo(() => {
    const map = new Map<string, DeptObjective[]>();
    departments.forEach(d => map.set(d.id, []));
    objectives.forEach(o => {
      const arr = map.get(o.department_id) || [];
      arr.push(o);
      map.set(o.department_id, arr);
    });
    return map;
  }, [objectives, departments]);

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = (data: Partial<Objective>) => {
    if (!selectedDeptId) return;
    create({ ...data, department_id: selectedDeptId } as any);
    setShowForm(false);
  };

  const handleEdit = (data: Partial<Objective>) => {
    if (!editingObj) return;
    update(editingObj.id, data as any);
    setEditingObj(null);
  };

  const handleEvalSave = (id: string, updates: Partial<Objective>) => {
    update(id, updates as any);
    setEvalObj(null);
  };

  const canEditObj = (obj: DeptObjective) => {
    if (isAdmin) return true;
    if (userDeptHead && obj.department_id === userDeptHead.id && obj.status === "draft") return true;
    return false;
  };

  const canDeleteObj = (obj: DeptObjective) => {
    if (isAdmin) return true;
    if (userDeptHead && obj.department_id === userDeptHead.id && obj.status === "draft") return true;
    return false;
  };

  // Stats
  const totalObjectives = objectives.length;
  const completedCount = objectives.filter(o => o.status === "completed").length;
  const totalBonus = objectives.reduce((s, o) => s + (o.bonus || 0), 0);
  const avgAchievement = totalObjectives > 0
    ? Math.round(objectives.reduce((s, o) => s + o.achievement_pct, 0) / totalObjectives)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-end flex-wrap gap-4">
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-28 h-9 text-sm rounded-xl border-border/50 bg-card shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Target} value={totalObjectives} label="Objectifs totaux" colorClass="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} value={completedCount} label="Complétés" colorClass="bg-accent/10 text-accent" />
        <StatCard icon={TrendingUp} value={`${avgAchievement}%`} label="Atteinte moyenne" colorClass="bg-secondary/20 text-secondary-foreground" />
        <StatCard icon={Coins} value={totalBonus.toLocaleString()} label="Bonus total (F CFA)" colorClass="bg-primary/10 text-primary" />
      </div>

      {/* Department sections */}
      <div className="space-y-4">
        {departments.map(dept => {
          const objs = objByDept.get(dept.id) || [];
          const isExpanded = expandedDepts.has(dept.id);
          const deptAvg = objs.length > 0 ? Math.round(objs.reduce((s, o) => s + o.achievement_pct, 0) / objs.length) : 0;
          const deptCompleted = objs.filter(o => o.status === "completed").length;
          const canAddForDept = isAdmin || (userDeptHead?.id === dept.id);

          const hasDraftOrPend = objs.some(o => o.status === "draft" || o.status === "pending_validation");
          const hasVal = objs.some(o => o.status === "validated");
          const hasS1 = objs.some(o => o.status === "s1_review");
          const hasS2 = objs.some(o => o.status === "s2_evaluation");

          return (
            <Card key={dept.id} className="border-0 shadow-[var(--shadow-card)] overflow-hidden">
              <Collapsible open={isExpanded} onOpenChange={() => toggleDept(dept.id)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center text-lg">
                        {dept.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-display font-semibold text-foreground">{dept.name}</h3>
                        <p className="text-[11px] text-muted-foreground">{dept.head} · {objs.length} objectif(s)</p>
                      </div>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" /> : <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />}
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-display font-bold text-foreground">{deptAvg}%</p>
                        <p className="text-[10px] text-muted-foreground">{deptCompleted}/{objs.length} complétés</p>
                      </div>
                      <div className="hidden md:block w-24">
                        <Progress value={deptAvg} className="h-2" />
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
                    {/* Divider */}
                    <div className="h-px bg-border/40" />

                    {/* Workflow actions */}
                    {isAdmin && objs.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasDraftOrPend && (
                          <Button size="sm" className="h-7 text-xs gap-1.5 rounded-lg" onClick={() => bulkUpdateStatus(dept.id, ["draft", "pending_validation"], "validated", { validated_by: user?.id, validated_at: new Date().toISOString() } as any)}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Valider tout
                          </Button>
                        )}
                        {hasVal && (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 rounded-lg" onClick={() => bulkUpdateStatus(dept.id, ["validated"], "s1_review")}>
                            <Play className="w-3.5 h-3.5" /> Revue S1
                          </Button>
                        )}
                        {hasS1 && (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 rounded-lg" onClick={() => bulkUpdateStatus(dept.id, ["s1_review"], "s2_evaluation")}>
                            <Play className="w-3.5 h-3.5" /> Éval. S2
                          </Button>
                        )}
                        {hasS2 && (
                          <Button size="sm" className="h-7 text-xs gap-1.5 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => bulkUpdateStatus(dept.id, ["s2_evaluation"], "completed")}>
                            <Award className="w-3.5 h-3.5" /> Finaliser
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Objectives */}
                    {objs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Target className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-xs">Aucun objectif pour ce département</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {objs.map(obj => (
                          <ObjectiveCard
                            key={obj.id}
                            obj={obj}
                            isAdmin={isAdmin}
                            onEval={(mode) => setEvalObj({ obj, mode })}
                            onEdit={() => setEditingObj(obj)}
                            onDelete={() => remove(obj.id)}
                            onKpi={() => setKpiObjId({ id: obj.id, title: obj.title })}
                            canEdit={canEditObj(obj)}
                            canDelete={canDeleteObj(obj)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Add button */}
                    {canAddForDept && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 rounded-lg border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-colors"
                        onClick={() => { setSelectedDeptId(dept.id); setShowForm(true); }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Ajouter un objectif
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Dialogs */}
      {showForm && (
        <ObjectiveFormDialog
          open={showForm}
          onOpenChange={setShowForm}
          onSave={handleCreate}
          title="Nouvel objectif départemental"
          isAdmin={isAdmin}
        />
      )}
      {editingObj && (
        <ObjectiveFormDialog
          open={!!editingObj}
          onOpenChange={open => { if (!open) setEditingObj(null); }}
          onSave={handleEdit}
          objective={editingObj as unknown as Objective}
          title="Modifier l'objectif"
          isAdmin={isAdmin}
        />
      )}
      {evalObj && (
        <ObjectiveEvalDialog
          open={!!evalObj}
          onOpenChange={open => { if (!open) setEvalObj(null); }}
          objective={evalObj.obj as unknown as Objective}
          mode={evalObj.mode}
          onSave={handleEvalSave}
        />
      )}
      {kpiObjId && (
        <DeptObjectiveKpisDialog
          open={!!kpiObjId}
          onOpenChange={open => { if (!open) setKpiObjId(null); }}
          objectiveId={kpiObjId.id}
          objectiveTitle={kpiObjId.title}
          readOnly={!isAdmin && !userDeptHead}
        />
      )}
    </div>
  );
};

export default DeptObjectivesView;
