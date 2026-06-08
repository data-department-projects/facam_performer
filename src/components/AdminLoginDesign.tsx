import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Palette, Save, RotateCcw, Eye, EyeOff, Mail, Lock, Sparkles, Type, Image, Upload, Plus, Trash2, Move, ChevronDown, ChevronUp, GripVertical, MousePointer, Settings2, Maximize2, Minimize2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
const STAIRWAY_LOGO = "/facam_stairway-bleu.png";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  type LoginDesignSettings, type TextStyle, type CustomTextBlock, type CustomImageBlock, type Position, type ImageSettings, type PanelSettings,
  DEFAULT_SETTINGS, DEFAULT_ELEMENT_POSITIONS, FONT_OPTIONS, COLOR_PRESETS, STORAGE_KEY,
  migrateSettings, defaultTextStyle, getImageContainerStyle,
} from "./loginDesignTypes";

// ── Shared text style editor ────────────────────────────────────────
const TextStyleEditor = ({
  label, textValue, onTextChange, style, onStyleChange, multiline = false, onDelete, defaultOpen = false,
}: {
  label: string; textValue: string; onTextChange: (v: string) => void;
  style: TextStyle; onStyleChange: (s: TextStyle) => void;
  multiline?: boolean; onDelete?: () => void; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg overflow-hidden">
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors text-left">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold text-foreground">{label}</span>
            <p className="text-[9px] text-muted-foreground truncate mt-0.5" style={{ fontFamily: `'${style.font}', sans-serif`, color: style.color }}>
              {textValue || "—"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {onDelete && (
              <span onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 hover:bg-destructive/20 rounded cursor-pointer">
                <Trash2 className="w-3 h-3 text-destructive" />
              </span>
            )}
            {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 space-y-2 border-t border-border bg-muted/20">
        <div className="space-y-1 pt-2">
          <Label className="text-[9px] text-muted-foreground">Contenu</Label>
          {multiline ? (
            <Textarea value={textValue} onChange={(e) => onTextChange(e.target.value)} className="min-h-[60px] text-xs" />
          ) : (
            <Input value={textValue} onChange={(e) => onTextChange(e.target.value)} className="h-7 text-xs" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Police</Label>
            <Select value={style.font} onValueChange={(v) => onStyleChange({ ...style, font: v })}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Couleur</Label>
            <div className="flex gap-1">
              <input type="color" value={style.color.slice(0, 7)} onChange={(e) => onStyleChange({ ...style, color: e.target.value })} className="w-7 h-7 rounded cursor-pointer border-0" />
              <Input value={style.color} onChange={(e) => onStyleChange({ ...style, color: e.target.value })} className="h-7 text-[9px] font-mono flex-1" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground">Taille : {style.size}px</Label>
          <Slider value={[style.size]} onValueChange={([v]) => onStyleChange({ ...style, size: v })} min={8} max={64} step={1} />
        </div>
        <Button variant={style.bold ? "default" : "outline"} size="sm" className="h-6 text-[9px] px-2 font-bold" onClick={() => onStyleChange({ ...style, bold: !style.bold })}>
          B Gras
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
};

// ── Draggable element wrapper ───────────────────────────────────────
type DragId = string;

const DraggableElement = ({
  id, position, onDrag, selected, onSelect, children, containerRef, editing,
}: {
  id: DragId; position: Position; onDrag: (id: DragId, pos: Position) => void;
  selected: boolean; onSelect: (id: DragId) => void; children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement>; editing: boolean;
}) => {
  const elRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    dragging.current = true;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !elRef.current) return;
    const elRect = elRef.current.getBoundingClientRect();
    offset.current = { x: e.clientX - elRect.left, y: e.clientY - elRect.top };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !rect) return;
      const elW = elRef.current?.offsetWidth || 0;
      const elH = elRef.current?.offsetHeight || 0;
      const newX = ((ev.clientX - rect.left - offset.current.x + elW / 2) / rect.width) * 100;
      const newY = ((ev.clientY - rect.top - offset.current.y + elH / 2) / rect.height) * 100;
      onDrag(id, { x: Math.max(5, Math.min(95, newX)), y: Math.max(3, Math.min(97, newY)) });
    };
    const handleMouseUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [editing, id, onDrag, onSelect, containerRef]);

  return (
    <div
      ref={elRef}
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 transition-shadow ${editing ? "cursor-grab active:cursor-grabbing" : ""} ${selected && editing ? "ring-2 ring-primary ring-offset-1 rounded" : ""}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onMouseDown={handleMouseDown}
    >
      {editing && selected && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <GripVertical className="w-3 h-3 text-primary" />
        </div>
      )}
      {children}
    </div>
  );
};

// ── Element labels for selection ────────────────────────────────────
const ELEMENT_LABELS: Record<string, string> = {
  leftIcon: "Icône gauche",
  leftTitle: "Titre gauche",
  leftDescription: "Description gauche",
  logo: "Logo",
  appTitle: "Titre application",
  appSubtitle: "Sous-titre application",
  leftPanel: "Panneau gauche",
  rightPanel: "Panneau droit",
  backgroundImage: "Image de fond",
};

const getElementLabel = (id: string, draft: LoginDesignSettings) => {
  if (ELEMENT_LABELS[id]) return ELEMENT_LABELS[id];
  const ct = draft.customTexts.find(c => c.id === id);
  if (ct) return ct.text.substring(0, 20);
  const ci = draft.customImages.find(c => c.id === id);
  if (ci) return `Image ${ci.panel === "left" ? "◀" : "▶"}`;
  return id;
};

