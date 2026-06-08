import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
const logoImg = "/facam_stairway-bleu.png";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDesign } from "@/contexts/GlobalDesignContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3, Network, GanttChart, FolderKanban,
  Clock, Target, Building2, Settings, LogOut, ChevronLeft,
  ChevronRight, ChevronDown, Home, ShieldAlert, ClipboardCheck, Check,
  ChevronFirst, ChevronLast, HelpCircle, BookOpen, AlertCircle, KeyRound, UserCog, type LucideIcon
} from "lucide-react";
import PasswordChangeDialog from "@/components/PasswordChangeDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewType =
"accueil" | "dashboard" | "roadmap" | "orgchart" | "comites" |
"admin" | "gantt" | "projects" |
"timeentry" | "etpadmin" | "collaborators" |
"hrperformance" | "projectscomites" | "dept_objectives" | "badgemanagement" | "actions" |
"guide" | "report_error" | "profil";

interface NavItem {
  id: ViewType;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  moduleId?: string;
  children?: {id: ViewType;label: string;icon: LucideIcon;moduleId?: string;}[];
}

const NAV_ITEMS: NavItem[] = [
{ id: "accueil", label: "Accueil", icon: Home },
{ id: "timeentry", label: "Week Planner", icon: Clock, moduleId: "timeentry" },
{ id: "gantt", label: "Planification", icon: GanttChart, moduleId: "gantt" },
{ id: "hrperformance", label: "Objectifs", icon: Target, moduleId: "hrperformance" },
{ id: "dept_objectives", label: "Obj. Départements", icon: Building2, moduleId: "dept_objectives" },
{ id: "orgchart", label: "Organigramme", icon: Network, moduleId: "orgchart" },
{ id: "dashboard", label: "Tableau de bord", icon: BarChart3, moduleId: "dashboard" },
{ id: "projectscomites", label: "Projets & Comités", icon: FolderKanban, moduleId: "projectscomites" },
{ id: "admin", label: "Administration", icon: Settings, adminOnly: true },
{ id: "etpadmin", label: "Suivi ETP", icon: BarChart3, adminOnly: true },
{ id: "badgemanagement", label: "Gestion de temps", icon: Clock, adminOnly: true },
{ id: "actions", label: "Actions à traiter", icon: ClipboardCheck, moduleId: "actions" }];


interface AppSidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onNavigateToAdminTab?: (tab: string) => void;
}

