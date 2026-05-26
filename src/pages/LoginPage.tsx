import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Sparkles, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
const logoImg = "/facam_stairway-bleu.png";
import {
  type LoginDesignSettings,
  DEFAULT_SETTINGS, DEFAULT_ELEMENT_POSITIONS, STORAGE_KEY,
  migrateSettings, textStyleToCSS, getImageContainerStyle,
} from "@/components/loginDesignTypes";

const LoginPage = () => {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [s, setS] = useState<LoginDesignSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setS(migrateSettings(JSON.parse(stored)));
      } catch {}
      try {
        const { data } = await supabase.from("app_organization").select("data").eq("id", "login_design").maybeSingle();
        if (data?.data && typeof data.data === "object") {
          const loaded = migrateSettings(data.data as Record<string, any>);
          setS(loaded);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
        }
      } catch {}
    };
    loadSettings();
  }, []);

  // Load Google Fonts dynamically
  useEffect(() => {
    const fonts = new Set([
      s.appTitleStyle.font, s.appSubtitleStyle.font,
      s.leftTitleStyle.font, s.leftDescriptionStyle.font,
      s.loginButtonStyle.font, s.forgotPasswordStyle.font,
      ...s.customTexts.map((ct) => ct.style.font),
    ]);
    fonts.forEach((font) => {
      if (font) {
        const link = document.createElement("link");
        link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}:wght@300;400;500;600;700;800&display=swap`;
        link.rel = "stylesheet";
        if (!document.querySelector(`link[href="${link.href}"]`)) document.head.appendChild(link);
      }
    });
  }, [s]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
    setLoading(false);
  };

  const resolvedLogo = s.logoUrl || logoImg;
  const ts = textStyleToCSS;
  const pos = s.elementPositions || DEFAULT_ELEMENT_POSITIONS;
  const hidden = s.hiddenElements || [];

  const logoSize = Math.round(56 * (s.logoSettings.size / 100));
  const iconSize = Math.round(80 * (s.leftIconSettings.size / 100));

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div
        className="hidden lg:flex relative overflow-hidden"
        style={{
          backgroundColor: s.leftPanelBg || "#f0f4fa",
          opacity: s.leftPanelSettings.opacity / 100,
          flex: `0 0 ${s.leftPanelSettings.widthPercent}%`,
        }}
      >
        {s.backgroundImageUrl && (
          <div className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${s.backgroundImageUrl})`, opacity: s.backgroundImageSettings.opacity / 100, backgroundPosition: `${s.backgroundImageSettings.objectPositionX ?? 50}% ${s.backgroundImageSettings.objectPositionY ?? 50}%` }} />
        )}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-30" style={{ backgroundColor: s.accentColor || "#ffae03" }} />
          <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full blur-3xl opacity-20" style={{ backgroundColor: s.accentColor || "#ffae03" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-primary/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-primary/5" />
        </div>

        {/* Positioned elements */}
        {!hidden.includes("leftIcon") && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${pos.leftIcon.x}%`, top: `${pos.leftIcon.y}%`, opacity: s.leftIconSettings.opacity / 100 }}>
            {s.leftIconUrl ? (
              <div className="overflow-hidden shadow-lg" style={{ width: iconSize, height: iconSize, borderRadius: s.leftIconSettings.borderRadius }}>
                <img src={s.leftIconUrl} alt="Icon" className="w-full h-full object-contain" style={{ objectPosition: `${s.leftIconSettings.objectPositionX ?? 50}% ${s.leftIconSettings.objectPositionY ?? 50}%` }} />
              </div>
            ) : (
              <div className="flex items-center justify-center shadow-lg" style={{ width: iconSize, height: iconSize, borderRadius: s.leftIconSettings.borderRadius, background: `linear-gradient(135deg, ${s.accentColor}, ${s.buttonColor})` }}>
                <Sparkles className="w-10 h-10" style={{ color: s.buttonTextColor }} />
              </div>
            )}
          </div>
        )}

        {!hidden.includes("leftTitle") && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center z-10" style={{ left: `${pos.leftTitle.x}%`, top: `${pos.leftTitle.y}%` }}>
            <h2 style={ts(s.leftTitleStyle)}>{s.leftTitle}</h2>
            <div className="w-32 h-[2px] mx-auto rounded-full mt-4" style={{ backgroundColor: s.accentColor }} />
          </div>
        )}

        {!hidden.includes("leftDescription") && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center max-w-md z-10" style={{ left: `${pos.leftDescription.x}%`, top: `${pos.leftDescription.y}%` }}>
            <p className="leading-relaxed" style={ts(s.leftDescriptionStyle)}>{s.leftDescription}</p>
          </div>
        )}

        {/* Custom texts on left */}
        {s.customTexts.filter((ct) => ct.panel === "left").map((ct) => (
          <div key={ct.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-center max-w-md z-10" style={{ left: `${ct.position.x}%`, top: `${ct.position.y}%` }}>
            <p style={ts(ct.style)}>{ct.text}</p>
          </div>
        ))}

        {/* Custom images on left */}
        {(s.customImages || []).filter((ci) => ci.panel === "left").map((ci) => {
          return (
            <div key={ci.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${ci.position.x}%`, top: `${ci.position.y}%` }}>
              <div className="overflow-hidden shadow-lg" style={getImageContainerStyle(ci.settings, 80)}>
                <img src={ci.url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Right panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="flex-1 flex items-center justify-center p-8 relative"
        style={{
          backgroundColor: s.rightPanelBg || "#ffffff",
          opacity: s.rightPanelSettings.opacity / 100,
          flex: `0 0 ${s.rightPanelSettings.widthPercent}%`,
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-primary/[0.04] blur-3xl" />
        </div>
        {/* Logo */}
        {!hidden.includes("logo") && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${pos.logo.x}%`, top: `${pos.logo.y}%`, opacity: s.logoSettings.opacity / 100 }}>
           <div className="z-10" style={{ left: `${pos.logo.x}%`, top: `${pos.logo.y}%`, opacity: s.logoSettings.opacity / 100 }}>
              <img src={resolvedLogo} alt="Logo" className="object-contain" loading="lazy" decoding="async" width={logoSize} height={Math.round(logoSize * 0.38)} style={{ width: logoSize, height: "auto", maxHeight: logoSize * 2, borderRadius: s.logoSettings.borderRadius }} />
           </div>
          </div>
        )}

        {!hidden.includes("appTitle") && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center z-10" style={{ left: `${pos.appTitle.x}%`, top: `${pos.appTitle.y}%` }}>
            <h1 style={ts(s.appTitleStyle)}>{s.appTitle}</h1>
          </div>
        )}

        {!hidden.includes("appSubtitle") && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center z-10" style={{ left: `${pos.appSubtitle.x}%`, top: `${pos.appSubtitle.y}%` }}>
            <p style={ts(s.appSubtitleStyle)}>{s.appSubtitle}</p>
          </div>
        )}

        {/* Custom texts on right */}
        {s.customTexts.filter((ct) => ct.panel === "right").map((ct) => (
          <div key={ct.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-center max-w-md z-10" style={{ left: `${ct.position.x}%`, top: `${ct.position.y}%` }}>
            <p style={ts(ct.style)}>{ct.text}</p>
          </div>
        ))}

        {/* Custom images on right */}
        {(s.customImages || []).filter((ci) => ci.panel === "right").map((ci) => {
          return (
            <div key={ci.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${ci.position.x}%`, top: `${ci.position.y}%` }}>
              <div className="overflow-hidden shadow-lg" style={getImageContainerStyle(ci.settings, 80)}>
                <img src={ci.url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              </div>
            </div>
          );
        })}

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px] mt-28 relative z-20"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-foreground/80">
                Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary/60 transition-colors" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  className="h-11 pl-10 rounded-xl bg-muted border-border focus:border-primary/40 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/50 transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-foreground/80">
                Mot de passe
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary/60 transition-colors" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 pl-10 rounded-xl bg-muted border-border focus:border-primary/40 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/50 transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="link"
                className="px-0 h-auto text-[13px] text-muted-foreground/60 hover:text-primary transition-colors"
                onClick={() => (window.location.href = "/reset-password")}
              >
                {s.forgotPasswordText || "Mot de passe oublié ?"}
              </Button>
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-gold hover:-translate-y-[1px] transition-all duration-200 font-medium gap-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Connexion…
                </span>
              ) : (
                <>
                  {s.loginButtonText || "Se connecter"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
