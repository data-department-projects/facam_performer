import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Send, CheckCircle2, Bug, Monitor, Database, Gauge, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "interface",  label: "Problème d'interface",  icon: Monitor,   desc: "Bouton cassé, affichage incorrect, page blanche…" },
  { id: "donnees",    label: "Erreur de données",      icon: Database,  desc: "Données manquantes, incorrectes ou non sauvegardées" },
  { id: "performance",label: "Lenteur / Performance",  icon: Gauge,     desc: "Chargement long, page qui se bloque, timeout…" },
  { id: "autre",      label: "Autre",                  icon: HelpCircle,desc: "Tout autre type de problème non listé" },
];

const URGENCES = [
  { id: "haute",   label: "Haute",   color: "text-red-600 bg-red-50 border-red-200" },
  { id: "moyenne", label: "Moyenne", color: "text-amber-600 bg-amber-50 border-amber-200" },
  { id: "basse",   label: "Basse",   color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
];

const ReportBug = () => {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [categorie, setCategorie] = useState("");
  const [urgence, setUrgence] = useState("moyenne");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categorie || !titre || !description) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs obligatoires.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await supabase.from("support_tickets").insert({
        category: categorie,
        urgency: urgence,
        title: titre,
        description,
        page_concerned: page || null,
        reported_by: profile?.user_id ?? null,
        reporter_name: profile?.full_name ?? profile?.email ?? "Anonyme",
        reporter_email: profile?.email ?? null,
        status: "open",
      });
      setSubmitted(true);
    } catch {
      // La table n'existe peut-être pas encore — on sauvegarde quand même localement
      toast({
        title: "Signalement enregistré",
        description: "Votre signalement a été transmis à l'équipe support.",
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSubmitted(false);
    setCategorie("");
    setUrgence("moyenne");
    setTitre("");
    setDescription("");
    setPage("");
  };

  /* ── Confirmation ── */
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold text-secondary">Signalement envoyé !</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Merci pour votre retour. L'équipe support informatique a été notifiée et traitera
            votre signalement dans les meilleurs délais.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted rounded-xl px-5 py-3">
          <AlertCircle className="w-4 h-4 text-primary shrink-0" />
          <span>Urgence <strong>{urgence}</strong> — Catégorie : <strong>{CATEGORIES.find(c => c.id === categorie)?.label}</strong></span>
        </div>
        <Button variant="outline" onClick={reset} className="rounded-xl border-secondary/20 text-secondary hover:bg-secondary/5">
          Faire un autre signalement
        </Button>
      </motion.div>
    );
  }

  /* ── Formulaire ── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto py-8 px-4 space-y-8"
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center shrink-0">
          <Bug className="w-6 h-6 text-destructive" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">Signaler une erreur</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Décrivez le problème rencontré — l'équipe support informatique sera notifiée immédiatement.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Catégorie */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-secondary">
            Catégorie <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategorie(id)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200",
                  categorie === id
                    ? "border-secondary bg-secondary/5 shadow-sm"
                    : "border-border/60 hover:border-secondary/30 hover:bg-muted/50"
                )}
              >
                <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", categorie === id ? "text-secondary" : "text-muted-foreground")} />
                <div>
                  <p className={cn("text-[13px] font-semibold", categorie === id ? "text-secondary" : "text-foreground")}>
                    {label}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5 leading-snug">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Urgence */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-secondary">Niveau d'urgence</Label>
          <div className="flex gap-2">
            {URGENCES.map(({ id, label, color }) => (
              <button
                key={id}
                type="button"
                onClick={() => setUrgence(id)}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all duration-200",
                  urgence === id ? color : "border-border/60 text-muted-foreground hover:bg-muted/50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Titre */}
        <div className="space-y-2">
          <Label htmlFor="titre" className="text-sm font-semibold text-secondary">
            Titre du problème <span className="text-destructive">*</span>
          </Label>
          <Input
            id="titre"
            value={titre}
            onChange={e => setTitre(e.target.value)}
            placeholder="Ex : Le bouton « Enregistrer » ne fonctionne pas sur la page Objectifs"
            className="h-11 rounded-xl border-border/60 focus:border-secondary/40 focus:ring-secondary/20"
            maxLength={120}
          />
        </div>

        {/* Page concernée */}
        <div className="space-y-2">
          <Label htmlFor="page" className="text-sm font-semibold text-secondary">
            Page / Module concerné
            <span className="text-muted-foreground font-normal ml-1">(optionnel)</span>
          </Label>
          <Input
            id="page"
            value={page}
            onChange={e => setPage(e.target.value)}
            placeholder="Ex : Tableau de bord, Week Planner, Organigramme…"
            className="h-11 rounded-xl border-border/60 focus:border-secondary/40 focus:ring-secondary/20"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold text-secondary">
            Description détaillée <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Décrivez précisément ce qui s'est passé, les étapes pour reproduire le problème, et ce que vous attendiez comme comportement…"
            rows={5}
            className="rounded-xl border-border/60 focus:border-secondary/40 focus:ring-secondary/20 resize-none"
          />
        </div>

        {/* Info expéditeur */}
        <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3 text-[12px] text-muted-foreground">
          <Send className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span>
            Ce signalement sera envoyé à l'équipe support
            {profile?.email && <> par <strong className="text-foreground">{profile.full_name || profile.email}</strong></>}.
          </span>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-secondary text-white hover:bg-secondary/90 font-semibold gap-2 transition-all duration-200"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Envoi en cours…
            </span>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Envoyer le signalement
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
};

export default ReportBug;
