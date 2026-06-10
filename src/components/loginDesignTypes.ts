import React from "react";

export interface TextStyle {
  font: string;
  color: string;
  size: number;
  bold: boolean;
}

export interface Position {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface CustomTextBlock {
  id: string;
  text: string;
  style: TextStyle;
  panel: "left" | "right";
  position: Position;
}

export interface CustomImageBlock {
  id: string;
  url: string;
  panel: "left" | "right";
  position: Position;
  settings: ImageSettings;
}

export interface ImageSettings {
  opacity: number; // 0-100
  size: number; // percentage scale, default 100
  borderRadius: number; // px
  objectPositionX: number; // 0-100, default 50
  objectPositionY: number; // 0-100, default 50
  width?: number; // px, independent width
  height?: number; // px, independent height
  borderWidth?: number; // px, default 0
  borderColor?: string; // hex color, default transparent
}

export const getImageDimensions = (settings: ImageSettings, baseSize: number, scale = 1) => {
  const w = settings.width ? Math.round(settings.width * scale) : Math.round(baseSize * (settings.size / 100) * scale);
  const h = settings.height ? Math.round(settings.height * scale) : Math.round(baseSize * (settings.size / 100) * scale);
  return { width: w, height: h };
};

export const getImageContainerStyle = (settings: ImageSettings, baseSize: number, scale = 1): React.CSSProperties => {
  const { width, height } = getImageDimensions(settings, baseSize, scale);
  return {
    width,
    height,
    borderRadius: settings.borderRadius * scale,
    opacity: settings.opacity / 100,
    border: (settings.borderWidth ?? 0) > 0 ? `${(settings.borderWidth ?? 0) * scale}px solid ${settings.borderColor ?? 'transparent'}` : undefined,
  };
};

export interface PanelSettings {
  opacity: number; // 0-100
  widthPercent: number; // 30-70
}

export interface ElementPositions {
  leftIcon: Position;
  leftTitle: Position;
  leftDescription: Position;
  logo: Position;
  appTitle: Position;
  appSubtitle: Position;
}

export interface LoginDesignSettings {
  appTitle: string;
  appSubtitle: string;
  leftTitle: string;
  leftDescription: string;
  loginButtonText: string;
  forgotPasswordText: string;
  appTitleStyle: TextStyle;
  appSubtitleStyle: TextStyle;
  leftTitleStyle: TextStyle;
  leftDescriptionStyle: TextStyle;
  loginButtonStyle: TextStyle;
  forgotPasswordStyle: TextStyle;
  titleFont: string;
  bodyFont: string;
  leftPanelBg: string;
  leftPanelText: string;
  rightPanelBg: string;
  buttonColor: string;
  buttonTextColor: string;
  accentColor: string;
  logoUrl: string;
  leftIconUrl: string;
  backgroundImageUrl: string;
  showLeftIcon: boolean;
  customTexts: CustomTextBlock[];
  customImages: CustomImageBlock[];
  elementPositions: ElementPositions;
  logoSettings: ImageSettings;
  leftIconSettings: ImageSettings;
  backgroundImageSettings: ImageSettings;
  leftPanelSettings: PanelSettings;
  rightPanelSettings: PanelSettings;
  hiddenElements: string[];
  _brandVersion?: number;
}

export const defaultTextStyle = (font: string, color: string, size: number, bold = false): TextStyle => ({
  font, color, size, bold,
});

export const DEFAULT_ELEMENT_POSITIONS: ElementPositions = {
  leftIcon: { x: 50, y: 22 },
  leftTitle: { x: 50, y: 40 },
  leftDescription: { x: 50, y: 60 },
  logo: { x: 50, y: 18 },
  appTitle: { x: 50, y: 30 },
  appSubtitle: { x: 50, y: 37 },
};

export const DEFAULT_SETTINGS: LoginDesignSettings = {
  appTitle: "FACAM PERFORMER",
  appSubtitle: "Connectez-vous à votre espace",
  leftTitle: "FACAM STAIRWAY",
  leftDescription:
    "Pilotez votre organisation avec des analyses en temps réel, un suivi des objectifs et des rapports professionnels conçus pour la prise de décision.",
  loginButtonText: "Se connecter",
  forgotPasswordText: "Mot de passe oublié ?",
  appTitleStyle: defaultTextStyle("Montserrat", "#001b61", 24, true),
  appSubtitleStyle: defaultTextStyle("Montserrat", "#001b61B0", 14, false),
  leftTitleStyle: defaultTextStyle("Montserrat", "#ffffff", 36, true),
  leftDescriptionStyle: defaultTextStyle("Montserrat", "#ffffffAA", 16, false),
  loginButtonStyle: defaultTextStyle("Montserrat", "#001b61", 14, true),
  forgotPasswordStyle: defaultTextStyle("Montserrat", "#001b6170", 12, false),
  titleFont: "Montserrat",
  bodyFont: "Montserrat",
  leftPanelBg: "#001b61",
  leftPanelText: "#ffffff",
  rightPanelBg: "#ffffff",
  buttonColor: "#FFAE03",
  buttonTextColor: "#001B61",
  accentColor: "#FFAE03",
  logoUrl: "/facam_stairway-bleu.png",
  leftIconUrl: "/facam_stairway-blanc.png",
  backgroundImageUrl: "",
  showLeftIcon: true,
  customTexts: [],
  customImages: [],
  elementPositions: { ...DEFAULT_ELEMENT_POSITIONS },
  logoSettings: { opacity: 100, size: 100, borderRadius: 0, objectPositionX: 50, objectPositionY: 50 },
  leftIconSettings: { opacity: 100, size: 180, borderRadius: 0, objectPositionX: 50, objectPositionY: 50 },
  backgroundImageSettings: { opacity: 20, size: 100, borderRadius: 0, objectPositionX: 50, objectPositionY: 50 },
  leftPanelSettings: { opacity: 100, widthPercent: 50 },
  rightPanelSettings: { opacity: 100, widthPercent: 50 },
  hiddenElements: [],
  _brandVersion: 2,
};

export const FONT_OPTIONS = [
  { value: "Montserrat", label: "Montserrat" },
  { value: "Inter", label: "Inter" },
  { value: "Poppins", label: "Poppins" },
  { value: "Roboto", label: "Roboto" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Raleway", label: "Raleway" },
  { value: "Lato", label: "Lato" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Nunito", label: "Nunito" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "Merriweather", label: "Merriweather" },
  { value: "Source Sans 3", label: "Source Sans 3" },
];

export const COLOR_PRESETS = [
  { label: "FACAM Stairway", leftBg: "#001b61", leftText: "#ffffff", buttonColor: "#FFAE03", accentColor: "#FFAE03" },
  { label: "Bleu Royal", leftBg: "#1e3a5f", leftText: "#e8f0fe", buttonColor: "#2563eb", accentColor: "#3b82f6" },
  { label: "Vert Émeraude", leftBg: "#064e3b", leftText: "#d1fae5", buttonColor: "#059669", accentColor: "#10b981" },
  { label: "Bordeaux", leftBg: "#450a0a", leftText: "#fef2f2", buttonColor: "#991b1b", accentColor: "#dc2626" },
  { label: "Violet Profond", leftBg: "#2e1065", leftText: "#f3e8ff", buttonColor: "#7c3aed", accentColor: "#8b5cf6" },
  { label: "Noir & Blanc", leftBg: "#18181b", leftText: "#fafafa", buttonColor: "#27272a", accentColor: "#a1a1aa" },
  { label: "Corail", leftBg: "#1c1917", leftText: "#fef3c7", buttonColor: "#ea580c", accentColor: "#f97316" },
  { label: "Teal Moderne", leftBg: "#042f2e", leftText: "#ccfbf1", buttonColor: "#0d9488", accentColor: "#14b8a6" },
];

export const STORAGE_KEY = "admin_login_design";

export const migrateSettings = (raw: Record<string, unknown>): LoginDesignSettings => {
  const s = { ...DEFAULT_SETTINGS, ...raw };

  // Migration v2 : basculer vers l'identité visuelle FACAM STAIRWAY.
  // Se déclenche une seule fois (quand _brandVersion est absent ou < 2).
  // Après sauvegarde, _brandVersion = 2 est persisté → ne se ré-applique plus.
  if (!raw._brandVersion || raw._brandVersion < 2) {
    s.logoUrl        = DEFAULT_SETTINGS.logoUrl;        // /facam_stairway-bleu.png
    s.leftIconUrl    = DEFAULT_SETTINGS.leftIconUrl;    // /facam_stairway-blanc.png
    s.leftPanelBg    = DEFAULT_SETTINGS.leftPanelBg;   // #001b61
    s.leftPanelText  = DEFAULT_SETTINGS.leftPanelText; // #ffffff
    s.leftTitleStyle = DEFAULT_SETTINGS.leftTitleStyle;
    s.leftDescriptionStyle = DEFAULT_SETTINGS.leftDescriptionStyle;
    s._brandVersion  = 2;
  }

  if (!s.appTitleStyle) s.appTitleStyle = DEFAULT_SETTINGS.appTitleStyle;
  if (!s.appSubtitleStyle) s.appSubtitleStyle = DEFAULT_SETTINGS.appSubtitleStyle;
  if (!s.leftTitleStyle) s.leftTitleStyle = DEFAULT_SETTINGS.leftTitleStyle;
  if (!s.leftDescriptionStyle) s.leftDescriptionStyle = DEFAULT_SETTINGS.leftDescriptionStyle;
  if (!s.loginButtonStyle) s.loginButtonStyle = DEFAULT_SETTINGS.loginButtonStyle;
  if (!s.forgotPasswordStyle) s.forgotPasswordStyle = DEFAULT_SETTINGS.forgotPasswordStyle;
  if (!s.customTexts) s.customTexts = [];
  if (!s.hiddenElements) s.hiddenElements = [];
  if (!s.customImages) s.customImages = [];
  if (!s.elementPositions) s.elementPositions = { ...DEFAULT_ELEMENT_POSITIONS };
  if (!s.logoSettings) s.logoSettings = DEFAULT_SETTINGS.logoSettings;
  else { if (s.logoSettings.objectPositionX == null) s.logoSettings.objectPositionX = 50; if (s.logoSettings.objectPositionY == null) s.logoSettings.objectPositionY = 50; }
  if (!s.leftIconSettings) s.leftIconSettings = DEFAULT_SETTINGS.leftIconSettings;
  else { if (s.leftIconSettings.objectPositionX == null) s.leftIconSettings.objectPositionX = 50; if (s.leftIconSettings.objectPositionY == null) s.leftIconSettings.objectPositionY = 50; }
  if (!s.backgroundImageSettings) s.backgroundImageSettings = DEFAULT_SETTINGS.backgroundImageSettings;
  else { if (s.backgroundImageSettings.objectPositionX == null) s.backgroundImageSettings.objectPositionX = 50; if (s.backgroundImageSettings.objectPositionY == null) s.backgroundImageSettings.objectPositionY = 50; }
  if (!s.leftPanelSettings) s.leftPanelSettings = DEFAULT_SETTINGS.leftPanelSettings;
  if (!s.rightPanelSettings) s.rightPanelSettings = DEFAULT_SETTINGS.rightPanelSettings;
  return s;
};

export const textStyleToCSS = (style: TextStyle) => ({
  fontFamily: `'${style.font}', sans-serif`,
  color: style.color,
  fontSize: `${style.size}px`,
  fontWeight: style.bold ? 700 : 400,
});
