import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/hooks/useProfiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ClipboardList, User, Calendar, FileText, Clock } from "lucide-react";

interface AuditEntry {
  id: string;
  table_name: string;
  action: string;
  user_id: string;
  details: Record<string, any>;
  created_at: string;
  extra?: Record<string, any>;
}

const AdminAuditLog = () => {
  const profiles = useProfiles();
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllAuditData();
  }, []);

  const fetchAllAuditData = async () => {
    setLoading(true);
    const allEntries: AuditEntry[] = [];

    // Objective change audit log
    const { data: objAudit } = await supabase
      .from("objective_change_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (objAudit) {
      for (const e of objAudit) {
        allEntries.push({
          id: e.id,
          table_name: "Objectifs (demandes)",
          action: e.action,
          user_id: e.user_id,
          details: typeof e.details === "object" && e.details !== null ? e.details as Record<string, any> : {},
          created_at: e.created_at,
          extra: { actor_id: e.actor_id, actor_role: e.actor_role },
        });
      }
    }

    // Weekly planner audit log
    const { data: weeklyAudit } = await supabase
      .from("weekly_planner_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (weeklyAudit) {
      for (const e of weeklyAudit) {
        allEntries.push({
          id: e.id,
          table_name: "Planning hebdomadaire",
          action: e.action,
          user_id: e.user_id,
          details: typeof e.details === "object" && e.details !== null ? e.details as Record<string, any> : {},
          created_at: e.created_at,
          extra: { actor_id: e.actor_id, week_start: e.week_start },
        });
      }
    }

    // Sort all by date desc
    allEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setEntries(allEntries);
    setLoading(false);
  };

  const getName = (id: string) => {
    const p = profiles.find((p) => p.user_id === id);
    return p?.full_name || id.slice(0, 8);
  };

  const filtered = selectedUser === "all" ? entries : entries.filter((e) => e.user_id === selectedUser);

  // Group by user
  const grouped = filtered.reduce<Record<string, AuditEntry[]>>((acc, entry) => {
    const key = entry.user_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      request_created: "Demande créée",
      manager_approved: "Approuvé (manager)",
      manager_rejected: "Rejeté (manager)",
      dg_approved: "Approuvé (DG)",
      dg_rejected: "Rejeté (DG)",
      submitted: "Soumis",
      validated: "Validé",
      rejected: "Rejeté",
      returned: "Retourné",
    };
    return map[action] || action;
  };

  const actionColor = (action: string) => {
    if (action.includes("approved") || action === "validated") return "default";
    if (action.includes("rejected")) return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Journal d'audit par collaborateur</h3>
        </div>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-[220px] h-8 text-xs">
            <SelectValue placeholder="Tous les collaborateurs" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all">Tous les collaborateurs</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune entrée d'audit</p>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {Object.entries(grouped).map(([userId, userEntries]) => (
              <Card key={userId} className="border-border">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-primary" />
                    {getName(userId)}
                    <Badge variant="outline" className="text-[9px] ml-auto">
                      {userEntries.length} action(s)
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <div className="space-y-2">
                    {userEntries.slice(0, 20).map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex-shrink-0 mt-0.5">
                          {entry.table_name.includes("Objectif") ? (
                            <FileText className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <Clock className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={actionColor(entry.action)} className="text-[9px]">
                              {actionLabel(entry.action)}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{entry.table_name}</span>
                          </div>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {entry.details.explanation || entry.details.title || entry.details.comment || JSON.stringify(entry.details).slice(0, 80)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground whitespace-nowrap">
                          <Calendar className="w-2.5 h-2.5" />
                          {format(new Date(entry.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                        </div>
                      </div>
                    ))}
                    {userEntries.length > 20 && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        +{userEntries.length - 20} entrée(s) supplémentaire(s)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default AdminAuditLog;
