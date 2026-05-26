import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { preloadAllData } from "@/hooks/useDataPreloader";

export interface ModuleDesignSettings {
  // Colors
  backgroundColor: string;
  foregroundColor: string;
  cardColor: string;
  primaryColor: string;
  primaryForeground: string;
  secondaryColor: string;
  accentColor: string;
  mutedColor: string;
  mutedForeground: string;
  borderColor: string;
  destructiveColor: string;

  // Sidebar
  sidebarBg: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarAccent: string;
  sidebarBorder: string;

  // Header
  headerBg: string;
  headerForeground: string;
  headerLogoUrl: string;
  headerTitle: string;
  headerSubtitle: string;

  // Fonts
  displayFont: string;
  bodyFont: string;

  // Extra
  borderRadius: number;
  sidebarLogoSize: number;
}

// Keep old name as alias for compatibility
export type GlobalDesignSettings = ModuleDesignSettings;

export const DEFAULT_GLOBAL_DESIGN: ModuleDesignSettings = {
  // === Charte FACAM STAIRWAY — Thème Blanc ===
  backgroundColor: "0 0% 100%",          // blanc pur
  foregroundColor: "224 100% 10%",        // #000d32 navy sombre
  cardColor: "0 0% 100%",                 // blanc
  primaryColor: "41 100% 50%",            // #ffae03 or FACAM
  primaryForeground: "0 0% 0%",           // noir sur or
  secondaryColor: "217 100% 22%",         // #002a6e bleu FACAM
  accentColor: "220 43% 97%",             // #f0f4fa bleu très clair
  mutedColor: "220 43% 97%",              // bleu très clair
  mutedForeground: "220 13% 46%",         // gris moyen
  borderColor: "220 20% 88%",             // gris bleu clair
  destructiveColor: "0 72% 51%",

  sidebarBg: "0 0% 100%",                 // sidebar blanche
  sidebarForeground: "224 100% 19%",      // #001b61 navy
  sidebarPrimary: "41 100% 50%",          // or FACAM
  sidebarAccent: "220 60% 96%",           // bleu très clair
  sidebarBorder: "220 20% 90%",           // gris clair

  headerBg: "",
  headerForeground: "",
  headerLogoUrl: "",
  headerTitle: "",
  headerSubtitle: "",

  displayFont: "Montserrat",
  bodyFont: "Montserrat",

  borderRadius: 10,
  sidebarLogoSize: 144,
};

export const MODULE_KEYS = [
  { id: "global", label: "Global (défaut)" },
  { id: "dashboard", label: "Accueil" },
  { id: "orgchart", label: "Organigramme" },
  { id: "gantt", label: "Planification" },
  { id: "projectscomites", label: "Projets & Comités" },
  { id: "search", label: "Recherche" },
  { id: "timeentry", label: "Week Planner" },
  { id: "hrperformance", label: "Objectifs" },
  { id: "dept_objectives", label: "Obj. Départements" },
  { id: "admin", label: "Administration" },
] as const;

export type ModuleId = typeof MODULE_KEYS[number]["id"];

const STORAGE_KEY = "global_design_settings";
const MODULE_STORAGE_KEY = "module_design_settings";

// Détecte l'ancien thème sombre (fond < 30% de luminosité) pour migrer vers le blanc FACAM
function isLegacyDarkTheme(data: Record<string, any>): boolean {
  const bg: string = data?.backgroundColor ?? "";
  const parts = bg.trim().split(/\s+/);
  const lightness = parseFloat(parts[2] ?? "100");
  return lightness < 30;
}

function applyDesignToDOM(s: ModuleDesignSettings) {
  const root = document.documentElement;
  root.style.setProperty("--background", s.backgroundColor);
  root.style.setProperty("--foreground", s.foregroundColor);
  root.style.setProperty("--card", s.cardColor);
  root.style.setProperty("--card-foreground", s.foregroundColor);
  root.style.setProperty("--popover", s.cardColor);
  root.style.setProperty("--popover-foreground", s.foregroundColor);
  root.style.setProperty("--primary", s.primaryColor);
  root.style.setProperty("--primary-foreground", s.primaryForeground);
  root.style.setProperty("--secondary", s.secondaryColor);
  root.style.setProperty("--secondary-foreground", s.foregroundColor);
  root.style.setProperty("--muted", s.mutedColor);
  root.style.setProperty("--muted-foreground", s.mutedForeground);
  root.style.setProperty("--accent", s.accentColor);
  root.style.setProperty("--accent-foreground", s.foregroundColor);
  root.style.setProperty("--border", s.borderColor);
  root.style.setProperty("--input", s.borderColor);
  root.style.setProperty("--ring", s.primaryColor);
  root.style.setProperty("--destructive", s.destructiveColor);

  root.style.setProperty("--sidebar-background", s.sidebarBg);
  root.style.setProperty("--sidebar-foreground", s.sidebarForeground);
  root.style.setProperty("--sidebar-primary", s.sidebarPrimary);
  root.style.setProperty("--sidebar-primary-foreground", s.primaryForeground);
  root.style.setProperty("--sidebar-accent", s.sidebarAccent);
  root.style.setProperty("--sidebar-accent-foreground", s.sidebarForeground);
  root.style.setProperty("--sidebar-border", s.sidebarBorder);
  root.style.setProperty("--sidebar-ring", s.sidebarPrimary);

  root.style.setProperty("--radius", `${s.borderRadius / 16}rem`);
  root.style.setProperty("--font-display", `'${s.displayFont}', sans-serif`);
  root.style.setProperty("--font-body", `'${s.bodyFont}', sans-serif`);

  // Load Google Fonts
  const fonts = new Set([s.displayFont, s.bodyFont]);
  fonts.forEach(font => {
    const id = `gfont-global-${font.replace(/\s+/g, "-")}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800&display=swap`;
      document.head.appendChild(link);
    }
  });
}

