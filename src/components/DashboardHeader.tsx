import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { getDepartmentDisplayName } from "@/data/departments";
import ExportButton from "@/components/ExportButton";
import ImportExcel from "@/components/ImportExcel";
import { useAuth } from "@/contexts/AuthContext";
import { Search, X, User, Building2, Layers, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ResultType = "member" | "department" | "service";

interface SearchResult {
  type: ResultType;
  title: string;
  subtitle: string;
  tags: string[];
  icon: string;
}

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  minimal?: boolean;
}

const DashboardHeader = ({ title, subtitle, minimal }: DashboardHeaderProps) => {
  const { departments } = useDepartments();
  const { isAdmin } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const totalMembers = departments.reduce((acc, d) => acc + d.compositionToday.length, 0);
  const totalTargetMembers = departments.reduce((acc, d) => acc + d.compositionTomorrow.length, 0);
  const allMilestones = departments.flatMap((d) => [...d.milestones2026, ...d.milestones2027]);
  const doneCount = allMilestones.filter((m) => m.status === "done").length;

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const res: SearchResult[] = [];

    departments.forEach(dept => {
      if (dept.name.toLowerCase().includes(q) || dept.nameTomorrow.toLowerCase().includes(q) || dept.head.toLowerCase().includes(q)) {
        res.push({
          type: "department",
          title: getDepartmentDisplayName(dept),
          subtitle: `Responsable : ${dept.head}`,
          tags: [dept.name],
          icon: dept.icon,
        });
      }
      dept.services?.forEach(svc => {
        if (svc.name.toLowerCase().includes(q) || svc.responsible?.toLowerCase().includes(q)) {
          res.push({
            type: "service",
            title: svc.name,
            subtitle: `${getDepartmentDisplayName(dept)} — ${svc.responsible || ""}`,
            tags: [],
            icon: "🏷️",
          });
        }
      });
      [...dept.compositionToday, ...dept.compositionTomorrow].forEach(member => {
        if (member.name.toLowerCase().includes(q) || member.role?.toLowerCase().includes(q)) {
          if (!res.find(r => r.type === "member" && r.title === member.name)) {
            res.push({
              type: "member",
              title: member.name,
              subtitle: `${member.role || ""} — ${getDepartmentDisplayName(dept)}`,
              tags: [],
              icon: "👤",
            });
          }
        }
      });
    });
    return res.slice(0, 15);
  }, [query, departments]);

  const typeIcon = (type: ResultType) => {
    switch (type) {
      case "member": return <User className="w-4 h-4 text-primary" />;
      case "department": return <Building2 className="w-4 h-4 text-primary" />;
      case "service": return <Layers className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md shadow-card p-5 mb-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {(title || subtitle) &&
            <div className="min-w-0">
                {title && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-1 h-5 rounded-full bg-primary" />
                    <h2 className="font-display font-semibold text-lg tracking-tight text-gradient-gold">{title}</h2>
                  </div>
                )}
                {subtitle && <p className="text-[13px] text-muted-foreground/70 mt-0.5 ml-3.5">{subtitle}</p>}
              </div>
            }
          </div>

          {!minimal && (
            <div className="flex items-center gap-2.5">
              {/* KPI pills */}
              <div className="hidden lg:flex items-center gap-2">
                <div className="rounded-xl border border-border/50 bg-muted px-4 py-2.5 text-center hover-lift">
                  <p className="font-display font-semibold text-[13px] text-foreground">{totalMembers} → {totalTargetMembers}</p>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium">Effectifs</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted px-4 py-2.5 text-center hover-lift">
                  <p className="font-display font-semibold text-[13px]">
                    <span className="text-primary">{doneCount}</span>
                    <span className="text-muted-foreground/50 font-normal"> / {allMilestones.length}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium">Étapes</p>
                </div>
              </div>
              {isAdmin && <ImportExcel />}
              <ExportButton />
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2 px-4 border-border/60 bg-muted hover:bg-accent hover:border-primary/30 text-muted-foreground transition-all duration-200"
                onClick={() => { setSearchOpen(true); setQuery(""); }}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="text-[13px] hidden sm:inline">Rechercher…</span>
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg border-border/60 bg-card/90 backdrop-blur-xl shadow-elevated">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Recherche rapide
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
              autoFocus
              placeholder="Rechercher un collaborateur, département, service…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl border-border/60 bg-muted focus:border-primary/40 focus:ring-primary/20"
            />
          </div>
          {query.trim() && (
            <div className="max-h-72 overflow-y-auto space-y-0.5 mt-2">
              {results.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center gap-2">
                  <Search className="w-5 h-5 opacity-30" />
                  <p>Aucun résultat pour « {query} »</p>
                </div>
              ) : (
                results.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent/40 cursor-default transition-colors group"
                  >
                    <span className="mt-0.5 flex-shrink-0">{typeIcon(r.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                        <span>{r.icon}</span>
                        <span>{r.title}</span>
                      </p>
                      <p className="text-xs text-muted-foreground/70 truncate">{r.subtitle}</p>
                      {r.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {r.tags.map(t => <Badge key={t} variant="secondary" className="text-[10px] rounded-md">{t}</Badge>)}
                        </div>
                      )}
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-all flex-shrink-0 mt-0.5" />
                  </motion.div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardHeader;