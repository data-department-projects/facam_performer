import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/[0.02] blur-3xl" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center relative z-10"
      >
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/5 border border-primary/10">
          <span className="text-3xl font-bold text-primary">404</span>
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Page introuvable</h1>
        <p className="mb-6 text-sm text-muted-foreground max-w-sm mx-auto">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          onClick={() => window.location.href = "/"}
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </Button>
      </motion.div>
    </div>
  );
};

export default NotFound;
