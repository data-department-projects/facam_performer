import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logObjectiveChangeAudit } from "@/hooks/useObjectiveAuditLog";
import { AlertTriangle, ArrowRight, ChevronLeft, Send } from "lucide-react";
import { OBJECTIVE_CATEGORIES, type Objective } from "@/hooks/useObjectives";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: Objective;
  onSuccess?: () => void;
}

const MODIFIABLE_FIELDS = [
  { value: "title", label: "Titre" },
  { value: "description", label: "Description" },
  { value: "category", label: "Catégorie" },
  { value: "deadline", label: "Date d'échéance" },
  { value: "kpi_target", label: "Objectif chiffré (cible KPI)" },
] as const;

type FieldKey = typeof MODIFIABLE_FIELDS[number]["value"];

const getCategoryLabel = (val: string) =>
  OBJECTIVE_CATEGORIES.find(c => c.value === val)?.label || val;

const ObjectiveChangeRequestDialog = ({ open, onOpenChange, objective, onSuccess }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set());
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetState = () => {
    setStep(1);
    setSelectedFields(new Set());
    setNewValues({});
    setExplanation("");
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  const toggleField = (field: FieldKey) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
        setNewValues(v => { const copy = { ...v }; delete copy[field]; return copy; });
      } else {
        next.add(field);
        // Pre-fill with current value
        setNewValues(v => ({ ...v, [field]: String((objective as unknown as Record<string, unknown>)[field] || "") }));
      }
      return next;
    });
  };

  const goToStep2 = () => {
    if (selectedFields.size === 0) {
      toast.error("Veuillez sélectionner au moins un champ à modifier");
      return;
    }
    setStep(2);
  };

  const getOldValue = (field: string) => String((objective as unknown as Record<string, unknown>)[field] || "");

  const getDisplayValue = (field: string, value: string) => {
    if (field === "category") return getCategoryLabel(value);
    return value || "—";
  };

  const handleSubmit = async () => {
    if (!user || !explanation.trim()) {
      toast.error("Veuillez expliquer la raison de votre demande");
      return;
    }

    // Verify at least one field has a different value
    const changedFields = Array.from(selectedFields).filter(
      f => newValues[f] !== getOldValue(f)
    );
    if (changedFields.length === 0) {
      toast.error("Aucune modification détectée");
      return;
    }

    setSubmitting(true);

    // Create one change request per modified field
    const requests = changedFields.map(field => ({
      user_id: user.id,
      objective_id: objective.id,
      request_type: "modification",
      field_name: field,
      old_value: getOldValue(field),
      new_value: newValues[field],
      explanation: explanation.trim(),
    }));

    const { data, error } = await supabase
      .from("objective_change_requests")
      .insert(requests as import("@/integrations/supabase/types").Database["public"]["Tables"]["objective_change_requests"]["Insert"][])
      .select();

    // Update objective status to "pending_validation" (En traitement)
    if (!error) {
      await supabase
        .from("objectives")
        .update({ status: "pending_validation" })
        .eq("id", objective.id);
    }

    if (error) {
      toast.error("Impossible d'envoyer la demande");
      console.error(error);
    } else if (data) {
      // Audit log for each
      for (const row of data as import("@/integrations/supabase/types").Database["public"]["Tables"]["objective_change_requests"]["Row"][]) {
        await logObjectiveChangeAudit({
          change_request_id: row.id,
          objective_id: objective.id,
          user_id: user.id,
          action: "request_created",
          actor_id: user.id,
          actor_role: "collaborateur",
          details: {
            request_type: "modification",
            field_name: row.field_name,
            old_value: row.old_value,
            new_value: row.new_value,
            explanation: explanation.trim(),
          },
        });
      }
      toast.success("Demande de modification envoyée pour validation");
      resetState();
      onOpenChange(false);
      onSuccess?.();
    }
    setSubmitting(false);
  };

  const renderFieldEditor = (field: FieldKey) => {
    const currentValue = newValues[field] || "";

    switch (field) {
      case "category":
        return (
          <Select value={currentValue} onValueChange={v => setNewValues(prev => ({ ...prev, category: v }))}>
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="Sélectionner une catégorie..." />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVE_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "deadline":
        return (
          <Input
            type="date"
            value={currentValue}
            onChange={e => setNewValues(prev => ({ ...prev, deadline: e.target.value }))}
            className="text-xs h-8"
          />
        );
      case "description":
        return (
          <Textarea
            value={currentValue}
            onChange={e => setNewValues(prev => ({ ...prev, description: e.target.value }))}
            className="text-xs min-h-[60px]"
            placeholder="Nouvelle description..."
          />
        );
      default:
        return (
          <Input
            value={currentValue}
            onChange={e => setNewValues(prev => ({ ...prev, [field]: e.target.value }))}
            className="text-xs h-8"
            placeholder={`Nouveau ${MODIFIABLE_FIELDS.find(f => f.value === field)?.label.toLowerCase()}...`}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Demande de modification
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === 1 ? "Sélectionnez les éléments que vous souhaitez modifier" : "Modifiez les valeurs et expliquez les raisons"}
          </DialogDescription>
        </DialogHeader>

        {/* Objective info */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs">
          <p className="font-semibold">{objective.title}</p>
          {objective.description && <p className="text-muted-foreground mt-1 line-clamp-2">{objective.description}</p>}
        </div>

        {step === 1 ? (
          /* Step 1: Field selection as checkboxes */
          <div className="space-y-3">
            <Label className="text-xs font-semibold">Éléments à modifier :</Label>
            <div className="space-y-2">
              {MODIFIABLE_FIELDS.map(field => (
                <label
                  key={field.value}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedFields.has(field.value)}
                    onCheckedChange={() => toggleField(field.value)}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{field.label}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Actuel : {getDisplayValue(field.value, getOldValue(field.value))}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : (
          /* Step 2: Edit selected fields + explanation */
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {Array.from(selectedFields).map(field => {
              const label = MODIFIABLE_FIELDS.find(f => f.value === field)?.label || field;
              const oldVal = getOldValue(field);
              return (
                <div key={field} className="space-y-1.5 p-3 rounded-lg border border-border bg-card">
                  <Label className="text-xs font-semibold">{label}</Label>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    Valeur actuelle : <Badge variant="outline" className="text-[10px] font-normal">{getDisplayValue(field, oldVal)}</Badge>
                  </p>
                  {renderFieldEditor(field as FieldKey)}
                </div>
              );
            })}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Raisons de la modification *</Label>
              <Textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                placeholder="Expliquez pourquoi ces modifications sont nécessaires..."
                className="min-h-[80px]"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 2 && (
            <Button variant="outline" size="sm" onClick={() => setStep(1)} className="mr-auto gap-1">
              <ChevronLeft className="w-3 h-3" /> Retour
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => handleClose(false)}>Annuler</Button>
          {step === 1 ? (
            <Button size="sm" onClick={goToStep2} disabled={selectedFields.size === 0} className="gap-1">
              Suivant <ArrowRight className="w-3 h-3" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !explanation.trim()} className="gap-1">
              <Send className="w-3 h-3" />
              {submitting ? "Envoi..." : "Envoyer la demande"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ObjectiveChangeRequestDialog;
