import { useState, useEffect, useRef, useCallback } from "react";
import { useGlobalDesign, DEFAULT_GLOBAL_DESIGN, ModuleDesignSettings, ModuleId } from "@/contexts/GlobalDesignContext";
import { CustomTextBlock, CustomImageBlock, TextStyle, Position, ImageSettings, defaultTextStyle, getImageContainerStyle } from "@/components/loginDesignTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  RotateCcw, Save, Paintbrush, Type, Layout, Eye, Maximize2, Minimize2,
  Plus, Image, MousePointer, Trash2, X, Settings2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Real module components
import DashboardView from "@/components/DashboardView";
import DashboardHeader from "@/components/DashboardHeader";
import SearchView from "@/components/SearchView";
import GanttView from "@/components/GanttView";
import ProjectsAndCommitteesView from "@/components/ProjectsAndCommitteesView";
import OrgChart from "@/components/OrgChart";
import HRPerformanceView from "@/components/HRPerformanceView";
import DeptObjectivesView from "@/components/DeptObjectivesView";
import WeeklyPlannerKpis from "@/components/WeeklyPlannerKpis";
import WeeklyTodoList from "@/components/WeeklyTodoList";

const FONT_OPTIONS = [
  "Montserrat", "Inter", "Poppins", "Roboto", "Playfair Display",
  "Raleway", "Lato", "Open Sans", "Nunito", "DM Sans",
  "Merriweather", "Source Sans 3", "Oswald", "Bebas Neue",
];

function hslToHex(hsl: string): string {
  if (!hsl) return "#000000";
  const p = hsl.match(/[\d.]+/g);
  if (!p || p.length < 3) return "#000000";
  const h = +p[0], s = +p[1] / 100, l = +p[2] / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "0 0% 0%";
  const r = +('0x' + m[1]) / 255, g = +('0x' + m[2]) / 255, b = +('0x' + m[3]) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1">
    <Label className="text-[10px] text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-2">
      <input type="color" value={hslToHex(value)} onChange={e => onChange(hexToHsl(e.target.value))} className="w-7 h-7 rounded cursor-pointer border border-border" />
      <Input value={value} onChange={e => onChange(e.target.value)} className="text-[10px] h-7 font-mono" />
    </div>
  </div>
);

const THEME_PRESETS = [
  { label: "FACAM Stairway (défaut)", s: DEFAULT_GLOBAL_DESIGN },
  { label: "Bleu Royal", s: { ...DEFAULT_GLOBAL_DESIGN, backgroundColor: "220 30% 8%", foregroundColor: "210 20% 92%", cardColor: "220 28% 12%", primaryColor: "220 80% 55%", primaryForeground: "0 0% 100%", sidebarBg: "220 35% 6%", sidebarPrimary: "220 80% 55%", borderColor: "220 20% 18%" } },
  { label: "Émeraude", s: { ...DEFAULT_GLOBAL_DESIGN, backgroundColor: "160 30% 8%", foregroundColor: "150 20% 92%", cardColor: "160 25% 12%", primaryColor: "160 70% 45%", primaryForeground: "0 0% 100%", sidebarBg: "160 32% 6%", sidebarPrimary: "160 70% 45%", borderColor: "160 18% 18%" } },
  { label: "Bordeaux", s: { ...DEFAULT_GLOBAL_DESIGN, backgroundColor: "0 25% 8%", foregroundColor: "0 10% 92%", cardColor: "0 20% 12%", primaryColor: "0 65% 50%", primaryForeground: "0 0% 100%", sidebarBg: "0 28% 6%", sidebarPrimary: "0 65% 50%", borderColor: "0 15% 18%" } },
  { label: "Violet", s: { ...DEFAULT_GLOBAL_DESIGN, backgroundColor: "270 30% 8%", foregroundColor: "270 15% 92%", cardColor: "270 25% 12%", primaryColor: "270 70% 60%", primaryForeground: "0 0% 100%", sidebarBg: "270 32% 6%", sidebarPrimary: "270 70% 60%", borderColor: "270 18% 18%" } },
  { label: "Clair", s: { ...DEFAULT_GLOBAL_DESIGN, backgroundColor: "0 0% 97%", foregroundColor: "222 30% 10%", cardColor: "0 0% 100%", primaryColor: "42 78% 55%", primaryForeground: "0 0% 100%", secondaryColor: "0 0% 93%", accentColor: "0 0% 95%", mutedColor: "0 0% 94%", mutedForeground: "0 0% 45%", borderColor: "0 0% 88%" } },
];

const MODULE_LABELS: Record<string, string> = {
  global: "Global (défaut)", dashboard: "Accueil", orgchart: "Organigramme", gantt: "Planification",
  projectscomites: "Projets & Comités", search: "Recherche", timeentry: "Week Planner",
  hrperformance: "Objectifs", dept_objectives: "Obj. Départements", admin: "Administration",
};

// Built-in selectable zones that map to design tokens
interface BuiltInZone {
  id: string;
  label: string;
  icon: string;
  top: string; left: string; width: string; height: string;
}

