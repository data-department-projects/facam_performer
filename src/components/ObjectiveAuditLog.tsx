import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/hooks/useProfiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ScrollText, CheckCircle2, XCircle, Send, FileEdit } from "lucide-react";

interface AuditEntry {
  id: string;
  change_request_id: string;
  objective_id: string;
  user_id: string;
  action: string;
  actor_id: string;
  actor_role: string;
  details: Record<string, any>;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  request_created: { label: "Demande créée", icon: FileEdit, color: "bg-blue-100 text-blue-800" },
  manager_approved: { label: "Approuvée (Manager)", icon: Send, color: "bg-indigo-100 text-indigo-800" },
  manager_rejected: { label: "Refusée (Manager)", icon: XCircle, color: "bg-red-100 text-red-800" },
  dg_approved: { label: "Approuvée (DG)", icon: CheckCircle2, color: "bg-green-100 text-green-800" },
  dg_rejected: { label: "Refusée (DG)", icon: XCircle, color: "bg-red-100 text-red-800" },
};

const ObjectiveAuditLog = () => {
  const profiles = useProfiles();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("objective_change_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setEntries(data as unknown as AuditEntry[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const getName = (id: string) => profiles.find(p => p.user_id === id)?.full_name || "—";

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-primary" />
          Journal d'audit — Demandes de modification d'objectifs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chargement...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune entrée d'audit</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Date</TableHead>
                  <TableHead className="text-[10px]">Action</TableHead>
                  <TableHead className="text-[10px]">Collaborateur</TableHead>
                  <TableHead className="text-[10px]">Acteur</TableHead>
                  <TableHead className="text-[10px]">Rôle</TableHead>
                  <TableHead className="text-[10px]">Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(e => {
                  const cfg = ACTION_CONFIG[e.action] || ACTION_CONFIG.request_created;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-[10px] whitespace-nowrap">
                        {format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${cfg.color} text-[10px] gap-1`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{getName(e.user_id)}</TableCell>
                      <TableCell className="text-xs">{getName(e.actor_id)}</TableCell>
                      <TableCell className="text-[10px] capitalize">{e.actor_role}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                        {e.details?.explanation || e.details?.manager_comment || e.details?.review_comment || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ObjectiveAuditLog;
