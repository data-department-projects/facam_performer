import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { Objective } from "@/hooks/useObjectives";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: Objective;
  mode: "s1" | "s2";
  onSave: (id: string, updates: Partial<Objective>) => void;
}

const ObjectiveEvalDialog = ({ open, onOpenChange, objective, mode, onSave }: Props) => {
  const isS1 = mode === "s1";
  const [pct, setPct] = useState(isS1 ? (objective.s1_achievement_pct ?? objective.achievement_pct) : (objective.final_achievement_pct ?? objective.achievement_pct));
  const [comment, setComment] = useState(isS1 ? (objective.s1_comment || "") : (objective.final_comment || ""));
  const [bonus, setBonus] = useState(objective.bonus ?? 0);

  const handleSave = () => {
    const updates: Partial<Objective> = { bonus };
    if (isS1) {
      updates.s1_achievement_pct = pct;
      updates.s1_comment = comment;
      updates.s1_reviewed_at = new Date().toISOString();
      updates.achievement_pct = pct;
    } else {
      updates.final_achievement_pct = pct;
      updates.final_comment = comment;
      updates.final_reviewed_at = new Date().toISOString();
      updates.achievement_pct = pct;
    }
    onSave(objective.id, updates);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isS1 ? "Revue S1" : "Évaluation Finale S2"} — {objective.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Pourcentage d'atteinte : {pct}%</Label>
            <Slider value={[pct]} onValueChange={v => setPct(v[0])} min={0} max={100} step={5} className="mt-2" />
          </div>
          <div>
            <Label className="text-xs">Bonus (montant)</Label>
            <Input type="number" min={0} value={bonus} onChange={e => setBonus(Number(e.target.value))} placeholder="Montant du bonus" />
          </div>
          <div>
            <Label className="text-xs">Commentaire</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Commentaire d'évaluation..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button size="sm" onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ObjectiveEvalDialog;
