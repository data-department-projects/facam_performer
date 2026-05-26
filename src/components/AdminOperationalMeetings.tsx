import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import { CalendarCheck, Plus, Trash2, Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MultiSelect from "@/components/ui/multi-select";
import { useToast } from "@/hooks/use-toast";

const DAYS_OF_WEEK = [
  { value: "1", label: "Lundi" },
  { value: "2", label: "Mardi" },
  { value: "3", label: "Mercredi" },
  { value: "4", label: "Jeudi" },
  { value: "5", label: "Vendredi" },
  { value: "6", label: "Samedi" },
  { value: "0", label: "Dimanche" },
];

interface OperationalMeeting {
  id: string;
  title: string;
  day_of_week: number;
  time_start: string | null;
  time_end: string | null;
  connection_link: string | null;
  animator_ids: string[];
  participant_ids: string[];
  created_by: string;
}

const AdminOperationalMeetings = () => {
  const { isAdmin, user } = useAuth();
  const profiles = useProfiles();
  const { toast } = useToast();

  const [meetings, setMeetings] = useState<OperationalMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDay, setFormDay] = useState("1");
  const [formTimeStart, setFormTimeStart] = useState("");
  const [formTimeEnd, setFormTimeEnd] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formAnimators, setFormAnimators] = useState<string[]>([]);
  const [formParticipants, setFormParticipants] = useState<string[]>([]);

  const collabOptions = profiles.map(p => ({ value: p.user_id, label: p.full_name || p.email }));
  const managerOptions = profiles.filter(p => p.is_manager).map(p => ({ value: p.user_id, label: p.full_name || p.email }));

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("operational_meetings")
      .select("*")
      .order("day_of_week", { ascending: true });
    if (data) {
      setMeetings(data as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const resetForm = () => {
    setFormTitle("");
    setFormDay("1");
    setFormTimeStart("");
    setFormTimeEnd("");
    setFormLink("");
    setFormAnimators([]);
    setFormParticipants([]);
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) {
      toast({ title: "Le titre est obligatoire", variant: "destructive" });
      return;
    }
    if (formParticipants.length === 0) {
      toast({ title: "Sélectionnez au moins un participant", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("operational_meetings").insert({
      title: formTitle.trim(),
      day_of_week: parseInt(formDay),
      time_start: formTimeStart || null,
      time_end: formTimeEnd || null,
      connection_link: formLink.trim() || null,
      animator_ids: formAnimators,
      participant_ids: formParticipants,
      created_by: user?.id,
    } as any);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Réunion ajoutée ✓" });
    setCreating(false);
    resetForm();
    fetchMeetings();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette réunion opérationnelle ?")) return;
    await supabase.from("operational_meetings").delete().eq("id", id);
    toast({ title: "Réunion supprimée ✓" });
    fetchMeetings();
  };

  const getDayLabel = (day: number) => DAYS_OF_WEEK.find(d => d.value === String(day))?.label || "—";
  const getProfileName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || userId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-xl">Réunions opérationnelles</h2>
            <p className="text-sm text-muted-foreground">Réunions obligatoires pour les managers</p>
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" className="text-xs gap-1.5" onClick={() => { resetForm(); setCreating(true); }}>
            <Plus className="w-3.5 h-3.5" /> Ajouter une réunion
          </Button>
        )}
      </div>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Chargement...</CardContent></Card>
      ) : meetings.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Aucune réunion opérationnelle définie.</CardContent></Card>
      ) : (
        <Card className="shadow-card">
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Titre</TableHead>
                  <TableHead className="text-[10px]">Jour</TableHead>
                  <TableHead className="text-[10px]">Horaire</TableHead>
                  <TableHead className="text-[10px]">Lien de connexion</TableHead>
                  <TableHead className="text-[10px]">Manager(s)</TableHead>
                  <TableHead className="text-[10px]">Participants</TableHead>
                  {isAdmin && <TableHead className="text-[10px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs font-medium">{m.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{getDayLabel(m.day_of_week)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.time_start ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {m.time_start}{m.time_end ? ` - ${m.time_end}` : ""}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {m.connection_link ? (
                        <a href={m.connection_link} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate max-w-[200px] inline-block">
                          {m.connection_link.length > 40 ? m.connection_link.slice(0, 40) + "…" : m.connection_link}
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(m.animator_ids || []).map(id => (
                          <Badge key={id} variant="default" className="text-[10px] font-normal">
                            {getProfileName(id)}
                          </Badge>
                        ))}
                        {(!m.animator_ids || m.animator_ids.length === 0) && <span className="text-[10px] text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.participant_ids.map(id => (
                          <Badge key={id} variant="secondary" className="text-[10px] font-normal">
                            {getProfileName(id)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Nouvelle réunion opérationnelle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Titre de la réunion</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} className="h-8 text-sm" placeholder="Ex: Réunion de pilotage hebdomadaire" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Jour de la semaine</Label>
                <Select value={formDay} onValueChange={setFormDay}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Heure de début</Label>
                <Input type="time" value={formTimeStart} onChange={e => setFormTimeStart(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Heure de fin</Label>
                <Input type="time" value={formTimeEnd} onChange={e => setFormTimeEnd(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lien de connexion (facultatif)</Label>
              <Input value={formLink} onChange={e => setFormLink(e.target.value)} className="h-8 text-sm" placeholder="https://meet.google.com/..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Manager(s)</Label>
              <MultiSelect
                options={managerOptions}
                selected={formAnimators}
                onChange={setFormAnimators}
                placeholder="Sélectionner les managers..."
                searchPlaceholder="Rechercher un manager..."
                emptyMessage="Aucun manager trouvé."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Participants</Label>
              <MultiSelect
                options={collabOptions}
                selected={formParticipants}
                onChange={setFormParticipants}
                placeholder="Sélectionner les participants..."
                searchPlaceholder="Rechercher un collaborateur..."
                emptyMessage="Aucun collaborateur trouvé."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>Annuler</Button>
              <Button size="sm" onClick={handleCreate}>Ajouter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOperationalMeetings;
