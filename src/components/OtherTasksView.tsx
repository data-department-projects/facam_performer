import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Check, Clock, CheckCircle2, Circle, CalendarDays } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const DEFAULT_CATEGORIES = [
  "Réunions",
  "Production de rapports",
  "Formation",
  "Veille stratégique",
];

interface OtherTask {
  id: string;
  user_id: string;
  category: string;
  custom_category: string | null;
  title: string;
  description: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  todo: { label: "À faire", icon: <Circle className="w-3.5 h-3.5" />, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "En cours", icon: <Clock className="w-3.5 h-3.5" />, color: "bg-primary/10 text-primary" },
  done: { label: "Terminé", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const OtherTasksView = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<OtherTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OtherTask | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [addingCustomCat, setAddingCustomCat] = useState(false);
  const [newCustomCat, setNewCustomCat] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Form state
  const [formCategory, setFormCategory] = useState("Réunions");
  const [formCustomCategory, setFormCustomCategory] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState("todo");
  const [formDueDate, setFormDueDate] = useState("");

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories, "Autres"];

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("other_tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setTasks(data as unknown as OtherTask[]);
      // Extract unique custom categories
      const customs = data
        .filter((t: any) => t.category === "Autres" && t.custom_category)
        .map((t: any) => t.custom_category as string);
      setCustomCategories((prev) => [...new Set([...prev, ...customs])]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const resetForm = () => {
    setFormCategory("Réunions");
    setFormCustomCategory("");
    setFormTitle("");
    setFormDescription("");
    setFormStatus("todo");
    setFormDueDate("");
    setEditingTask(null);
  };

  const openAdd = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (task: OtherTask) => {
    setEditingTask(task);
    if (DEFAULT_CATEGORIES.includes(task.category)) {
      setFormCategory(task.category);
    } else if (task.category === "Autres") {
      setFormCategory("Autres");
      setFormCustomCategory(task.custom_category || "");
    } else {
      // It's a custom category stored as category name
      setFormCategory(task.category);
    }
    setFormTitle(task.title);
    setFormDescription(task.description);
    setFormStatus(task.status);
    setFormDueDate(task.due_date || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formTitle.trim()) {
      toast({ title: "Erreur", description: "Le titre est obligatoire.", variant: "destructive" });
      return;
    }

    const payload = {
      user_id: user.id,
      category: formCategory,
      custom_category: formCategory === "Autres" ? formCustomCategory || null : null,
      title: formTitle.trim(),
      description: formDescription.trim(),
      status: formStatus,
      due_date: formDueDate || null,
      updated_at: new Date().toISOString(),
    };

    if (editingTask) {
      const { error } = await supabase.from("other_tasks").update(payload).eq("id", editingTask.id);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Tâche mise à jour" });
    } else {
      const { error } = await supabase.from("other_tasks").insert(payload);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Tâche ajoutée" });
    }

    setDialogOpen(false);
    resetForm();
    fetchTasks();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("other_tasks").delete().eq("id", id);
    if (!error) { toast({ title: "Tâche supprimée" }); fetchTasks(); }
  };

  const handleStatusToggle = async (task: OtherTask) => {
    const next = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    await supabase.from("other_tasks").update({ status: next, updated_at: new Date().toISOString() }).eq("id", task.id);
    fetchTasks();
  };

  const addCustomCategory = () => {
    if (newCustomCat.trim() && !customCategories.includes(newCustomCat.trim())) {
      setCustomCategories((prev) => [...prev, newCustomCat.trim()]);
      setNewCustomCat("");
      setAddingCustomCat(false);
    }
  };

  const filteredTasks = filterCategory === "all"
    ? tasks
    : tasks.filter((t) => t.category === filterCategory);

  const getCategoryLabel = (task: OtherTask) =>
    task.category === "Autres" && task.custom_category ? task.custom_category : task.category;

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="Filtrer par catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {allCategories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="text-xs gap-1.5" onClick={openAdd}>
          <Plus className="w-3.5 h-3.5" /> Nouvelle tâche
        </Button>
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Aucune tâche pour le moment.</p>
          <Button variant="outline" size="sm" className="mt-3 text-xs gap-1.5" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" /> Ajouter une tâche
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const st = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
            return (
              <Card key={task.id} className="p-3 flex items-start gap-3 group hover:shadow-md transition-shadow">
                <button
                  onClick={() => handleStatusToggle(task)}
                  className="mt-0.5 shrink-0 rounded-full p-1 hover:bg-muted transition-colors"
                  title="Changer le statut"
                >
                  {st.icon}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {getCategoryLabel(task)}
                    </Badge>
                    <Badge className={`text-[10px] px-1.5 py-0 ${st.color} border-0`}>
                      {st.label}
                    </Badge>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                  )}
                  {task.due_date && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      {format(new Date(task.due_date), "dd MMM yyyy", { locale: fr })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(task)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(task.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { resetForm(); } setDialogOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{editingTask ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Catégorie</label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom category input for "Autres" */}
            {formCategory === "Autres" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Préciser la catégorie</label>
                <div className="flex gap-2">
                  <Input
                    value={formCustomCategory}
                    onChange={(e) => setFormCustomCategory(e.target.value)}
                    placeholder="Ex: Audit, Événement..."
                    className="h-9 text-xs flex-1"
                  />
                  {formCustomCategory.trim() && !customCategories.includes(formCustomCategory.trim()) && (
                    <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => {
                      if (formCustomCategory.trim()) {
                        setCustomCategories((prev) => [...new Set([...prev, formCustomCategory.trim()])]);
                        toast({ title: `Catégorie "${formCustomCategory.trim()}" ajoutée` });
                      }
                    }}>
                      <Plus className="w-3 h-3 mr-1" /> Sauver
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Titre *</label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Titre de la tâche" className="h-9 text-xs" />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description (optionnel)" className="text-xs min-h-[60px]" />
            </div>

            {/* Status */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Statut</label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-1.5">{v.icon} {v.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date d'échéance</label>
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="h-9 text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button size="sm" className="text-xs" onClick={handleSave}>
              <Check className="w-3.5 h-3.5 mr-1" /> {editingTask ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OtherTasksView;
