import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface KpiRow {
  id?: string;
  objective_id: string;
  label: string;
  unit: string;
  target_value: number;
  actual_value: number | null;
}

const SUGGESTED_KPIS = [
  { label: "Chiffre d'affaires", unit: "F CFA" },
  { label: "Quantités vendues", unit: "unités" },
  { label: "Quantités produites", unit: "unités" },
  { label: "Nombre de clients", unit: "clients" },
  { label: "Marge brute", unit: "F CFA" },
  { label: "Taux de satisfaction", unit: "%" },
  { label: "Délai moyen", unit: "jours" },
  { label: "Taux de conversion", unit: "%" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  objectiveTitle: string;
  readOnly?: boolean;
}

const DeptObjectiveKpisDialog = ({ open, onOpenChange, objectiveId, objectiveTitle, readOnly = false }: Props) => {
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchKpis = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("department_objective_kpis")
        .select("*")
        .eq("objective_id", objectiveId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error(error);
        toast.error("Erreur chargement indicateurs");
      } else {
        setKpis((data as unknown as KpiRow[]) || []);
      }
      setLoading(false);
    };
    fetchKpis();
  }, [open, objectiveId]);

  const addRow = (suggested?: { label: string; unit: string }) => {
    setKpis(prev => [...prev, {
      objective_id: objectiveId,
      label: suggested?.label || "",
      unit: suggested?.unit || "",
      target_value: 0,
      actual_value: null,
    }]);
  };

  const updateRow = (idx: number, field: keyof KpiRow, value: string | number | null) => {
    setKpis(prev => prev.map((k, i) => i === idx ? { ...k, [field]: value } : k));
  };

  const removeRow = (idx: number) => {
    const kpi = kpis[idx];
    if (kpi.id) {
      // Delete from DB
      supabase.from("department_objective_kpis").delete().eq("id", kpi.id).then(({ error }) => {
        if (error) toast.error("Erreur suppression");
      });
    }
    setKpis(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    const toInsert = kpis.filter(k => !k.id && k.label.trim());
    const toUpdate = kpis.filter(k => k.id && k.label.trim());

    // Insert new
    if (toInsert.length > 0) {
      const { error } = await supabase.from("department_objective_kpis").insert(
        toInsert.map(k => ({
          objective_id: objectiveId,
          label: k.label,
          unit: k.unit,
          target_value: k.target_value,
          actual_value: k.actual_value,
        }))
      );
      if (error) { toast.error("Erreur lors de l'ajout"); console.error(error); }
    }

    // Update existing
    for (const k of toUpdate) {
      const { error } = await supabase.from("department_objective_kpis")
        .update({ label: k.label, unit: k.unit, target_value: k.target_value, actual_value: k.actual_value })
        .eq("id", k.id!);
      if (error) { toast.error("Erreur mise à jour"); console.error(error); }
    }

    toast.success("Indicateurs sauvegardés");
    setSaving(false);
    onOpenChange(false);
  };

  const getProgress = (kpi: KpiRow) => {
    if (!kpi.actual_value || !kpi.target_value) return null;
    return Math.round((kpi.actual_value / kpi.target_value) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Indicateurs chiffrés — {objectiveTitle}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
        ) : (
          <div className="space-y-4">
            {/* Suggestions */}
            {!readOnly && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Ajout rapide</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_KPIS.map(s => (
                    <Button
                      key={s.label}
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] gap-1"
                      onClick={() => addRow(s)}
                    >
                      <Plus className="w-2.5 h-2.5" /> {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Table */}
            {kpis.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucun indicateur chiffré</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Indicateur</TableHead>
                    <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Unité</TableHead>
                    <TableHead className="text-[10px] text-right">Cible</TableHead>
                    <TableHead className="text-[10px] text-right">Réalisé</TableHead>
                    <TableHead className="text-[10px] text-center">%</TableHead>
                    {!readOnly && <TableHead className="text-[10px] w-10"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.map((kpi, idx) => {
                    const pct = getProgress(kpi);
                    return (
                      <TableRow key={kpi.id || `new-${idx}`}>
                        <TableCell>
                          {readOnly ? (
                            <span className="text-xs">{kpi.label}</span>
                          ) : (
                            <Input
                              value={kpi.label}
                              onChange={e => updateRow(idx, "label", e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Ex: Chiffre d'affaires"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {readOnly ? (
                            <span className="text-xs">{kpi.unit}</span>
                          ) : (
                            <Input
                              value={kpi.unit}
                              onChange={e => updateRow(idx, "unit", e.target.value)}
                              className="h-7 text-xs w-20"
                              placeholder="F CFA"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {readOnly ? (
                            <span className="text-xs font-medium">{kpi.target_value.toLocaleString()}</span>
                          ) : (
                            <Input
                              type="number"
                              value={kpi.target_value}
                              onChange={e => updateRow(idx, "target_value", Number(e.target.value))}
                              className="h-7 text-xs w-28 text-right"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {readOnly ? (
                            <span className="text-xs font-medium">{kpi.actual_value != null ? kpi.actual_value.toLocaleString() : "—"}</span>
                          ) : (
                            <Input
                              type="number"
                              value={kpi.actual_value ?? ""}
                              onChange={e => updateRow(idx, "actual_value", e.target.value ? Number(e.target.value) : null)}
                              className="h-7 text-xs w-28 text-right"
                              placeholder="—"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {pct != null ? (
                            <span className={`text-xs font-bold ${pct >= 100 ? "text-green-600" : pct >= 70 ? "text-orange-500" : "text-destructive"}`}>
                              {pct}%
                            </span>
                          ) : "—"}
                        </TableCell>
                        {!readOnly && (
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeRow(idx)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {!readOnly && (
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => addRow()}>
                <Plus className="w-3 h-3" /> Ajouter un indicateur
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          {readOnly ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1">
                <Save className="w-3.5 h-3.5" /> Sauvegarder
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeptObjectiveKpisDialog;
