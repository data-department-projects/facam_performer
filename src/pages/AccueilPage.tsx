import { motion } from "framer-motion";
import {
  Users, TrendingUp, BarChart2, Network, Calendar,
  Clock, Target, FolderKanban, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const BARS = [38, 62, 48, 82, 54, 100, 68];

/* ── Geometric decorations (SVG, bottom-right of each card) ── */
const decos = [
  /* 0 – featured: gold overlapping circles */
  <svg key={0} viewBox="0 0 140 120" fill="none">
    <circle cx="105" cy="95" r="62" fill="rgba(255,174,3,0.18)" />
    <circle cx="82" cy="82" r="44" fill="rgba(255,174,3,0.28)" />
    <circle cx="112" cy="62" r="30" fill="rgba(255,174,3,0.42)" />
    <circle cx="90" cy="90" r="18" fill="#ffae03" />
  </svg>,
  /* 1 – orgchart: navy concentric circles */
  <svg key={1} viewBox="0 0 140 120" fill="none">
    <circle cx="105" cy="95" r="62" fill="rgba(0,27,97,0.05)" />
    <circle cx="85" cy="80" r="42" fill="rgba(0,27,97,0.09)" />
    <circle cx="108" cy="62" r="28" fill="rgba(0,27,97,0.15)" />
    <circle cx="90" cy="88" r="15" fill="rgba(0,27,97,0.30)" />
  </svg>,
  /* 2 – objectifs: rose layered arcs */
  <svg key={2} viewBox="0 0 140 120" fill="none">
    <circle cx="105" cy="95" r="60" fill="rgba(244,63,94,0.07)" />
    <circle cx="82" cy="82" r="40" fill="rgba(244,63,94,0.13)" />
    <circle cx="108" cy="62" r="27" fill="rgba(244,63,94,0.22)" />
    <circle cx="90" cy="90" r="16" fill="rgba(244,63,94,0.50)" />
  </svg>,
  /* 3 – time: violet rings */
  <svg key={3} viewBox="0 0 140 120" fill="none">
    <circle cx="105" cy="95" r="60" fill="rgba(139,92,246,0.07)" />
    <circle cx="82" cy="80" r="42" fill="rgba(139,92,246,0.12)" />
    <circle cx="108" cy="62" r="28" fill="rgba(139,92,246,0.20)" />
    <circle cx="90" cy="88" r="16" fill="rgba(139,92,246,0.48)" />
  </svg>,
  /* 4 – gantt: teal stacked bars */
  <svg key={4} viewBox="0 0 140 120" fill="none">
    <rect x="40" y="65" width="92" height="12" rx="6" fill="rgba(20,184,166,0.12)" />
    <rect x="52" y="80" width="76" height="12" rx="6" fill="rgba(20,184,166,0.22)" />
    <rect x="64" y="95" width="62" height="12" rx="6" fill="rgba(20,184,166,0.40)" />
    <circle cx="105" cy="48" r="22" fill="rgba(20,184,166,0.10)" />
  </svg>,
  /* 5 – projets: amber stacked blocks */
  <svg key={5} viewBox="0 0 140 120" fill="none">
    <rect x="52" y="72" width="76" height="34" rx="10" fill="rgba(245,158,11,0.10)" />
    <rect x="62" y="58" width="62" height="26" rx="9" fill="rgba(245,158,11,0.20)" />
    <rect x="74" y="46" width="50" height="22" rx="8" fill="rgba(245,158,11,0.36)" />
    <rect x="84" y="36" width="40" height="18" rx="7" fill="rgba(245,158,11,0.60)" />
  </svg>,
];

const MODULES = [
  { id: "dashboard",       title: "Tableau de bord",       desc: "Vue d'ensemble de l'organisation en temps réel.",                  Icon: BarChart2,    featured: true,  deco: 0 },
  { id: "orgchart",        title: "Organigramme",           desc: "Structure hiérarchique et départements de l'organisation.",        Icon: Network,      featured: false, deco: 1, iconColor: "#001b61", cardBg: "#f0f4ff" },
  { id: "hrperformance",   title: "Gestion des Objectifs",  desc: "Définissez, évaluez et suivez les objectifs annuels.",             Icon: Target,       featured: false, deco: 2, iconColor: "#e11d48", cardBg: "#fff1f2" },
  { id: "timeentry",       title: "Saisie du temps",        desc: "Planifiez votre semaine et saisissez vos heures de travail.",      Icon: Clock,        featured: false, deco: 3, iconColor: "#7c3aed", cardBg: "#f5f3ff" },
  { id: "gantt",           title: "Gantt Projets",          desc: "Visualisez le planning de toutes vos missions et échéances.",      Icon: Calendar,     featured: false, deco: 4, iconColor: "#0d9488", cardBg: "#f0fdfa" },
  { id: "projectscomites", title: "Projets & Comités",      desc: "Gérez vos projets stratégiques et comités de direction.",         Icon: FolderKanban, featured: false, deco: 5, iconColor: "#d97706", cardBg: "#fffbeb" },
] as const;

interface AccueilPageProps {
  onNavigate?: (view: string) => void;
}

const AccueilPage = ({ onNavigate }: AccueilPageProps) => {
  const { profile } = useAuth();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const firstName = profile?.full_name?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "";

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ══════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════ */}
      <section className="relative flex flex-col lg:flex-row items-center gap-10 lg:gap-14 px-6 lg:px-14 pt-10 pb-16 lg:py-16 min-h-[calc(100vh-64px)] max-w-[1380px] mx-auto">

        {/* ─── LEFT : texte ─── */}
        <div className="flex-1 flex flex-col gap-7 z-10 lg:max-w-[480px]">

          {/* Badge */}
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex self-start items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-[11px] font-bold tracking-[0.18em] text-primary uppercase"
          >
            Performer
          </motion.span>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="space-y-1"
          >
            <h1 className="font-display text-[clamp(2.6rem,5vw,4.2rem)] font-bold leading-[1.06] tracking-tight text-secondary">
              Un nouvel outil
            </h1>
            <div className="relative inline-block">
              <h1 className="font-display text-[clamp(2.6rem,5vw,4.2rem)] font-bold leading-[1.06] tracking-tight text-secondary">
                de pilotage
              </h1>
              <svg
                className="absolute -bottom-1.5 left-0 w-full"
                viewBox="0 0 260 14"
                fill="none"
                preserveAspectRatio="none"
              >
                <path d="M4 10 Q130 1 256 10" stroke="#ffae03" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="font-display text-[clamp(2.6rem,5vw,4.2rem)] font-bold leading-[1.06] tracking-tight text-secondary">
              organisationnel
            </h1>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
            className="text-muted-foreground text-[15px] leading-[1.75] max-w-[400px]"
          >
            Les décisions stratégiques s'appuient sur des données fiables et des analyses en
            temps réel — pas seulement sur l'intuition. FACAM PERFORMER vous donne les outils
            pour piloter votre organisation avec clarté et précision.
          </motion.p>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.38 }}
            className="flex items-center gap-3 mt-2"
          >
            <div className="w-[26px] h-[42px] rounded-full border-2 border-secondary/25 flex items-start justify-center pt-[7px]">
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="w-[5px] h-[9px] bg-primary rounded-full"
              />
            </div>
            <span className="text-[11px] text-muted-foreground/50 tracking-[0.14em] uppercase">
              Découvrir
            </span>
          </motion.div>
        </div>

        {/* ─── RIGHT : image + cartes flottantes ─── */}
        <motion.div
          initial={{ opacity: 0, x: 52 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 relative self-stretch min-h-[420px] lg:min-h-0"
        >
          <div className="relative rounded-[28px] overflow-hidden h-[440px] lg:h-full min-h-[440px] bg-gradient-to-br from-[#d6e6f5] to-[#b4cfe8]">
            <img
              src="/F36 (1).jpg"
              alt="FACAM Stairway — Bâtiment"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-secondary/20 via-transparent to-transparent" />
          </div>

          {/* Carte flottante 1 — Effectifs */}
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.52, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-5 left-4 bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_8px_30px_rgba(0,27,97,0.13)]"
          >
            <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <Users className="w-[17px] h-[17px] text-secondary" />
            </div>
            <div>
              <p className="text-[9.5px] text-muted-foreground font-semibold tracking-[0.12em] uppercase mb-0.5">Total Effectifs</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[19px] font-bold text-secondary leading-none">128</span>
                <span className="text-[10px] font-bold text-emerald-500">↑ 8%</span>
              </div>
            </div>
          </motion.div>

          {/* Carte flottante 2 — Mini bar chart */}
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.62, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-5 right-4 bg-white rounded-2xl p-3.5 shadow-[0_8px_30px_rgba(0,27,97,0.13)] min-w-[130px]"
          >
            <div className="flex items-center gap-1.5 mb-2.5">
              <BarChart2 className="w-3 h-3 text-secondary/60" />
              <p className="text-[9.5px] text-muted-foreground font-semibold tracking-[0.12em] uppercase">Résultats</p>
            </div>
            <div className="flex items-end gap-[3px] h-10">
              {BARS.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.72 + i * 0.05, duration: 0.28, ease: "easeOut" }}
                  className="flex-1 rounded-t-[3px] origin-bottom"
                  style={{ height: `${h}%`, backgroundColor: i === 5 ? "#ffae03" : "rgba(0,42,110,0.18)" }}
                />
              ))}
            </div>
            <div className="flex gap-1 mt-2">
              <div className="w-5 h-1 rounded-full bg-secondary/20" />
              <div className="w-5 h-1 rounded-full bg-secondary/20" />
            </div>
          </motion.div>

          {/* Carte flottante 3 — Objectifs */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.72, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-5 right-4 bg-white rounded-2xl p-3.5 shadow-[0_8px_30px_rgba(0,27,97,0.13)] min-w-[160px]"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9.5px] text-muted-foreground font-semibold tracking-[0.12em] uppercase">Objectifs</p>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className="text-[26px] font-bold text-secondary leading-none mb-2.5">74%</p>
            <div className="w-full bg-muted rounded-full h-[5px]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "74%" }}
                transition={{ delay: 0.92, duration: 0.9, ease: "easeOut" }}
                className="bg-primary rounded-full h-[5px]"
              />
            </div>
            <p className="text-[9px] text-muted-foreground/55 mt-1.5">32 / 43 milestones complétés</p>
          </motion.div>

          {/* Point décoratif or */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, duration: 0.3 }}
            className="absolute bottom-5 left-4 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center"
          >
            <div className="w-3 h-3 rounded-full bg-primary/50" />
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════
          MODULES SECTION
      ══════════════════════════════════════ */}
      <section className="bg-[#f7f9fc] border-t border-border/40">
        <div className="max-w-[1380px] mx-auto px-6 lg:px-14 py-16 lg:py-20">

          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase text-primary mb-3">
              Plateforme
            </p>
            <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold text-secondary leading-tight">
              {greeting()}{firstName ? `, ${firstName}` : ""}&nbsp;!
            </h2>
            <p className="text-muted-foreground text-[15px] mt-2 max-w-[480px] leading-relaxed">
              Accédez rapidement aux modules de FACAM PERFORMER et pilotez votre organisation.
            </p>
          </motion.div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {MODULES.map((mod, i) => {
              const { id, title, desc, Icon, featured, deco } = mod;
              const iconColor = !featured && "iconColor" in mod ? mod.iconColor : undefined;
              const cardBg   = !featured && "cardBg"   in mod ? mod.cardBg   : undefined;

              return (
                <motion.button
                  key={id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => onNavigate?.(id)}
                  className={cn(
                    "relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 group min-h-[220px]",
                    "flex flex-col justify-between",
                    featured
                      ? "bg-secondary shadow-xl hover:shadow-2xl hover:scale-[1.015]"
                      : "border border-border/60 hover:border-secondary/25 hover:shadow-lg hover:scale-[1.012]"
                  )}
                  style={!featured ? { backgroundColor: cardBg } : undefined}
                >
                  {/* Top row: icon */}
                  <div className="flex justify-between items-start">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center",
                        featured ? "bg-white/12" : "bg-white/70"
                      )}
                      style={!featured && iconColor ? { boxShadow: `0 0 0 1px ${iconColor}18` } : undefined}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{ color: featured ? "#ffae03" : iconColor }}
                      />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="mt-6 relative z-10">
                    <h3 className={cn(
                      "font-display text-[17px] font-bold mb-1.5 leading-snug",
                      featured ? "text-white" : "text-secondary"
                    )}>
                      {title}
                    </h3>
                    <p className={cn(
                      "text-[13px] leading-relaxed",
                      featured ? "text-white/65" : "text-muted-foreground"
                    )}>
                      {desc}
                    </p>
                  </div>

                  {/* Bottom row: arrow */}
                  <div className="mt-6 relative z-10">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-1",
                      featured
                        ? "bg-white/15 text-white group-hover:bg-white/25"
                        : "bg-white/80 group-hover:bg-white"
                    )}
                      style={!featured && iconColor ? { color: iconColor } : undefined}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Geometric decoration bottom-right */}
                  <div className="absolute bottom-0 right-0 w-[145px] h-[125px] overflow-hidden pointer-events-none">
                    {decos[deco]}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AccueilPage;