const BUILT_IN_ZONES: BuiltInZone[] = [
  { id: "zone_header", label: "En-tête", icon: "📌", top: "0%", left: "8%", width: "92%", height: "12%" },
  { id: "zone_sidebar", label: "Barre latérale", icon: "📋", top: "0%", left: "0%", width: "8%", height: "100%" },
  { id: "zone_background", label: "Fond de page", icon: "🎨", top: "85%", left: "85%", width: "14%", height: "14%" },
  { id: "zone_cards", label: "Cartes", icon: "🃏", top: "20%", left: "12%", width: "40%", height: "30%" },
  { id: "zone_primary", label: "Couleur primaire", icon: "⭐", top: "20%", left: "55%", width: "20%", height: "15%" },
  { id: "zone_titles", label: "Titres & Polices", icon: "🔤", top: "13%", left: "12%", width: "30%", height: "8%" },
  { id: "zone_text", label: "Texte courant", icon: "📝", top: "55%", left: "12%", width: "35%", height: "12%" },
  { id: "zone_borders", label: "Bordures & Arrondi", icon: "🔲", top: "70%", left: "12%", width: "25%", height: "12%" },
];

// Extended settings per module (colors + overlay elements)
interface ModuleOverlay {
  customTexts: CustomTextBlock[];
  customImages: CustomImageBlock[];
}

const DEFAULT_OVERLAY: ModuleOverlay = { customTexts: [], customImages: [] };

/** Draggable element for positioning custom overlays */
const DraggableOverlay = ({ id, position, onDrag, selected, onSelect, containerRef, editing, children }: {
  id: string; position: Position; onDrag: (id: string, pos: Position) => void;
  selected: boolean; onSelect: (id: string) => void; containerRef: React.RefObject<HTMLDivElement>;
  editing: boolean; children: React.ReactNode;
}) => {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const x = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - rect.top) / rect.height) * 100));
      onDrag(id, { x, y });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [id, editing, onDrag, onSelect, containerRef]);

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 ${editing ? "cursor-move" : ""} ${selected && editing ? "ring-2 ring-primary ring-offset-1 rounded" : ""}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onMouseDown={handleMouseDown}
      onClick={e => { if (editing) { e.stopPropagation(); onSelect(id); } }}
    >
      {children}
    </div>
  );
};

/** Mini sidebar for preview — reflects draft CSS vars */
const PreviewSidebar = ({ moduleId }: { moduleId: string }) => {
  const NAV_LABELS = [
    { id: "dashboard", label: "Accueil", icon: "📊" },
    { id: "orgchart", label: "Organigramme", icon: "🏢" },
    { id: "gantt", label: "Planification", icon: "📅" },
    { id: "projectscomites", label: "Projets & Comités", icon: "📁" },
    { id: "search", label: "Recherche", icon: "🔍" },
    { id: "timeentry", label: "Week Planner", icon: "⏰" },
    { id: "hrperformance", label: "Objectifs", icon: "🎯" },
    { id: "dept_objectives", label: "Obj. Départements", icon: "🏗️" },
    { id: "admin", label: "Administration", icon: "⚙️" },
  ];
  return (
    <div
      className="flex flex-col h-full shrink-0"
      style={{
        width: 200,
        background: "hsl(var(--sidebar-background))",
        borderRight: "1px solid hsl(var(--sidebar-border))",
        color: "hsl(var(--sidebar-foreground))",
      }}
    >
      <div className="flex items-center justify-center py-4 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div className="w-16 h-8 rounded" style={{ background: "hsl(var(--sidebar-accent))" }} />
      </div>
      <div className="flex-1 py-2 px-2 space-y-0.5 overflow-hidden">
        {NAV_LABELS.map(n => (
          <div
            key={n.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]"
            style={
              n.id === moduleId
                ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                : { color: "hsl(var(--sidebar-foreground) / 0.7)" }
            }
          >
            <span className="text-[10px]">{n.icon}</span>
            <span className="truncate">{n.label}</span>
          </div>
        ))}
      </div>
      <div className="border-t px-3 py-2" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div className="text-[9px]" style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}>utilisateur@email.com</div>
      </div>
    </div>
  );
};

/** Renders the real module component wrapped in app layout */
const RealModuleContent = ({ moduleId, withSidebar = false }: { moduleId: string; withSidebar?: boolean }) => {
  const content = (() => {
    switch (moduleId) {
      case "dashboard": case "global":
        return <><DashboardHeader /><DashboardView /></>;
      case "orgchart":
        return (
          <div className="space-y-4">
            <DashboardHeader />
            <div>
              <h2 className="font-display font-bold text-xl mb-2">Organigramme</h2>
              <div className="bg-card rounded-2xl border border-border p-4">
                <OrgChart view="tomorrow" />
              </div>
            </div>
          </div>
        );
      case "gantt":
        return <><DashboardHeader /><GanttView onNavigateToProject={() => {}} /></>;
      case "projectscomites":
        return <><DashboardHeader /><ProjectsAndCommitteesView initialProjectId={null} onNavigateToGantt={() => {}} /></>;
      case "search":
        return <><DashboardHeader /><SearchView /></>;
      case "timeentry":
        return <><DashboardHeader /><WeeklyPlannerKpis /><WeeklyTodoList onTodosChanged={() => {}} /></>;
      case "hrperformance":
        return <><DashboardHeader /><HRPerformanceView /></>;
      case "dept_objectives":
        return <><DashboardHeader /><DeptObjectivesView /></>;
      default:
        return <><DashboardHeader /><DashboardView /></>;
    }
  })();

  if (!withSidebar) return content;

  return (
    <div className="flex min-h-screen" style={{ background: "hsl(var(--background))" }}>
      <PreviewSidebar moduleId={moduleId} />
      <div className="flex-1 overflow-hidden">
        <div className="p-6">{content}</div>
      </div>
    </div>
  );
};

