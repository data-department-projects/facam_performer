import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useGlobalDesign } from "@/contexts/GlobalDesignContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar, { ViewType } from "@/components/AppSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import PasswordChangeDialog from "@/components/PasswordChangeDialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { KeyRound, X } from "lucide-react";


// Lazy load heavy view components
const OrgChart = lazy(() => import("@/components/OrgChart"));
const AdminView = lazy(() => import("@/components/AdminView"));
const DashboardView = lazy(() => import("@/components/DashboardView"));
const GanttView = lazy(() => import("@/components/GanttView"));
const ProjectsAndCommitteesView = lazy(() => import("@/components/ProjectsAndCommitteesView"));
const TimeEntryForm = lazy(() => import("@/components/TimeEntryForm"));
const WeeklyTodoList = lazy(() => import("@/components/WeeklyTodoList"));
const WeeklyPlannerKpis = lazy(() => import("@/components/WeeklyPlannerKpis"));
const TimeEntriesList = lazy(() => import("@/components/TimeEntriesList"));
const ManagerWeeklyValidation = lazy(() => import("@/components/ManagerWeeklyValidation"));
const AdminTimeAnalytics = lazy(() => import("@/components/AdminTimeAnalytics"));
const HRPerformanceView = lazy(() => import("@/components/HRPerformanceView"));
const BadgeManagement = lazy(() => import("@/components/BadgeManagement"));
const ModuleOverlayRenderer = lazy(() => import("@/components/ModuleOverlayRenderer"));
const UserManual = lazy(() => import("@/components/UserManual"));
const AccueilPage = lazy(() => import("@/pages/AccueilPage"));
const CampaignAnimationPlayer = lazy(() => import("@/components/CampaignAnimationPlayer"));
const ManagerActionsView = lazy(() => import("@/components/ManagerActionsView"));
const DGExecutiveReport = lazy(() => import("@/components/DGExecutiveReport"));
const HelpChatbot = lazy(() => import("@/components/HelpChatbot"));
const ReportBug = lazy(() => import("@/components/ReportBug"));
const UserProfileView = lazy(() => import("@/components/UserProfileView"));


const ViewLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="relative w-8 h-8">
      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
      <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  </div>
);


const Index = () => {
  const { departments } = useDepartments();
  const { isAdmin, allowedModules, loading, profile, mustChangePassword } = useAuth();
  const { applyModuleDesign, resetToGlobal } = useGlobalDesign();

  const [mainView, setMainView] = useState<ViewType | null>(null);
  const [orgView, setOrgView] = useState<"today" | "tomorrow">("today");
  const [navigateToProjectId, setNavigateToProjectId] = useState<string | null>(null);
  const [todoRefreshKey, setTodoRefreshKey] = useState(0);
  const [adminInitialTab, setAdminInitialTab] = useState<string | undefined>(undefined);
  const [scrollToValidation, setScrollToValidation] = useState(false);
  const [pwdBannerDismissed, setPwdBannerDismissed] = useState(false);
  const [orgHeaderStats, setOrgHeaderStats] = useState<{ label: string; value: number; highlight?: boolean }[]>([]);

  const sidebarModules: ViewType[] = [
  "accueil",
  "dashboard",
  "orgchart",
  "gantt",
  "projectscomites",
  "timeentry",
  "hrperformance",
  "admin",
  "etpadmin",
  "badgemanagement",
  "actions",
  "guide",
  "report_error",
  "profil"];


  // "accueil", "guide", "report_error" are always accessible; "actions" is accessible to managers
  const alwaysAccessible: ViewType[] = ["accueil", "guide", "report_error", "profil"];
  if (profile?.is_manager) alwaysAccessible.push("actions");

  const accessibleViews = isAdmin ?
  sidebarModules :
  sidebarModules.filter((view) => alwaysAccessible.includes(view) || allowedModules.includes(view));

  const activeView: ViewType | null =
  loading ? null :
  mainView && (isAdmin || accessibleViews.includes(mainView)) ? mainView :
  accessibleViews.includes("dashboard") ? "dashboard" :
  accessibleViews.length > 0 ? accessibleViews[0] :
  null;

  useEffect(() => {
    if (loading || !activeView) return;
    if (activeView !== mainView) {
      setMainView(activeView);
    }
  }, [loading, activeView, mainView]);

  // Fetch org stats for header (only when on orgchart view)
  useEffect(() => {
    if (activeView !== "orgchart") return;
    supabase
      .from("profiles")
      .select("is_manager, poste")
      .then(({ data }) => {
        if (!data) return;
        const total = data.length;
        const managers = data.filter((p) => p.is_manager).length;
        const stagiaires = data.filter(
          (p) => typeof p.poste === "string" && p.poste.toLowerCase().includes("stagiaire")
        ).length;
        const collaborateurs = total - managers - stagiaires;
        const pills: { label: string; value: number; highlight?: boolean }[] = [
          { label: "Effectif total", value: total },
          { label: "Managers", value: managers, highlight: true },
          { label: "Collaborateurs", value: collaborateurs },
        ];
        if (stagiaires > 0) pills.push({ label: "Stagiaires", value: stagiaires });
        setOrgHeaderStats(pills);
      });
  }, [activeView]);

  // Apply per-module design when view changes
  useEffect(() => {
    if (loading) return;
    applyModuleDesign(activeView);
    return () => resetToGlobal();
  }, [activeView, applyModuleDesign, resetToGlobal, loading]);


  const MODULE_TITLES: Partial<Record<ViewType, {title: string;subtitle: string;}>> = {
    accueil: { title: "Accueil", subtitle: "Bienvenue sur FACAM PERFORMER" },
    dashboard: { title: "Tableau de bord", subtitle: "Vue d'ensemble de l'organisation" },

    orgchart: { title: "Organigramme", subtitle: "Structure organisationnelle — Départements" },
    gantt: { title: "Gantt Projets", subtitle: "Vue par mission, responsable et dates sur 2026–2027" },
    projectscomites: { title: "Projets & Comités", subtitle: "Gérez vos projets et comités" },
    admin: { title: "Administration", subtitle: "Gérez vos départements, services et collaborateurs" },
    timeentry: { title: "Saisie du temps", subtitle: "Planification hebdomadaire et suivi des heures" },
    etpadmin: { title: "Suivi ETP — Vue Administrateur", subtitle: "Coûts, durées, temps passé et suivi des saisies" },
    hrperformance: { title: "Gestion des Objectifs", subtitle: "Définition, validation et évaluation des objectifs annuels" },
    badgemanagement: { title: "Gestion de temps", subtitle: "Suivi des heures d'arrivée et de départ par badge" },
    actions: { title: "Actions à traiter", subtitle: "Validations, demandes et retards de vos collaborateurs" },
    guide: { title: "Guide d'utilisation", subtitle: "Procédures et bonnes pratiques de la plateforme" },
    report_error: { title: "Signaler une erreur", subtitle: "Transmettez un problème à l'équipe support informatique" },
    profil: { title: "Mon Profil", subtitle: "Gérez vos informations et votre mot de passe" },
  };

  const currentModule = activeView && MODULE_TITLES[activeView] || { title: "", subtitle: "" };

  const renderContent = () => {
    if (!activeView) return <ViewLoader />;
    const content = (() => {
      switch (activeView) {
        case "accueil":return <AccueilPage onNavigate={(v) => { setAdminInitialTab(undefined); setMainView(v as ViewType); }} />;
        case "dashboard":return <DashboardView onNavigateToGantt={() => setMainView("gantt")} />;

        case "projectscomites":return (
            <ProjectsAndCommitteesView
              initialProjectId={navigateToProjectId}
              onNavigateToGantt={() => {setNavigateToProjectId(null);setMainView("gantt");}} />);
        case "gantt":return (
            <GanttView onNavigateToProject={(id) => {setNavigateToProjectId(id);setMainView("projectscomites");}} />);
        case "orgchart":return <OrgChart />;
        case "admin":return <AdminView orgView={orgView} onOrgViewChange={setOrgView} initialTab={adminInitialTab} />;
        case "timeentry":{
            const skipPlanning = !!(profile?.skip_personal_planning);
            const handleToggleSkip = async () => {
              if (!profile) return;
              const newVal = !skipPlanning;
              const { error } = await supabase.from("profiles").update({ skip_personal_planning: newVal }).eq("user_id", profile.user_id);
              if (error) {
                console.error("Toggle DG mode error:", error);
                return;
              }
              // Force full reload to re-fetch profile
              setTimeout(() => window.location.reload(), 300);
            };
            return (
              <div className="flex flex-col gap-6 max-w-6xl">
            {isAdmin &&
                <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">Mode DG (rapports uniquement)</span>
                <Switch checked={skipPlanning} onCheckedChange={handleToggleSkip} />
              </div>
                }
            {skipPlanning ?
                <>
                <WeeklyPlannerKpis />
                <DGExecutiveReport />
                <ManagerWeeklyValidation scrollToSelf={scrollToValidation} onScrolled={() => setScrollToValidation(false)} />
              </> :

                <>
                <WeeklyPlannerKpis />
                
                <WeeklyTodoList onTodosChanged={() => setTodoRefreshKey((k) => k + 1)} refreshKey={todoRefreshKey} />
                <TimeEntryForm todoRefreshKey={todoRefreshKey} onTodoCompleted={() => setTodoRefreshKey((k) => k + 1)} />
                <TimeEntriesList />
                <ManagerWeeklyValidation scrollToSelf={scrollToValidation} onScrolled={() => setScrollToValidation(false)} />
              </>
                }
          </div>);
          }
        case "etpadmin":return <AdminTimeAnalytics />;
        case "hrperformance":return <HRPerformanceView />;
        case "badgemanagement":return <BadgeManagement />;
        case "guide":return <UserManual />;
        case "report_error":return <ReportBug />;
        case "profil":return <UserProfileView />;
        case "actions":return <ManagerActionsView onNavigate={(view: string) => {
            if (view === "timeentry:validation") {
              setScrollToValidation(true);
              setMainView("timeentry");
            } else {
              setMainView(view as ViewType);
            }
          }} />;
        default:return <DashboardView />;
      }
    })();
    return <Suspense fallback={<ViewLoader />}>{content}</Suspense>;
  };


  return (
    <div className="flex min-h-screen bg-background relative">
      {/* Subtle ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/[0.015] blur-3xl" />
        <div className="absolute bottom-0 left-[20%] w-[400px] h-[400px] rounded-full bg-primary/[0.008] blur-3xl" />
      </div>

      <Suspense fallback={null}><HelpChatbot /></Suspense>
      <Suspense fallback={null}><CampaignAnimationPlayer /></Suspense>
      <AppSidebar currentView={activeView || "accueil"} onViewChange={(v) => {setAdminInitialTab(undefined);setMainView(v);}} onNavigateToAdminTab={(tab) => {setAdminInitialTab(tab);setMainView("admin");}} />
      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-7xl mx-auto px-5 py-5">
          <DashboardHeader
            title={currentModule.title}
            subtitle={currentModule.subtitle}
            minimal={true}
            stats={activeView === "orgchart" ? orgHeaderStats : undefined}
          />

          {/* ── Bannière changement de mot de passe recommandé ── */}
          <AnimatePresence>
            {mustChangePassword && !pwdBannerDismissed && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden mb-4"
              >
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">
                  <KeyRound className="w-4 h-4 text-orange-500 shrink-0" />
                  <p className="text-[12px] font-medium flex-1">
                    Votre mot de passe temporaire n'a pas encore été modifié. Nous recommandons de le changer pour sécuriser votre compte.
                  </p>
                  <PasswordChangeDialog
                    trigger={
                      <Button size="sm" variant="outline" className="shrink-0 h-7 text-[11px] border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-900 gap-1.5">
                        <KeyRound className="w-3 h-3" />
                        Changer maintenant
                      </Button>
                    }
                  />
                  <button
                    onClick={() => setPwdBannerDismissed(true)}
                    className="p-1 rounded hover:bg-orange-100 text-orange-400 hover:text-orange-600 transition-colors shrink-0"
                    title="Masquer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
        <Suspense fallback={null}><ModuleOverlayRenderer moduleId={activeView || "accueil"} /></Suspense>
      </main>
    </div>
  );


};

export default Index;