interface GlobalDesignContextType {
  settings: ModuleDesignSettings;
  moduleSettings: Record<string, ModuleDesignSettings>;
  updateSettings: (s: ModuleDesignSettings) => void;
  getModuleSettings: (moduleId: string) => ModuleDesignSettings;
  updateModuleSettings: (moduleId: string, s: ModuleDesignSettings) => void;
  applyModuleDesign: (moduleId: string) => void;
  resetToGlobal: () => void;
}

const GlobalDesignContext = createContext<GlobalDesignContextType | null>(null);

export const useGlobalDesign = () => {
  const ctx = useContext(GlobalDesignContext);
  if (!ctx) throw new Error("useGlobalDesign must be inside GlobalDesignProvider");
  return ctx;
};

export const GlobalDesignProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<ModuleDesignSettings>(DEFAULT_GLOBAL_DESIGN);
  const [moduleSettings, setModuleSettings] = useState<Record<string, ModuleDesignSettings>>({});

  useEffect(() => {
    const load = async () => {
      // localStorage — migration automatique depuis l'ancien thème sombre
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw);
          if (isLegacyDarkTheme(stored)) {
            // Migration : effacer l'ancien thème sombre, utiliser le blanc FACAM
            localStorage.removeItem(STORAGE_KEY);
            applyDesignToDOM(DEFAULT_GLOBAL_DESIGN);
          } else {
            const parsed = { ...DEFAULT_GLOBAL_DESIGN, ...stored };
            setSettings(parsed);
            applyDesignToDOM(parsed);
          }
        } else {
          applyDesignToDOM(DEFAULT_GLOBAL_DESIGN);
        }
      } catch {
        applyDesignToDOM(DEFAULT_GLOBAL_DESIGN);
      }

      try {
        const rawModules = localStorage.getItem(MODULE_STORAGE_KEY);
        if (rawModules) {
          setModuleSettings(JSON.parse(rawModules));
        }
      } catch {}

      // Use preloaded data instead of individual queries
      const cached = await preloadAllData();

      if (cached.globalDesign) {
        const rawData = cached.globalDesign as Record<string, any>;
        if (isLegacyDarkTheme(rawData)) {
          // Migration DB : remplacer l'ancien thème sombre par le blanc FACAM
          setSettings(DEFAULT_GLOBAL_DESIGN);
          applyDesignToDOM(DEFAULT_GLOBAL_DESIGN);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GLOBAL_DESIGN));
          supabase.from("app_organization").upsert({ id: "global_design", data: DEFAULT_GLOBAL_DESIGN as any }).then();
        } else {
          const merged = { ...DEFAULT_GLOBAL_DESIGN, ...rawData };
          setSettings(merged);
          applyDesignToDOM(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      }

      if (cached.moduleDesigns) {
        const parsed = cached.moduleDesigns as Record<string, any>;
        setModuleSettings(parsed);
        localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(parsed));
      }
    };
    load();
  }, []);

  const updateSettings = useCallback((s: ModuleDesignSettings) => {
    setSettings(s);
    applyDesignToDOM(s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    supabase.from("app_organization").upsert({ id: "global_design", data: s as any }).then();
  }, []);

  const getModuleSettings = useCallback((moduleId: string): ModuleDesignSettings => {
    if (moduleId === "global") return settings;
    return moduleSettings[moduleId] ? { ...DEFAULT_GLOBAL_DESIGN, ...moduleSettings[moduleId] } : settings;
  }, [settings, moduleSettings]);

  const updateModuleSettings = useCallback((moduleId: string, s: ModuleDesignSettings) => {
    if (moduleId === "global") {
      updateSettings(s);
      return;
    }
    const updated = { ...moduleSettings, [moduleId]: s };
    setModuleSettings(updated);
    localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(updated));
    supabase.from("app_organization").upsert({ id: "module_designs", data: updated as any }).then();
  }, [moduleSettings, updateSettings]);

  const applyModuleDesign = useCallback((moduleId: string) => {
    const s = moduleId === "global" ? settings : (moduleSettings[moduleId] ? { ...DEFAULT_GLOBAL_DESIGN, ...moduleSettings[moduleId] } : settings);
    applyDesignToDOM(s);
  }, [settings, moduleSettings]);

  const resetToGlobal = useCallback(() => {
    applyDesignToDOM(settings);
  }, [settings]);

  return (
    <GlobalDesignContext.Provider value={{ settings, moduleSettings, updateSettings, getModuleSettings, updateModuleSettings, applyModuleDesign, resetToGlobal }}>
      {children}
    </GlobalDesignContext.Provider>
  );
};
