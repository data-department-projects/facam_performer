import { useCommittees } from "@/contexts/CommitteesContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Committee, CommitteeMeeting, frequencyLabels } from "@/data/committees";
import { getDepartmentDisplayName } from "@/data/departments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, Users, Clock, LinkIcon, CalendarPlus, ChevronDown, ChevronUp, Video, ExternalLink } from "lucide-react";
import DataToolbar from "@/components/DataToolbar";
import ExportCommitteesPPTButton from "@/components/ExportCommitteesPPT";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import EditCommitteeDialog from "@/components/EditCommitteeDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProfiles } from "@/hooks/useProfiles";
import { cn } from "@/lib/utils";

const CommitteesView = () => {
  const { committees, addCommittee, updateCommittee, deleteCommittee } = useCommittees();
  const { departments } = useDepartments();
  const { isAdmin, user } = useAuth();
  const [editing, setEditing] = useState<Committee | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const profiles = useProfiles();
  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach(p => { map[p.user_id] = p.full_name; });
    return map;
  }, [profiles]);
  const [canCreateCommittees, setCanCreateCommittees] = useState(false);
  const [expandedMeetings, setExpandedMeetings] = useState<Record<string, boolean>>({});
  const [addingMeeting, setAddingMeeting] = useState<string | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<{ committeeId: string; meetingId: string } | null>(null);
  const [newMeetingDate, setNewMeetingDate] = useState<Date | undefined>();
  const [newMeetingLink, setNewMeetingLink] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("");
  const [newMeetingTimeEnd, setNewMeetingTimeEnd] = useState("");
  const [newMeetingInstitution, setNewMeetingInstitution] = useState("");

  const isSurveillanceFinanciere = (c: Committee) =>
    c.name.toLowerCase().includes("surveillance financi");

  const isResponsible = (c: Committee) => {
    if (!user) return false;
    const ids: string[] = (c as any).responsibleIds || [];
    if (ids.includes(user.id)) return true;
    const profile = profiles.find(p => p.user_id === user.id);
    if (profile && c.responsible?.includes(profile.full_name)) return true;
    return false;
  };

  const canManageMeetings = (c: Committee) => isAdmin || isResponsible(c);

  const handleAddMeeting = (c: Committee) => {
    if (!newMeetingDate) return;
    const meeting: CommitteeMeeting = {
      id: `meet-${Date.now()}`,
      date: newMeetingDate.toISOString(),
      time: newMeetingTime || undefined,
      time_end: newMeetingTimeEnd || undefined,
      link: newMeetingLink.trim(),
      ...(isSurveillanceFinanciere(c) && newMeetingInstitution ? { institution: newMeetingInstitution } : {}),
    };
    const updated = { ...c, meetings: [...(c.meetings || []), meeting] };
    updateCommittee(updated);
    setAddingMeeting(null);
    setNewMeetingDate(undefined);
    setNewMeetingTime("");
    setNewMeetingTimeEnd("");
    setNewMeetingLink("");
    setNewMeetingInstitution("");
  };

  const handleDeleteMeeting = (c: Committee, meetingId: string) => {
    const updated = { ...c, meetings: (c.meetings || []).filter(m => m.id !== meetingId) };
    updateCommittee(updated);
  };

  const handleEditMeeting = (c: Committee, meetingId: string) => {
    const meeting = (c.meetings || []).find(m => m.id === meetingId);
    if (!meeting) return;
    setEditingMeeting({ committeeId: c.id, meetingId });
    setNewMeetingDate(new Date(meeting.date));
    setNewMeetingTime(meeting.time || "");
    setNewMeetingTimeEnd(meeting.time_end || "");
    setNewMeetingLink(meeting.link || "");
    setNewMeetingInstitution(meeting.institution || "");
  };

  const handleSaveEditMeeting = (c: Committee) => {
    if (!editingMeeting || !newMeetingDate) return;
    const updated = {
      ...c,
      meetings: (c.meetings || []).map(m =>
        m.id === editingMeeting.meetingId
          ? { ...m, date: newMeetingDate.toISOString(), time: newMeetingTime || undefined, time_end: newMeetingTimeEnd || undefined, link: newMeetingLink.trim(), ...(isSurveillanceFinanciere(c) ? { institution: newMeetingInstitution } : {}) }
          : m
      ),
    };
    updateCommittee(updated);
    setEditingMeeting(null);
    setNewMeetingDate(undefined);
    setNewMeetingTime("");
    setNewMeetingTimeEnd("");
    setNewMeetingLink("");
    setNewMeetingInstitution("");
  };

  // Filter committees: admins see all, others see only committees they're attached to
  const filteredCommittees = useMemo(() => {
    if (isAdmin) return committees;
    if (!user) return [];
    const currentProfile = profiles.find(p => p.user_id === user.id);
    const userName = currentProfile?.full_name || "";
    return committees.filter(c => {
      // Check responsibleIds
      const rIds: string[] = (c as any).responsibleIds || [];
      if (rIds.includes(user.id)) return true;
      // Check responsible name
      if (userName && c.responsible?.includes(userName)) return true;
      // Check members (by name or user_id)
      if (c.members?.some(m => m.name === userName || m.name === user.id)) return true;
      // Check guests (user_id format)
      if (c.guests?.some(g => g === user.id || (userName && g === userName))) return true;
      return false;
    });
  }, [isAdmin, committees, user, profiles]);

  useEffect(() => {
    if (isAdmin) { setCanCreateCommittees(true); return; }
    if (!user) return;
    const check = async () => {
      const { data } = await supabase.from("user_create_permissions" as any).select("can_create_committees").eq("user_id", user.id).maybeSingle();
      setCanCreateCommittees(!!(data as any)?.can_create_committees);
    };
    check();
  }, [user, isAdmin]);

  const handleAdd = () => {
    const newC: Committee = {
      id: `comite-${Date.now()}`,
      name: "Nouveau Comité",
      icon: "📋",
      purpose: "",
      responsible: "",
      frequency: "mensuel",
      linkedDepartmentIds: [],
      members: [],
    };
    addCommittee(newC);
    setEditing(newC);
  };

  const getDeptName = (id: string) => {
    const d = departments.find(dep => dep.id === id);
    return d ? `${d.icon} ${getDepartmentDisplayName(d)}` : id;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl">Comités</h2>
          <p className="text-sm text-muted-foreground">Instances de gouvernance et coordination</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <DataToolbar moduleType="comites" />}
          {canCreateCommittees && <ExportCommitteesPPTButton committees={committees} getDeptName={getDeptName} profileMap={profileMap} />}
          {canCreateCommittees && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleAdd}>
              <Plus className="w-3.5 h-3.5" /> Ajouter un comité
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filteredCommittees.map(c => (
          <div key={c.id} className="bg-card rounded-2xl border border-border shadow-card p-5 space-y-4 group relative">
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(c)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleting(c.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-2xl">{c.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-sm leading-tight">{c.name}</h3>
                {(c.institutions || []).length > 0 && (
                  <p className="text-[10px] font-semibold text-destructive mt-0.5">
                    Institutions Bancaires : {(c.institutions || []).join(" · ")}
                  </p>
                )}
                {c.responsible && (
                  <p className="text-xs text-primary font-medium mt-0.5">{c.responsible}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{c.purpose}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs gap-1">
                <Clock className="w-3 h-3" />
                {frequencyLabels[c.frequency]}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Users className="w-3 h-3" />
                {c.members.length} participant{c.members.length > 1 ? "s" : ""}
              </Badge>
            </div>

            {c.linkedDepartmentIds.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> Départements rattachés
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.linkedDepartmentIds.map(id => (
                    <Badge key={id} variant="outline" className="text-xs font-normal">
                      {getDeptName(id)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {c.members.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Participants</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.members.slice(0, 5).map((m, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {m.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span className="text-xs">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground">({m.role})</span>
                    </div>
                  ))}
                  {c.members.length > 5 && (
                    <span className="text-xs text-muted-foreground self-center">+{c.members.length - 5} autres</span>
                  )}
                </div>
              </div>
            )}

            {(c.guests || []).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Invités</p>
                <div className="flex flex-wrap gap-1.5">
                  {(c.guests || []).map((g, i) => {
                    const isExternal = g.startsWith("ext:");
                    const name = isExternal ? g.slice(4) : (profileMap[g] || g);
                    return (
                      <div key={i} className="flex items-center gap-1.5 bg-accent/5 rounded-full px-2.5 py-1">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isExternal ? "bg-secondary/20 text-secondary-foreground" : "bg-accent/10 text-accent"}`}>
                          {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-xs">{name}</span>
                        {isExternal && <span className="text-[9px] text-muted-foreground">(ext.)</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Réunions prévues */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 px-2 h-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setExpandedMeetings(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                >
                  <Video className="w-3 h-3" />
                  Réunions prévues ({(c.meetings || []).length})
                  {expandedMeetings[c.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </Button>
                {canManageMeetings(c) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] gap-1 h-6 px-2"
                    onClick={() => { setAddingMeeting(c.id); setNewMeetingDate(undefined); setNewMeetingLink(""); }}
                  >
                    <CalendarPlus className="w-3 h-3" /> Planifier
                  </Button>
                )}
              </div>

              {addingMeeting === c.id && (
                <div className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border">
                  <p className="text-xs font-medium">Nouvelle réunion</p>
                  <div className="flex flex-col gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("text-xs justify-start h-8", !newMeetingDate && "text-muted-foreground")}>
                          <Clock className="w-3 h-3 mr-1.5" />
                          {newMeetingDate ? format(newMeetingDate, "PPP", { locale: fr }) : "Choisir une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newMeetingDate}
                          onSelect={setNewMeetingDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      placeholder="Heure début"
                      value={newMeetingTime}
                      onChange={e => setNewMeetingTime(e.target.value)}
                      className="h-8 text-xs w-32"
                    />
                    <Input
                      type="time"
                      placeholder="Heure fin"
                      value={newMeetingTimeEnd}
                      onChange={e => setNewMeetingTimeEnd(e.target.value)}
                      className="h-8 text-xs w-32"
                    />
                    <Input
                      placeholder="Lien de connexion (ex: https://meet.google.com/...)"
                      value={newMeetingLink}
                      onChange={e => setNewMeetingLink(e.target.value)}
                      className="h-8 text-xs"
                    />
                    {isSurveillanceFinanciere(c) && (c.institutions || []).length > 0 && (
                      <Select value={newMeetingInstitution} onValueChange={setNewMeetingInstitution}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Choisir l'institution bancaire" />
                        </SelectTrigger>
                        <SelectContent>
                          {(c.institutions || []).map(inst => (
                            <SelectItem key={inst} value={inst} className="text-xs">{inst}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs h-7" onClick={() => handleAddMeeting(c)} disabled={!newMeetingDate}>
                        Ajouter
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setAddingMeeting(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {expandedMeetings[c.id] && (c.meetings || []).length > 0 && (
                <div className="space-y-1.5">
                  {(c.meetings || [])
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(m => (
                      editingMeeting?.committeeId === c.id && editingMeeting?.meetingId === m.id ? (
                        <div key={m.id} className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border">
                          <p className="text-xs font-medium">Modifier la réunion</p>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className={cn("text-xs justify-start h-8 w-full", !newMeetingDate && "text-muted-foreground")}>
                                <Clock className="w-3 h-3 mr-1.5" />
                                {newMeetingDate ? format(newMeetingDate, "PPP", { locale: fr }) : "Choisir une date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={newMeetingDate} onSelect={setNewMeetingDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                            </PopoverContent>
                          </Popover>
                          <Input type="time" value={newMeetingTime} onChange={e => setNewMeetingTime(e.target.value)} className="h-8 text-xs w-32" placeholder="Début" />
                          <Input type="time" value={newMeetingTimeEnd} onChange={e => setNewMeetingTimeEnd(e.target.value)} className="h-8 text-xs w-32" placeholder="Fin" />
                          <Input placeholder="Lien de connexion" value={newMeetingLink} onChange={e => setNewMeetingLink(e.target.value)} className="h-8 text-xs" />
                          {isSurveillanceFinanciere(c) && (c.institutions || []).length > 0 && (
                            <Select value={newMeetingInstitution} onValueChange={setNewMeetingInstitution}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Choisir l'institution bancaire" />
                              </SelectTrigger>
                              <SelectContent>
                                {(c.institutions || []).map(inst => (
                                  <SelectItem key={inst} value={inst} className="text-xs">{inst}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" className="text-xs h-7" onClick={() => handleSaveEditMeeting(c)} disabled={!newMeetingDate}>Enregistrer</Button>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setEditingMeeting(null); setNewMeetingDate(undefined); setNewMeetingLink(""); setNewMeetingTimeEnd(""); setNewMeetingInstitution(""); }}>Annuler</Button>
                          </div>
                        </div>
                      ) : (
                        <div key={m.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {format(new Date(m.date), "dd MMM yyyy", { locale: fr })}{m.time ? ` ${m.time}${m.time_end ? `-${m.time_end}` : ""}` : ""}
                            </Badge>
                            {m.institution && (
                              <Badge variant="secondary" className="text-[10px] font-normal">
                                🏦 {m.institution}
                              </Badge>
                            )}
                            {m.link && (
                              <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Rejoindre
                              </a>
                            )}
                          </div>
                          {canManageMeetings(c) && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleEditMeeting(c, m.id)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleDeleteMeeting(c, m.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    ))}
                </div>
              )}

              {expandedMeetings[c.id] && (c.meetings || []).length === 0 && (
                <p className="text-[10px] text-muted-foreground italic pl-2">Aucune réunion prévue</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditCommitteeDialog
          committee={editing}
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          onSave={(updated) => {
            updateCommittee(updated);
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce comité ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleting) deleteCommittee(deleting); setDeleting(null); }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommitteesView;
