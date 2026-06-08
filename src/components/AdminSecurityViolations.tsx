import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/hooks/useProfiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ShieldAlert, Unlock, AlertTriangle, Brain, Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Violation {
  id: string;
  user_id: string;
  user_email: string | null;
  violation_type: string;
  target_table: string | null;
  target_action: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

interface BlockedUser {
  user_id: string;
  full_name: string;
  email: string;
  blocked_at: string | null;
  blocked_reason: string | null;
}

const VIOLATION_LABELS: Record<string, string> = {
  rls_bypass_attempt: "Tentative de contournement RLS",
  unauthorized_access: "Accès non autorisé",
  data_tampering: "Falsification de données",
  suspicious_activity: "Activité suspecte",
};

const SEVERITY_MAP: Record<string, { label: string; color: string }> = {
  rls_bypass_attempt: { label: "Critique", color: "bg-red-600" },
  data_tampering: { label: "Élevé", color: "bg-orange-500" },
  unauthorized_access: { label: "Moyen", color: "bg-yellow-500" },
  suspicious_activity: { label: "Faible", color: "bg-blue-500" },
};

const AdminSecurityViolations = () => {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const profiles = useProfiles();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [violRes, blockedRes] = await Promise.all([
      supabase
        .from("security_violations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("profiles")
        .select("user_id, full_name, email, blocked_at, blocked_reason")
        .eq("is_blocked", true),
    ]);
    if (violRes.data) setViolations(violRes.data as Violation[]);
    if (blockedRes.data) setBlockedUsers(blockedRes.data as BlockedUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUnblock = async (userId: string) => {
    type UntypedRpc = (fn: string, params: Record<string, unknown>) => Promise<{ error: Error | null }>;
    const rpc = supabase.rpc as unknown as UntypedRpc;
    const { error } = await rpc("unblock_user", { _user_id: userId });
    if (error) {
      toast({ title: "Erreur", description: "Impossible de débloquer l'utilisateur.", variant: "destructive" });
    } else {
      toast({ title: "Compte débloqué", description: "L'utilisateur peut à nouveau se connecter." });
      fetchData();
    }
  };

  const handleAiAnalysis = async () => {
    if (filteredViolations.length === 0) {
      toast({ title: "Aucune donnée", description: "Aucune violation à analyser.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expirée. Veuillez vous reconnecter.");
      const aiResp = await fetch("/api/analyze-security", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ violations: filteredViolations.slice(0, 50) }),
      });
      const data = await aiResp.json() as { analysis?: string; error?: string };
      if (!aiResp.ok || data.error) throw new Error(data.error || `Erreur ${aiResp.status}`);
      setAiAnalysis(data.analysis ?? null);
    } catch (e: unknown) {
      console.error("AI analysis error:", e);
      const msg = e instanceof Error ? e.message : "Analyse IA indisponible.";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || "—";

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // Unique users from violations
  const uniqueUsers = Array.from(new Set(violations.map(v => v.user_id))).map(uid => ({
    user_id: uid,
    name: getName(uid),
    email: violations.find(v => v.user_id === uid)?.user_email || "",
  }));

  const uniqueTypes = Array.from(new Set(violations.map(v => v.violation_type)));

  // Filter violations
  const filteredViolations = violations.filter(v => {
    if (filterUser !== "all" && v.user_id !== filterUser) return false;
    if (filterType !== "all" && v.violation_type !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (v.user_email || "").toLowerCase().includes(term) ||
        getName(v.user_id).toLowerCase().includes(term) ||
        (v.target_table || "").toLowerCase().includes(term) ||
        (v.violation_type || "").toLowerCase().includes(term) ||
        JSON.stringify(v.details).toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: violations.length,
    last24h: violations.filter(v => new Date(v.created_at) > new Date(Date.now() - 86400000)).length,
    last7d: violations.filter(v => new Date(v.created_at) > new Date(Date.now() - 7 * 86400000)).length,
    uniqueUsers: new Set(violations.map(v => v.user_id)).size,
  };

  const exportCSV = () => {
    const headers = ["Date", "Collaborateur", "Email", "Type", "Sévérité", "Table", "Action", "Détails"];
    const rows = filteredViolations.map(v => [
      format(new Date(v.created_at), "dd/MM/yyyy HH:mm:ss"),
      getName(v.user_id),
      v.user_email || "",
      VIOLATION_LABELS[v.violation_type] || v.violation_type,
      SEVERITY_MAP[v.violation_type]?.label || "Inconnu",
      v.target_table || "",
      v.target_action || "",
      JSON.stringify(v.details),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `violations_securite_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDetails = (details: Record<string, unknown>): string[] => {
    const lines: string[] = [];
    if (details.error_code) lines.push(`Code erreur: ${details.error_code}`);
    if (details.error_message) lines.push(`Message: ${details.error_message}`);
    if (details.attempted_operation) lines.push(`Opération tentée: ${details.attempted_operation}`);
    if (details.table) lines.push(`Table ciblée: ${details.table}`);
    if (details.action) lines.push(`Action: ${details.action}`);
    // Show all other keys
    for (const [k, v] of Object.entries(details)) {
      if (!["error_code", "error_message", "attempted_operation", "table", "action"].includes(k)) {
        lines.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
      }
    }
    return lines.length > 0 ? lines : [JSON.stringify(details)];
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Chargement...</div>;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-destructive/20">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total violations</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/20">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.last24h}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dernières 24h</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.last7d}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">7 derniers jours</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.uniqueUsers}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Utilisateurs impliqués</p>
          </CardContent>
        </Card>
      </div>

      {/* Blocked users */}
      {blockedUsers.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Comptes bloqués ({blockedUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Bloqué le</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead className="w-[100px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockedUsers.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-xs">{u.email}</TableCell>
                    <TableCell className="text-xs">
                      {u.blocked_at ? format(new Date(u.blocked_at), "dd/MM/yyyy HH:mm", { locale: fr }) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-destructive">{u.blocked_reason || "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleUnblock(u.user_id)}>
                        <Unlock className="w-3 h-3" /> Débloquer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Violations log */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              Journal complet des violations ({filteredViolations.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportCSV}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleAiAnalysis}
                disabled={aiLoading || filteredViolations.length === 0}
              >
                <Brain className="w-3.5 h-3.5" />
                {aiLoading ? "Analyse en cours..." : "Analyse IA"}
              </Button>
            </div>
          </div>
          {/* Filters */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-8 text-xs pl-8"
              />
            </div>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <SelectValue placeholder="Tous les utilisateurs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                {uniqueUsers.map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.name} ({u.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {uniqueTypes.map(t => (
                  <SelectItem key={t} value={t}>{VIOLATION_LABELS[t] || t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {/* AI Analysis result */}
          {aiAnalysis && (
            <Card className="mb-4 border-purple-500/30 bg-purple-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                  <Brain className="w-4 h-4" />
                  Rapport d'analyse IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {aiAnalysis}
                </div>
              </CardContent>
            </Card>
          )}

          {filteredViolations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune violation détectée.</p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Collaborateur</TableHead>
                    <TableHead>Sévérité</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredViolations.map(v => {
                    const isExpanded = expandedRows.has(v.id);
                    const severity = SEVERITY_MAP[v.violation_type] || { label: "Inconnu", color: "bg-gray-500" };
                    return (
                      <>
                        <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(v.id)}>
                          <TableCell className="px-2">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(v.created_at), "dd/MM/yyyy HH:mm:ss", { locale: fr })}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-medium">{getName(v.user_id)}</span>
                            <div className="text-muted-foreground text-[10px]">{v.user_email}</div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white ${severity.color}`}>
                              {severity.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-[10px]">
                              {VIOLATION_LABELS[v.violation_type] || v.violation_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{v.target_table || "—"}</TableCell>
                          <TableCell className="text-xs">{v.target_action || "—"}</TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${v.id}-details`}>
                            <TableCell colSpan={7} className="bg-muted/30 border-l-4 border-destructive/30">
                              <div className="p-3 space-y-2">
                                <p className="text-xs font-semibold text-foreground">Détails de la tentative :</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                  {formatDetails(v.details).map((line, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="text-destructive shrink-0">•</span>
                                      <span>{line}</span>
                                    </li>
                                  ))}
                                </ul>
                                <div className="flex gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border mt-2">
                                  <span>ID Utilisateur: <code className="font-mono">{v.user_id}</code></span>
                                  <span>ID Violation: <code className="font-mono">{v.id}</code></span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSecurityViolations;
