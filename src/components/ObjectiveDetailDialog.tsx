import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Target } from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS, OBJECTIVE_CATEGORIES, type Objective } from "@/hooks/useObjectives";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: Objective;
}

const getCategoryLabel = (cat: string) => OBJECTIVE_CATEGORIES.find(c => c.value === cat)?.label || cat;

const ObjectiveDetailDialog = ({ open, onOpenChange, objective: obj }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-primary" />
            Fiche objectif
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Title */}
          <div className="bg-muted/40 rounded-lg p-3">
            <h3 className="text-sm font-bold">{obj.title}</h3>
            {obj.description && (
              <p className="text-xs text-muted-foreground mt-1">{obj.description}</p>
            )}
          </div>

          {/* Info table - line by line */}
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground w-[140px] py-2">Statut</TableCell>
                <TableCell className="py-2">
                  <Badge className={`text-[10px] ${STATUS_COLORS[obj.status]}`}>
                    {STATUS_LABELS[obj.status]}
                  </Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Catégorie</TableCell>
                <TableCell className="text-xs py-2">{getCategoryLabel(obj.category)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Pondération</TableCell>
                <TableCell className="text-xs font-medium py-2">{obj.weight > 0 ? `${obj.weight}%` : "—"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Échéance</TableCell>
                <TableCell className="text-xs py-2">{obj.deadline ? new Date(obj.deadline).toLocaleDateString("fr-FR") : "—"}</TableCell>
              </TableRow>

              {/* KPI rows */}
              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">KPI — Cible</TableCell>
                <TableCell className="text-xs py-2">{obj.kpi_target || "—"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">KPI — Unité</TableCell>
                <TableCell className="text-xs py-2">{obj.kpi_unit || "—"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">KPI — Réalisé</TableCell>
                <TableCell className="text-xs py-2">{obj.kpi_actual || "—"}</TableCell>
              </TableRow>

              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Date de création</TableCell>
                <TableCell className="text-xs py-2">{new Date(obj.created_at).toLocaleDateString("fr-FR")}</TableCell>
              </TableRow>
              {obj.validated_at && (
                <TableRow>
                  <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Date de validation</TableCell>
                  <TableCell className="text-xs py-2">{new Date(obj.validated_at).toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Separator />

          {/* Progression */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Progression</p>
            <div className="flex items-center justify-between text-xs">
              <span>Atteinte globale</span>
              <span className="font-bold">{obj.achievement_pct}%</span>
            </div>
            <Progress value={obj.achievement_pct} className="h-2" />
          </div>

          {/* S1 / S2 table */}
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground w-[140px] py-2">Revue S1 — %</TableCell>
                <TableCell className="text-xs font-medium py-2">
                  {obj.s1_achievement_pct != null ? `${obj.s1_achievement_pct}%` : "—"}
                </TableCell>
              </TableRow>
              {obj.s1_comment && (
                <TableRow>
                  <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Commentaire S1</TableCell>
                  <TableCell className="text-xs italic text-muted-foreground py-2">"{obj.s1_comment}"</TableCell>
                </TableRow>
              )}
              {obj.s1_reviewed_at && (
                <TableRow>
                  <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Date revue S1</TableCell>
                  <TableCell className="text-xs py-2">{new Date(obj.s1_reviewed_at).toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Évaluation S2 — %</TableCell>
                <TableCell className="text-xs font-medium py-2">
                  {obj.final_achievement_pct != null ? `${obj.final_achievement_pct}%` : "—"}
                </TableCell>
              </TableRow>
              {obj.final_comment && (
                <TableRow>
                  <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Commentaire S2</TableCell>
                  <TableCell className="text-xs italic text-muted-foreground py-2">"{obj.final_comment}"</TableCell>
                </TableRow>
              )}
              {obj.final_reviewed_at && (
                <TableRow>
                  <TableCell className="text-[11px] font-semibold text-muted-foreground py-2">Date éval. S2</TableCell>
                  <TableCell className="text-xs py-2">{new Date(obj.final_reviewed_at).toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ObjectiveDetailDialog;
