import { useState } from "react";
import { Committee, CommitteeMember, frequencyLabels } from "@/data/committees";
import { getDepartmentDisplayName } from "@/data/departments";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useDepartments } from "@/contexts/DepartmentsContext";
import MultiSelect, { MultiSelectOption } from "@/components/ui/multi-select";
import { useProfiles } from "@/hooks/useProfiles";

interface EditCommitteeDialogProps {
  committee: Committee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (c: Committee) => void;
}

const EditCommitteeDialog = ({ committee, open, onOpenChange, onSave }: EditCommitteeDialogProps) => {
  const [draft, setDraft] = useState<Committee>({ ...committee, members: [...committee.members], linkedDepartmentIds: [...committee.linkedDepartmentIds] });
  const { departments } = useDepartments();
  const collaborators = useProfiles();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setDraft({ ...committee, members: [...committee.members], linkedDepartmentIds: [...committee.linkedDepartmentIds] });
    onOpenChange(isOpen);
  };

  const toggleDept = (deptId: string) => {
    setDraft(prev => ({
      ...prev,
      linkedDepartmentIds: prev.linkedDepartmentIds.includes(deptId)
        ? prev.linkedDepartmentIds.filter(id => id !== deptId)
        : [...prev.linkedDepartmentIds, deptId],
    }));
  };

  const handleSave = () => {
    onSave(draft);
    onOpenChange(false);
  };

  const collabOptions: MultiSelectOption[] = collaborators.map(c => {
    const dept = departments.find(d => d.id === c.department_id);
    const sublabel = [getDepartmentDisplayName(dept), c.service, c.poste].filter(Boolean).join(" · ");
    return {
      value: c.user_id,
      label: c.full_name,
      sublabel,
    };
  });

  // Responsible: stored as comma-separated string, convert to/from array of user_ids
  const responsibleIds = (draft.responsible || "").split(",").map(s => s.trim()).filter(Boolean);

  const setResponsibleIds = (ids: string[]) => {
    // Store as comma-separated full names for display compatibility
    const names = ids.map(id => collaborators.find(c => c.user_id === id)?.full_name || id);
    setDraft(prev => ({ ...prev, responsible: names.join(", "), responsibleIds: ids }));
  };

  // For responsible, try to match existing names to user_ids on first load
  const resolvedResponsibleIds = (draft as any).responsibleIds ||
    responsibleIds.map(nameOrId => {
      const byId = collaborators.find(c => c.user_id === nameOrId);
      if (byId) return nameOrId;
      const byName = collaborators.find(c => c.full_name === nameOrId);
      return byName?.user_id || nameOrId;
    }).filter(id => collaborators.some(c => c.user_id === id));

  // Participants: stored as CommitteeMember[], convert to/from user_id selection
  const memberIds = draft.members
    .map(m => {
      if ((m as any).userId) return (m as any).userId;
      const match = collaborators.find(c => c.full_name === m.name);
      return match?.user_id;
    })
    .filter(Boolean) as string[];

  const setMemberIds = (ids: string[]) => {
    const newMembers: CommitteeMember[] = ids.map(id => {
      const existing = draft.members.find(m => (m as any).userId === id || m.name === collaborators.find(c => c.user_id === id)?.full_name);
      const collab = collaborators.find(c => c.user_id === id);
      return {
        name: collab?.full_name || id,
        role: existing?.role || "Membre",
        departmentId: collab?.department_id || existing?.departmentId || "",
        userId: id,
      } as CommitteeMember & { userId: string };
    });
    setDraft(prev => ({ ...prev, members: newMembers }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            Modifier — {draft.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="bg-muted/50 p-1 rounded-lg w-full grid grid-cols-4">
            <TabsTrigger value="general" className="text-xs">Général</TabsTrigger>
            <TabsTrigger value="directions" className="text-xs">Départements</TabsTrigger>
            <TabsTrigger value="participants" className="text-xs">Participants</TabsTrigger>
            <TabsTrigger value="guests" className="text-xs">Invités</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs">Nom du comité</Label>
              <Input value={draft.name} onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Responsable(s)</Label>
              <MultiSelect
                options={collabOptions}
                selected={resolvedResponsibleIds}
                onChange={setResponsibleIds}
                placeholder="Sélectionner les responsables..."
                searchPlaceholder="Rechercher un collaborateur..."
                emptyMessage="Aucun collaborateur trouvé."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Objectif / Mission</Label>
              <Textarea value={draft.purpose} onChange={e => setDraft(prev => ({ ...prev, purpose: e.target.value }))} rows={3} className="text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Fréquence</Label>
              <Select value={draft.frequency} onValueChange={v => setDraft(prev => ({ ...prev, frequency: v as Committee["frequency"] }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(frequencyLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Institutions financières (facultatif)</Label>
              <p className="text-[10px] text-muted-foreground">Ajoutez les institutions avec lesquelles ce comité est tenu.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nom de l'institution"
                  className="text-sm h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !(draft.institutions || []).includes(val)) {
                        setDraft(prev => ({ ...prev, institutions: [...(prev.institutions || []), val] }));
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs shrink-0"
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    const val = input.value.trim();
                    if (val && !(draft.institutions || []).includes(val)) {
                      setDraft(prev => ({ ...prev, institutions: [...(prev.institutions || []), val] }));
                      input.value = "";
                    }
                  }}
                >
                  Ajouter
                </Button>
              </div>
              {(draft.institutions || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(draft.institutions || []).map((inst) => (
                    <span key={inst} className="flex items-center gap-1 bg-destructive/10 text-destructive text-xs px-2 py-0.5 rounded-full">
                      🏦 {inst}
                      <button
                        type="button"
                        className="hover:text-destructive/70 ml-0.5"
                        onClick={() => setDraft(prev => ({ ...prev, institutions: (prev.institutions || []).filter(i => i !== inst) }))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="directions" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">Rattachez ce comité à un ou plusieurs départements (optionnel).</p>
            <div className="space-y-2">
              {departments.map(dept => (
                <label key={dept.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                  <Checkbox
                    checked={draft.linkedDepartmentIds.includes(dept.id)}
                    onCheckedChange={() => toggleDept(dept.id)}
                  />
                  <span className="text-base">{dept.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{getDepartmentDisplayName(dept)}</p>
                    <p className="text-xs text-muted-foreground truncate">{dept.head} — {dept.headRoleTomorrow}</p>
                  </div>
                </label>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="participants" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs">Participants ({memberIds.length})</Label>
              <MultiSelect
                options={collabOptions}
                selected={memberIds}
                onChange={setMemberIds}
                placeholder="Sélectionner les participants..."
                searchPlaceholder="Rechercher un collaborateur..."
                emptyMessage="Aucun collaborateur trouvé."
              />
            </div>
            {draft.members.length > 0 && (
              <div className="space-y-2 mt-4">
                <Label className="text-xs text-muted-foreground">Rôles des participants</Label>
                {draft.members.map((m, i) => {
                  const collab = collaborators.find(c => c.user_id === (m as any).userId || c.full_name === m.name);
                  const dept = collab ? departments.find(d => d.id === collab.department_id) : null;
                  return (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {m.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[getDepartmentDisplayName(dept), collab?.service, collab?.poste].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Input
                        value={m.role}
                        onChange={e => {
                          const newMembers = [...draft.members];
                          newMembers[i] = { ...newMembers[i], role: e.target.value };
                          setDraft(prev => ({ ...prev, members: newMembers }));
                        }}
                        placeholder="Rôle"
                        className="w-32 text-xs h-8"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="guests" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">Ajoutez des invités internes (collaborateurs) ou externes (nom libre).</p>
            <MultiSelect
              options={collabOptions}
              selected={(draft.guests || []).filter(g => collaborators.some(c => c.user_id === g))}
              onChange={(ids) => {
                const externals = (draft.guests || []).filter(g => !collaborators.some(c => c.user_id === g));
                setDraft(prev => ({ ...prev, guests: [...ids, ...externals] }));
              }}
              placeholder="Sélectionner des collaborateurs..."
              searchPlaceholder="Rechercher un collaborateur..."
              emptyMessage="Aucun collaborateur trouvé."
            />
            <div className="space-y-2">
              <Label className="text-xs">Ajouter un invité externe</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nom de l'invité externe"
                  className="text-sm h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !(draft.guests || []).includes(`ext:${val}`)) {
                        setDraft(prev => ({ ...prev, guests: [...(prev.guests || []), `ext:${val}`] }));
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs shrink-0"
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    const val = input.value.trim();
                    if (val && !(draft.guests || []).includes(`ext:${val}`)) {
                      setDraft(prev => ({ ...prev, guests: [...(prev.guests || []), `ext:${val}`] }));
                      input.value = "";
                    }
                  }}
                >
                  Ajouter
                </Button>
              </div>
            </div>
            {(draft.guests || []).length > 0 && (
              <div className="space-y-2 mt-2">
                <Label className="text-xs text-muted-foreground">Invités sélectionnés</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(draft.guests || []).map(gId => {
                    const isExternal = gId.startsWith("ext:");
                    const name = isExternal ? gId.slice(4) : (collaborators.find(c => c.user_id === gId)?.full_name || gId);
                    return (
                      <div key={gId} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isExternal ? "bg-secondary/20 text-secondary-foreground" : "bg-accent/10 text-accent"}`}>
                          {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-xs">{name}</span>
                        {isExternal && <span className="text-[9px] text-muted-foreground">(externe)</span>}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive ml-0.5"
                          onClick={() => setDraft(prev => ({ ...prev, guests: (prev.guests || []).filter(g => g !== gId) }))}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-sm">Annuler</Button>
          <Button onClick={handleSave} className="text-sm">Enregistrer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditCommitteeDialog;