/** Build inline CSS vars from draft */
function draftToVars(d: ModuleDesignSettings): React.CSSProperties {
  return {
    "--background": d.backgroundColor,
    "--foreground": d.foregroundColor,
    "--card": d.cardColor,
    "--card-foreground": d.foregroundColor,
    "--popover": d.cardColor,
    "--popover-foreground": d.foregroundColor,
    "--primary": d.primaryColor,
    "--primary-foreground": d.primaryForeground,
    "--secondary": d.secondaryColor,
    "--secondary-foreground": d.foregroundColor,
    "--muted": d.mutedColor,
    "--muted-foreground": d.mutedForeground,
    "--accent": d.accentColor,
    "--accent-foreground": d.foregroundColor,
    "--border": d.borderColor,
    "--input": d.borderColor,
    "--ring": d.primaryColor,
    "--destructive": d.destructiveColor,
    "--sidebar-background": d.sidebarBg,
    "--sidebar-foreground": d.sidebarForeground,
    "--sidebar-primary": d.sidebarPrimary,
    "--sidebar-primary-foreground": d.primaryForeground,
    "--sidebar-accent": d.sidebarAccent,
    "--sidebar-accent-foreground": d.sidebarForeground,
    "--sidebar-border": d.sidebarBorder,
    "--sidebar-ring": d.sidebarPrimary,
    "--radius": `${d.borderRadius / 16}rem`,
    "--font-display": `'${d.displayFont}', sans-serif`,
    "--font-body": `'${d.bodyFont}', sans-serif`,
  } as React.CSSProperties;
}

interface Props {
  moduleId?: ModuleId;
}