const AppSidebar = ({ currentView, onViewChange, onNavigateToAdminTab }: AppSidebarProps) => {
  const { isAdmin, allowedModules, signOut, profile, user, mustChangePassword } = useAuth();
  const { organization, updateOrganization } = useOrganization();
  const { settings } = useGlobalDesign();
  const { toast } = useToast();
  const logoSize = settings.sidebarLogoSize ?? 144;
  const [collapsed, setCollapsed] = useState(false);
  const [aideOpen, setAideOpen] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!user) return;
    if (!isAdmin && !profile?.is_manager) return;
    let total = 0;

    if (isAdmin) {
      const ackAt = organization?.securityAcknowledgedAt;
      let secQuery = supabase.from("security_violations").select("id", { count: "exact", head: true });
      if (ackAt) {
        secQuery = secQuery.gt("created_at", ackAt);
      }
      const { count: secCount } = await secQuery;
      setViolationCount(secCount ?? 0);

      const { count: modCount } = await supabase.
      from("modification_requests").
      select("id", { count: "exact", head: true }).
      eq("status", "pending");
      total += modCount ?? 0;
    }

    // Fetch subordinate IDs for this user
    const { data: subProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("hierarchy_user_id", user.id);
    const subIds = (subProfiles || []).map(p => p.user_id);
    if (subIds.length === 0) {
      setPendingActionsCount(total);
      return;
    }

    // Fetch acknowledged action IDs
    const { data: ackData } = await supabase
      .from("action_acknowledgements")
      .select("action_type, action_ref_id");
    const ackSet = new Set((ackData || []).map(a => `${a.action_type}:${a.action_ref_id}`));

    // Only count requests from direct subordinates
    let objQuery = supabase
      .from("objective_change_requests")
      .select("id")
      .in("user_id", subIds);
    if (isAdmin) {
      objQuery = objQuery.eq("status", "pending");
    } else {
      objQuery = objQuery.eq("manager_status", "pending");
    }
    const { data: objData } = await objQuery;
    const activeObjCount = (objData || []).filter(r => !ackSet.has(`objective_request:${r.id}`)).length;
    total += activeObjCount;

    const { data: wpData } = await supabase
      .from("weekly_planner_status")
      .select("id")
      .in("user_id", subIds)
      .eq("status", "submitted");
    const activeWpCount = (wpData || []).filter(w => !ackSet.has(`weekly_validation:${w.id}`)).length;
    total += activeWpCount;

    setPendingActionsCount(total);
  }, [user, isAdmin, profile?.is_manager, organization?.securityAcknowledgedAt]);

  const handleAcknowledgeSecurity = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date().toISOString();
    updateOrganization({ ...organization, securityAcknowledgedAt: now });
    setViolationCount(0);
  };

  // Initial fetch
  useEffect(() => {fetchCounts();}, [fetchCounts]);

  // Realtime subscription for weekly_planner_status changes
  useEffect(() => {
    if (!isAdmin && !profile?.is_manager) return;

    const channel = supabase.
    channel('sidebar-planner-alerts').
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'weekly_planner_status' },
      (payload) => {
        // Refresh counts on any change
        fetchCounts();

        // Show toast when a new submission arrives
        if (
        payload.eventType === 'UPDATE' &&
        (payload.new as unknown as { status?: string })?.status === 'submitted' &&
        (payload.old as unknown as { status?: string })?.status !== 'submitted')
        {
          toast({
            title: "📋 Nouveau planning soumis",
            description: "Un collaborateur a soumis son planning hebdomadaire pour validation."
          });
        }
      }
    ).
    subscribe();

    return () => {supabase.removeChannel(channel);};
  }, [isAdmin, profile?.is_manager, fetchCounts, toast]);

  const showActions = isAdmin || !!profile?.is_manager;

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.id === "actions") return false; // rendered separately below security
    if (item.adminOnly) {
      return isAdmin || allowedModules.includes(item.id);
    }
    if (item.moduleId) return isAdmin || allowedModules.includes(item.moduleId);
    return true;
  });

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar-background border-r border-sidebar-border transition-all duration-300 sticky top-0",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}>
      
      {/* Logo */}
      <div className={cn(
        "flex flex-col items-center justify-center border-b border-sidebar-border/60 transition-all duration-300",
        collapsed ? "px-2 py-4 gap-1" : "px-3 py-5 gap-2"
      )}>
        <motion.div
          layout
          className="relative"
        >
          <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full" />
          <img
            src={logoImg}
            alt="FACAM STAIRWAY"
            className="object-contain block mx-auto relative z-10"
            style={{ width: collapsed ? 36 : Math.min(logoSize, 140), height: "auto", maxWidth: "100%" }}
          />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="font-display font-bold text-[13px] tracking-[0.15em] text-center w-full text-secondary uppercase"
            >
              Work Space
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-0.5 px-3 py-4">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const isGuide = item.id === "accueil";

          if (isGuide) {
            return (
              <div key={item.id} className="space-y-1">
                <motion.button
                  whileHover={{ x: 1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-200 mt-1",
                    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                    isActive ?
                    "bg-secondary/10 text-secondary border-l-2 border-primary" :
                    "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                  title={collapsed ? item.label : undefined}>
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={isActive ? 2.5 : 1.5} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="ml-auto w-1 h-1 rounded-full bg-primary"
                    />
                  )}
                </motion.button>
                {isAdmin && violationCount > 0 &&
                <div className="flex items-center gap-1">
                  <motion.button
                    whileHover={{ x: 1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {if (onNavigateToAdminTab) onNavigateToAdminTab("security");else onViewChange("admin");}}
                    className={cn(
                      "flex-1 flex items-center gap-3 rounded-lg text-[11px] font-semibold transition-all duration-200 border",
                      collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                      "border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
                    )}
                    title={collapsed ? `${violationCount} alerte(s) sécurité` : undefined}>
                    
                      <ShieldAlert className="w-4 h-4 flex-shrink-0 text-destructive" />
                      {!collapsed &&
                    <span className="truncate text-destructive/90">
                          {`${violationCount} alerte${violationCount > 1 ? "s" : ""}`}
                        </span>
                    }
                    </motion.button>
                    {!collapsed &&
                      <button
                        onClick={handleAcknowledgeSecurity}
                        className="flex items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500 px-2 py-2 transition-colors"
                        title="Marquer comme lu"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    }
                  </div>
                }
                {showActions && (pendingActionsCount > 0 || currentView === "actions") &&
                <motion.button
                  whileHover={{ x: 1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onViewChange("actions")}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg text-[11px] font-semibold transition-all duration-200 border",
                    collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                    currentView === "actions" ?
                    "border-primary/40 bg-primary/10" :
                    pendingActionsCount > 0 ?
                    "border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10" :
                    "border-border/40 bg-muted/20 hover:bg-muted/40"
                  )}
                  title={collapsed ? pendingActionsCount > 0 ? `${pendingActionsCount} action(s) à traiter` : "Actions à traiter" : undefined}>
                  
                    <ClipboardCheck className={cn(
                    "w-4 h-4 flex-shrink-0",
                    pendingActionsCount > 0 ? "text-orange-500" : "text-muted-foreground/60"
                  )} />
                    {!collapsed &&
                  <span className={cn("truncate", pendingActionsCount > 0 ? "text-orange-500" : "text-muted-foreground/70")}>
                        {pendingActionsCount > 0 ?
                    `${pendingActionsCount} action${pendingActionsCount > 1 ? "s" : ""}` :
                    "Actions"}
                      </span>
                  }
                  </motion.button>
                }
              </div>);

          }

          return (
            <motion.button
              key={item.id}
              whileHover={{ x: 1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-200 group",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                isActive ?
                "bg-secondary/10 text-secondary border-l-2 border-primary" :
                "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
              title={collapsed ? item.label : undefined}>
              
              <Icon className={cn(
                "w-[18px] h-[18px] flex-shrink-0 transition-all duration-200",
                isActive ? "stroke-[2.5]" : "stroke-[1.5]",
                item.id === "etpadmin" && !isActive && "text-destructive/70"
              )} />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  {item.children && !isActive &&
                    <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-40 group-hover:opacity-70 transition-opacity" />
                  }
                </>
              )}
            </motion.button>);
        })}
        {/* ── Section Aide ── */}
        <div className="mt-2 pt-2 border-t border-sidebar-border/40 space-y-0.5">
          {/* Bouton parent Aide */}
          <button
            onClick={() => {
              if (!collapsed) setAideOpen(o => !o);
            }}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-200",
              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
              (aideOpen || currentView === "guide" || currentView === "report_error")
                ? "text-sidebar-foreground bg-sidebar-accent/60"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
            title={collapsed ? "Aide" : undefined}
          >
            <HelpCircle className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
            {!collapsed && (
              <>
                <span className="truncate flex-1 text-left">Aide</span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform duration-200 opacity-50",
                    aideOpen && "rotate-180 opacity-80"
                  )}
                />
              </>
            )}
          </button>

          {/* Sous-menus (mode étendu uniquement) */}
          <AnimatePresence>
            {aideOpen && !collapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="pl-4 space-y-0.5 py-0.5">
                  {/* Guide d'utilisation */}
                  <button
                    onClick={() => onViewChange("guide")}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg text-[12px] font-medium px-3 py-2 transition-all duration-200",
                      currentView === "guide"
                        ? "bg-secondary/10 text-secondary border-l-2 border-primary"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Guide d'utilisation</span>
                    {currentView === "guide" && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>

                  {/* Signaler une erreur */}
                  <button
                    onClick={() => onViewChange("report_error")}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg text-[12px] font-medium px-3 py-2 transition-all duration-200",
                      currentView === "report_error"
                        ? "bg-secondary/10 text-secondary border-l-2 border-primary"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Signaler une erreur</span>
                    {currentView === "report_error" && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border/60 p-3 space-y-2">
        <AnimatePresence>
          {!collapsed && profile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-2 py-2 rounded-lg bg-sidebar-accent/40 border border-sidebar-border/40"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {(profile.full_name || profile.email || "?").charAt(0).toUpperCase()}
                  </span>
                  {mustChangePassword && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white" title="Mot de passe à changer" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-sidebar-foreground truncate">
                    {profile.full_name || profile.email}
                  </p>
                  <p className="text-[10px] text-sidebar-foreground/40 truncate">
                    {profile.email}
                  </p>
                </div>
                <button
                  onClick={() => onViewChange("profil")}
                  className="shrink-0 w-7 h-7 rounded-lg hover:bg-sidebar-accent flex items-center justify-center text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
                  title="Mon profil"
                >
                  <UserCog className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {mustChangePassword && (
          <PasswordChangeDialog
            trigger={
              <button
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg text-[11px] font-semibold transition-all duration-200 border border-amber-300/60 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2"
                )}
                title={collapsed ? "Changer mot de passe" : undefined}
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                {!collapsed && <span className="truncate">Changer mot de passe</span>}
                {!collapsed && <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
              </button>
            }
          />
        )}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 justify-start gap-2 text-[12px] rounded-lg"
            onClick={signOut}>
            <LogOut className="w-[15px] h-[15px]" />
            {!collapsed && "Déconnexion"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/30 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/60 rounded-lg"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Développer" : "Réduire"}
          >
            {collapsed ? <ChevronLast className="w-3.5 h-3.5" /> : <ChevronFirst className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </aside>);

};

export default AppSidebar;