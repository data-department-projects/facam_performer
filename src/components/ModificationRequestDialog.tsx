import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

interface ModificationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: "project" | "milestone";
  entityId: string;
  projectId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  onSuccess?: () => void;
}

const ModificationRequestDialog = ({
  open,
  onOpenChange,
  entityType,
  entityId,
  projectId,
  fieldName,
  oldValue,
  newValue,
  onSuccess,
}: ModificationRequestDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !explanation.trim()) {
      toast({ title: "Explication requise", description: "Veuillez expliquer la raison de cette modification", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("modification_requests").insert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      project_id: projectId,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      explanation: explanation.trim(),
    });

    if (error) {
      toast({ title: "Erreur", description: "Impossible d'envoyer la demande", variant: "destructive" });
    } else {
      toast({ title: "Demande envoyée", description: "Votre demande de modification a été envoyée au Directeur Général pour validation." });
      setExplanation("");
      onOpenChange(false);
      onSuccess?.();
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Demande de modification
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
            <p><span className="font-semibold">Champ :</span> {fieldName}</p>
            <p><span className="font-semibold">Ancienne valeur :</span> {oldValue || "—"}</p>
            <p><span className="font-semibold">Nouvelle valeur :</span> {newValue || "—"}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Explication de la modification *</Label>
            <Textarea
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              placeholder="Expliquez pourquoi cette modification est nécessaire..."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !explanation.trim()}>
            {submitting ? "Envoi..." : "Envoyer la demande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModificationRequestDialog;