// ── Properties panel for selected element ───────────────────────────
const SelectedElementProperties = ({
  selectedEl, draft, setDraft, onDelete,
}: {
  selectedEl: string;
  draft: LoginDesignSettings;
  setDraft: React.Dispatch<React.SetStateAction<LoginDesignSettings>>;
  onDelete?: () => void;
}) => {
  const label = getElementLabel(selectedEl, draft);

  // Panel properties
  if (selectedEl === "leftPanel") {
    return (
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-primary/30">
        <div className="flex items-center gap-2">
          <MousePointer className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-primary">{label}</span>
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Couleur de fond</Label>
            <div className="flex gap-1.5">
              <input type="color" value={draft.leftPanelBg} onChange={(e) => setDraft(p => ({ ...p, leftPanelBg: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0" />
              <Input value={draft.leftPanelBg} onChange={(e) => setDraft(p => ({ ...p, leftPanelBg: e.target.value }))} className="h-7 text-[9px] font-mono flex-1" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Opacité : {draft.leftPanelSettings.opacity}%</Label>
            <Slider value={[draft.leftPanelSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, leftPanelSettings: { ...p.leftPanelSettings, opacity: v } }))} min={0} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Largeur : {draft.leftPanelSettings.widthPercent}%</Label>
            <Slider value={[draft.leftPanelSettings.widthPercent]} onValueChange={([v]) => setDraft(p => ({ ...p, leftPanelSettings: { ...p.leftPanelSettings, widthPercent: v }, rightPanelSettings: { ...p.rightPanelSettings, widthPercent: 100 - v } }))} min={25} max={75} step={1} />
          </div>
        </div>
      </div>
    );
  }

  if (selectedEl === "rightPanel") {
    return (
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-primary/30">
        <div className="flex items-center gap-2">
          <MousePointer className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-primary">{label}</span>
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Couleur de fond</Label>
            <div className="flex gap-1.5">
              <input type="color" value={draft.rightPanelBg} onChange={(e) => setDraft(p => ({ ...p, rightPanelBg: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0" />
              <Input value={draft.rightPanelBg} onChange={(e) => setDraft(p => ({ ...p, rightPanelBg: e.target.value }))} className="h-7 text-[9px] font-mono flex-1" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Opacité : {draft.rightPanelSettings.opacity}%</Label>
            <Slider value={[draft.rightPanelSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, rightPanelSettings: { ...p.rightPanelSettings, opacity: v } }))} min={0} max={100} step={1} />
          </div>
        </div>
      </div>
    );
  }

  // Image properties (logo, leftIcon, backgroundImage)
  if (selectedEl === "logo") {
    const isHidden = (draft.hiddenElements || []).includes("logo");
    const toggleHide = () => {
      setDraft(p => {
        const arr = p.hiddenElements || [];
        return { ...p, hiddenElements: isHidden ? arr.filter(e => e !== "logo") : [...arr, "logo"] };
      });
    };
    return (
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointer className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary">{label}</span>
          </div>
          <div className="flex gap-1">
            {draft.logoUrl && (
              <Button variant="ghost" size="sm" className="h-5 text-[8px] text-destructive gap-0.5" onClick={() => setDraft(p => ({ ...p, logoUrl: "" }))}>
                <Trash2 className="w-2.5 h-2.5" /> Suppr. image
              </Button>
            )}
            <Button variant="ghost" size="sm" className={`h-5 text-[8px] gap-0.5 ${isHidden ? 'text-primary' : 'text-destructive'}`} onClick={toggleHide}>
              {isHidden ? <><Eye className="w-2.5 h-2.5" /> Afficher</> : <><EyeOff className="w-2.5 h-2.5" /> Masquer</>}
            </Button>
          </div>
        </div>
        {!isHidden && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Opacité : {draft.logoSettings.opacity}%</Label>
              <Slider value={[draft.logoSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, logoSettings: { ...p.logoSettings, opacity: v } }))} min={0} max={100} step={1} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Taille : {draft.logoSettings.size}%</Label>
              <Slider value={[draft.logoSettings.size]} onValueChange={([v]) => setDraft(p => ({ ...p, logoSettings: { ...p.logoSettings, size: v } }))} min={30} max={500} step={5} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Arrondi : {draft.logoSettings.borderRadius}px</Label>
              <Slider value={[draft.logoSettings.borderRadius]} onValueChange={([v]) => setDraft(p => ({ ...p, logoSettings: { ...p.logoSettings, borderRadius: v } }))} min={0} max={50} step={1} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Rogner X : {draft.logoSettings.objectPositionX}%</Label>
              <Slider value={[draft.logoSettings.objectPositionX]} onValueChange={([v]) => setDraft(p => ({ ...p, logoSettings: { ...p.logoSettings, objectPositionX: v } }))} min={0} max={100} step={1} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Rogner Y : {draft.logoSettings.objectPositionY}%</Label>
              <Slider value={[draft.logoSettings.objectPositionY]} onValueChange={([v]) => setDraft(p => ({ ...p, logoSettings: { ...p.logoSettings, objectPositionY: v } }))} min={0} max={100} step={1} />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (selectedEl === "leftIcon") {
    return (
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointer className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary">{label}</span>
          </div>
          <div className="flex gap-1">
            {draft.leftIconUrl && (
              <Button variant="ghost" size="sm" className="h-5 text-[8px] text-destructive gap-0.5" onClick={() => setDraft(p => ({ ...p, leftIconUrl: "" }))}>
                <Trash2 className="w-2.5 h-2.5" /> Suppr. image
              </Button>
            )}
            {(() => {
              const isHidden = (draft.hiddenElements || []).includes("leftIcon");
              return (
                <Button variant="ghost" size="sm" className={`h-5 text-[8px] gap-0.5 ${isHidden ? 'text-primary' : 'text-destructive'}`} onClick={() => setDraft(p => {
                  const arr = p.hiddenElements || [];
                  return { ...p, hiddenElements: isHidden ? arr.filter(e => e !== "leftIcon") : [...arr, "leftIcon"] };
                })}>
                  {isHidden ? <><Eye className="w-2.5 h-2.5" /> Afficher</> : <><EyeOff className="w-2.5 h-2.5" /> Masquer</>}
                </Button>
              );
            })()}
          </div>
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Opacité : {draft.leftIconSettings.opacity}%</Label>
            <Slider value={[draft.leftIconSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, leftIconSettings: { ...p.leftIconSettings, opacity: v } }))} min={0} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Taille : {draft.leftIconSettings.size}%</Label>
            <Slider value={[draft.leftIconSettings.size]} onValueChange={([v]) => setDraft(p => ({ ...p, leftIconSettings: { ...p.leftIconSettings, size: v } }))} min={30} max={500} step={5} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Arrondi : {draft.leftIconSettings.borderRadius}px</Label>
            <Slider value={[draft.leftIconSettings.borderRadius]} onValueChange={([v]) => setDraft(p => ({ ...p, leftIconSettings: { ...p.leftIconSettings, borderRadius: v } }))} min={0} max={50} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Rogner X : {draft.leftIconSettings.objectPositionX}%</Label>
            <Slider value={[draft.leftIconSettings.objectPositionX]} onValueChange={([v]) => setDraft(p => ({ ...p, leftIconSettings: { ...p.leftIconSettings, objectPositionX: v } }))} min={0} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Rogner Y : {draft.leftIconSettings.objectPositionY}%</Label>
            <Slider value={[draft.leftIconSettings.objectPositionY]} onValueChange={([v]) => setDraft(p => ({ ...p, leftIconSettings: { ...p.leftIconSettings, objectPositionY: v } }))} min={0} max={100} step={1} />
          </div>
        </div>
      </div>
    );
  }

  if (selectedEl === "backgroundImage") {
    return (
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointer className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary">{label}</span>
          </div>
          <Button variant="ghost" size="sm" className="h-5 text-[8px] text-destructive gap-0.5" onClick={() => setDraft(p => ({ ...p, backgroundImageUrl: "" }))}>
            <Trash2 className="w-2.5 h-2.5" /> Supprimer
          </Button>
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Opacité : {draft.backgroundImageSettings.opacity}%</Label>
            <Slider value={[draft.backgroundImageSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, backgroundImageSettings: { ...p.backgroundImageSettings, opacity: v } }))} min={0} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Position X : {draft.backgroundImageSettings.objectPositionX}%</Label>
            <Slider value={[draft.backgroundImageSettings.objectPositionX]} onValueChange={([v]) => setDraft(p => ({ ...p, backgroundImageSettings: { ...p.backgroundImageSettings, objectPositionX: v } }))} min={0} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Position Y : {draft.backgroundImageSettings.objectPositionY}%</Label>
            <Slider value={[draft.backgroundImageSettings.objectPositionY]} onValueChange={([v]) => setDraft(p => ({ ...p, backgroundImageSettings: { ...p.backgroundImageSettings, objectPositionY: v } }))} min={0} max={100} step={1} />
          </div>
        </div>
      </div>
    );
  }

  // Text elements (built-in or custom)
  const isCustom = selectedEl.startsWith("custom_");
  const ct = isCustom ? draft.customTexts.find(c => c.id === selectedEl) : null;

  // Built-in text elements
  const builtInMap: Record<string, { textKey: string; styleKey: string; label: string }> = {
    leftTitle: { textKey: "leftTitle", styleKey: "leftTitleStyle", label: "Titre gauche" },
    leftDescription: { textKey: "leftDescription", styleKey: "leftDescriptionStyle", label: "Description gauche" },
    appTitle: { textKey: "appTitle", styleKey: "appTitleStyle", label: "Titre application" },
    appSubtitle: { textKey: "appSubtitle", styleKey: "appSubtitleStyle", label: "Sous-titre" },
  };

  const builtIn = builtInMap[selectedEl];

  if (builtIn) {
    const style = draft[builtIn.styleKey as keyof typeof draft] as TextStyle;
    const textVal = draft[builtIn.textKey as keyof typeof draft] as string;
    const isHidden = (draft.hiddenElements || []).includes(selectedEl);
    const toggleHide = () => {
      setDraft(p => {
        const arr = p.hiddenElements || [];
        return { ...p, hiddenElements: isHidden ? arr.filter(e => e !== selectedEl) : [...arr, selectedEl] };
      });
    };
    return (
      <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-primary/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MousePointer className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary">{builtIn.label}</span>
          </div>
          <Button variant="ghost" size="sm" className={`h-5 text-[8px] gap-0.5 ${isHidden ? 'text-primary' : 'text-destructive'}`} onClick={toggleHide}>
            {isHidden ? <><Eye className="w-2.5 h-2.5" /> Afficher</> : <><EyeOff className="w-2.5 h-2.5" /> Masquer</>}
          </Button>
        </div>
        {!isHidden && (
          <TextStyleEditor
            label={builtIn.label}
            textValue={textVal}
            onTextChange={(v) => setDraft(p => ({ ...p, [builtIn.textKey]: v }))}
            style={style}
            onStyleChange={(st) => setDraft(p => ({ ...p, [builtIn.styleKey]: st }))}
            multiline={selectedEl === "leftDescription"}
            defaultOpen
          />
        )}
      </div>
    );
  }

  if (ct) {
    return (
      <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-primary/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MousePointer className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary">Texte personnalisé</span>
          </div>
          <Button variant="ghost" size="sm" className="h-5 text-[8px] text-destructive gap-0.5" onClick={onDelete}>
            <Trash2 className="w-2.5 h-2.5" /> Supprimer
          </Button>
        </div>
        <TextStyleEditor
          label={ct.text.substring(0, 30)}
          textValue={ct.text}
          onTextChange={(v) => setDraft(p => ({ ...p, customTexts: p.customTexts.map(c => c.id === ct.id ? { ...c, text: v } : c) }))}
          style={ct.style}
          onStyleChange={(st) => setDraft(p => ({ ...p, customTexts: p.customTexts.map(c => c.id === ct.id ? { ...c, style: st } : c) }))}
          multiline
          defaultOpen
        />
      </div>
    );
  }

  // Custom image element
  const isImg = selectedEl.startsWith("img_");
  const ci = isImg ? draft.customImages.find(c => c.id === selectedEl) : null;

  if (ci) {
    return (
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointer className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-primary">Image personnalisée</span>
          </div>
          <Button variant="ghost" size="sm" className="h-5 text-[8px] text-destructive gap-0.5" onClick={onDelete}>
            <Trash2 className="w-2.5 h-2.5" /> Supprimer
          </Button>
        </div>
        <div className="w-16 h-16 rounded-lg overflow-hidden border border-border mx-auto">
          <img src={ci.url} alt="Custom" className="w-full h-full object-cover" />
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Largeur : {ci.settings.width ?? 'Auto'}px</Label>
            <Slider value={[ci.settings.width ?? Math.round(80 * (ci.settings.size / 100))]} onValueChange={([v]) => setDraft(p => ({ ...p, customImages: p.customImages.map(c => c.id === ci.id ? { ...c, settings: { ...c.settings, width: v } } : c) }))} min={20} max={800} step={5} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Hauteur : {ci.settings.height ?? 'Auto'}px</Label>
            <Slider value={[ci.settings.height ?? Math.round(80 * (ci.settings.size / 100))]} onValueChange={([v]) => setDraft(p => ({ ...p, customImages: p.customImages.map(c => c.id === ci.id ? { ...c, settings: { ...c.settings, height: v } } : c) }))} min={20} max={800} step={5} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Opacité : {ci.settings.opacity}%</Label>
            <Slider value={[ci.settings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, customImages: p.customImages.map(c => c.id === ci.id ? { ...c, settings: { ...c.settings, opacity: v } } : c) }))} min={0} max={100} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Arrondi : {ci.settings.borderRadius}px</Label>
            <Slider value={[ci.settings.borderRadius]} onValueChange={([v]) => setDraft(p => ({ ...p, customImages: p.customImages.map(c => c.id === ci.id ? { ...c, settings: { ...c.settings, borderRadius: v } } : c) }))} min={0} max={200} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Bordure : {ci.settings.borderWidth ?? 0}px</Label>
            <Slider value={[ci.settings.borderWidth ?? 0]} onValueChange={([v]) => setDraft(p => ({ ...p, customImages: p.customImages.map(c => c.id === ci.id ? { ...c, settings: { ...c.settings, borderWidth: v } } : c) }))} min={0} max={20} step={1} />
          </div>
          {(ci.settings.borderWidth ?? 0) > 0 && (
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Couleur bordure</Label>
              <Input type="color" value={ci.settings.borderColor ?? '#ffffff'} onChange={(e) => setDraft(p => ({ ...p, customImages: p.customImages.map(c => c.id === ci.id ? { ...c, settings: { ...c.settings, borderColor: e.target.value } } : c) }))} className="h-7 w-full p-0.5" />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-[9px] text-muted-foreground">Panneau</Label>
            <Select value={ci.panel} onValueChange={(v: "left" | "right") => setDraft(p => ({ ...p, customImages: p.customImages.map(c => c.id === ci.id ? { ...c, panel: v } : c) }))}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Gauche</SelectItem>
                <SelectItem value="right">Droite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// ── Main component ──────────────────────────────────────────────────
const AdminLoginDesign = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<LoginDesignSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return migrateSettings(JSON.parse(stored));
    } catch {}
    return DEFAULT_SETTINGS;
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LoginDesignSettings>(settings);
  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenLeftRef = useRef<HTMLDivElement>(null);
  const fullscreenRightRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("selection");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const leftIconInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const startEdit = () => { setDraft({ ...settings }); setEditing(true); setSelectedEl(null); };

  const persistLoginDesign = async (toSave: LoginDesignSettings) => {
    return supabase.from("app_organization").upsert({
      id: "login_design",
      data: toSave as unknown as Json,
      updated_at: new Date().toISOString(),
    });
  };

  const saveSettings = async () => {
    const toSave = { ...draft, titleFont: draft.appTitleStyle.font, bodyFont: draft.appSubtitleStyle.font };
    setSettings(toSave);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.warn("Local save failed:", err);
    }

    let { error } = await persistLoginDesign(toSave);

    if (error && (error.code === "42501" || /row-level security/i.test(error.message))) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: "Session expirée",
          description: "Reconnectez-vous puis réessayez la sauvegarde.",
          variant: "destructive",
        });
        return;
      }

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) {
        const retry = await persistLoginDesign(toSave);
        error = retry.error;
      }
    }

    if (error) {
      console.error("Save login design error:", error);
      toast({ title: "Erreur de sauvegarde", description: error.message, variant: "destructive" });
      return;
    }

    setEditing(false);
    toast({ title: "Design sauvegardé ✓", description: "Les modifications seront visibles sur la page de connexion." });
  };

  const resetSettings = () => { setDraft({ ...DEFAULT_SETTINGS }); };

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_organization").select("data").eq("id", "login_design").maybeSingle();
      if (data?.data && typeof data.data === "object") {
        const raw = data.data as Record<string, unknown>;
        const loaded = migrateSettings(raw);
        setSettings(loaded);
        setDraft(loaded);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
        if (!raw._brandVersion || raw._brandVersion < 2) {
          await supabase.from("app_organization").upsert({
            id: "login_design",
            data: loaded as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          });
        }
      }
    };
    load();
  }, []);

  const uploadToStorage = async (file: File, prefix: string): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "png";
    const path = `${prefix}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("login-assets").upload(path, file, { upsert: true });
    if (error) {
      console.error("Storage upload error:", error);
      toast({ title: "Erreur d'upload", description: error.message, variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from("login-assets").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "logoUrl" | "leftIconUrl" | "backgroundImageUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Fichier trop volumineux", description: "Max 5 Mo", variant: "destructive" }); return; }
    e.target.value = "";
    const url = await uploadToStorage(file, field);
    if (url) setDraft((prev) => ({ ...prev, [field]: url }));
  };

  const handleDrag = useCallback((id: DragId, pos: Position) => {
    setDraft((prev) => {
      if (id in prev.elementPositions) {
        return { ...prev, elementPositions: { ...prev.elementPositions, [id]: pos } };
      }
      const ctIdx = prev.customTexts.findIndex(ct => ct.id === id);
      if (ctIdx >= 0) {
        return { ...prev, customTexts: prev.customTexts.map((ct) => ct.id === id ? { ...ct, position: pos } : ct) };
      }
      const ciIdx = prev.customImages.findIndex(ci => ci.id === id);
      if (ciIdx >= 0) {
        return { ...prev, customImages: prev.customImages.map((ci) => ci.id === id ? { ...ci, position: pos } : ci) };
      }
      return prev;
    });
  }, []);

  const addCustomText = (panel: "left" | "right") => {
    const newText: CustomTextBlock = {
      id: `custom_${Date.now()}`,
      text: "Nouveau texte",
      style: defaultTextStyle("Montserrat", panel === "left" ? "#ffffff" : "#ffffff", 14, false),
      panel,
      position: { x: 50, y: 80 },
    };
    setDraft((prev) => ({ ...prev, customTexts: [...prev.customTexts, newText] }));
    setSelectedEl(newText.id);
    setActiveTab("selection");
  };

  const deleteCustomText = (id: string) => {
    setDraft((prev) => ({ ...prev, customTexts: prev.customTexts.filter((ct) => ct.id !== id) }));
    if (selectedEl === id) setSelectedEl(null);
  };

  const customImageInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePanel = useRef<"left" | "right">("left");

  const addCustomImage = (panel: "left" | "right") => {
    pendingImagePanel.current = panel;
    customImageInputRef.current?.click();
  };

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Fichier trop volumineux", description: "Max 5 Mo", variant: "destructive" }); return; }
    e.target.value = "";
    const url = await uploadToStorage(file, "custom");
    if (url) {
      const newImg: CustomImageBlock = {
        id: `img_${Date.now()}`,
        url,
        panel: pendingImagePanel.current,
        position: { x: 50, y: 50 },
        settings: { opacity: 100, size: 100, borderRadius: 8, objectPositionX: 50, objectPositionY: 50 },
      };
      setDraft((prev) => ({ ...prev, customImages: [...prev.customImages, newImg] }));
      setSelectedEl(newImg.id);
      setActiveTab("selection");
    }
  };

  const deleteCustomImage = (id: string) => {
    setDraft((prev) => ({ ...prev, customImages: prev.customImages.filter((ci) => ci.id !== id) }));
    if (selectedEl === id) setSelectedEl(null);
  };

  // Auto-switch to selection tab when an element is selected
  useEffect(() => {
    if (selectedEl && editing) setActiveTab("selection");
  }, [selectedEl, editing]);

  const s = editing ? draft : settings;
  const hidden = s.hiddenElements || [];
  const resolvedLogo = s.logoUrl || STAIRWAY_LOGO;
  const pos = s.elementPositions || DEFAULT_ELEMENT_POSITIONS;

  const previewScale = 0.45;
  const tsPrev = (style: TextStyle) => ({
    fontFamily: `'${style.font}', sans-serif`,
    color: style.color,
    fontSize: `${Math.round(style.size * previewScale)}px`,
    fontWeight: style.bold ? 700 : 400,
  });

  const logoSizePx = Math.round(32 * (s.logoSettings.size / 100));
  const iconSizePx = Math.round(40 * (s.leftIconSettings.size / 100));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Design de la page de connexion</h3>
        </div>
        {editing ? (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={resetSettings}><RotateCcw className="w-3 h-3" /> Réinitialiser</Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setEditing(false)}>Annuler</Button>
            <Button size="sm" className="h-7 text-[10px] gap-1" onClick={saveSettings}><Save className="w-3 h-3" /> Sauvegarder</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={startEdit}><Eye className="w-3 h-3" /> Modifier le design</Button>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border">
          <MousePointer className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span>Cliquez sur un élément dans l'aperçu pour le sélectionner et voir ses propriétés. Glissez pour repositionner. Cliquez sur un panneau vide pour le sélectionner.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Live Preview with drag support */}
        <Card className="border-border overflow-hidden">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> Aperçu interactif
              <Button variant="ghost" size="sm" className="h-5 text-[8px] px-1.5 gap-0.5 ml-1" onClick={() => setFullscreen(true)} title="Plein écran">
                <Maximize2 className="w-2.5 h-2.5" />
              </Button>
              {editing && (
                <span className="ml-auto flex gap-1 flex-wrap">
                  <Button variant="outline" size="sm" className="h-5 text-[8px] px-1.5 gap-0.5" onClick={() => addCustomText("left")}>
                    <Plus className="w-2.5 h-2.5" /> Texte gauche
                  </Button>
                  <Button variant="outline" size="sm" className="h-5 text-[8px] px-1.5 gap-0.5" onClick={() => addCustomText("right")}>
                    <Plus className="w-2.5 h-2.5" /> Texte droit
                  </Button>
                  <Button variant="outline" size="sm" className="h-5 text-[8px] px-1.5 gap-0.5" onClick={() => addCustomImage("left")}>
                    <Image className="w-2.5 h-2.5" /> Image gauche
                  </Button>
                  <Button variant="outline" size="sm" className="h-5 text-[8px] px-1.5 gap-0.5" onClick={() => addCustomImage("right")}>
                    <Image className="w-2.5 h-2.5" /> Image droite
                  </Button>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex min-h-[400px] rounded-b-lg overflow-hidden border-t border-border" onClick={() => editing && setSelectedEl(null)}>
              {/* Left panel preview */}
              <div
                ref={leftPanelRef}
                className={`relative overflow-hidden transition-all ${editing ? "cursor-pointer" : ""} ${selectedEl === "leftPanel" && editing ? "ring-2 ring-primary ring-inset" : ""}`}
                style={{
                  backgroundColor: s.leftPanelBg,
                  opacity: s.leftPanelSettings.opacity / 100,
                  flex: `0 0 ${s.leftPanelSettings.widthPercent}%`,
                }}
                onClick={(e) => { if (editing) { e.stopPropagation(); setSelectedEl("leftPanel"); } }}
              >
                {s.backgroundImageUrl && (
                  <div
                    className={`absolute inset-0 bg-cover ${editing && selectedEl === "backgroundImage" ? "ring-2 ring-primary ring-inset" : ""}`}
                    style={{ backgroundImage: `url(${s.backgroundImageUrl})`, opacity: s.backgroundImageSettings.opacity / 100, backgroundPosition: `${s.backgroundImageSettings.objectPositionX}% ${s.backgroundImageSettings.objectPositionY}%` }}
                    onClick={(e) => { if (editing) { e.stopPropagation(); setSelectedEl("backgroundImage"); } }}
                  />
                )}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                  <div className="absolute top-10 left-5 w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: `${s.accentColor}10` }} />
                  <div className="absolute bottom-10 right-5 w-40 h-40 rounded-full blur-3xl" style={{ backgroundColor: `${s.accentColor}10` }} />
                </div>

                {/* Icon */}
                {!hidden.includes("leftIcon") && (
                  <DraggableElement id="leftIcon" position={pos.leftIcon} onDrag={handleDrag} selected={selectedEl === "leftIcon"} onSelect={setSelectedEl} containerRef={leftPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <div style={{ opacity: s.leftIconSettings.opacity / 100 }}>
                      {s.leftIconUrl ? (
                        <div className="overflow-hidden shadow-lg" style={{ width: iconSizePx, height: iconSizePx, borderRadius: s.leftIconSettings.borderRadius * previewScale }}>
                          <img src={s.leftIconUrl} alt="Icon" className="w-full h-full object-cover" style={{ objectPosition: `${s.leftIconSettings.objectPositionX}% ${s.leftIconSettings.objectPositionY}%` }} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center shadow-lg" style={{ width: iconSizePx, height: iconSizePx, borderRadius: s.leftIconSettings.borderRadius * previewScale, background: `linear-gradient(135deg, ${s.accentColor}, ${s.buttonColor})` }}>
                          <Sparkles className="w-1/2 h-1/2" style={{ color: s.buttonTextColor }} />
                        </div>
                      )}
                    </div>
                  </DraggableElement>
                )}

                {/* Title */}
                {!hidden.includes("leftTitle") && (
                  <DraggableElement id="leftTitle" position={pos.leftTitle} onDrag={handleDrag} selected={selectedEl === "leftTitle"} onSelect={setSelectedEl} containerRef={leftPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <div className="text-center">
                      <h2 className="leading-tight whitespace-nowrap" style={tsPrev(s.leftTitleStyle)}>{s.leftTitle}</h2>
                      <div className="w-16 h-[2px] mx-auto rounded-full mt-2" style={{ backgroundColor: s.accentColor }} />
                    </div>
                  </DraggableElement>
                )}

                {/* Description */}
                {!hidden.includes("leftDescription") && (
                  <DraggableElement id="leftDescription" position={pos.leftDescription} onDrag={handleDrag} selected={selectedEl === "leftDescription"} onSelect={setSelectedEl} containerRef={leftPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <p className="text-center max-w-[180px] leading-relaxed" style={tsPrev(s.leftDescriptionStyle)}>{s.leftDescription}</p>
                  </DraggableElement>
                )}

                {/* Custom texts on left */}
                {s.customTexts.filter((ct) => ct.panel === "left").map((ct) => (
                  <DraggableElement key={ct.id} id={ct.id} position={ct.position} onDrag={handleDrag} selected={selectedEl === ct.id} onSelect={setSelectedEl} containerRef={leftPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <p className="text-center max-w-[180px]" style={tsPrev(ct.style)}>{ct.text}</p>
                  </DraggableElement>
                ))}

                {/* Custom images on left */}
                {(s.customImages || []).filter((ci) => ci.panel === "left").map((ci) => {
                  return (
                    <DraggableElement key={ci.id} id={ci.id} position={ci.position} onDrag={handleDrag} selected={selectedEl === ci.id} onSelect={setSelectedEl} containerRef={leftPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                      <div className="overflow-hidden shadow-lg" style={getImageContainerStyle(ci.settings, 60, previewScale)}>
                        <img src={ci.url} alt="Custom" className="w-full h-full object-cover" />
                      </div>
                    </DraggableElement>
                  );
                })}
              </div>

              {/* Right panel preview */}
              <div
                ref={rightPanelRef}
                className={`relative overflow-hidden transition-all ${editing ? "cursor-pointer" : ""} ${selectedEl === "rightPanel" && editing ? "ring-2 ring-primary ring-inset" : ""}`}
                style={{
                  backgroundColor: s.rightPanelBg,
                  opacity: s.rightPanelSettings.opacity / 100,
                  flex: `0 0 ${s.rightPanelSettings.widthPercent}%`,
                }}
                onClick={(e) => { if (editing) { e.stopPropagation(); setSelectedEl("rightPanel"); } }}
              >
                {/* Logo */}
                {!hidden.includes("logo") && (
                  <DraggableElement id="logo" position={pos.logo} onDrag={handleDrag} selected={selectedEl === "logo"} onSelect={setSelectedEl} containerRef={rightPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <div className="overflow-hidden shadow-lg" style={{ width: logoSizePx, height: logoSizePx, borderRadius: s.logoSettings.borderRadius * previewScale, opacity: s.logoSettings.opacity / 100 }}>
                      <img src={resolvedLogo} alt="Logo" className="w-full h-full object-cover" style={{ objectPosition: `${s.logoSettings.objectPositionX}% ${s.logoSettings.objectPositionY}%` }} />
                    </div>
                  </DraggableElement>
                )}

                {/* App title */}
                {!hidden.includes("appTitle") && (
                  <DraggableElement id="appTitle" position={pos.appTitle} onDrag={handleDrag} selected={selectedEl === "appTitle"} onSelect={setSelectedEl} containerRef={rightPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <h1 className="text-center whitespace-nowrap" style={tsPrev(s.appTitleStyle)}>{s.appTitle}</h1>
                  </DraggableElement>
                )}

                {/* App subtitle */}
                {!hidden.includes("appSubtitle") && (
                  <DraggableElement id="appSubtitle" position={pos.appSubtitle} onDrag={handleDrag} selected={selectedEl === "appSubtitle"} onSelect={setSelectedEl} containerRef={rightPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <p className="text-center whitespace-nowrap" style={tsPrev(s.appSubtitleStyle)}>{s.appSubtitle}</p>
                  </DraggableElement>
                )}

                {/* Form (static, centered at bottom) */}
                <div className="absolute left-1/2 -translate-x-1/2 w-[75%] space-y-2" style={{ top: "48%" }}>
                  <div className="relative">
                    <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5" style={{ color: `${s.leftPanelText}60` }} />
                    <div className="h-5 pl-6 rounded border text-[7px] flex items-center" style={{ borderColor: `${s.leftPanelText}20`, color: `${s.leftPanelText}60` }}>votre@email.com</div>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5" style={{ color: `${s.leftPanelText}60` }} />
                    <div className="h-5 pl-6 rounded border text-[7px] flex items-center" style={{ borderColor: `${s.leftPanelText}20`, color: `${s.leftPanelText}60` }}>••••••••</div>
                  </div>
                  <div className="text-right">
                    <span style={tsPrev(s.forgotPasswordStyle)}>{s.forgotPasswordText}</span>
                  </div>
                  <div className="h-5 rounded flex items-center justify-center" style={{ backgroundColor: s.buttonColor }}>
                    <span style={tsPrev(s.loginButtonStyle)}>{s.loginButtonText}</span>
                  </div>
                </div>

                {/* Custom texts on right */}
                {s.customTexts.filter((ct) => ct.panel === "right").map((ct) => (
                  <DraggableElement key={ct.id} id={ct.id} position={ct.position} onDrag={handleDrag} selected={selectedEl === ct.id} onSelect={setSelectedEl} containerRef={rightPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <p className="text-center max-w-[160px]" style={tsPrev(ct.style)}>{ct.text}</p>
                  </DraggableElement>
                ))}

                {/* Custom images on right */}
                {(s.customImages || []).filter((ci) => ci.panel === "right").map((ci) => {
                  return (
                    <DraggableElement key={ci.id} id={ci.id} position={ci.position} onDrag={handleDrag} selected={selectedEl === ci.id} onSelect={setSelectedEl} containerRef={rightPanelRef as React.RefObject<HTMLDivElement>} editing={editing}>
                      <div className="overflow-hidden shadow-lg" style={getImageContainerStyle(ci.settings, 60, previewScale)}>
                        <img src={ci.url} alt="Custom" className="w-full h-full object-cover" />
                      </div>
                    </DraggableElement>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fullscreen preview dialog */}
        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 border-0 rounded-none [&>button]:hidden">
            <DialogTitle className="sr-only">Aperçu plein écran</DialogTitle>
            {/* Top toolbar */}
            <div className="absolute top-3 right-3 z-50 flex gap-2">
              <Button variant="secondary" size="sm" className="h-8 gap-1.5 shadow-lg" onClick={() => { setFullscreen(false); }}>
                <Minimize2 className="w-4 h-4" /> Fermer
              </Button>
            </div>
            <div className="flex w-full h-full">
              {/* Left panel fullscreen */}
              <div
                ref={fullscreenLeftRef}
                className={`relative overflow-hidden ${editing ? "cursor-pointer" : ""} ${selectedEl === "leftPanel" && editing ? "ring-2 ring-primary ring-inset" : ""}`}
                style={{
                  backgroundColor: s.leftPanelBg,
                  opacity: s.leftPanelSettings.opacity / 100,
                  flex: `0 0 ${s.leftPanelSettings.widthPercent}%`,
                }}
                onClick={(e) => { if (editing) { e.stopPropagation(); setSelectedEl("leftPanel"); } }}
              >
                {s.backgroundImageUrl && (
                  <div
                    className={`absolute inset-0 bg-cover ${editing && selectedEl === "backgroundImage" ? "ring-2 ring-primary ring-inset" : ""}`}
                    style={{ backgroundImage: `url(${s.backgroundImageUrl})`, opacity: s.backgroundImageSettings.opacity / 100, backgroundPosition: `${s.backgroundImageSettings.objectPositionX}% ${s.backgroundImageSettings.objectPositionY}%` }}
                    onClick={(e) => { if (editing) { e.stopPropagation(); setSelectedEl("backgroundImage"); } }}
                  />
                )}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                  <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: `${s.accentColor}08` }} />
                  <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full blur-3xl" style={{ backgroundColor: `${s.accentColor}08` }} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full" style={{ border: `1px solid ${s.accentColor}15` }} />
                </div>
                {!hidden.includes("leftIcon") && (() => {
                  const iconSize = Math.round(80 * (s.leftIconSettings.size / 100));
                  return (
                    <DraggableElement id="leftIcon" position={pos.leftIcon} onDrag={handleDrag} selected={selectedEl === "leftIcon"} onSelect={setSelectedEl} containerRef={fullscreenLeftRef as React.RefObject<HTMLDivElement>} editing={editing}>
                      <div style={{ opacity: s.leftIconSettings.opacity / 100 }}>
                        {s.leftIconUrl ? (
                          <div className="overflow-hidden shadow-lg" style={{ width: iconSize, height: iconSize, borderRadius: s.leftIconSettings.borderRadius }}>
                            <img src={s.leftIconUrl} alt="Icon" className="w-full h-full object-cover" style={{ objectPosition: `${s.leftIconSettings.objectPositionX}% ${s.leftIconSettings.objectPositionY}%` }} />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center shadow-lg" style={{ width: iconSize, height: iconSize, borderRadius: s.leftIconSettings.borderRadius, background: `linear-gradient(135deg, ${s.accentColor}, ${s.buttonColor})` }}>
                            <Sparkles className="w-10 h-10" style={{ color: s.buttonTextColor }} />
                          </div>
                        )}
                      </div>
                    </DraggableElement>
                  );
                })()}
                {!hidden.includes("leftTitle") && (
                  <DraggableElement id="leftTitle" position={pos.leftTitle} onDrag={handleDrag} selected={selectedEl === "leftTitle"} onSelect={setSelectedEl} containerRef={fullscreenLeftRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <div className="text-center">
                      <h2 style={{ fontFamily: `'${s.leftTitleStyle.font}', sans-serif`, color: s.leftTitleStyle.color, fontSize: `${s.leftTitleStyle.size}px`, fontWeight: s.leftTitleStyle.bold ? 700 : 400 }}>{s.leftTitle}</h2>
                      <div className="w-32 h-[2px] mx-auto rounded-full mt-4" style={{ backgroundColor: s.accentColor }} />
                    </div>
                  </DraggableElement>
                )}
                {!hidden.includes("leftDescription") && (
                  <DraggableElement id="leftDescription" position={pos.leftDescription} onDrag={handleDrag} selected={selectedEl === "leftDescription"} onSelect={setSelectedEl} containerRef={fullscreenLeftRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <p className="text-center max-w-md leading-relaxed" style={{ fontFamily: `'${s.leftDescriptionStyle.font}', sans-serif`, color: s.leftDescriptionStyle.color, fontSize: `${s.leftDescriptionStyle.size}px`, fontWeight: s.leftDescriptionStyle.bold ? 700 : 400 }}>{s.leftDescription}</p>
                  </DraggableElement>
                )}
                {s.customTexts.filter((ct) => ct.panel === "left").map((ct) => (
                  <DraggableElement key={ct.id} id={ct.id} position={ct.position} onDrag={handleDrag} selected={selectedEl === ct.id} onSelect={setSelectedEl} containerRef={fullscreenLeftRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <p className="text-center max-w-md" style={{ fontFamily: `'${ct.style.font}', sans-serif`, color: ct.style.color, fontSize: `${ct.style.size}px`, fontWeight: ct.style.bold ? 700 : 400 }}>{ct.text}</p>
                  </DraggableElement>
                ))}
                {(s.customImages || []).filter((ci) => ci.panel === "left").map((ci) => {
                  return (
                    <DraggableElement key={ci.id} id={ci.id} position={ci.position} onDrag={handleDrag} selected={selectedEl === ci.id} onSelect={setSelectedEl} containerRef={fullscreenLeftRef as React.RefObject<HTMLDivElement>} editing={editing}>
                      <div className="overflow-hidden shadow-lg" style={getImageContainerStyle(ci.settings, 80)}>
                        <img src={ci.url} alt="" className="w-full h-full object-cover" />
                      </div>
                    </DraggableElement>
                  );
                })}
              </div>
              {/* Right panel fullscreen */}
              <div
                ref={fullscreenRightRef}
                className={`flex-1 flex items-center justify-center relative ${editing ? "cursor-pointer" : ""} ${selectedEl === "rightPanel" && editing ? "ring-2 ring-primary ring-inset" : ""}`}
                style={{
                  backgroundColor: s.rightPanelBg,
                  opacity: s.rightPanelSettings.opacity / 100,
                  flex: `0 0 ${s.rightPanelSettings.widthPercent}%`,
                }}
                onClick={(e) => { if (editing) { e.stopPropagation(); setSelectedEl("rightPanel"); } }}
              >
                {!hidden.includes("logo") && (() => {
                  const logoSize = Math.round(56 * (s.logoSettings.size / 100));
                  return (
                    <DraggableElement id="logo" position={pos.logo} onDrag={handleDrag} selected={selectedEl === "logo"} onSelect={setSelectedEl} containerRef={fullscreenRightRef as React.RefObject<HTMLDivElement>} editing={editing}>
                      <div className="overflow-hidden shadow-lg" style={{ width: logoSize, height: logoSize, borderRadius: s.logoSettings.borderRadius, opacity: s.logoSettings.opacity / 100 }}>
                        <img src={resolvedLogo} alt="Logo" className="w-full h-full object-cover" style={{ objectPosition: `${s.logoSettings.objectPositionX}% ${s.logoSettings.objectPositionY}%` }} />
                      </div>
                    </DraggableElement>
                  );
                })()}
                {!hidden.includes("appTitle") && (
                  <DraggableElement id="appTitle" position={pos.appTitle} onDrag={handleDrag} selected={selectedEl === "appTitle"} onSelect={setSelectedEl} containerRef={fullscreenRightRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <h1 className="text-center whitespace-nowrap" style={{ fontFamily: `'${s.appTitleStyle.font}', sans-serif`, color: s.appTitleStyle.color, fontSize: `${s.appTitleStyle.size}px`, fontWeight: s.appTitleStyle.bold ? 700 : 400 }}>{s.appTitle}</h1>
                  </DraggableElement>
                )}
                {!hidden.includes("appSubtitle") && (
                  <DraggableElement id="appSubtitle" position={pos.appSubtitle} onDrag={handleDrag} selected={selectedEl === "appSubtitle"} onSelect={setSelectedEl} containerRef={fullscreenRightRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <p className="text-center whitespace-nowrap" style={{ fontFamily: `'${s.appSubtitleStyle.font}', sans-serif`, color: s.appSubtitleStyle.color, fontSize: `${s.appSubtitleStyle.size}px`, fontWeight: s.appSubtitleStyle.bold ? 700 : 400 }}>{s.appSubtitle}</p>
                  </DraggableElement>
                )}
                {/* Form preview */}
                <div className="w-full max-w-[420px] mt-32 relative z-20">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: s.leftPanelText }}>Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: `${s.leftPanelText}60` }} />
                        <div className="h-11 pl-10 rounded-lg border flex items-center text-sm" style={{ backgroundColor: s.leftPanelBg, borderColor: `${s.leftPanelText}20`, color: `${s.leftPanelText}60` }}>votre@email.com</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: s.leftPanelText }}>Mot de passe</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: `${s.leftPanelText}60` }} />
                        <div className="h-11 pl-10 rounded-lg border flex items-center text-sm" style={{ backgroundColor: s.leftPanelBg, borderColor: `${s.leftPanelText}20`, color: `${s.leftPanelText}60` }}>••••••••</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span style={{ fontFamily: `'${s.forgotPasswordStyle.font}', sans-serif`, color: s.forgotPasswordStyle.color, fontSize: `${s.forgotPasswordStyle.size}px` }}>{s.forgotPasswordText}</span>
                    </div>
                    <div className="h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.buttonColor }}>
                      <span style={{ fontFamily: `'${s.loginButtonStyle.font}', sans-serif`, color: s.loginButtonStyle.color, fontSize: `${s.loginButtonStyle.size}px`, fontWeight: s.loginButtonStyle.bold ? 700 : 400 }}>{s.loginButtonText}</span>
                    </div>
                  </div>
                </div>
                {s.customTexts.filter((ct) => ct.panel === "right").map((ct) => (
                  <DraggableElement key={ct.id} id={ct.id} position={ct.position} onDrag={handleDrag} selected={selectedEl === ct.id} onSelect={setSelectedEl} containerRef={fullscreenRightRef as React.RefObject<HTMLDivElement>} editing={editing}>
                    <p className="text-center max-w-md" style={{ fontFamily: `'${ct.style.font}', sans-serif`, color: ct.style.color, fontSize: `${ct.style.size}px`, fontWeight: ct.style.bold ? 700 : 400 }}>{ct.text}</p>
                  </DraggableElement>
                ))}
                {(s.customImages || []).filter((ci) => ci.panel === "right").map((ci) => {
                  return (
                    <DraggableElement key={ci.id} id={ci.id} position={ci.position} onDrag={handleDrag} selected={selectedEl === ci.id} onSelect={setSelectedEl} containerRef={fullscreenRightRef as React.RefObject<HTMLDivElement>} editing={editing}>
                      <div className="overflow-hidden shadow-lg" style={getImageContainerStyle(ci.settings, 80)}>
                        <img src={ci.url} alt="" className="w-full h-full object-cover" />
                      </div>
                    </DraggableElement>
                  );
                })}
              </div>
              {/* Properties sidebar in fullscreen */}
              {editing && selectedEl && (
                <div className="w-[300px] bg-background border-l border-border overflow-auto p-4 z-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-foreground">Propriétés</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedEl(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <SelectedElementProperties
                    selectedEl={selectedEl}
                    draft={draft}
                    setDraft={setDraft}
                    onDelete={selectedEl.startsWith("custom_") ? () => deleteCustomText(selectedEl) : selectedEl.startsWith("img_") ? () => deleteCustomImage(selectedEl) : undefined}
                  />
                  {/* Quick selection */}
                  <div className="border-t border-border pt-3 mt-3">
                    <Label className="text-[9px] text-muted-foreground mb-2 block">Sélection rapide</Label>
                    <div className="flex flex-wrap gap-1">
                      {["leftPanel", "rightPanel", "logo", "appTitle", "appSubtitle", "leftTitle", "leftDescription",
                        "leftIcon",
                        ...(s.backgroundImageUrl ? ["backgroundImage"] : []),
                        ...s.customTexts.map(ct => ct.id),
                        ...(s.customImages || []).map(ci => ci.id),
                      ].map((elId) => (
                        <Button key={elId} variant={selectedEl === elId ? "default" : "outline"} size="sm" className="h-6 text-[8px] px-2" onClick={() => setSelectedEl(elId)}>
                          {getElementLabel(elId, draft)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {editing && (
          <Card className="border-border">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4 pt-3 pb-0 gap-1 flex-wrap">
                  <TabsTrigger value="selection" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><MousePointer className="w-3 h-3" /> Sélection</TabsTrigger>
                  <TabsTrigger value="texts" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><Type className="w-3 h-3" /> Textes</TabsTrigger>
                  <TabsTrigger value="colors" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><Palette className="w-3 h-3" /> Couleurs</TabsTrigger>
                  <TabsTrigger value="images" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><Image className="w-3 h-3" /> Images</TabsTrigger>
                  <TabsTrigger value="panels" className="rounded-t-md rounded-b-none text-[10px] gap-1 data-[state=active]:bg-muted"><Settings2 className="w-3 h-3" /> Panneaux</TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[350px]">
                  {/* Selection-based properties */}
                  <TabsContent value="selection" className="px-4 pb-4 pt-2 space-y-2 mt-0">
                    {selectedEl ? (
                      <SelectedElementProperties
                        selectedEl={selectedEl}
                        draft={draft}
                        setDraft={setDraft}
                        onDelete={selectedEl.startsWith("custom_") ? () => deleteCustomText(selectedEl) : selectedEl.startsWith("img_") ? () => deleteCustomImage(selectedEl) : undefined}
                      />
                    ) : (
                      <div className="text-center py-8 space-y-3">
                        <MousePointer className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                        <p className="text-[11px] text-muted-foreground">Cliquez sur un élément dans l'aperçu</p>
                        <p className="text-[9px] text-muted-foreground/60">Sélectionnez un texte, une image ou un panneau pour voir et modifier ses propriétés</p>
                        <div className="border-t border-border pt-3 mt-2">
                          <Label className="text-[9px] text-muted-foreground mb-2 block">Ajouter des éléments</Label>
                          <div className="flex flex-wrap gap-1 justify-center">
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => addCustomImage("left")}>
                              <Image className="w-3 h-3" /> Photo gauche
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => addCustomImage("right")}>
                              <Image className="w-3 h-3" /> Photo droite
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => addCustomText("left")}>
                              <Plus className="w-3 h-3" /> Texte gauche
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => addCustomText("right")}>
                              <Plus className="w-3 h-3" /> Texte droit
                            </Button>
                          </div>
                          <p className="text-[8px] text-muted-foreground/50 mt-2">Les photos ajoutées peuvent être déplacées par glisser-déposer et redimensionnées via les propriétés</p>
                        </div>
                      </div>
                    )}

                    {/* Element list for quick selection */}
                    <div className="border-t border-border pt-3 mt-3">
                      <Label className="text-[9px] text-muted-foreground mb-2 block">Sélection rapide</Label>
                      <div className="flex flex-wrap gap-1">
                        {["leftPanel", "rightPanel", "logo", "appTitle", "appSubtitle", "leftTitle", "leftDescription",
                          "leftIcon",
                          ...(s.backgroundImageUrl ? ["backgroundImage"] : []),
                          ...s.customTexts.map(ct => ct.id),
                          ...(s.customImages || []).map(ci => ci.id),
                        ].map((elId) => (
                          <Button
                            key={elId}
                            variant={selectedEl === elId ? "default" : "outline"}
                            size="sm"
                            className="h-6 text-[8px] px-2"
                            onClick={() => setSelectedEl(elId)}
                          >
                            {getElementLabel(elId, draft)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Built-in texts */}
                  <TabsContent value="texts" className="px-4 pb-4 pt-2 space-y-2 mt-0">
                    <p className="text-[9px] text-muted-foreground mb-1">Personnalisez chaque texte : contenu, police, couleur, taille.</p>
                    <TextStyleEditor label="Titre de l'application" textValue={draft.appTitle} onTextChange={(v) => setDraft({ ...draft, appTitle: v })} style={draft.appTitleStyle} onStyleChange={(st) => setDraft({ ...draft, appTitleStyle: st })} />
                    <TextStyleEditor label="Sous-titre" textValue={draft.appSubtitle} onTextChange={(v) => setDraft({ ...draft, appSubtitle: v })} style={draft.appSubtitleStyle} onStyleChange={(st) => setDraft({ ...draft, appSubtitleStyle: st })} />
                    <TextStyleEditor label="Titre panneau gauche" textValue={draft.leftTitle} onTextChange={(v) => setDraft({ ...draft, leftTitle: v })} style={draft.leftTitleStyle} onStyleChange={(st) => setDraft({ ...draft, leftTitleStyle: st })} />
                    <TextStyleEditor label="Description panneau gauche" textValue={draft.leftDescription} onTextChange={(v) => setDraft({ ...draft, leftDescription: v })} style={draft.leftDescriptionStyle} onStyleChange={(st) => setDraft({ ...draft, leftDescriptionStyle: st })} multiline />
                    <TextStyleEditor label="Texte du bouton" textValue={draft.loginButtonText} onTextChange={(v) => setDraft({ ...draft, loginButtonText: v })} style={draft.loginButtonStyle} onStyleChange={(st) => setDraft({ ...draft, loginButtonStyle: st })} />
                    <TextStyleEditor label="Lien mot de passe oublié" textValue={draft.forgotPasswordText} onTextChange={(v) => setDraft({ ...draft, forgotPasswordText: v })} style={draft.forgotPasswordStyle} onStyleChange={(st) => setDraft({ ...draft, forgotPasswordStyle: st })} />
                    
                    {/* Custom blocks in texts tab too */}
                    {draft.customTexts.length > 0 && (
                      <>
                        <div className="border-t border-border pt-2 mt-2">
                          <Label className="text-[9px] text-muted-foreground">Blocs personnalisés</Label>
                        </div>
                        {draft.customTexts.map((ct) => (
                          <TextStyleEditor
                            key={ct.id}
                            label={`${ct.panel === "left" ? "◀" : "▶"} ${ct.text.substring(0, 30)}${ct.text.length > 30 ? "..." : ""}`}
                            textValue={ct.text}
                            onTextChange={(v) => setDraft(p => ({ ...p, customTexts: p.customTexts.map(c => c.id === ct.id ? { ...c, text: v } : c) }))}
                            style={ct.style}
                            onStyleChange={(st) => setDraft(p => ({ ...p, customTexts: p.customTexts.map(c => c.id === ct.id ? { ...c, style: st } : c) }))}
                            onDelete={() => deleteCustomText(ct.id)}
                            multiline
                          />
                        ))}
                      </>
                    )}
                    <div className="flex gap-1 pt-2">
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 flex-1" onClick={() => addCustomText("left")}>
                        <Plus className="w-3 h-3" /> Texte gauche
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 flex-1" onClick={() => addCustomText("right")}>
                        <Plus className="w-3 h-3" /> Texte droit
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Colors */}
                  <TabsContent value="colors" className="px-4 pb-4 pt-2 space-y-3 mt-0">
                    <div>
                      <Label className="text-[10px] mb-2 block">Thèmes prédéfinis</Label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {COLOR_PRESETS.map((preset) => (
                          <button key={preset.label} className="flex flex-col items-center gap-1 p-2 rounded-md border border-border hover:border-primary/50 transition-colors"
                            onClick={() => setDraft({ ...draft, leftPanelBg: preset.leftBg, leftPanelText: preset.leftText, buttonColor: preset.buttonColor, accentColor: preset.accentColor })}>
                            <div className="flex gap-0.5">
                              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: preset.leftBg }} />
                              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: preset.buttonColor }} />
                            </div>
                            <span className="text-[8px] text-muted-foreground">{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Fond panneau gauche", key: "leftPanelBg" },
                        { label: "Fond panneau droit", key: "rightPanelBg" },
                        { label: "Couleur d'accent", key: "accentColor" },
                        { label: "Couleur du bouton", key: "buttonColor" },
                      ].map(({ label, key }) => (
                        <div className="space-y-1" key={key}>
                          <Label className="text-[10px]">{label}</Label>
                          <div className="flex gap-1.5">
                            <input type="color" value={(draft[key as keyof typeof draft]) as string} onChange={(e) => setDraft({ ...draft, [key as keyof typeof draft]: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                            <Input value={(draft[key as keyof typeof draft]) as string} onChange={(e) => setDraft({ ...draft, [key as keyof typeof draft]: e.target.value })} className="h-8 text-[10px] font-mono flex-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Images */}
                  <TabsContent value="images" className="px-4 pb-4 pt-2 space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold">Logo (panneau droit)</Label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0" style={{ opacity: draft.logoSettings.opacity / 100 }}>
                          <img src={draft.logoUrl || logoImg} alt="Logo" className="w-12 h-12 object-cover" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "logoUrl")} />
                          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 w-full" onClick={() => logoInputRef.current?.click()}><Upload className="w-3 h-3" /> Changer le logo</Button>
                          {draft.logoUrl && <Button variant="ghost" size="sm" className="h-6 text-[9px] w-full text-destructive" onClick={() => setDraft({ ...draft, logoUrl: "" })}><Trash2 className="w-3 h-3 mr-1" /> Supprimer</Button>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">Opacité : {draft.logoSettings.opacity}%</Label>
                        <Slider value={[draft.logoSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, logoSettings: { ...p.logoSettings, opacity: v } }))} min={0} max={100} step={1} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground">Taille : {draft.logoSettings.size}%</Label>
                        <Slider value={[draft.logoSettings.size]} onValueChange={([v]) => setDraft(p => ({ ...p, logoSettings: { ...p.logoSettings, size: v } }))} min={30} max={500} step={5} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-semibold">Icône (panneau gauche)</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground">Visible</span>
                          <Switch checked={!(draft.hiddenElements || []).includes("leftIcon")} onCheckedChange={(v) => setDraft(p => {
                            const arr = p.hiddenElements || [];
                            return { ...p, hiddenElements: v ? arr.filter(e => e !== "leftIcon") : [...arr, "leftIcon"] };
                          })} />
                        </div>
                      </div>
                      {!(draft.hiddenElements || []).includes("leftIcon") && (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${draft.accentColor}, ${draft.buttonColor})`, opacity: draft.leftIconSettings.opacity / 100 }}>
                              {draft.leftIconUrl ? <img src={draft.leftIconUrl} alt="Icon" className="w-12 h-12 object-cover" /> : <Sparkles className="w-6 h-6" style={{ color: draft.buttonTextColor }} />}
                            </div>
                            <div className="flex-1 space-y-1">
                              <input ref={leftIconInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "leftIconUrl")} />
                              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 w-full" onClick={() => leftIconInputRef.current?.click()}><Upload className="w-3 h-3" /> Changer l'icône</Button>
                              {draft.leftIconUrl && <Button variant="ghost" size="sm" className="h-6 text-[9px] w-full text-destructive" onClick={() => setDraft({ ...draft, leftIconUrl: "" })}><Trash2 className="w-3 h-3 mr-1" /> Supprimer</Button>}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] text-muted-foreground">Opacité : {draft.leftIconSettings.opacity}%</Label>
                            <Slider value={[draft.leftIconSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, leftIconSettings: { ...p.leftIconSettings, opacity: v } }))} min={0} max={100} step={1} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] text-muted-foreground">Taille : {draft.leftIconSettings.size}%</Label>
                            <Slider value={[draft.leftIconSettings.size]} onValueChange={([v]) => setDraft(p => ({ ...p, leftIconSettings: { ...p.leftIconSettings, size: v } }))} min={30} max={500} step={5} />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-semibold">Image de fond (panneau gauche)</Label>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: draft.leftPanelBg }}>
                          {draft.backgroundImageUrl ? <img src={draft.backgroundImageUrl} alt="Fond" className="w-16 h-12 object-cover" style={{ opacity: draft.backgroundImageSettings.opacity / 100 }} /> : <span className="text-[8px] text-muted-foreground">Aucune</span>}
                        </div>
                        <div className="flex-1 space-y-1">
                          <input ref={bgImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "backgroundImageUrl")} />
                          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 w-full" onClick={() => bgImageInputRef.current?.click()}><Upload className="w-3 h-3" /> Ajouter une image</Button>
                          {draft.backgroundImageUrl && <Button variant="ghost" size="sm" className="h-6 text-[9px] w-full text-destructive" onClick={() => setDraft({ ...draft, backgroundImageUrl: "" })}><Trash2 className="w-3 h-3 mr-1" /> Supprimer</Button>}
                        </div>
                      </div>
                      {draft.backgroundImageUrl && (
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Opacité : {draft.backgroundImageSettings.opacity}%</Label>
                          <Slider value={[draft.backgroundImageSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, backgroundImageSettings: { ...p.backgroundImageSettings, opacity: v } }))} min={0} max={100} step={1} />
                        </div>
                      )}
                    </div>

                    {/* Custom images section */}
                    <div className="space-y-2 border-t border-border pt-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-semibold">Images personnalisées</Label>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-6 text-[9px] gap-0.5" onClick={() => addCustomImage("left")}>
                            <Plus className="w-2.5 h-2.5" /> Gauche
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 text-[9px] gap-0.5" onClick={() => addCustomImage("right")}>
                            <Plus className="w-2.5 h-2.5" /> Droite
                          </Button>
                        </div>
                      </div>
                      <input ref={customImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomImageUpload} />
                      {(draft.customImages || []).length === 0 && (
                        <p className="text-[9px] text-muted-foreground text-center py-2">Aucune image personnalisée ajoutée</p>
                      )}
                      {(draft.customImages || []).map((ci) => (
                        <div key={ci.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                          <div className="w-10 h-10 rounded overflow-hidden border border-border flex-shrink-0">
                            <img src={ci.url} alt="Custom" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] text-muted-foreground">{ci.panel === "left" ? "◀ Gauche" : "▶ Droite"}</p>
                            <p className="text-[8px] text-muted-foreground/60">Taille: {ci.settings.size}% · Opacité: {ci.settings.opacity}%</p>
                          </div>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setSelectedEl(ci.id); setActiveTab("selection"); }}>
                              <Settings2 className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteCustomImage(ci.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Panels */}
                  <TabsContent value="panels" className="px-4 pb-4 pt-2 space-y-4 mt-0">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-semibold">Panneau gauche</Label>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Couleur de fond</Label>
                          <div className="flex gap-1.5">
                            <input type="color" value={draft.leftPanelBg} onChange={(e) => setDraft(p => ({ ...p, leftPanelBg: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0" />
                            <Input value={draft.leftPanelBg} onChange={(e) => setDraft(p => ({ ...p, leftPanelBg: e.target.value }))} className="h-7 text-[9px] font-mono flex-1" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Opacité : {draft.leftPanelSettings.opacity}%</Label>
                          <Slider value={[draft.leftPanelSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, leftPanelSettings: { ...p.leftPanelSettings, opacity: v } }))} min={0} max={100} step={1} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Largeur : {draft.leftPanelSettings.widthPercent}%</Label>
                          <Slider value={[draft.leftPanelSettings.widthPercent]} onValueChange={([v]) => setDraft(p => ({ ...p, leftPanelSettings: { ...p.leftPanelSettings, widthPercent: v }, rightPanelSettings: { ...p.rightPanelSettings, widthPercent: 100 - v } }))} min={25} max={75} step={1} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 border-t border-border pt-3">
                      <Label className="text-[10px] font-semibold">Panneau droit</Label>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Couleur de fond</Label>
                          <div className="flex gap-1.5">
                            <input type="color" value={draft.rightPanelBg} onChange={(e) => setDraft(p => ({ ...p, rightPanelBg: e.target.value }))} className="w-7 h-7 rounded cursor-pointer border-0" />
                            <Input value={draft.rightPanelBg} onChange={(e) => setDraft(p => ({ ...p, rightPanelBg: e.target.value }))} className="h-7 text-[9px] font-mono flex-1" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] text-muted-foreground">Opacité : {draft.rightPanelSettings.opacity}%</Label>
                          <Slider value={[draft.rightPanelSettings.opacity]} onValueChange={([v]) => setDraft(p => ({ ...p, rightPanelSettings: { ...p.rightPanelSettings, opacity: v } }))} min={0} max={100} step={1} />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminLoginDesign;
