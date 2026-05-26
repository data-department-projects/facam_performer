import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, Copy, Sparkles, Upload, X, Image } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Campaign {
  id: string;
  title: string;
  description: string;
  logo_url: string | null;
  custom_image_url: string | null;
  button_label: string | null;
  button_url: string | null;
  duration_seconds: number;
  trigger_type: string;
  date_start: string | null;
  date_end: string | null;
  recurrence: string | null;
  is_active: boolean;
  priority: number;
  max_views: number | null;
  created_at: string;
  created_by: string;
}

const emptyCampaign: Omit<Campaign, "id" | "created_at" | "created_by"> = {
  title: "",
  description: "",
  logo_url: null,
  custom_image_url: null,
  button_label: null,
  button_url: null,
  duration_seconds: 6,
  trigger_type: "first_login",
  date_start: null,
  date_end: null,
  recurrence: null,
  is_active: false,
  priority: 0,
  max_views: null,
};

const TRIGGER_LABELS: Record<string, string> = {
  first_login: "Première connexion",
  date_range: "Plage de dates",
  recurring_daily: "Quotidien",
  recurring_weekly: "Hebdomadaire",
  recurring_monthly: "Mensuel",
  always: "À chaque connexion",
};

const AdminCampaigns = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState(emptyCampaign);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from("campaign_animations")
      .select("*")
      .order("priority", { ascending: false });
    if (data) setCampaigns(data as Campaign[]);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyCampaign);
    setDialogOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      title: c.title,
      description: c.description,
      logo_url: c.logo_url,
      custom_image_url: c.custom_image_url,
      button_label: c.button_label,
      button_url: c.button_url,
      duration_seconds: c.duration_seconds,
      trigger_type: c.trigger_type,
      date_start: c.date_start,
      date_end: c.date_end,
      recurrence: c.recurrence,
      is_active: c.is_active,
      priority: c.priority,
      max_views: (c as any).max_views ?? null,
    });
    setDialogOpen(true);
  };

  const duplicate = (c: Campaign) => {
    setEditing(null);
    setForm({
      title: c.title + " (copie)",
      description: c.description,
      logo_url: c.logo_url,
      custom_image_url: c.custom_image_url,
      button_label: c.button_label,
      button_url: c.button_url,
      duration_seconds: c.duration_seconds,
      trigger_type: c.trigger_type,
      date_start: c.date_start,
      date_end: c.date_end,
      recurrence: c.recurrence,
      is_active: false,
      priority: c.priority,
      max_views: (c as any).max_views ?? null,
    });
    setDialogOpen(true);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 5 Mo");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `campaign-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("campaign-images")
      .upload(filePath, file, { upsert: true });

    if (error) {
      toast.error("Erreur lors du téléchargement de l'image");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("campaign-images")
      .getPublicUrl(filePath);

    setForm({ ...form, custom_image_url: urlData.publicUrl });
    setUploading(false);
    toast.success("Image téléchargée");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    const payload = { ...form } as any;
    if (editing) {
      const { error } = await supabase
        .from("campaign_animations")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (error) { toast.error("Erreur lors de la mise à jour"); return; }
      toast.success("Campagne mise à jour");
    } else {
      const { error } = await supabase
        .from("campaign_animations")
        .insert({ ...payload, created_by: user!.id });
      if (error) { toast.error("Erreur lors de la création"); return; }
      toast.success("Campagne créée");
    }
    setDialogOpen(false);
    fetchCampaigns();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette campagne ?")) return;
    await supabase.from("campaign_animations").delete().eq("id", id);
    toast.success("Campagne supprimée");
    fetchCampaigns();
  };

  const toggleActive = async (c: Campaign) => {
    await supabase
      .from("campaign_animations")
      .update({ is_active: !c.is_active, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    fetchCampaigns();
  };

  const previewCampaign = (c: Campaign) => {
    setEditing(c);
    setPreviewOpen(true);
  };

  if (loading) return <div className="text-sm text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Animations & Campagnes</h3>
          <p className="text-xs text-muted-foreground">Créez et programmez des animations pour vos collaborateurs</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" /> Nouvelle campagne
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Aucune campagne créée</p>
            <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={openNew}>
              Créer ma première campagne
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Card key={c.id} className={`transition-all ${c.is_active ? "border-primary/30 bg-primary/5" : "opacity-75"}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {c.custom_image_url && (
                        <img src={c.custom_image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      )}
                      <h4 className="text-sm font-medium truncate">{c.title}</h4>
                      <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                        {c.is_active ? "Actif" : "Inactif"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {TRIGGER_LABELS[c.trigger_type] || c.trigger_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.description || "Pas de description"}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span>{c.duration_seconds}s</span>
                      {c.date_start && <span>Du {format(new Date(c.date_start), "dd MMM yyyy", { locale: fr })}</span>}
                      {c.date_end && <span>Au {format(new Date(c.date_end), "dd MMM yyyy", { locale: fr })}</span>}
                      <span>Priorité: {c.priority}</span>
                      {(c as any).max_views != null && <span>Max: {(c as any).max_views} vue(s)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => previewCampaign(c)} title="Prévisualiser">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicate(c)} title="Dupliquer">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} title="Modifier">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} className="ml-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)} title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? "Modifier la campagne" : "Nouvelle campagne"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Bienvenue 2026" className="text-sm" />
            </div>



            {/* Image upload */}
            <div>
              <Label className="text-xs">Image de la campagne</Label>
              <div className="mt-1.5 space-y-2">
                {form.custom_image_url ? (
                  <div className="relative inline-block">
                    <img src={form.custom_image_url} alt="Aperçu" className="max-w-[200px] max-h-[120px] rounded-lg border border-border object-contain" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                      onClick={() => setForm({ ...form, custom_image_url: null })}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Image className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {uploading ? "Téléchargement en cours..." : "Cliquez pour charger une image"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">PNG, JPG, WEBP — Max 5 Mo</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadImage}
                />
                {form.custom_image_url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="w-3 h-3" /> Changer l'image
                  </Button>
                )}
              </div>
            </div>



            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Durée (secondes)</Label>
                <Input type="number" min={2} max={30} value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: parseInt(e.target.value) || 6 })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Priorité</Label>
                <Input type="number" min={0} value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} className="text-sm" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Plus élevé = affiché en premier</p>
              </div>
              <div>
                <Label className="text-xs">Nb max de vues</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_views ?? ""}
                  onChange={(e) => setForm({ ...form, max_views: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Illimité"
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Vide = illimité</p>
              </div>
            </div>
            <div>
              <Label className="text-xs">Déclenchement</Label>
              <Select value={form.trigger_type} onValueChange={(v) => setForm({ ...form, trigger_type: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_login">Première connexion</SelectItem>
                  <SelectItem value="date_range">Plage de dates</SelectItem>
                  <SelectItem value="recurring_daily">Quotidien (1x/jour)</SelectItem>
                  <SelectItem value="recurring_weekly">Hebdomadaire (1x/semaine)</SelectItem>
                  <SelectItem value="recurring_monthly">Mensuel (1x/mois)</SelectItem>
                  <SelectItem value="always">À chaque connexion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date début</Label>
                <Input type="date" value={form.date_start || ""} onChange={(e) => setForm({ ...form, date_start: e.target.value || null })} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Date fin</Label>
                <Input type="date" value={form.date_end || ""} onChange={(e) => setForm({ ...form, date_end: e.target.value || null })} className="text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="text-xs">Activer immédiatement</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={uploading}>{editing ? "Mettre à jour" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="bg-background flex flex-col items-center justify-center min-h-[400px] p-8 gap-6">
            {editing?.custom_image_url ? (
              <img src={editing.custom_image_url} alt="" className="max-w-[300px] max-h-[200px] object-contain" />
            ) : editing?.logo_url ? (
              <img src={editing.logo_url} alt="" className="w-48 h-auto object-contain" />
            ) : (
              <img src="/facam_stairway-bleu.png" alt="FACAM STAIRWAY" className="w-48 h-auto object-contain" />
            )}


            <p className="text-[10px] text-muted-foreground/50">
              Durée: {editing?.duration_seconds || 6}s • {TRIGGER_LABELS[editing?.trigger_type || "first_login"]}
              {(editing as any)?.max_views != null && ` • Max ${(editing as any).max_views} vue(s)`}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCampaigns;
