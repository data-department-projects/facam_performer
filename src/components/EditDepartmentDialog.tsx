import { useState } from "react";
import { Department, ServiceItem } from "@/data/departments";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import MultiSelect from "@/components/ui/multi-select";
import { useProfiles, useProfileOptions } from "@/hooks/useProfiles";

interface EditDepartmentDialogProps {
  department: Department;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dept: Department) => void;
}

const EditDepartmentDialog = ({ department, open, onOpenChange, onSave }: EditDepartmentDialogProps) => {
  const [draft, setDraft] = useState<Department>({ ...department });
  const profiles = useProfiles();
  const profileOptions = useProfileOptions();
  const { departments: allDepartments } = useDepartments();

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setDraft({ ...department });
    onOpenChange(isOpen);
  };

  const set = <K extends keyof Department>(key: K, value: Department[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const addService = () => {
    setDraft(prev => ({
      ...prev,
      services: [...prev.services, { name: "", responsible: "", members: [] }],
    }));
  };

  const updateService = (idx: number, field: keyof ServiceItem, value: string | string[]) => {
    setDraft(prev => ({
      ...prev,
      services: prev.services.map((s, i) => {
        const svc = typeof s === "string" ? { name: s, responsible: "", members: [] } : s;
        return i === idx ? { ...svc, [field]: value } : svc;
      }),
    }));
  };


  const removeService = (idx: number) => {
    setDraft(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = () => {
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <span className="text-xl">{draft.icon}</span>
            Modifier — {draft.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="bg-muted/50 p-1 rounded-lg w-full grid grid-cols-4">
            <TabsTrigger value="general" className="text-xs">Général</TabsTrigger>
            <TabsTrigger value="mission" className="text-xs">Mission</TabsTrigger>
            <TabsTrigger value="services" className="text-xs">Services</TabsTrigger>
            <TabsTrigger value="collaborators" className="text-xs">Collaborateurs</TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                {draft.visibleOnOrgChart !== false ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <Label className="text-xs font-semibold">Visible sur l'organigramme</Label>
                  <p className="text-[10px] text-muted-foreground">Afficher ce département dans l'organigramme</p>
                </div>
              </div>
              <Switch
                checked={draft.visibleOnOrgChart !== false}
                onCheckedChange={v => set("visibleOnOrgChart" as keyof Department, v as Department[keyof Department])}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Nom</Label>
                <Select value={draft.name} onValueChange={v => set("name", v)}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Choisir un département" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {allDepartments
                      .filter(d => d.id !== draft.id)
                      .map(d => (
                        <SelectItem key={d.id} value={d.name}>{d.icon} {d.name}</SelectItem>
                      ))}
                    <SelectItem value={draft.name || "Nouveau Département"}>
                      {draft.name || "Nouveau Département"} (actuel)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Icône</Label>
                <Select value={draft.icon} onValueChange={v => set("icon", v)}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Choisir une icône">{draft.icon ? `${draft.icon}` : "Choisir..."}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {[
                      { icon: "💰", label: "Finance" },
                      { icon: "📊", label: "Statistiques" },
                      { icon: "📈", label: "Croissance" },
                      { icon: "🏦", label: "Banque" },
                      { icon: "💼", label: "Business" },
                      { icon: "🏢", label: "Bureau" },
                      { icon: "🏗️", label: "Construction" },
                      { icon: "🏭", label: "Industrie" },
                      { icon: "⚖️", label: "Juridique" },
                      { icon: "📋", label: "Administration" },
                      { icon: "👥", label: "Ressources Humaines" },
                      { icon: "🎓", label: "Formation" },
                      { icon: "🔧", label: "Technique" },
                      { icon: "⚙️", label: "Ingénierie" },
                      { icon: "💻", label: "Informatique" },
                      { icon: "🌐", label: "Digital" },
                      { icon: "📡", label: "Télécommunications" },
                      { icon: "🔒", label: "Sécurité" },
                      { icon: "📢", label: "Communication" },
                      { icon: "📣", label: "Marketing" },
                      { icon: "🎨", label: "Création" },
                      { icon: "🛒", label: "Commercial" },
                      { icon: "🤝", label: "Partenariat" },
                      { icon: "📦", label: "Logistique" },
                      { icon: "🚚", label: "Transport" },
                      { icon: "🏥", label: "Santé" },
                      { icon: "🔬", label: "Recherche" },
                      { icon: "📐", label: "Architecture" },
                      { icon: "🌍", label: "International" },
                      { icon: "♻️", label: "Environnement" },
                      { icon: "⚡", label: "Énergie" },
                      { icon: "🛡️", label: "Conformité" },
                      { icon: "📝", label: "Rédaction" },
                      { icon: "🗂️", label: "Archives" },
                      { icon: "📞", label: "Relations clients" },
                      { icon: "🎯", label: "Stratégie" },
                    ].map(item => (
                      <SelectItem key={item.icon} value={item.icon}>
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Responsable 1</Label>
                <Select value={draft.head} onValueChange={v => {
                  const p = profiles.find(pr => pr.full_name === v);
                  set("head", v);
                  set("headRoleToday", (p?.poste || ""));
                }}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Choisir un responsable" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {profiles.map(p => (
                      <SelectItem key={p.user_id} value={p.full_name}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Poste</Label>
                <Input value={draft.headRoleToday} readOnly disabled className="text-sm bg-muted/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Responsable 2 <span className="text-muted-foreground">(optionnel)</span></Label>
                <Select value={draft.head2 || "__none__"} onValueChange={v => {
                  const name = v === "__none__" ? "" : v;
                  const p = profiles.find(pr => pr.full_name === name);
                  set("head2" as keyof Department, name as Department[keyof Department]);
                  set("headRoleToday2" as keyof Department, (name ? (p?.poste || "") : "") as Department[keyof Department]);
                }}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Choisir un 2ᵉ responsable" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__none__">— Aucun —</SelectItem>
                    {profiles.map(p => (
                      <SelectItem key={p.user_id} value={p.full_name}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Poste</Label>
                <Input value={draft.headRoleToday2 || ""} readOnly disabled className="text-sm bg-muted/50" />
              </div>
            </div>
          </TabsContent>

          {/* Mission */}
          <TabsContent value="mission" className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mission</Label>
              <Textarea value={draft.missionToday} onChange={e => set("missionToday", e.target.value)} rows={6} className="text-sm" />
            </div>
          </TabsContent>

          {/* Services */}
          <TabsContent value="services" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services du département</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addService}>
                <Plus className="w-3 h-3" /> Ajouter
              </Button>
            </div>
            {draft.services.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Aucun service défini</p>
            )}
            <div className="space-y-4">
              {draft.services.map((service, i) => {
                const svc = typeof service === "string" ? { name: service, responsible: "", members: [] } : service;
                return (
                  <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={svc.name}
                        onChange={e => updateService(i, "name", e.target.value)}
                        placeholder="Nom du service"
                        className="text-sm h-8 flex-1"
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeService(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Responsable 1</Label>
                        <Select value={svc.responsible || "__none__"} onValueChange={v => updateService(i, "responsible", v === "__none__" ? "" : v)}>
                          <SelectTrigger className="text-sm h-8">
                            <SelectValue placeholder="Responsable" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Aucun —</SelectItem>
                            {profiles.map(p => (
                              <SelectItem key={p.user_id} value={p.full_name}>{p.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Responsable 2 (optionnel)</Label>
                        <Select value={svc.responsible2 || "__none__"} onValueChange={v => updateService(i, "responsible2", v === "__none__" ? "" : v)}>
                          <SelectTrigger className="text-sm h-8">
                            <SelectValue placeholder="2ᵉ responsable" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Aucun —</SelectItem>
                            {profiles.map(p => (
                              <SelectItem key={p.user_id} value={p.full_name}>{p.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" /> Collaborateurs rattachés
                      </Label>
                      <MultiSelect
                        options={profileOptions}
                        selected={svc.members || []}
                        onChange={v => updateService(i, "members", v)}
                        placeholder="Sélectionner des collaborateurs..."
                        searchPlaceholder="Rechercher un collaborateur..."
                        emptyMessage="Aucun collaborateur trouvé."
                        className="text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Collaborateurs */}
          <TabsContent value="collaborators" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> Collaborateurs rattachés au département
              </Label>
              <p className="text-xs text-muted-foreground">
                Liste automatique des collaborateurs dont le département est défini dans leur profil (Administration → Collaborateurs).
              </p>
              {(() => {
                const deptMembers = profiles.filter(p => p.department_id === draft.id);
                if (deptMembers.length === 0) {
                  return <p className="text-xs text-muted-foreground italic">Aucun collaborateur rattaché à ce département.</p>;
                }
                return (
                  <div className="space-y-1">
                    {deptMembers.map(p => (
                      <div key={p.user_id} className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border border-border text-sm">
                        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{p.full_name}</span>
                        {p.poste && <span className="text-muted-foreground text-xs">— {p.poste}</span>}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-1">{deptMembers.length} collaborateur(s)</p>
                  </div>
                );
              })()}
            </div>
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

export default EditDepartmentDialog;
