import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useProfiles } from "@/hooks/useProfiles";
import { Copy, Mail, Send, MessageSquare, Pencil, RotateCcw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TemplateKey = "invitation" | "password_change" | "account_restriction" | "task_reminder";

interface Template {
  key: TemplateKey;
  label: string;
  icon: string;
  subject: string;
  body: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    key: "invitation",
    label: "Invitation de connexion",
    icon: "📩",
    subject: "Vos identifiants de connexion - FACAM STRAT MANAGEMENT",
    body: `Bonjour {{nom}},

Bienvenue sur la plateforme FACAM STRAT MANAGEMENT.

Voici vos identifiants de connexion :
📧 Email : {{email}}
🔑 Mot de passe : {{mot_de_passe}}
🔗 URL : {{url}}

⚠️ Merci de changer votre mot de passe après votre première connexion.

Cordialement,
L'équipe FACAM`,
  },
  {
    key: "password_change",
    label: "Changement de mot de passe",
    icon: "🔑",
    subject: "Nouveau mot de passe - FACAM STRAT MANAGEMENT",
    body: `Bonjour {{nom}},

Votre mot de passe a été réinitialisé.

Nouveau mot de passe : {{mot_de_passe}}
🔗 URL : {{url}}

Merci de le changer dès votre prochaine connexion.

Cordialement,
L'équipe FACAM`,
  },
  {
    key: "account_restriction",
    label: "Restriction du compte",
    icon: "🚫",
    subject: "Compte désactivé - FACAM STRAT MANAGEMENT",
    body: `Bonjour {{nom}},

Votre compte sur la plateforme FACAM STRAT MANAGEMENT a été temporairement désactivé.

Si vous pensez qu'il s'agit d'une erreur, veuillez contacter votre administrateur.

Cordialement,
L'équipe FACAM`,
  },
  {
    key: "task_reminder",
    label: "Rappel saisie des tâches",
    icon: "⏰",
    subject: "Rappel : Saisie de vos tâches hebdomadaires - FACAM STRAT MANAGEMENT",
    body: `Bonjour {{nom}},

Ceci est un rappel pour vous inviter à saisir vos tâches et livrables de la semaine sur la plateforme FACAM STRAT MANAGEMENT.

🔗 URL : {{url}}

Merci de compléter votre planning hebdomadaire avant la fin de la semaine.

Cordialement,
L'équipe FACAM`,
  },
];

const STORAGE_KEY = "admin_message_templates";

const loadTemplates = (): Template[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_TEMPLATES;
};

const AdminMessaging = () => {
  const { toast } = useToast();
  const profiles = useProfiles();
  const [templates, setTemplates] = useState<Template[]>(loadTemplates);
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>("invitation");
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<string>("all");
  const [sending, setSending] = useState(false);

  const current = templates.find((t) => t.key === activeTemplate)!;

  const startEdit = () => {
    setEditSubject(current.subject);
    setEditBody(current.body);
    setEditing(true);
  };

  const saveEdit = () => {
    const updated = templates.map((t) =>
      t.key === activeTemplate ? { ...t, subject: editSubject, body: editBody } : t
    );
    setTemplates(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setEditing(false);
    toast({ title: "Modèle sauvegardé ✓" });
  };

  const resetTemplate = () => {
    const def = DEFAULT_TEMPLATES.find((t) => t.key === activeTemplate)!;
    const updated = templates.map((t) => (t.key === activeTemplate ? { ...def } : t));
    setTemplates(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setEditing(false);
    toast({ title: "Modèle réinitialisé ✓" });
  };

  const fillTemplate = (template: string, profile: { full_name: string; email: string }) => {
    return template
      .replace(/\{\{nom\}\}/g, profile.full_name)
      .replace(/\{\{email\}\}/g, profile.email)
      .replace(/\{\{url\}\}/g, window.location.origin)
      .replace(/\{\{mot_de_passe\}\}/g, "[mot de passe]");
  };

  const copyMessage = () => {
    const recipients =
      selectedRecipient === "all"
        ? profiles
        : profiles.filter((p) => p.user_id === selectedRecipient);

    if (recipients.length === 0) {
      toast({ title: "Aucun destinataire sélectionné", variant: "destructive" });
      return;
    }

    const firstRecipient = recipients[0];
    const filled = fillTemplate(current.body, firstRecipient);
    const subject = fillTemplate(current.subject, firstRecipient);

    navigator.clipboard.writeText(`Objet: ${subject}\n\n${filled}`);
    toast({ title: "Message copié dans le presse-papier ✓" });
  };

  const sendEmail = async () => {
    const recipients =
      selectedRecipient === "all"
        ? profiles
        : profiles.filter((p) => p.user_id === selectedRecipient);

    if (recipients.length === 0) {
      toast({ title: "Aucun destinataire", variant: "destructive" });
      return;
    }

    setSending(true);
    let successCount = 0;
    let errorCount = 0;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Session expirée", description: "Veuillez vous reconnecter.", variant: "destructive" });
      setSending(false);
      return;
    }

    for (const recipient of recipients) {
      const filledBody = fillTemplate(current.body, recipient);
      const filledSubject = fillTemplate(current.subject, recipient);

      try {
        const resp = await fetch("/api/send-admin-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ to: recipient.email, subject: filledSubject, body: filledBody }),
        });
        if (!resp.ok) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setSending(false);
    if (successCount > 0) {
      toast({ title: `${successCount} email(s) envoyé(s) ✓` });
    }
    if (errorCount > 0) {
      toast({
        title: `${errorCount} erreur(s) d'envoi`,
        description: "La fonctionnalité d'envoi par email nécessite une configuration supplémentaire.",
        variant: "destructive",
      });
    }
  };

  const variables = [
    { var: "{{nom}}", desc: "Nom complet" },
    { var: "{{email}}", desc: "Email" },
    { var: "{{mot_de_passe}}", desc: "Mot de passe" },
    { var: "{{url}}", desc: "URL de l'app" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Messagerie & Modèles</h3>
      </div>

      {/* Template selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {templates.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActiveTemplate(t.key);
              setEditing(false);
            }}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
              activeTemplate === t.key
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <span className="text-lg">{t.icon}</span>
            <span className="text-[11px] font-medium leading-tight">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Template editor/preview */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              {current.icon} {current.label}
            </CardTitle>
            <div className="flex gap-1">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={resetTemplate}>
                    <RotateCcw className="w-3 h-3" /> Réinitialiser
                  </Button>
                  <Button size="sm" className="h-7 text-[10px] gap-1" onClick={saveEdit}>
                    <Save className="w-3 h-3" /> Sauvegarder
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={startEdit}>
                  <Pencil className="w-3 h-3" /> Modifier
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {editing ? (
              <>
                <div className="space-y-1">
                  <Label className="text-[10px]">Objet</Label>
                  <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Corps du message</Label>
                  <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="min-h-[200px] text-xs font-mono" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <Badge key={v.var} variant="outline" className="text-[9px] cursor-pointer" onClick={() => setEditBody((b) => b + v.var)}>
                      {v.var} = {v.desc}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground">Objet : {current.subject}</p>
                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground">{current.body}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Send panel */}
        <Card className="border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs font-semibold flex items-center gap-2">
              <Send className="w-3.5 h-3.5" /> Envoyer
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Destinataire(s)</Label>
              <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Tous les collaborateurs ({profiles.length})</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview for selected recipient */}
            {selectedRecipient !== "all" && (
              <div className="bg-muted/30 rounded-md p-2.5">
                <p className="text-[10px] text-muted-foreground mb-1">Aperçu :</p>
                <p className="text-[10px] font-medium">
                  {fillTemplate(current.subject, profiles.find((p) => p.user_id === selectedRecipient) || { full_name: "—", email: "—" })}
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={copyMessage}>
                <Copy className="w-3 h-3" /> Copier le message
              </Button>
              <Button size="sm" className="w-full text-xs gap-1.5" onClick={sendEmail} disabled={sending}>
                <Mail className="w-3 h-3" /> {sending ? "Envoi en cours..." : "Envoyer par email"}
              </Button>
            </div>

            <p className="text-[9px] text-muted-foreground italic">
              L'envoi par email nécessite la configuration d'un service email.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMessaging;
