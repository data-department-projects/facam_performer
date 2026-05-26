import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OBJECTIVE_CATEGORIES, type Objective } from "@/hooks/useObjectives";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<Objective>) => void;
  objective?: Objective | null;
  title?: string;
  isAdmin?: boolean;
}

const ObjectiveFormDialog = ({ open, onOpenChange, onSave, objective, title = "Nouvel objectif", isAdmin = false }: Props) => {
  const [form, setForm] = useState({
    title: objective?.title || "",
    description: objective?.description || "",
    category: objective?.category || "general",
    deadline: objective?.deadline || "",
    bonus: objective?.bonus ?? 0,
    isQuantified: !!(objective?.kpi_unit),
    kpiType: objective?.kpi_unit || "",
  });

  const handleSave = () => {
    if (!form.title.trim()) return;
    const data: Partial<Objective> = {
      title: form.title,
      description: form.description,
      category: form.category,
      deadline: form.deadline,
      kpi_unit: form.isQuantified ? form.kpiType : "",
    };
    if (isAdmin) {
      data.bonus = form.bonus;
    }
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Titre *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre de l'objectif" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrivez l'objectif en détail..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Catégorie</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date d'échéance</Label>
              <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <Switch
              checked={form.isQuantified}
              onCheckedChange={v => setForm(f => ({ ...f, isQuantified: v, kpiType: v ? f.kpiType : "" }))}
            />
            <Label className="text-xs font-medium cursor-pointer">Objectif chiffré</Label>
            {form.isQuantified && (
              <Input
                className="ml-auto max-w-[200px] h-8 text-xs"
                value={form.kpiType}
                onChange={e => setForm(f => ({ ...f, kpiType: e.target.value }))}
                placeholder="Ex: Chiffre d'affaires, Nb clients..."
              />
            )}
          </div>
          {isAdmin && (
            <div>
              <Label className="text-xs">Bonus (montant)</Label>
              <Input type="number" min={0} value={form.bonus} onChange={e => setForm(f => ({ ...f, bonus: Number(e.target.value) }))} placeholder="Montant du bonus" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button size="sm" onClick={handleSave} disabled={!form.title.trim()}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ObjectiveFormDialog;
