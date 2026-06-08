import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/hooks/useProfiles";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Download, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  user_created: { label: "Création", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  user_deleted: { label: "Suppression", color: "bg-destructive/10 text-destructive border-destructive/20" },
  user_edited: { label: "Modification", color: "bg-primary/10 text-primary border-primary/20" },
  password_reset: { label: "Réinit. MDP", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  user_banned: { label: "Désactivation", color: "bg-destructive/10 text-destructive border-destructive/20" },
  user_unbanned: { label: "Réactivation", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  invite_generated: { label: "Invitation", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  user_login: { label: "Connexion", color: "bg-muted text-muted-foreground border-border" },
  user_logout: { label: "Déconnexion", color: "bg-muted text-muted-foreground border-border" },
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

interface AuditEntry {
  id: string;
  actor_id: string;
  target_user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

const AdminUserAuditLog = () => {
  const profiles = useProfiles();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [limit, setLimit] = useState(100);

  const getProfileName = (userId: string | null) => {
    if (!userId) return "—";
    return profiles.find(p => p.user_id === userId)?.full_name || userId.slice(0, 8) + "…";
  };

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("user_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filterUser !== "all") {
      query = query.or(`actor_id.eq.${filterUser},target_user_id.eq.${filterUser}`);
    }
    if (filterAction !== "all") {
      query = query.eq("action", filterAction);
    }

    const { data } = await query;
    setEntries((data as unknown as AuditEntry[]) ?? []);
    setLoading(false);
  }, [filterUser, filterAction, limit]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const filtered = entries.filter(e => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const actorName = getProfileName(e.actor_id).toLowerCase();
    const targetName = getProfileName(e.target_user_id).toLowerCase();
    const actionLabel = (ACTION_LABELS[e.action]?.label || e.action).toLowerCase();
    const detailsStr = JSON.stringify(e.details).toLowerCase();
    return actorName.includes(term) || targetName.includes(term) || actionLabel.includes(term) || detailsStr.includes(term);
  });

  const exportExcel = () => {
    const rows = filtered.map(e => ({
      "Date": format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", { locale: fr }),
      "Action": ACTION_LABELS[e.action]?.label || e.action,
      "Effectuée par": getProfileName(e.actor_id),
      "Utilisateur cible": getProfileName(e.target_user_id),
      "Détails": JSON.stringify(e.details),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Log");
    XLSX.writeFile(wb, `audit_utilisateurs_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const exportCSV = () => {
    const rows = filtered.map(e => ({
      "Date": format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", { locale: fr }),
      "Action": ACTION_LABELS[e.action]?.label || e.action,
      "Effectuée par": getProfileName(e.actor_id),
      "Utilisateur cible": getProfileName(e.target_user_id),
      "Détails": JSON.stringify(e.details),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_utilisateurs_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const userOptions = profiles.map(p => ({ value: p.user_id, label: p.full_name || p.email }));

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-display font-bold text-lg">Journal d'audit utilisateurs</h3>
            <p className="text-xs text-muted-foreground">{filtered.length} entrée(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={exportExcel}>
            <Download className="w-3 h-3" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={exportCSV}>
            <Download className="w-3 h-3" /> CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-8 text-xs w-48"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="h-8 text-xs w-52"><SelectValue placeholder="Tous les utilisateurs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les utilisateurs</SelectItem>
              {userOptions.map(u => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Toutes les actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les actions</SelectItem>
            {ALL_ACTIONS.map(a => (
              <SelectItem key={a} value={a}>{ACTION_LABELS[a].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50 lignes</SelectItem>
            <SelectItem value="100">100 lignes</SelectItem>
            <SelectItem value="500">500 lignes</SelectItem>
            <SelectItem value="1000">1000 lignes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] w-[140px]">Date</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Action</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Effectuée par</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Utilisateur cible</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Chargement...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Aucune entrée d'audit.</TableCell>
                  </TableRow>
                ) : filtered.map(e => {
                  const actionMeta = ACTION_LABELS[e.action] || { label: e.action, color: "bg-muted text-muted-foreground border-border" };
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${actionMeta.color}`}>
                          {actionMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{getProfileName(e.actor_id)}</TableCell>
                      <TableCell className="text-xs">{getProfileName(e.target_user_id)}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground max-w-[300px] truncate">
                        {formatDetails(e)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

function formatDetails(e: AuditEntry): string {
  const d = e.details;
  if (!d || Object.keys(d).length === 0) return "—";
  
  const parts: string[] = [];
  if (d.email) parts.push(`Email: ${d.email}`);
  if (d.full_name) parts.push(`Nom: ${d.full_name}`);
  if (d.role) parts.push(`Rôle: ${d.role}`);
  if (d.department) parts.push(`Dept: ${d.department}`);
  if (d.changes) parts.push(`Modifs: ${JSON.stringify(d.changes)}`);
  
  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(d);
}

export default AdminUserAuditLog;
