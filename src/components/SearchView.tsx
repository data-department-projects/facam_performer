import { useState, useMemo } from "react";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, User, Building2, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ResultType = "member" | "department" | "service";

interface SearchResult {
  type: ResultType;
  title: string;
  subtitle: string;
  tags: string[];
  icon: string;
  period?: string;
}

const SearchView = () => {
  const { departments } = useDepartments();
  const [query, setQuery] = useState("");

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const res: SearchResult[] = [];

    departments.forEach(dept => {
      // Match department
      if (dept.name.toLowerCase().includes(q) || dept.nameTomorrow.toLowerCase().includes(q) || dept.head.toLowerCase().includes(q)) {
        res.push({ type: "department", title: dept.name, subtitle: `Responsable : ${dept.head}`, tags: dept.services.map(s => typeof s === "string" ? s : s.name), icon: dept.icon });
      }

      // Match services
      dept.services.forEach(s => {
        const sName = typeof s === "string" ? s : s.name;
        if (sName.toLowerCase().includes(q)) {
          res.push({ type: "service", title: sName, subtitle: dept.name, tags: [], icon: dept.icon });
        }
      });

      // Match members
      const searchMembers = (members: typeof dept.compositionToday, period: string) => {
        members.forEach(m => {
          if (m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || (m.services || []).some(s => s.toLowerCase().includes(q))) {
            res.push({ type: "member", title: m.name || "(sans nom)", subtitle: m.role, tags: m.services || [], icon: dept.icon, period });
          }
        });
      };
      searchMembers(dept.compositionToday, "Aujourd'hui");
      searchMembers(dept.compositionTomorrow, "Cible 2027");
    });

    return res.slice(0, 30);
  }, [query, departments]);

  const iconMap: Record<ResultType, React.ReactNode> = {
    member: <User className="w-4 h-4 text-accent" />,
    department: <Building2 className="w-4 h-4 text-primary" />,
    service: <Layers className="w-4 h-4 text-secondary-foreground" />,
  };

  const labelMap: Record<ResultType, string> = {
    member: "Collaborateur",
    department: "Département",
    service: "Service",
  };

  return (
    <div className="space-y-6">

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un nom, un rôle, un service..."
          className="pl-10 h-10"
          autoFocus
        />
      </div>

      {query.trim() && (
        <p className="text-xs text-muted-foreground">{results.length} résultat{results.length !== 1 ? "s" : ""}</p>
      )}

      <div className="space-y-2">
        {results.map((r, i) => (
          <Card key={i} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {iconMap[r.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{r.title}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">{labelMap[r.type]}</Badge>
                  {r.period && <Badge variant="secondary" className="text-[10px] shrink-0">{r.period}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.icon} {r.subtitle}</p>
                {r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.tags.map((t, ti) => (
                      <span key={ti} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {query.trim() && results.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun résultat pour « {query} »</p>
        </div>
      )}
    </div>
  );
};

export default SearchView;
