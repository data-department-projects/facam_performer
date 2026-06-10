import { useAuth } from "@/contexts/AuthContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import UserGuideExport from "@/components/UserGuideExport";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Network, GanttChart, FolderKanban,
  Clock, Target, Building2, BookOpen, ArrowRight, CheckCircle2,
  AlertCircle, Users, FileText, CalendarDays, Settings, type LucideIcon
} from "lucide-react";

interface ManualSection {
  id: string;
  title: string;
  icon: LucideIcon;
  badge?: string;
  managerOnly?: boolean;
  adminOnly?: boolean;
  content: React.ReactNode;
}

const UserManual = () => {
  const { profile, isAdmin, allowedModules } = useAuth();
  const isManager = profile?.is_manager ?? false;

  const hasModuleAccess = (moduleId: string) => {
    if (isAdmin) return true;
    return allowedModules.includes(moduleId);
  };

  const sections: ManualSection[] = [
    {
      id: "dashboard",
      title: "Tableau de bord",
      icon: BarChart3,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Le <strong className="text-foreground">Tableau de bord</strong> est votre page d'accueil personnalisée. Il affiche en un coup d'œil :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Votre <strong className="text-foreground">département</strong> et votre rattachement hiérarchique</li>
            <li>Le nombre de <strong className="text-foreground">projets</strong> et <strong className="text-foreground">comités</strong> auxquels vous participez</li>
            <li>Les <strong className="text-foreground">jalons en retard</strong> ou à venir</li>
            <li>Votre <strong className="text-foreground">progression globale</strong> sur les missions actives</li>
          </ul>
          {isManager && (
            <div className="mt-3 p-3 rounded-lg bg-accent/50 border border-accent">
              <p className="flex items-center gap-2 font-medium text-foreground mb-1.5">
                <Users className="w-4 h-4 text-primary" /> Vue Manager
              </p>
              <p>En tant que manager, votre tableau de bord inclut également les indicateurs de votre <strong className="text-foreground">équipe</strong> (subordonnés directs) : projets, comités, livrables en retard et progression de chaque membre.</p>
            </div>
          )}
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <p>Cliquez sur <strong className="text-foreground">"Voir détail"</strong> sur chaque KPI pour déplier les listes détaillées.</p>
          </div>
        </div>
      ),
    },
    {
      id: "orgchart",
      title: "Organigramme",
      icon: Network,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>L'<strong className="text-foreground">Organigramme</strong> présente la structure complète de l'organisation :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Le <strong className="text-foreground">Directeur Général</strong> en tête, suivi de tous les départements</li>
            <li>Chaque département affiche son <strong className="text-foreground">responsable</strong>, sa <strong className="text-foreground">mission</strong> et ses <strong className="text-foreground">services rattachés</strong></li>
            <li>Les <strong className="text-foreground">collaborateurs</strong> sont listés par service sous chaque département</li>
          </ul>
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-muted/50">
            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <p>L'organigramme est en <strong className="text-foreground">lecture seule</strong> pour les collaborateurs. Toute modification passe par l'administration.</p>
          </div>
        </div>
      ),
    },
    {
      id: "gantt",
      title: "Planification (Gantt)",
      icon: GanttChart,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>La vue <strong className="text-foreground">Planification</strong> affiche un diagramme de Gantt interactif montrant :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Tous les <strong className="text-foreground">projets</strong> avec leurs jalons positionnés sur un calendrier 2026–2027</li>
            <li>Les <strong className="text-foreground">responsables</strong> de chaque mission</li>
            <li>Les <strong className="text-foreground">dates de début et fin</strong> prévues</li>
            <li>L'<strong className="text-foreground">avancement</strong> en pourcentage de chaque jalon</li>
          </ul>
          <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2">
            <p className="flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary shrink-0" /> Cliquez sur un projet pour naviguer directement vers sa fiche détaillée dans <strong className="text-foreground">Projets & Comités</strong>.</p>
          </div>
        </div>
      ),
    },
    {
      id: "projectscomites",
      title: "Projets & Comités",
      icon: FolderKanban,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Ce module centralise la gestion de vos <strong className="text-foreground">projets</strong> et <strong className="text-foreground">comités</strong> :</p>
          
          <h4 className="font-semibold text-foreground mt-4 flex items-center gap-2"><FileText className="w-4 h-4" /> Projets</h4>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Consultez les <strong className="text-foreground">objectifs</strong>, <strong className="text-foreground">départements impliqués</strong> et <strong className="text-foreground">responsables</strong></li>
            <li>Suivez les <strong className="text-foreground">jalons</strong> (milestones) avec leurs échéances et livrables</li>
            <li>Déposez des <strong className="text-foreground">livrables</strong> pour chaque jalon dont vous êtes responsable</li>
          </ul>

          <h4 className="font-semibold text-foreground mt-4 flex items-center gap-2"><Users className="w-4 h-4" /> Comités</h4>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Visualisez les <strong className="text-foreground">membres</strong>, <strong className="text-foreground">fréquence</strong> et <strong className="text-foreground">objectifs</strong> de chaque comité</li>
            <li>Accédez aux comptes rendus et décisions</li>
          </ul>

          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-accent/50 border border-accent">
            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">Modifications verrouillées</p>
              <p>Si vous n'êtes pas chef de projet, vos modifications passent par une <strong className="text-foreground">demande de modification</strong> soumise à validation par l'administrateur.</p>
            </div>
          </div>
        </div>
      ),
    },


    {
      id: "timeentry",
      title: "Week Planner (Saisie du temps)",
      icon: Clock,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Le <strong className="text-foreground">Week Planner</strong> est votre outil de planification hebdomadaire. Le planning doit être complété <strong className="text-foreground">au plus tard le vendredi de la semaine précédente</strong> pour la semaine suivante :</p>
          
          <h4 className="font-semibold text-foreground mt-4 flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Processus hebdomadaire
          </h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong className="text-foreground">Planifiez vos tâches</strong> — Ajoutez vos tâches pour chaque jour de la semaine (lundi à vendredi)
            </li>
            <li>
              <strong className="text-foreground">Associez des livrables</strong> — Liez optionnellement une tâche à un livrable de projet
            </li>
            <li>
              <strong className="text-foreground">Cochez les tâches terminées</strong> — Marquez vos tâches au fur et à mesure
            </li>
            <li>
              <strong className="text-foreground">Soumettez avant vendredi 16h00</strong> — Votre planning doit être soumis pour validation
            </li>
            <li>
              <strong className="text-foreground">Saisissez vos heures</strong> — Enregistrez le temps passé par activité (projet/comité)
            </li>
          </ol>

          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-accent/50 border border-accent">
            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">Échéances importantes</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong className="text-foreground">Vendredi 16h00</strong> : Date limite de soumission du planning</li>
                <li><strong className="text-foreground">Vendredi 18h30</strong> : Date limite de validation par le manager</li>
              </ul>
            </div>
          </div>

          {isManager && (
            <div className="mt-3 p-3 rounded-lg bg-accent/50 border border-accent">
              <p className="flex items-center gap-2 font-medium text-foreground mb-1.5">
                <Users className="w-4 h-4 text-primary" /> Validation Manager
              </p>
              <p>Vous recevez les plannings soumis par vos subordonnés. Vous pouvez :</p>
              <ul className="list-disc pl-5 mt-1.5 space-y-1">
                <li><strong className="text-foreground text-green-700">Valider</strong> le planning du collaborateur</li>
                <li><strong className="text-foreground text-red-700">Rejeter</strong> avec un commentaire explicatif</li>
              </ul>
              <p className="mt-2">Un <strong className="text-foreground">historique d'audit</strong> trace toutes les actions de validation/rejet.</p>
            </div>
          )}

          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <p>Une fois validé, le planning est <strong className="text-foreground">verrouillé</strong> : les tâches ne peuvent plus être supprimées ou décochées, mais vous pouvez en ajouter de nouvelles.</p>
          </div>
        </div>
      ),
    },
    {
      id: "hrperformance",
      title: "Gestion des Objectifs individuels",
      icon: Target,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Ce module gère le <strong className="text-foreground">cycle de vie complet</strong> de vos objectifs annuels :</p>
          
          <h4 className="font-semibold text-foreground mt-4">Cycle de vie d'un objectif</h4>
          <div className="flex flex-wrap gap-2 mt-2">
            {["Brouillon", "En attente de validation", "Validé", "Revue S1", "Évaluation S2", "Complété"].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">{s}</Badge>
                {i < 5 && <ArrowRight className="w-3 h-3 text-muted-foreground/50" />}
              </div>
            ))}
          </div>

          <h4 className="font-semibold text-foreground mt-4">Pour les collaborateurs</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li><strong className="text-foreground">Créez</strong> vos objectifs (titre, description, catégorie, KPI, échéance)</li>
            <li><strong className="text-foreground">Soumettez</strong> pour validation par votre manager</li>
            <li>Après validation, participez aux <strong className="text-foreground">revues semestrielles</strong> (S1 et S2)</li>
            <li>Demandez des <strong className="text-foreground">modifications</strong> sur un objectif validé via le circuit de demande de changement</li>
          </ol>

          {isManager && (
            <>
              <h4 className="font-semibold text-foreground mt-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Pour les managers
              </h4>
              <ol className="list-decimal pl-5 space-y-2">
                <li><strong className="text-foreground">Créez des objectifs</strong> pour vos subordonnés</li>
                <li><strong className="text-foreground">Validez</strong> les objectifs soumis par votre équipe</li>
                <li>Effectuez les <strong className="text-foreground">revues S1</strong> (semestrielle) avec pourcentage d'atteinte et commentaire</li>
                <li>Réalisez l'<strong className="text-foreground">évaluation S2</strong> (finale) avec bonus éventuel</li>
                <li>Gérez les <strong className="text-foreground">demandes de modification</strong> de vos subordonnés</li>
                <li>Pilotez le <strong className="text-foreground">budget bonus</strong> alloué à votre équipe</li>
              </ol>

              <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-accent/50 border border-accent">
                <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground mb-1">Circuit de modification</p>
                  <p>Les demandes de modification suivent le circuit : <strong className="text-foreground">Collaborateur → Manager → DG</strong>. Vous voyez les demandes de vos subordonnés et pouvez les approuver ou rejeter avec un commentaire.</p>
                </div>
              </div>
            </>
          )}

          {!isManager && (
            <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-accent/50 border border-accent">
              <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground mb-1">Demandes de modification</p>
                <p>Pour modifier un objectif déjà validé, soumettez une <strong className="text-foreground">demande de changement</strong>. Celle-ci sera examinée par votre manager puis par le DG. Vous serez notifié du résultat via des badges et tooltips.</p>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "dept_objectives",
      title: "Objectifs Départementaux",
      icon: Building2,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Ce module permet de suivre les <strong className="text-foreground">objectifs stratégiques</strong> de chaque département :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Consultez les objectifs groupés par <strong className="text-foreground">département</strong> et par <strong className="text-foreground">année</strong></li>
            <li>Suivez l'<strong className="text-foreground">avancement</strong> et les <strong className="text-foreground">KPIs</strong> associés à chaque objectif</li>
            <li>Visualisez les statistiques globales (objectifs en cours, validés, complétés)</li>
          </ul>

          {isManager && (
            <div className="mt-3 p-3 rounded-lg bg-accent/50 border border-accent">
              <p className="flex items-center gap-2 font-medium text-foreground mb-1.5">
                <Users className="w-4 h-4 text-primary" /> Responsable de département
              </p>
              <p>Si vous êtes responsable d'un département, vous pouvez :</p>
              <ul className="list-disc pl-5 mt-1.5 space-y-1">
                <li><strong className="text-foreground">Créer</strong> et <strong className="text-foreground">modifier</strong> les objectifs de votre département</li>
                <li>Définir des <strong className="text-foreground">KPIs</strong> (indicateurs) avec valeurs cibles et réalisées</li>
                <li>Effectuer les <strong className="text-foreground">revues semestrielles</strong> et <strong className="text-foreground">évaluations finales</strong></li>
              </ul>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "admin",
      title: "Administration",
      icon: Building2,
      adminOnly: true,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Le module <strong className="text-foreground">Administration</strong> centralise la gestion globale de la plateforme :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Gérez les <strong className="text-foreground">utilisateurs</strong> : création, modification, blocage et attribution des rôles</li>
            <li>Configurez les <strong className="text-foreground">permissions par module</strong> pour chaque collaborateur</li>
            <li>Suivez les <strong className="text-foreground">demandes de modification</strong> soumises par les collaborateurs</li>
            <li>Consultez le <strong className="text-foreground">journal d'audit</strong> de toutes les actions utilisateurs</li>
            <li>Gérez les <strong className="text-foreground">campagnes d'animation</strong>, la messagerie et la configuration globale</li>
            <li>Accédez aux <strong className="text-foreground">coûts des projets</strong> et à l'<strong className="text-foreground">analyse hebdomadaire IA</strong></li>
            <li>Visualisez les <strong className="text-foreground">violations de sécurité</strong> détectées</li>
          </ul>
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-accent/50 border border-accent">
            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <p>Ce module est réservé aux <strong className="text-foreground">administrateurs</strong>. Toutes les actions sont tracées dans le journal d'audit.</p>
          </div>
        </div>
      ),
    },
    {
      id: "etpadmin",
      title: "Suivi ETP",
      icon: BarChart3,
      adminOnly: true,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Le module <strong className="text-foreground">Suivi ETP</strong> permet d'analyser la répartition du temps de travail :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Visualisez la <strong className="text-foreground">répartition du temps</strong> par collaborateur, projet et comité</li>
            <li>Suivez les <strong className="text-foreground">heures saisies</strong> vs les heures prévues</li>
            <li>Analysez les <strong className="text-foreground">tendances</strong> de charge de travail par département</li>
            <li>Exportez les <strong className="text-foreground">rapports</strong> de suivi ETP</li>
          </ul>
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <p>Les données se basent sur les saisies de temps validées par les managers.</p>
          </div>
        </div>
      ),
    },
    {
      id: "badgemanagement",
      title: "Gestion de temps",
      icon: Clock,
      adminOnly: true,
      content: (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Le module <strong className="text-foreground">Gestion de temps</strong> permet de suivre les pointages quotidiens :</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Consultez les <strong className="text-foreground">4 pointages journaliers</strong> (entrée matin, sortie midi, entrée après-midi, sortie soir)</li>
            <li>Visualisez l'<strong className="text-foreground">historique</strong> des pointages par jour et par semaine</li>
            <li>Vérifiez la <strong className="text-foreground">cohérence</strong> entre les pointages et les saisies de temps</li>
          </ul>
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-muted/50">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <p>Les données de badge sont importées par l'administration.</p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-card to-accent/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              
              <CardDescription className="text-base mt-1">
                Bienvenue <strong className="text-primary">{profile?.full_name || "Collaborateur"}</strong> — 
                {isManager
                  ? " Voici le guide complet adapté à votre rôle de manager."
                  : " Voici le guide des fonctionnalités à votre disposition."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {isManager ? "👔 Manager" : "👤 Collaborateur"}
            </Badge>
          <Badge variant="outline" className="text-xs">
              {sections.filter((s) => (!s.managerOnly || isManager) && (!s.adminOnly || isAdmin) && hasModuleAccess(s.id)).length} modules documentés
            </Badge>
            <div className="ml-auto">
              <UserGuideExport />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accordion sections */}
      <Accordion type="multiple" className="space-y-2">
        {sections
          .filter((s) => (!s.managerOnly || isManager) && (!s.adminOnly || isAdmin) && hasModuleAccess(s.id))
          .map((section) => {
            const Icon = section.icon;
            return (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="border rounded-lg px-4 bg-card shadow-sm"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-semibold text-foreground">{section.title}</span>
                    {section.badge && (
                      <Badge variant="secondary" className="text-[10px] ml-1">{section.badge}</Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  {section.content}
                </AccordionContent>
              </AccordionItem>
            );
          })}
      </Accordion>

    </div>
  );
};

export default UserManual;
