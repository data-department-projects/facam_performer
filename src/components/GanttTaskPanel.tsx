import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { useProjects } from "@/contexts/ProjectsContext";
import { useProfiles } from "@/hooks/useProfiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  X, Save, Upload, Download, FileSpreadsheet,
  AlertTriangle, CheckCircle2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { ProjectGanttTask } from "@/data/projects";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GanttTaskPanelProps {
  mode: "create" | "edit" | "import";
  projectId: string;
  task?: ProjectGanttTask;      // pour le mode edit
  onClose: () => void;
}

// ─── Excel column mapping ─────────────────────────────────────────────────────
// Col A: Titre (requis)
// Col B: Assignés (séparés par ";")
// Col C: Date début (DD/MM/YYYY ou YYYY-MM-DD)
// Col D: Date fin / Deadline (DD/MM/YYYY ou YYYY-MM-DD)
// Col E: Statut (planned / in-progress / done) – défaut: planned
// Col F: Description
// Col G: Avancement % (0-100) – défaut: 0

function parseExcelDate(val: unknown): string {
  if (!val) return "";
  if (typeof val === "number") {
    // Excel serial number → JS Date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const dd = String(d.d).padStart(2, "0");
      const mm = String(d.m).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const str = String(val).trim();
  // DD/MM/YYYY
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  const m2 = str.match(/^\d{4}-\d{2}-\d{2}$/);
  if (m2) return str;
  return "";
}

function normalizeStatus(val: unknown): "planned" | "in-progress" | "done" {
  const s = String(val || "").toLowerCase().trim();
  if (s === "done" || s === "terminé" || s === "termine") return "done";
  if (s === "in-progress" || s === "en cours" || s === "encours") return "in-progress";
  return "planned";
}

function fmtDisplay(iso: string) {
  try { return format(parseISO(iso), "dd/MM/yyyy", { locale: fr }); } catch { return iso; }
}

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Titre de la tâche *", "Assignés (séparés par ;)", "Date début *", "Date fin / Deadline *", "Statut", "Description", "Avancement (%)"],
    ["Développement API",   "Jean Dupont;Marie Martin",  "01/01/2026",   "31/03/2026",            "planned", "Développer les endpoints REST", "0"],
    ["Tests unitaires",     "Paul Durand",               "01/02/2026",   "28/02/2026",            "in-progress", "", "40"],
    ["Livraison V1",        "Jean Dupont",               "01/04/2026",   "15/04/2026",            "planned", "Release finale", "0"],
  ]);

  // Style the header row
  ws["!cols"] = [
    { wch: 30 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 15 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tâches");
  XLSX.writeFile(wb, "modele_gantt.xlsx");
}

// ─── Import preview row ───────────────────────────────────────────────────────

interface PreviewRow {
  title: string;
  assignees: string[];
  startDate: string;
  deadline: string;
  status: "planned" | "in-progress" | "done";
  description: string;
  progress: number;
  errors: string[];
}

// ─── Main component ───────────────────────────────────────────────────────────

const GanttTaskPanel = ({ mode: initialMode, projectId, task, onClose }: GanttTaskPanelProps) => {
  const { projects, addGanttTask, updateGanttTask, importGanttTasks } = useProjects();
  const profiles = useProfiles();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"create" | "edit" | "import">(initialMode);

  // ── Form state ──
  const [form, setForm] = useState<{
    title: string; assignees: string[]; startDate: string;
    deadline: string; status: "done" | "in-progress" | "planned";
    description: string; progress: number;
  }>({
    title: task?.title ?? "",
    assignees: task?.assignees ?? [],
    startDate: task?.startDate ?? "",
    deadline: task?.deadline ?? "",
    status: task?.status ?? "planned",
    description: task?.description ?? "",
    progress: task?.progress ?? 0,
  });

  // ── Project selection (create / import) ──
  // In create mode the user can pick any project; in edit the project is fixed.
  const [localProjectId, setLocalProjectId] = useState(projectId || projects[0]?.id || "");

  // ── Import state ──
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const activeProjectId = mode === "edit" ? projectId : localProjectId;
  const proj = projects.find(p => p.id === activeProjectId);

  // ── Assignee multi-select ──
  const toggleAssignee = (name: string) => {
    setForm(f => ({
      ...f,
      assignees: f.assignees.includes(name)
        ? f.assignees.filter(a => a !== name)
        : [...f.assignees, name],
    }));
  };

  // ── Save task ──
  const handleSave = () => {
    if (!form.title.trim()) {
      toast({ title: "Champ requis", description: "Le titre de la tâche est obligatoire.", variant: "destructive" });
      return;
    }
    if (!form.startDate || !form.deadline) {
      toast({ title: "Dates manquantes", description: "Veuillez définir une date de début et une date de fin.", variant: "destructive" });
      return;
    }
    if (form.startDate > form.deadline) {
      toast({ title: "Dates invalides", description: "La date de début doit être avant la date de fin.", variant: "destructive" });
      return;
    }

    const ganttTask: ProjectGanttTask = {
      id: task?.id ?? `gt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: form.title.trim(),
      assignees: form.assignees,
      startDate: form.startDate,
      deadline: form.deadline,
      status: form.status,
      description: form.description.trim() || undefined,
      progress: form.progress,
      createdAt: task?.createdAt ?? new Date().toISOString().split("T")[0],
    };

    if (mode === "edit" && task) {
      updateGanttTask(projectId, ganttTask);
      toast({ title: "Tâche mise à jour ✓" });
    } else {
      addGanttTask(localProjectId, ganttTask);
      toast({ title: "Tâche créée ✓" });
    }
    onClose();
  };

  // ── Excel file handler ──
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as unknown[][];

      const parsed: PreviewRow[] = [];
      // Skip header row (row 0)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const title = String(row[0] || "").trim();
        if (!title) continue;

        const assigneesRaw = String(row[1] || "").trim();
        const assignees = assigneesRaw
          ? assigneesRaw.split(/[;,]/).map(s => s.trim()).filter(Boolean)
          : [];
        const startDate = parseExcelDate(row[2]);
        const deadline = parseExcelDate(row[3]);
        const status = normalizeStatus(row[4]);
        const description = String(row[5] || "").trim();
        const progress = Math.min(100, Math.max(0, Number(row[6]) || 0));

        const errors: string[] = [];
        if (!startDate) errors.push("Date début invalide");
        if (!deadline) errors.push("Date fin invalide");
        if (startDate && deadline && startDate > deadline) errors.push("Début > Fin");

        parsed.push({ title, assignees, startDate, deadline, status, description, progress, errors });
      }
      setPreview(parsed);
      setShowPreview(true);
    };
    reader.readAsArrayBuffer(file);
    // reset file input
    e.target.value = "";
  }, []);

  // ── Import valid rows ──
  const handleImport = () => {
    const valid = preview.filter(r => r.errors.length === 0);
    if (valid.length === 0) {
      toast({ title: "Aucune ligne valide", variant: "destructive" });
      return;
    }
    const tasks: ProjectGanttTask[] = valid.map(r => ({
      id: `gt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: r.title,
      assignees: r.assignees,
      startDate: r.startDate,
      deadline: r.deadline,
      status: r.status,
      description: r.description || undefined,
      progress: r.progress,
      createdAt: new Date().toISOString().split("T")[0],
    }));
    importGanttTasks(localProjectId, tasks);
    toast({ title: `${tasks.length} tâche${tasks.length > 1 ? "s" : ""} importée${tasks.length > 1 ? "s" : ""} ✓` });
    onClose();
  };

  const STATUS_LABEL = { planned: "Planifié", "in-progress": "En cours", done: "Terminé" };
  const STATUS_COLOR: Record<string, string> = {
    planned: "bg-muted text-muted-foreground border border-border",
    "in-progress": "bg-primary/10 text-primary border border-primary/20",
    done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };

  return (
    <motion.div
      initial={{ x: 440, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 440, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed right-0 top-0 h-full w-[420px] bg-card border-l border-border shadow-elevated z-50 flex flex-col overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-border bg-muted/30">
        <div className="flex-1">
          <p className="font-display font-bold text-sm">
            {mode === "create" && "Nouvelle tâche"}
            {mode === "edit" && "Modifier la tâche"}
            {mode === "import" && "Importer depuis Excel"}
          </p>
          {proj && <p className="text-[11px] text-muted-foreground mt-0.5">{proj.name}</p>}
        </div>

        {/* Mode switcher */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(["create", "import"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`h-6 px-2 rounded text-[10px] font-medium transition-colors ${
                mode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "create" ? "Manuel" : "Excel"}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        {/* ────── CREATE / EDIT mode ────── */}
        {(mode === "create" || mode === "edit") && (
          <div className="p-5 space-y-5">
            {/* Project — sélectionnable en création, lecture seule en édition */}
            <div className="space-y-1">
              <Label className="text-[11px]">Projet *</Label>
              {mode === "edit" ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                  {proj && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />}
                  <span className="text-xs font-medium">{proj?.name ?? "—"}</span>
                </div>
              ) : (
                <Select value={localProjectId} onValueChange={setLocalProjectId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choisir un projet…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span>{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label className="text-[11px]">Titre de la tâche *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex. Développement module reporting"
                className="h-9 text-sm"
                autoFocus
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Date de début *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Date de fin *</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Status + Progress */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Statut</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as typeof form.status }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planifié</SelectItem>
                    <SelectItem value="in-progress">En cours</SelectItem>
                    <SelectItem value="done">Terminé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Avancement — {form.progress}%</Label>
                <input
                  type="range"
                  min={0} max={100} step={5}
                  value={form.progress}
                  onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))}
                  className="w-full mt-2.5 accent-primary"
                />
              </div>
            </div>

            {/* Assignees */}
            <div className="space-y-2">
              <Label className="text-[11px]">Personnes assignées</Label>
              {form.assignees.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.assignees.map(name => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-medium"
                    >
                      {name}
                      <button onClick={() => toggleAssignee(name)} className="hover:text-destructive">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/20">
                {profiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">Aucun profil disponible</p>
                ) : (
                  profiles.map(p => {
                    const selected = form.assignees.includes(p.full_name);
                    return (
                      <button
                        key={p.user_id}
                        onClick={() => toggleAssignee(p.full_name)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors border-b border-border/30 last:border-0 ${selected ? "bg-primary/5" : ""}`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? "border-primary bg-primary" : "border-border"
                        }`}>
                          {selected && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{p.full_name}</p>
                          {p.poste && <p className="text-[10px] text-muted-foreground truncate">{p.poste}</p>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-[11px]">Description (optionnel)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Décrivez brièvement cette tâche…"
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
        )}

        {/* ────── IMPORT mode ────── */}
        {mode === "import" && (
          <div className="p-5 space-y-5">
            {/* Project selector for import */}
            <div className="space-y-1">
              <Label className="text-[11px]">Importer dans le projet</Label>
              <Select value={localProjectId} onValueChange={setLocalProjectId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template download */}
            <div className="bg-muted/40 rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-8 h-8 text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">Format du fichier Excel</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    Téléchargez le modèle, remplissez-le et reimportez-le.
                  </p>
                </div>
              </div>
              {/* Format table */}
              <div className="rounded-lg overflow-hidden border border-border text-[10px]">
                <div className="bg-muted/60 grid grid-cols-3 px-2 py-1.5 font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Colonne</span><span>Contenu</span><span>Requis</span>
                </div>
                {[
                  ["A", "Titre de la tâche", "✓"],
                  ["B", "Assignés (séparés par ;)", ""],
                  ["C", "Date début (JJ/MM/AAAA)", "✓"],
                  ["D", "Date fin / Deadline (JJ/MM/AAAA)", "✓"],
                  ["E", "Statut (planned / in-progress / done)", ""],
                  ["F", "Description", ""],
                  ["G", "Avancement % (0-100)", ""],
                ].map(([col, desc, req]) => (
                  <div key={col} className="grid grid-cols-3 px-2 py-1.5 border-t border-border/50">
                    <span className="font-bold text-primary">{col}</span>
                    <span className="text-muted-foreground">{desc}</span>
                    <span className={req ? "text-destructive font-bold" : "text-muted-foreground/40"}>{req || "—"}</span>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 gap-2 text-xs border-green-200 text-green-700 hover:bg-green-50"
                onClick={downloadTemplate}
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger le modèle Excel
              </Button>
            </div>

            {/* File picker */}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full h-10 gap-2 text-sm border-dashed"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {fileName ? fileName : "Choisir un fichier Excel (.xlsx / .xls)"}
              </Button>
            </div>

            {/* Preview */}
            <AnimatePresence>
              {showPreview && preview.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Aperçu — {preview.length} ligne{preview.length > 1 ? "s" : ""} détectée{preview.length > 1 ? "s" : ""}
                      </p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        preview.filter(r => r.errors.length === 0).length > 0
                          ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"
                      }`}>
                        {preview.filter(r => r.errors.length === 0).length} valide{preview.filter(r => r.errors.length === 0).length > 1 ? "s" : ""}
                        {preview.filter(r => r.errors.length > 0).length > 0 && `, ${preview.filter(r => r.errors.length > 0).length} erreur${preview.filter(r => r.errors.length > 0).length > 1 ? "s" : ""}`}
                      </span>
                    </div>
                    <div className="max-h-52 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
                      {preview.map((row, i) => (
                        <div
                          key={i}
                          className={`rounded-lg px-3 py-2 border text-[10px] ${
                            row.errors.length > 0
                              ? "bg-destructive/5 border-destructive/30"
                              : "bg-muted/30 border-border/50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {row.errors.length > 0
                              ? <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                              : <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{row.title}</p>
                              <div className="flex flex-wrap gap-1.5 mt-0.5">
                                {row.startDate && <span className="text-muted-foreground">{fmtDisplay(row.startDate)} → {fmtDisplay(row.deadline)}</span>}
                                {row.assignees.length > 0 && (
                                  <span className="text-primary">{row.assignees.join(", ")}</span>
                                )}
                                <span className={`px-1 rounded ${STATUS_COLOR[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                              </div>
                              {row.errors.length > 0 && (
                                <p className="text-destructive mt-0.5">{row.errors.join(" · ")}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {showPreview && preview.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-4">
                Aucune ligne de données trouvée dans le fichier.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-9 text-sm" onClick={onClose}>
          Annuler
        </Button>
        <div className="flex-1" />
        {(mode === "create" || mode === "edit") && (
          <Button size="sm" className="h-9 text-sm gap-2" onClick={handleSave}>
            <Save className="w-4 h-4" />
            {mode === "edit" ? "Enregistrer" : "Créer la tâche"}
          </Button>
        )}
        {mode === "import" && (
          <Button
            size="sm"
            className="h-9 text-sm gap-2"
            onClick={handleImport}
            disabled={preview.filter(r => r.errors.length === 0).length === 0}
          >
            <Upload className="w-4 h-4" />
            Importer {preview.filter(r => r.errors.length === 0).length > 0
              ? `(${preview.filter(r => r.errors.length === 0).length} tâche${preview.filter(r => r.errors.length === 0).length > 1 ? "s" : ""})`
              : ""}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

const STATUS_LABEL: Record<string, string> = { planned: "Planifié", "in-progress": "En cours", done: "Terminé" };
const STATUS_COLOR: Record<string, string> = {
  planned: "bg-muted text-muted-foreground border border-border",
  "in-progress": "bg-primary/10 text-primary border border-primary/20",
  done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

export default GanttTaskPanel;
