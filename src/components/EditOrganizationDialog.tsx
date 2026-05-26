import { useState } from "react";
import { Organization } from "@/contexts/OrganizationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface EditOrganizationDialogProps {
  organization: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (org: Organization) => void;
}

const EditOrganizationDialog = ({ organization, open, onOpenChange, onSave }: EditOrganizationDialogProps) => {
  const [draft, setDraft] = useState<Organization>({ ...organization });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setDraft({ ...organization });
    onOpenChange(isOpen);
  };

  const set = <K extends keyof Organization>(key: K, value: Organization[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Modifier l'Organisation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-xs">Nom de l'organisation</Label>
            <Input value={draft.name} onChange={e => set("name", e.target.value)} className="text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Dirigeant</Label>
              <Input value={draft.leader} onChange={e => set("leader", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Direction</Label>
              <Input value={draft.leaderDirection || ""} onChange={e => set("leaderDirection", e.target.value)} className="text-sm" placeholder="Ex: Direction Générale" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Rôle dirigeant (Aujourd'hui)</Label>
              <Input value={draft.leaderRoleToday} onChange={e => set("leaderRoleToday", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Rôle dirigeant (Demain)</Label>
              <Input value={draft.leaderRoleTomorrow} onChange={e => set("leaderRoleTomorrow", e.target.value)} className="text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Titre (Aujourd'hui)</Label>
              <Input value={draft.titleToday} onChange={e => set("titleToday", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Titre (Demain)</Label>
              <Input value={draft.titleTomorrow} onChange={e => set("titleTomorrow", e.target.value)} className="text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Description (Aujourd'hui)</Label>
              <Input value={draft.descriptionToday} onChange={e => set("descriptionToday", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Description (Demain)</Label>
              <Input value={draft.descriptionTomorrow} onChange={e => set("descriptionTomorrow", e.target.value)} className="text-sm" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-sm">Annuler</Button>
          <Button onClick={() => { onSave(draft); onOpenChange(false); }} className="text-sm">Enregistrer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrganizationDialog;
