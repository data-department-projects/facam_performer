import { useEffect } from "react";
import { motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DepartmentsProvider } from "@/contexts/DepartmentsContext";
import { CommitteesProvider } from "@/contexts/CommitteesContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { GlobalDesignProvider } from "@/contexts/GlobalDesignContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import { TimeTrackingProvider } from "@/contexts/TimeTrackingContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ShieldAlert, LogOut } from "lucide-react";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

const BlockedScreen = () => {
  const { signOut, profile } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-destructive/[0.03] blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-primary/[0.03] blur-3xl" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl border border-destructive/20 bg-card/60 backdrop-blur-xl shadow-elevated relative z-10"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-destructive tracking-tight">Compte Bloqué</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Votre compte <span className="text-foreground font-medium">{profile?.email}</span> a été temporairement suspendu suite à la détection d'activités suspectes.
          </p>
        </div>
        <div className="space-y-3 text-xs text-muted-foreground/80 leading-relaxed">
          <p>Des tentatives d'accès non autorisé ont été détectées et enregistrées. L'administrateur a été notifié et dispose de l'historique complet de ces activités.</p>
          <p className="font-medium text-muted-foreground">Veuillez contacter votre Direction Générale pour le déblocage de votre compte.</p>
        </div>
        <Button
          variant="outline"
          onClick={signOut}
          className="gap-2"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </Button>
      </motion.div>
    </div>
  );
};

const AppRoutes = () => {
  const { user, loading, mustChangePassword, isRecovery, isBlocked, isAdmin } = useAuth();

  useEffect(() => {
    const badge = document.getElementById("lovable-badge") ||
      document.querySelector('a[href*="lovable.dev"][target="_blank"]');
    if (badge) {
      (badge as HTMLElement).style.display = isAdmin ? "" : "none";
    }
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4 relative z-10"
        >
          <div className="relative w-10 h-10 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-medium tracking-wide">Chargement...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (isBlocked) return <BlockedScreen />;

  return (
    <GlobalDesignProvider>
      <DepartmentsProvider>
        <CommitteesProvider>
          <OrganizationProvider>
            <ProjectsProvider>
              <TimeTrackingProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </TimeTrackingProvider>
            </ProjectsProvider>
          </OrganizationProvider>
        </CommitteesProvider>
      </DepartmentsProvider>
    </GlobalDesignProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