const AdminGlobalDesign = ({ moduleId = "global" }: Props) => {
  const { getModuleSettings, updateModuleSettings } = useGlobalDesign();
  const [draft, setDraft] = useState<ModuleDesignSettings>(getModuleSettings(moduleId));
  const [overlay, setOverlay] = useState<ModuleOverlay>(DEFAULT_OVERLAY);
  const [editing, setEditing] = useState(false);
  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("selection");
  const previewRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const customImageInputRef = useRef<HTMLInputElement>(null);
  const pendingPanel = useRef<"overlay">("overlay");
  const { toast } = useToast();
  const moduleLabel = MODULE_LABELS[moduleId] || moduleId;

  // Load settings + overlay on module change
  useEffect(() => {
    setDraft(getModuleSettings(moduleId));
    setEditing(false);
    setSelectedEl(null);
    // Load overlay from DB
    const loadOverlay = async () => {
      const { data } = await supabase.from("app_organization").select("data").eq("id", `module_overlay_${moduleId}`).maybeSingle();
      if (data?.data) setOverlay({ ...DEFAULT_OVERLAY, ...(data.data as unknown as Partial<typeof DEFAULT_OVERLAY>) });
      else setOverlay(DEFAULT_OVERLAY);
    };
    loadOverlay();
  }, [moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => { setDraft(getModuleSettings(moduleId)); setEditing(true); setSelectedEl(null); };

  const handleSave = async () => {
    updateModuleSettings(moduleId, draft);
    await supabase.from("app_organization").upsert({ id: `module_overlay_${moduleId}`, data: overlay as unknown as import("@/integrations/supabase/types").Json });
    setEditing(false);
    toast({ title: `Design "${moduleLabel}" sauvegardé ✓` });
  };

  const handleReset = () => {
    setDraft(DEFAULT_GLOBAL_DESIGN);
    setOverlay(DEFAULT_OVERLAY);
  };

  const update = (field: keyof ModuleDesignSettings, value: string | number) => setDraft(prev => ({ ...prev, [field]: value }));

  // Drag handler for custom overlays
  const handleDrag = useCallback((id: string, pos: Position) => {
    setOverlay(prev => ({
      ...prev,
      customTexts: prev.customTexts.map(ct => ct.id === id ? { ...ct, position: pos } : ct),
      customImages: prev.customImages.map(ci => ci.id === id ? { ...ci, position: pos } : ci),
    }));
  }, []);

  const addCustomText = () => {
    const t: CustomTextBlock = {
      id: `ct_${Date.now()}`, text: "Nouveau texte",
      style: defaultTextStyle(draft.displayFont, `hsl(${draft.foregroundColor})`, 16, false),
      panel: "left", position: { x: 50, y: 50 },
    };
    setOverlay(prev => ({ ...prev, customTexts: [...prev.customTexts, t] }));
    setSelectedEl(t.id);
    setActiveTab("selection");
  };

  const deleteCustomText = (id: string) => {
    setOverlay(prev => ({ ...prev, customTexts: prev.customTexts.filter(ct => ct.id !== id) }));
    if (selectedEl === id) setSelectedEl(null);
  };

  const addCustomImage = () => { customImageInputRef.current?.click(); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Max 5 Mo", variant: "destructive" }); return; }
    e.target.value = "";
    const path = `module_${Date.now()}.${file.name.split(".").pop() || "png"}`;
    const { error } = await supabase.storage.from("login-assets").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Erreur upload", description: error.message, variant: "destructive" }); return; }
    const { data: urlData } = supabase.storage.from("login-assets").getPublicUrl(path);
    const img: CustomImageBlock = {
      id: `ci_${Date.now()}`, url: urlData.publicUrl, panel: "left",
      position: { x: 50, y: 30 },
      settings: { opacity: 100, size: 100, borderRadius: 8, objectPositionX: 50, objectPositionY: 50 },
    };
    setOverlay(prev => ({ ...prev, customImages: [...prev.customImages, img] }));
    setSelectedEl(img.id);
    setActiveTab("selection");
  };

  const deleteCustomImage = (id: string) => {
    setOverlay(prev => ({ ...prev, customImages: prev.customImages.filter(ci => ci.id !== id) }));
    if (selectedEl === id) setSelectedEl(null);
  };

  useEffect(() => { if (selectedEl && editing) setActiveTab("selection"); }, [selectedEl, editing]);

  const previewScale = 0.38;

  /** Render the preview container with real content + overlays */
  const renderPreview = (ref: React.RefObject<HTMLDivElement>, scale: number) => (
    <div
      ref={ref}
      className="relative overflow-hidden bg-background"
      style={{ ...draftToVars(draft), background: `hsl(${draft.backgroundColor})`, height: "100%" }}
      onClick={() => editing && setSelectedEl(null)}
    >
      {/* Real module content scaled - contained in a clipped wrapper */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${scale})`,
            width: `${100 / scale}%`,
            ...draftToVars(draft),
            fontFamily: `'${draft.bodyFont}', sans-serif`,
          }}
        >
          <RealModuleContent moduleId={moduleId} withSidebar />
        </div>
      </div>

      {/* Overlay layer - always interactive */}
      <div className="absolute inset-0 z-20" style={{ pointerEvents: editing ? "auto" : "none" }} onClick={(e) => { if (e.target === e.currentTarget && editing) setSelectedEl(null); }}>
        {/* Built-in clickable zones */}
        {editing && BUILT_IN_ZONES.map(zone => (
          <div
            key={zone.id}
            className={`absolute cursor-pointer transition-all border-2 ${selectedEl === zone.id ? "border-primary bg-primary/10" : "border-transparent hover:border-primary/40 hover:bg-primary/5"}`}
            style={{ top: zone.top, left: zone.left, width: zone.width, height: zone.height, borderRadius: 4 }}
            onClick={(e) => { e.stopPropagation(); setSelectedEl(zone.id); }}
          >
            <span className={`absolute top-0.5 left-0.5 text-[7px] px-1 py-0.5 rounded font-semibold whitespace-nowrap ${selectedEl === zone.id ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground/70 opacity-0 group-hover:opacity-100"}`}
              style={{ opacity: selectedEl === zone.id ? 1 : undefined }}
            >{zone.icon} {zone.label}</span>
          </div>
        ))}

        {/* Custom text overlays */}
        {overlay.customTexts.map(ct => (
          <DraggableOverlay key={ct.id} id={ct.id} position={ct.position} onDrag={handleDrag}
            selected={selectedEl === ct.id} onSelect={setSelectedEl} containerRef={ref as React.RefObject<HTMLDivElement>} editing={editing}>
            <p style={{
              fontFamily: `'${ct.style.font}', sans-serif`, color: ct.style.color,
              fontSize: `${ct.style.size * scale}px`, fontWeight: ct.style.bold ? 700 : 400,
              pointerEvents: "auto",
            }}>{ct.text}</p>
          </DraggableOverlay>
        ))}

        {/* Custom image overlays */}
        {overlay.customImages.map(ci => (
          <DraggableOverlay key={ci.id} id={ci.id} position={ci.position} onDrag={handleDrag}
            selected={selectedEl === ci.id} onSelect={setSelectedEl} containerRef={ref as React.RefObject<HTMLDivElement>} editing={editing}>
            <div className="overflow-hidden shadow-lg" style={{ ...getImageContainerStyle(ci.settings, 80, scale), pointerEvents: "auto" }}>
              <img src={ci.url} alt="" className="w-full h-full object-cover" />
            </div>
          </DraggableOverlay>
        ))}
      </div>
    </div>
  );

  /** Selected element property editor */
  const renderProperties = () => {
    if (!selectedEl) return (
      <div className="text-center py-6 space-y-3">
        <MousePointer className="w-8 h-8 text-muted-foreground/30 mx-auto" />
        <p className="text-[11px] text-muted-foreground">Cliquez sur une zone ou un élément dans l'aperçu</p>
        <div className="border-t border-border pt-3 mt-2">
          <Label className="text-[9px] text-muted-foreground mb-2 block">Zones de la page</Label>
          <div className="flex flex-wrap gap-1 justify-center">
            {BUILT_IN_ZONES.map(z => (
              <Button key={z.id} variant="outline" size="sm" className="h-6 text-[8px] px-2" onClick={() => setSelectedEl(z.id)}>
                {z.icon} {z.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="border-t border-border pt-3 mt-2">
          <Label className="text-[9px] text-muted-foreground mb-2 block">Ajouter des éléments</Label>
          <div className="flex flex-wrap gap-1 justify-center">
            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={addCustomImage}>
              <Image className="w-3 h-3" /> Image
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={addCustomText}>
              <Plus className="w-3 h-3" /> Texte
            </Button>
          </div>
        </div>
      </div>
    );

    // Built-in zone properties
    const zone = BUILT_IN_ZONES.find(z => z.id === selectedEl);
    if (zone) {
      switch (zone.id) {
        case "zone_header":
          return (
            <div className="space-y-3">
              <span className="text-xs font-semibold">{zone.icon} {zone.label}</span>
              <ColorField label="Fond header" value={draft.headerBg || draft.cardColor} onChange={v => update("headerBg", v)} />
              <ColorField label="Texte header" value={draft.headerForeground || draft.foregroundColor} onChange={v => update("headerForeground", v)} />
              <div className="space-y-1">
                <Label className="text-[10px]">Titre header</Label>
                <Input value={draft.headerTitle} onChange={e => update("headerTitle", e.target.value)} className="text-[10px] h-7" placeholder="Titre" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Sous-titre</Label>
                <Input value={draft.headerSubtitle} onChange={e => update("headerSubtitle", e.target.value)} className="text-[10px] h-7" placeholder="Sous-titre" />
              </div>
            </div>
          );
        case "zone_sidebar":
          return (
            <div className="space-y-3">
              <span className="text-xs font-semibold">{zone.icon} {zone.label}</span>
              <ColorField label="Fond sidebar" value={draft.sidebarBg} onChange={v => update("sidebarBg", v)} />
              <ColorField label="Texte sidebar" value={draft.sidebarForeground} onChange={v => update("sidebarForeground", v)} />
              <ColorField label="Primaire sidebar" value={draft.sidebarPrimary} onChange={v => update("sidebarPrimary", v)} />
              <ColorField label="Accent sidebar" value={draft.sidebarAccent} onChange={v => update("sidebarAccent", v)} />
              <ColorField label="Bordure sidebar" value={draft.sidebarBorder} onChange={v => update("sidebarBorder", v)} />
              <div className="border-t border-border pt-3 mt-2">
                <Label className="text-[10px] text-muted-foreground mb-1 block">Taille du logo ({draft.sidebarLogoSize ?? 144}px)</Label>
                <Slider min={40} max={300} step={4} value={[draft.sidebarLogoSize ?? 144]} onValueChange={([v]) => update("sidebarLogoSize", v)} />
              </div>
            </div>
          );
        case "zone_background":
          return (
            <div className="space-y-3">
              <span className="text-xs font-semibold">{zone.icon} {zone.label}</span>
              <ColorField label="Fond d'écran" value={draft.backgroundColor} onChange={v => update("backgroundColor", v)} />
              <ColorField label="Texte global" value={draft.foregroundColor} onChange={v => update("foregroundColor", v)} />
              <ColorField label="Destructif" value={draft.destructiveColor} onChange={v => update("destructiveColor", v)} />
            </div>
          );
        case "zone_cards":
          return (
            <div className="space-y-3">
              <span className="text-xs font-semibold">{zone.icon} {zone.label}</span>
              <ColorField label="Fond des cartes" value={draft.cardColor} onChange={v => update("cardColor", v)} />
              <ColorField label="Secondaire" value={draft.secondaryColor} onChange={v => update("secondaryColor", v)} />
              <ColorField label="Accent" value={draft.accentColor} onChange={v => update("accentColor", v)} />
              <ColorField label="Muted" value={draft.mutedColor} onChange={v => update("mutedColor", v)} />
              <ColorField label="Texte muted" value={draft.mutedForeground} onChange={v => update("mutedForeground", v)} />
            </div>
          );
        case "zone_primary":
          return (
            <div className="space-y-3">
              <span className="text-xs font-semibold">{zone.icon} {zone.label}</span>
              <ColorField label="Couleur primaire" value={draft.primaryColor} onChange={v => update("primaryColor", v)} />
              <ColorField label="Texte sur primaire" value={draft.primaryForeground} onChange={v => update("primaryForeground", v)} />
            </div>
          );
        case "zone_titles":
          return (
            <div className="space-y-3">
              <span className="text-xs font-semibold">{zone.icon} {zone.label}</span>
              <div className="space-y-1">
                <Label className="text-[10px]">Police des titres</Label>
                <Select value={draft.displayFont} onValueChange={v => update("displayFont", v)}>
                  <SelectTrigger className="text-[10px] h-7"><SelectValue /></SelectTrigger>
                  <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs" style={{ fontFamily: `'${f}'` }}>{f}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-sm font-bold mt-1" style={{ fontFamily: `'${draft.displayFont}'` }}>Aperçu titre</p>
              </div>
              <ColorField label="Couleur texte" value={draft.foregroundColor} onChange={v => update("foregroundColor", v)} />
            </div>
          );
        case "zone_text":
          return (
            <div className="space-y-3">
              <span className="text-xs font-semibold">{zone.icon} {zone.label}</span>
              <div className="space-y-1">
                <Label className="text-[10px]">Police du corps</Label>
                <Select value={draft.bodyFont} onValueChange={v => update("bodyFont", v)}>
                  <SelectTrigger className="text-[10px] h-7"><SelectValue /></SelectTrigger>
                  <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs" style={{ fontFamily: `'${f}'` }}>{f}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs mt-1" style={{ fontFamily: `'${draft.bodyFont}'` }}>Aperçu du texte courant.</p>
              </div>
              <ColorField label="Texte muted" value={draft.mutedForeground} onChange={v => update("mutedForeground", v)} />
            </div>
          );
        case "zone_borders":
          return (
            <div className="space-y-3">
              <span className="text-xs font-semibold">{zone.icon} {zone.label}</span>
              <ColorField label="Couleur des bordures" value={draft.borderColor} onChange={v => update("borderColor", v)} />
              <div className="space-y-1">
                <Label className="text-[10px]">Arrondi ({draft.borderRadius}px)</Label>
                <Slider value={[draft.borderRadius]} onValueChange={([v]) => update("borderRadius", v)} min={0} max={24} step={1} />
              </div>
            </div>
          );
        default:
          return null;
      }
    }

    // Custom text properties
    const ct = overlay.customTexts.find(t => t.id === selectedEl);
    if (ct) return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Texte personnalisé</span>
          <Button variant="destructive" size="sm" className="h-6 text-[9px] gap-1" onClick={() => deleteCustomText(ct.id)}>
            <Trash2 className="w-3 h-3" /> Supprimer
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Contenu</Label>
          <Input value={ct.text} onChange={e => setOverlay(prev => ({ ...prev, customTexts: prev.customTexts.map(t => t.id === ct.id ? { ...t, text: e.target.value } : t) }))} className="text-xs h-7" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Police</Label>
          <Select value={ct.style.font} onValueChange={v => setOverlay(prev => ({ ...prev, customTexts: prev.customTexts.map(t => t.id === ct.id ? { ...t, style: { ...t.style, font: v } } : t) }))}>
            <SelectTrigger className="text-[10px] h-7"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Couleur</Label>
          <input type="color" value={ct.style.color} onChange={e => setOverlay(prev => ({ ...prev, customTexts: prev.customTexts.map(t => t.id === ct.id ? { ...t, style: { ...t.style, color: e.target.value } } : t) }))} className="w-8 h-7 rounded cursor-pointer border border-border" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Taille ({ct.style.size}px)</Label>
          <Slider value={[ct.style.size]} onValueChange={([v]) => setOverlay(prev => ({ ...prev, customTexts: prev.customTexts.map(t => t.id === ct.id ? { ...t, style: { ...t.style, size: v } } : t) }))} min={8} max={72} step={1} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={ct.style.bold} onCheckedChange={v => setOverlay(prev => ({ ...prev, customTexts: prev.customTexts.map(t => t.id === ct.id ? { ...t, style: { ...t.style, bold: v } } : t) }))} />
          <Label className="text-[10px]">Gras</Label>
        </div>
      </div>
    );

    // Custom image properties
    const ci = overlay.customImages.find(i => i.id === selectedEl);
    if (ci) return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Image personnalisée</span>
          <Button variant="destructive" size="sm" className="h-6 text-[9px] gap-1" onClick={() => deleteCustomImage(ci.id)}>
            <Trash2 className="w-3 h-3" /> Supprimer
          </Button>
        </div>
        <img src={ci.url} alt="" className="w-full h-16 object-cover rounded border border-border" />
        <div className="space-y-1">
          <Label className="text-[10px]">Largeur ({ci.settings.width || 80}px)</Label>
          <Slider value={[ci.settings.width || 80]} onValueChange={([v]) => setOverlay(prev => ({ ...prev, customImages: prev.customImages.map(i => i.id === ci.id ? { ...i, settings: { ...i.settings, width: v } } : i) }))} min={20} max={800} step={1} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Hauteur ({ci.settings.height || 80}px)</Label>
          <Slider value={[ci.settings.height || 80]} onValueChange={([v]) => setOverlay(prev => ({ ...prev, customImages: prev.customImages.map(i => i.id === ci.id ? { ...i, settings: { ...i.settings, height: v } } : i) }))} min={20} max={800} step={1} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Opacité ({ci.settings.opacity}%)</Label>
          <Slider value={[ci.settings.opacity]} onValueChange={([v]) => setOverlay(prev => ({ ...prev, customImages: prev.customImages.map(i => i.id === ci.id ? { ...i, settings: { ...i.settings, opacity: v } } : i) }))} min={0} max={100} step={1} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Arrondi ({ci.settings.borderRadius}px)</Label>
          <Slider value={[ci.settings.borderRadius]} onValueChange={([v]) => setOverlay(prev => ({ ...prev, customImages: prev.customImages.map(i => i.id === ci.id ? { ...i, settings: { ...i.settings, borderRadius: v } } : i) }))} min={0} max={200} step={1} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Bordure ({ci.settings.borderWidth || 0}px)</Label>
          <Slider value={[ci.settings.borderWidth || 0]} onValueChange={([v]) => setOverlay(prev => ({ ...prev, customImages: prev.customImages.map(i => i.id === ci.id ? { ...i, settings: { ...i.settings, borderWidth: v } } : i) }))} min={0} max={20} step={1} />
        </div>
      </div>
    );

    return <p className="text-[10px] text-muted-foreground">Élément non reconnu</p>;
  };


  return (
    <div className="space-y-4">
      <input ref={customImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-base">{moduleLabel}</h3>
          <p className="text-[10px] text-muted-foreground">Personnalisez l'apparence de cette page</p>
        </div>
        {editing ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleReset}><RotateCcw className="w-3 h-3" /> Reset</Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setEditing(false)}>Annuler</Button>
            <Button size="sm" className="h-7 text-[10px] gap-1" onClick={handleSave}><Save className="w-3 h-3" /> Sauvegarder</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={startEdit}><Eye className="w-3 h-3" /> Modifier le design</Button>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border">
          <MousePointer className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span>Cliquez sur un élément overlay pour le sélectionner. Glissez pour repositionner. Modifiez les couleurs/polices dans les onglets.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Preview */}
        <Card className="border-border overflow-hidden">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> Aperçu en direct — {moduleLabel}
              <Button variant="ghost" size="sm" className="h-5 text-[8px] px-1.5 gap-0.5 ml-1" onClick={() => setFullscreen(true)}>
                <Maximize2 className="w-2.5 h-2.5" />
              </Button>
              {editing && (
                <span className="ml-auto flex gap-1">
                  <Button variant="outline" size="sm" className="h-5 text-[8px] px-1.5 gap-0.5" onClick={addCustomText}>
                    <Plus className="w-2.5 h-2.5" /> Texte
                  </Button>
                  <Button variant="outline" size="sm" className="h-5 text-[8px] px-1.5 gap-0.5" onClick={addCustomImage}>
                    <Image className="w-2.5 h-2.5" /> Image
                  </Button>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t border-border" style={{ height: 420, overflow: "hidden" }}>
              {renderPreview(previewRef, previewScale)}
            </div>
          </CardContent>
        </Card>

        {/* Fullscreen dialog */}
        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 border-0 rounded-none [&>button]:hidden">
            <DialogTitle className="sr-only">Aperçu plein écran — {moduleLabel}</DialogTitle>
            <div className="absolute top-3 right-3 z-50 flex gap-2">
              {editing && (
                <>
                  <Button variant="secondary" size="sm" className="h-8 gap-1.5 shadow-lg" onClick={addCustomText}><Plus className="w-4 h-4" /> Texte</Button>
                  <Button variant="secondary" size="sm" className="h-8 gap-1.5 shadow-lg" onClick={addCustomImage}><Image className="w-4 h-4" /> Image</Button>
                </>
              )}
              <Button variant="secondary" size="sm" className="h-8 gap-1.5 shadow-lg" onClick={() => setFullscreen(false)}>
                <Minimize2 className="w-4 h-4" /> Fermer
              </Button>
            </div>
            <div className="flex w-full h-full">
              <div className="flex-1 overflow-auto relative" style={{ ...draftToVars(draft), background: `hsl(${draft.backgroundColor})` }}>
                <div ref={fullscreenRef} className="relative min-h-full" style={{ fontFamily: `'${draft.bodyFont}', sans-serif` }}>
                  <div className="pointer-events-none" onClick={() => editing && setSelectedEl(null)}>
                    <RealModuleContent moduleId={moduleId} withSidebar />
                  </div>
                   {/* Overlay layer */}
                  <div className="absolute inset-0 z-20" style={{ pointerEvents: editing ? "auto" : "none" }} onClick={(e) => { if (e.target === e.currentTarget && editing) setSelectedEl(null); }}>
                    {/* Built-in clickable zones */}
                    {editing && BUILT_IN_ZONES.map(zone => (
                      <div
                        key={zone.id}
                        className={`absolute cursor-pointer transition-all border-2 ${selectedEl === zone.id ? "border-primary bg-primary/10" : "border-transparent hover:border-primary/40 hover:bg-primary/5"}`}
                        style={{ top: zone.top, left: zone.left, width: zone.width, height: zone.height, borderRadius: 6 }}
                        onClick={(e) => { e.stopPropagation(); setSelectedEl(zone.id); }}
                      >
                        <span className={`absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${selectedEl === zone.id ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground/70"}`}>{zone.icon} {zone.label}</span>
                      </div>
                    ))}
                    {overlay.customTexts.map(ct => (
                      <DraggableOverlay key={ct.id} id={ct.id} position={ct.position} onDrag={handleDrag}
                        selected={selectedEl === ct.id} onSelect={setSelectedEl} containerRef={fullscreenRef as React.RefObject<HTMLDivElement>} editing={editing}>
                        <p style={{ fontFamily: `'${ct.style.font}', sans-serif`, color: ct.style.color, fontSize: `${ct.style.size}px`, fontWeight: ct.style.bold ? 700 : 400, pointerEvents: "auto" }}>{ct.text}</p>
                      </DraggableOverlay>
                    ))}
                    {overlay.customImages.map(ci => (
                      <DraggableOverlay key={ci.id} id={ci.id} position={ci.position} onDrag={handleDrag}
                        selected={selectedEl === ci.id} onSelect={setSelectedEl} containerRef={fullscreenRef as React.RefObject<HTMLDivElement>} editing={editing}>
                        <div className="overflow-hidden shadow-lg" style={{ ...getImageContainerStyle(ci.settings, 80), pointerEvents: "auto" }}>
                          <img src={ci.url} alt="" className="w-full h-full object-cover" />
                        </div>
                      </DraggableOverlay>
                    ))}
                  </div>
                </div>
              </div>
              {editing && (
                <div className="w-[280px] bg-background border-l border-border overflow-auto p-4 z-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold">Propriétés</span>
                    {selectedEl && <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedEl(null)}><X className="w-3 h-3" /></Button>}
                  </div>
                  {renderProperties()}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Controls panel */}
        {editing ? (
          <Card className="border-border">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-3 pt-2 pb-0 gap-1 flex-wrap">
                  <TabsTrigger value="selection" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><MousePointer className="w-3 h-3" /> Sélection</TabsTrigger>
                  <TabsTrigger value="colors" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><Paintbrush className="w-3 h-3" /> Couleurs</TabsTrigger>
                  <TabsTrigger value="sidebar" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><Layout className="w-3 h-3" /> Sidebar</TabsTrigger>
                  <TabsTrigger value="fonts" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><Type className="w-3 h-3" /> Polices</TabsTrigger>
                  <TabsTrigger value="presets" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><Settings2 className="w-3 h-3" /> Thèmes</TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[360px]">
                  <TabsContent value="selection" className="px-4 pb-4 pt-2 mt-0">
                    {renderProperties()}
                    {/* Quick selection */}
                    {(overlay.customTexts.length > 0 || overlay.customImages.length > 0) && (
                      <div className="border-t border-border pt-3 mt-3">
                        <Label className="text-[9px] text-muted-foreground mb-2 block">Éléments</Label>
                        <div className="flex flex-wrap gap-1">
                          {overlay.customTexts.map(ct => (
                            <Button key={ct.id} variant={selectedEl === ct.id ? "default" : "outline"} size="sm" className="h-6 text-[8px] px-2" onClick={() => setSelectedEl(ct.id)}>
                              📝 {ct.text.slice(0, 12)}
                            </Button>
                          ))}
                          {overlay.customImages.map(ci => (
                            <Button key={ci.id} variant={selectedEl === ci.id ? "default" : "outline"} size="sm" className="h-6 text-[8px] px-2" onClick={() => setSelectedEl(ci.id)}>
                              🖼️ Image
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="colors" className="px-4 pb-4 pt-2 space-y-3 mt-0">
                    <ColorField label="Fond d'écran" value={draft.backgroundColor} onChange={v => update("backgroundColor", v)} />
                    <ColorField label="Texte" value={draft.foregroundColor} onChange={v => update("foregroundColor", v)} />
                    <ColorField label="Primaire" value={draft.primaryColor} onChange={v => update("primaryColor", v)} />
                    <ColorField label="Texte sur primaire" value={draft.primaryForeground} onChange={v => update("primaryForeground", v)} />
                    <ColorField label="Cartes" value={draft.cardColor} onChange={v => update("cardColor", v)} />
                    <ColorField label="Secondaire" value={draft.secondaryColor} onChange={v => update("secondaryColor", v)} />
                    <ColorField label="Accent" value={draft.accentColor} onChange={v => update("accentColor", v)} />
                    <ColorField label="Muted" value={draft.mutedColor} onChange={v => update("mutedColor", v)} />
                    <ColorField label="Texte muted" value={draft.mutedForeground} onChange={v => update("mutedForeground", v)} />
                    <ColorField label="Bordures" value={draft.borderColor} onChange={v => update("borderColor", v)} />
                    <ColorField label="Destructif" value={draft.destructiveColor} onChange={v => update("destructiveColor", v)} />
                  </TabsContent>

                  <TabsContent value="sidebar" className="px-4 pb-4 pt-2 space-y-3 mt-0">
                    <ColorField label="Fond sidebar" value={draft.sidebarBg} onChange={v => update("sidebarBg", v)} />
                    <ColorField label="Texte sidebar" value={draft.sidebarForeground} onChange={v => update("sidebarForeground", v)} />
                    <ColorField label="Primaire sidebar" value={draft.sidebarPrimary} onChange={v => update("sidebarPrimary", v)} />
                    <ColorField label="Accent sidebar" value={draft.sidebarAccent} onChange={v => update("sidebarAccent", v)} />
                    <ColorField label="Bordure sidebar" value={draft.sidebarBorder} onChange={v => update("sidebarBorder", v)} />
                    <div className="border-t border-border pt-3 mt-2">
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Taille du logo ({draft.sidebarLogoSize ?? 144}px)</Label>
                      <Slider min={40} max={300} step={4} value={[draft.sidebarLogoSize ?? 144]} onValueChange={([v]) => update("sidebarLogoSize", v)} />
                    </div>
                    <div className="border-t border-border pt-3 mt-2">
                      <Label className="text-[10px] text-muted-foreground mb-2 block font-semibold">Header</Label>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Titre</Label>
                          <Input value={draft.headerTitle} onChange={e => update("headerTitle", e.target.value)} className="text-[10px] h-7" placeholder="Titre header" />
                        </div>
                        <ColorField label="Fond header" value={draft.headerBg} onChange={v => update("headerBg", v)} />
                        <ColorField label="Texte header" value={draft.headerForeground} onChange={v => update("headerForeground", v)} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="fonts" className="px-4 pb-4 pt-2 space-y-3 mt-0">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Police titres</Label>
                      <Select value={draft.displayFont} onValueChange={v => update("displayFont", v)}>
                        <SelectTrigger className="text-[10px] h-7"><SelectValue /></SelectTrigger>
                        <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs" style={{ fontFamily: `'${f}'` }}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                      <p className="text-sm font-bold" style={{ fontFamily: `'${draft.displayFont}'` }}>Aperçu titre</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Police corps</Label>
                      <Select value={draft.bodyFont} onValueChange={v => update("bodyFont", v)}>
                        <SelectTrigger className="text-[10px] h-7"><SelectValue /></SelectTrigger>
                        <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs" style={{ fontFamily: `'${f}'` }}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                      <p className="text-xs" style={{ fontFamily: `'${draft.bodyFont}'` }}>Aperçu du texte courant.</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Arrondi ({draft.borderRadius}px)</Label>
                      <Slider value={[draft.borderRadius]} onValueChange={([v]) => update("borderRadius", v)} min={0} max={24} step={1} />
                    </div>
                  </TabsContent>

                  <TabsContent value="presets" className="px-4 pb-4 pt-2 mt-0">
                    <div className="grid grid-cols-2 gap-2">
                      {THEME_PRESETS.map(p => (
                        <button key={p.label} onClick={() => { setDraft(p.s); toast({ title: `Thème "${p.label}" appliqué` }); }}
                          className="rounded-lg border border-border p-2.5 hover:border-primary/50 transition-colors text-left">
                          <div className="flex gap-1 mb-1.5">
                            <div className="w-4 h-4 rounded-full" style={{ background: `hsl(${p.s.backgroundColor})` }} />
                            <div className="w-4 h-4 rounded-full" style={{ background: `hsl(${p.s.primaryColor})` }} />
                            <div className="w-4 h-4 rounded-full" style={{ background: `hsl(${p.s.sidebarBg})` }} />
                          </div>
                          <p className="text-[10px] font-medium">{p.label}</p>
                        </button>
                      ))}
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          /* Non-editing: show preview info */
          <div className="space-y-3">
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">Cliquez sur <strong>"Modifier le design"</strong> pour personnaliser les couleurs, polices, ajouter des textes et images sur cette page.</p>
                <div className="grid grid-cols-3 gap-2">
                  {THEME_PRESETS.slice(0, 3).map(p => (
                    <div key={p.label} className="rounded-md border border-border p-1.5 text-center">
                      <div className="flex gap-0.5 justify-center mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: `hsl(${p.s.backgroundColor})` }} />
                        <div className="w-3 h-3 rounded-full" style={{ background: `hsl(${p.s.primaryColor})` }} />
                      </div>
                      <p className="text-[8px] text-muted-foreground">{p.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGlobalDesign;
