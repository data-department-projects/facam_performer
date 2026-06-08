import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Mail, CheckCircle2, XCircle, AlertTriangle, ChevronLeft, ChevronRight, Download } from "lucide-react";

type EmailLog = {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  sent: { label: "Envoyé", variant: "default", color: "text-green-600" },
  pending: { label: "En attente", variant: "secondary", color: "text-yellow-600" },
  failed: { label: "Échoué", variant: "destructive", color: "text-red-600" },
  dlq: { label: "Échoué (DLQ)", variant: "destructive", color: "text-red-700" },
  suppressed: { label: "Supprimé", variant: "outline", color: "text-orange-600" },
  bounced: { label: "Rebond", variant: "destructive", color: "text-red-500" },
  complained: { label: "Spam", variant: "destructive", color: "text-red-500" },
};

const TIME_RANGES = [
  { label: "24h", value: "24h", hours: 24 },
  { label: "7 jours", value: "7d", hours: 168 },
  { label: "30 jours", value: "30d", hours: 720 },
];

const PAGE_SIZE = 20;

export default function AdminEmailLog() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [page, setPage] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    const hours = TIME_RANGES.find(t => t.value === timeRange)?.hours || 168;
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const { data, error } = await supabase
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deduplicate by message_id (keep latest per message_id)
  const dedupLogs = useMemo(() => {
    const byMsg = new Map<string, EmailLog>();
    for (const log of logs) {
      const key = log.message_id || log.id;
      const existing = byMsg.get(key);
      if (!existing || new Date(log.created_at) > new Date(existing.created_at)) {
        byMsg.set(key, log);
      }
    }
    return Array.from(byMsg.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [logs]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: 0, sent: 0, failed: 0, suppressed: 0 };
    for (const log of dedupLogs) {
      s.total++;
      if (log.status === "sent") s.sent++;
      else if (["failed", "dlq"].includes(log.status)) s.failed++;
      else if (["suppressed", "bounced", "complained"].includes(log.status)) s.suppressed++;
    }
    return s;
  }, [dedupLogs]);

  // Template names for filter
  const templateNames = useMemo(() => {
    const names = new Set(dedupLogs.map(l => l.template_name));
    return Array.from(names).sort();
  }, [dedupLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return dedupLogs.filter(log => {
      if (statusFilter !== "all") {
        if (statusFilter === "failed" && !["failed", "dlq"].includes(log.status)) return false;
        if (statusFilter === "suppressed" && !["suppressed", "bounced", "complained"].includes(log.status)) return false;
        if (statusFilter === "sent" && log.status !== "sent") return false;
        if (statusFilter === "pending" && log.status !== "pending") return false;
      }
      if (templateFilter !== "all" && log.template_name !== templateFilter) return false;
      return true;
    });
  }, [dedupLogs, statusFilter, templateFilter]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const pagedLogs = filteredLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [statusFilter, templateFilter, timeRange]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || { label: status, variant: "outline" as const, color: "" };
    return <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>;
  };

  const handleExportXlsx = () => {
    const rows = filteredLogs.map(log => ({
      "Type": log.template_name,
      "Destinataire": log.recipient_email,
      "Statut": STATUS_CONFIG[log.status]?.label || log.status,
      "Date": formatDate(log.created_at),
      "Erreur": log.error_message || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Emails");
    XLSX.writeFile(wb, `suivi-emails-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground">Total emails</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
              <p className="text-[11px] text-muted-foreground">Envoyés</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
              <p className="text-[11px] text-muted-foreground">Échoués</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.suppressed}</p>
              <p className="text-[11px] text-muted-foreground">Suppressions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {TIME_RANGES.map(tr => (
            <Button
              key={tr.value}
              size="sm"
              variant={timeRange === tr.value ? "default" : "outline"}
              className="text-xs h-8"
              onClick={() => setTimeRange(tr.value)}
            >
              {tr.label}
            </Button>
          ))}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="sent">Envoyés</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="failed">Échoués</SelectItem>
            <SelectItem value="suppressed">Suppressions</SelectItem>
          </SelectContent>
        </Select>
        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Type d'email" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {templateNames.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleExportXlsx} disabled={filteredLogs.length === 0}>
          <Download className="w-3.5 h-3.5" /> Excel
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredLogs.length} email(s)
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Destinataire</TableHead>
                  <TableHead className="text-xs">Statut</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Erreur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      {loading ? "Chargement..." : "Aucun email trouvé"}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-medium">{log.template_name}</TableCell>
                      <TableCell className="text-xs">{log.recipient_email}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={log.error_message || ""}>
                        {log.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border">
              <Button size="sm" variant="ghost" className="text-xs h-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Précédent
              </Button>
              <span className="text-xs text-muted-foreground">Page {page + 1} / {totalPages}</span>
              <Button size="sm" variant="ghost" className="text-xs h-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Suivant <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
