import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { getDepartmentDisplayName } from "@/data/departments";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, Plus, Trash2, Calendar, Send } from "lucide-react";
import DataToolbar from "@/components/DataToolbar";

type ReportType = "weekly" | "monthly" | "semiannual";

interface Report {
  id: string;
  user_id: string;
  department_id: string;
  report_type: ReportType;
  title: string;
  content: string;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

const REPORT_LABELS: Record<ReportType, string> = {
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  semiannual: "Semestriel",
};

const REPORT_COLORS: Record<ReportType, string> = {
  weekly: "bg-blue-100 text-blue-800",
  monthly: "bg-orange-100 text-orange-800",
  semiannual: "bg-purple-100 text-purple-800",
};

const ReportsView = () => {
  const { user, profile, isAdmin } = useAuth();
  const { departments } = useDepartments();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportType>("weekly");

  // Form state
  const [formType, setFormType] = useState<ReportType>("weekly");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formDeptId, setFormDeptId] = useState(profile?.department_id || "");
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [formPeriodEnd, setFormPeriodEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger les rapports", variant: "destructive" });
    } else {
      setReports((data as Report[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!user || !formTitle.trim() || !formContent.trim() || !formPeriodStart || !formPeriodEnd || !formDeptId) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      user_id: user.id,
      department_id: formDeptId,
      report_type: formType,
      title: formTitle.trim(),
      content: formContent.trim(),
      period_start: formPeriodStart,
      period_end: formPeriodEnd,
    });

    if (error) {
      toast({ title: "Erreur", description: "Impossible de soumettre le rapport", variant: "destructive" });
    } else {
      toast({ title: "Rapport déposé", description: "Votre rapport a été enregistré avec succès" });
      setShowForm(false);
      setFormTitle("");
      setFormContent("");
      setFormPeriodStart("");
      setFormPeriodEnd("");
      fetchReports();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    } else {
      setReports(prev => prev.filter(r => r.id !== id));
      toast({ title: "Supprimé", description: "Le rapport a été supprimé" });
    }
  };

  const getDeptName = (id: string) => { const d = departments.find(dep => dep.id === id); return d ? getDepartmentDisplayName(d) : id; };
  const getDeptIcon = (id: string) => departments.find(d => d.id === id)?.icon || "📄";

  const filteredReports = reports.filter(r => r.report_type === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl">Rapports d'activité</h2>
          <p className="text-sm text-muted-foreground">
            Déposez vos rapports hebdomadaires, mensuels et semestriels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataToolbar moduleType="reports" />
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Nouveau rapport
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4" />
              Déposer un rapport
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Type de rapport</label>
                <Select value={formType} onValueChange={(v) => setFormType(v as ReportType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    <SelectItem value="monthly">Mensuel</SelectItem>
                    <SelectItem value="semiannual">Semestriel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Département</label>
                <Select value={formDeptId} onValueChange={setFormDeptId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.icon} {d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Titre</label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Titre du rapport..." />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Début de période</label>
                <Input type="date" value={formPeriodStart} onChange={e => setFormPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Fin de période</label>
                <Input type="date" value={formPeriodEnd} onChange={e => setFormPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Contenu du rapport</label>
              <Textarea
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                placeholder="Rédigez votre rapport ici..."
                className="min-h-[200px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Envoi..." : "Soumettre le rapport"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
        <TabsList>
          <TabsTrigger value="weekly" className="gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Hebdomadaire
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Mensuel
          </TabsTrigger>
          <TabsTrigger value="semiannual" className="gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Semestriel
          </TabsTrigger>
        </TabsList>

        {(["weekly", "monthly", "semiannual"] as ReportType[]).map(type => (
          <TabsContent key={type} value={type}>
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Chargement...</p>
            ) : filteredReports.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucun rapport {REPORT_LABELS[type].toLowerCase()} déposé</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredReports.map(report => (
                  <Card key={report.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg">{getDeptIcon(report.department_id)}</span>
                            <h3 className="font-semibold text-sm">{report.title}</h3>
                            <Badge variant="secondary" className={REPORT_COLORS[report.report_type]}>
                              {REPORT_LABELS[report.report_type]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {getDeptName(report.department_id)} • Période : {format(new Date(report.period_start), "dd MMM yyyy", { locale: fr })} — {format(new Date(report.period_end), "dd MMM yyyy", { locale: fr })}
                          </p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.content}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Déposé le {format(new Date(report.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                          </p>
                        </div>
                        {(report.user_id === user?.id || isAdmin) && (
                          <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => handleDelete(report.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ReportsView;
