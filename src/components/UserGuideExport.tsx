
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const GOLD = "#ffae03";
const GOLD_LIGHT = "#ffc247";
const NAVY = "#001b61";
const NAVY_LIGHT = "#002a6e";
const CREAM = "#f0f4fa";

const LOGO_URL = `${window.location.origin}/facam_stairway-bleu.png`;

interface GuideSection {
  title: string;
  icon: string;
  moduleId: string;
  description: string;
  steps: string[];
  tips?: string[];
  managerNote?: string;
  adminOnly?: boolean;
}

const allGuideContent: GuideSection[] = [
  {
    title: "Tableau de bord",
    icon: "📊",
    moduleId: "dashboard",
    description: "Votre page d'accueil personnalisée affichant vos indicateurs clés de performance (KPIs). C'est le point central de votre activité quotidienne.",
    steps: [
      "Consultez votre département et votre rattachement hiérarchique en haut du tableau de bord",
      "Suivez le nombre de projets et comités auxquels vous participez via les cartes KPI",
      "Identifiez les jalons en retard ou à venir grâce aux indicateurs visuels colorés",
      "Visualisez votre progression globale sur les missions actives avec les barres de progression",
      "Cliquez sur « Voir détail » sur chaque KPI pour déplier les listes détaillées",
    ],
    tips: [
      "Les cartes KPI changent de couleur selon l'urgence : vert (ok), orange (attention), rouge (retard)",
      "Actualisez régulièrement votre tableau de bord pour avoir les données les plus récentes",
    ],
    managerNote: "En tant que manager, votre tableau de bord inclut également les indicateurs de votre équipe : nombre de projets, comités, livrables en retard et progression de chaque membre.",
  },
  {
    title: "Organigramme",
    icon: "🏢",
    moduleId: "orgchart",
    description: "Visualisez la structure complète de l'organisation en un coup d'œil. L'organigramme présente la hiérarchie de manière interactive et claire.",
    steps: [
      "Consultez la hiérarchie depuis le Directeur Général jusqu'aux collaborateurs de chaque service",
      "Identifiez le responsable, la mission et les services rattachés à chaque département",
      "Retrouvez rapidement un collaborateur en naviguant par service ou département",
      "Visualisez les liens de rattachement hiérarchique entre les différentes entités",
    ],
    tips: [
      "L'organigramme est en lecture seule — toute modification de la structure passe par l'administration",
    ],
  },
  {
    title: "Planification (Gantt)",
    icon: "📅",
    moduleId: "gantt",
    description: "Diagramme de Gantt interactif pour visualiser l'avancement de tous les projets sur un calendrier annuel.",
    steps: [
      "Visualisez tous les projets avec leurs jalons positionnés sur un calendrier annuel",
      "Identifiez les responsables de chaque mission et les départements impliqués",
      "Suivez les dates de début et fin prévues pour chaque jalon avec les barres colorées",
      "Consultez l'avancement en pourcentage de chaque jalon directement sur le diagramme",
      "Cliquez sur un projet pour naviguer directement vers sa fiche détaillée",
    ],
    tips: [
      "Les barres du Gantt sont colorées selon l'avancement : identifiez rapidement les retards",
    ],
  },
  {
    title: "Projets & Comités",
    icon: "📁",
    moduleId: "projectscomites",
    description: "Centralisez la gestion de vos projets et comités de gouvernance. Chaque projet contient ses objectifs, jalons, livrables et équipe dédiée.",
    steps: [
      "Consultez les objectifs, départements impliqués et responsables de chaque projet",
      "Suivez les jalons (milestones) avec leurs échéances, livrables attendus et statut",
      "Déposez des livrables pour chaque jalon dont vous êtes responsable",
      "Visualisez les membres, fréquence et objectifs de chaque comité de gouvernance",
    ],
    tips: [
      "Si vous n'êtes pas chef de projet, vos modifications passent par une demande de modification soumise à validation",
      "Les livrables déposés sont horodatés et tracés dans l'historique du projet",
    ],
    managerNote: "En tant que chef de projet, vous pouvez créer, modifier et finaliser les projets. Vous validez également les demandes de modification soumises par les collaborateurs.",
  },
  {
    title: "Week Planner",
    icon: "⏰",
    moduleId: "timeentry",
    description: "Votre outil de planification et de suivi hebdomadaire. Le planning doit être complété au plus tard le vendredi de la semaine précédente.",
    steps: [
      "Planifiez vos tâches pour chaque jour de la semaine (lundi à vendredi)",
      "Associez optionnellement une tâche à un livrable de projet existant",
      "Cochez les tâches au fur et à mesure de leur achèvement",
      "Soumettez votre planning hebdomadaire avant la date limite (vendredi 16h00)",
      "Saisissez vos heures par activité (projet/comité) dans la section dédiée",
    ],
    tips: [
      "⚠️ Vendredi 16h00 : Date limite de soumission du planning hebdomadaire",
      "⚠️ Vendredi 18h30 : Date limite de validation par le manager",
      "Une fois validé, le planning est verrouillé : les tâches existantes ne peuvent plus être supprimées",
    ],
    managerNote: "Vous recevez les plannings soumis par vos subordonnés. Vous pouvez les valider ou les rejeter avec un commentaire. Un historique d'audit complet trace toutes les actions.",
  },
  {
    title: "Objectifs Individuels",
    icon: "🎯",
    moduleId: "hrperformance",
    description: "Gérez le cycle de vie complet de vos objectifs annuels, de la création à l'évaluation finale.",
    steps: [
      "Créez vos objectifs en définissant : titre, description, catégorie, KPI cible, unité de mesure et échéance",
      "Attribuez un poids (pondération) à chaque objectif selon son importance relative",
      "Soumettez vos objectifs pour validation par votre manager",
      "Après validation, participez à la revue semestrielle S1 avec votre manager",
      "En fin d'année, participez à l'évaluation S2 pour mesurer l'atteinte de vos objectifs",
      "Pour modifier un objectif validé, soumettez une demande de changement (circuit : Manager → DG)",
    ],
    tips: [
      "Cycle : Brouillon → En attente → Validé → Revue S1 → Évaluation S2 → Complété",
      "La somme des pondérations de vos objectifs doit idéalement atteindre 100%",
    ],
    managerNote: "Créez des objectifs pour vos subordonnés, effectuez les revues S1/S2, gérez les demandes de modification et pilotez le budget bonus alloué à votre équipe.",
  },
  {
    title: "Objectifs Départementaux",
    icon: "🏛️",
    moduleId: "dept_objectives",
    description: "Suivez les objectifs stratégiques de chaque département avec leurs KPIs associés.",
    steps: [
      "Consultez les objectifs groupés par département et par année",
      "Suivez l'avancement et les KPIs associés à chaque objectif départemental",
      "Visualisez les statistiques globales : objectifs en cours, validés et complétés",
    ],
    tips: [
      "Les objectifs départementaux sont alignés avec la stratégie globale de l'organisation",
    ],
    managerNote: "En tant que responsable de département, vous pouvez créer et modifier les objectifs départementaux, définir des KPIs et effectuer les revues de performance.",
  },
  {
    title: "Administration",
    icon: "⚙️",
    moduleId: "admin",
    description: "Module de gestion globale de la plateforme : utilisateurs, permissions, configuration, audit et sécurité.",
    adminOnly: true,
    steps: [
      "Gérez les utilisateurs : création, modification, blocage et attribution des rôles",
      "Configurez les permissions par module pour chaque collaborateur",
      "Suivez les demandes de modification soumises par les collaborateurs",
      "Consultez le journal d'audit de toutes les actions utilisateurs",
      "Gérez les campagnes d'animation et la messagerie interne",
      "Accédez aux coûts des projets et à l'analyse hebdomadaire IA",
      "Visualisez les violations de sécurité détectées",
    ],
    tips: [
      "Toutes les actions administratives sont tracées dans le journal d'audit",
      "Vérifiez régulièrement les violations de sécurité pour maintenir l'intégrité du système",
    ],
  },
  {
    title: "Suivi ETP",
    icon: "📈",
    moduleId: "etpadmin",
    description: "Analysez la répartition du temps de travail par collaborateur, projet et département.",
    adminOnly: true,
    steps: [
      "Visualisez la répartition du temps par collaborateur, projet et comité",
      "Suivez les heures saisies vs les heures prévues",
      "Analysez les tendances de charge de travail par département",
      "Exportez les rapports de suivi ETP",
    ],
    tips: [
      "Les données se basent sur les saisies de temps validées par les managers",
    ],
  },
  {
    title: "Gestion de temps",
    icon: "⏱️",
    moduleId: "badgemanagement",
    description: "Suivez les pointages quotidiens et vérifiez la cohérence avec les saisies de temps.",
    adminOnly: true,
    steps: [
      "Consultez les 4 pointages journaliers (entrée matin, sortie midi, entrée après-midi, sortie soir)",
      "Visualisez l'historique des pointages par jour et par semaine",
      "Vérifiez la cohérence entre les pointages et les saisies de temps",
    ],
    tips: [
      "Les données de badge sont importées par l'administration",
    ],
  },
];

function generateGuideHTML(isManager: boolean, isAdmin: boolean, userName: string, allowedModules: string[]): string {
  const hasAccess = (moduleId: string) => isAdmin || allowedModules.includes(moduleId);
  // Filter content based on role AND module access
  const guideContent = allGuideContent
    .filter(s => (!s.adminOnly || isAdmin) && hasAccess(s.moduleId))
    .map((s, idx) => ({ ...s, number: String(idx + 1).padStart(2, "0") }));

  const roleLabel = isAdmin ? "Administrateur" : isManager ? "Manager" : "Collaborateur";
  const coverSubtitle = isAdmin
    ? "Guide complet — Administrateur"
    : isManager
    ? "Guide adapté — Manager"
    : "Guide à destination des collaborateurs";

  const pageBreak = `<div style="page-break-after: always; height: 0; overflow: hidden; margin: 0; padding: 0; border: 0;"></div>`;

  // Cover page
  const cover = `
    <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(160deg, ${NAVY} 0%, ${NAVY_LIGHT} 40%, ${NAVY} 100%); color: white; text-align: center; position: relative; overflow: hidden; page-break-after: always;">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse at 30% 20%, rgba(255,174,3,0.18) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(255,174,3,0.12) 0%, transparent 50%);"></div>
      <div style="position: absolute; top: 60px; left: 60px; width: 80px; height: 2px; background: ${GOLD}; opacity: 0.3;"></div>
      <div style="position: absolute; bottom: 60px; right: 60px; width: 80px; height: 2px; background: ${GOLD}; opacity: 0.3;"></div>
      <div style="position: relative; z-index: 1;">
        <img src="${LOGO_URL}" alt="FACAM PERFORMER" style="height: 90px; margin: 0 auto 30px; display: block; object-fit: contain;" onerror="this.style.display='none'" />
        <div style="width: 120px; height: 3px; background: linear-gradient(90deg, transparent, ${GOLD}, transparent); margin: 0 auto 36px; border-radius: 2px;"></div>
        <h1 style="font-size: 48px; font-weight: 800; letter-spacing: -1px; margin: 0 0 6px; font-family: 'Montserrat', sans-serif; background: linear-gradient(135deg, ${CREAM}, ${GOLD_LIGHT}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">FACAM PERFORMER</h1>
        <p style="font-size: 16px; letter-spacing: 10px; color: ${GOLD}; margin: 0 0 50px; font-weight: 500;">W O R K S P A C E</p>
        <div style="width: 50px; height: 1px; background: rgba(255,255,255,0.15); margin: 0 auto 50px;"></div>
        <h2 style="font-size: 30px; font-weight: 300; margin: 0 0 8px; opacity: 0.95; font-family: 'Montserrat', sans-serif;">Guide d'utilisation</h2>
        <p style="font-size: 15px; opacity: 0.45; margin: 0 0 10px; font-weight: 300;">${coverSubtitle}</p>
        ${userName ? `<p style="font-size: 13px; opacity: 0.35; margin: 8px 0 0; font-weight: 400;">Généré pour : ${userName}</p>` : ""}
        <div style="margin-top: 50px; display: flex; gap: 16px; justify-content: center; align-items: center;">
          <div style="padding: 14px 28px; border: 1px solid rgba(255,174,3,0.25); border-radius: 10px; background: rgba(255,174,3,0.04);">
            <p style="font-size: 13px; margin: 0 0 4px; opacity: 0.5; font-weight: 400;">Édition</p>
            <p style="font-size: 15px; margin: 0; color: ${GOLD}; font-weight: 600;">${new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}</p>
          </div>
          <div style="padding: 14px 28px; border: 1px solid rgba(255,174,3,0.25); border-radius: 10px; background: rgba(255,174,3,0.04);">
            <p style="font-size: 13px; margin: 0 0 4px; opacity: 0.5; font-weight: 400;">Profil</p>
            <p style="font-size: 15px; margin: 0; color: ${GOLD}; font-weight: 600;">${roleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Table of contents
  const toc = `
    <div style="padding: 70px 60px; font-family: 'Montserrat', sans-serif; display: flex; flex-direction: column; justify-content: center; position: relative; overflow: hidden; page-break-after: always;">
      <div style="position: absolute; top: 30px; right: 40px; opacity: 0.08;">
        <img src="${LOGO_URL}" alt="" style="height: 50px; object-fit: contain;" onerror="this.style.display='none'" />
      </div>
      <div style="max-width: 620px; margin: 0 auto; width: 100%;">
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 40px;">
          <div style="width: 4px; height: 50px; background: linear-gradient(to bottom, ${GOLD}, transparent); border-radius: 2px;"></div>
          <div>
            <p style="font-size: 11px; letter-spacing: 4px; color: ${GOLD}; margin: 0 0 6px; font-weight: 600; text-transform: uppercase;">Sommaire</p>
            <h2 style="font-size: 30px; font-weight: 700; margin: 0; color: ${NAVY};">Table des matières</h2>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0;">
          ${guideContent.map((section) => `
            <div style="display: flex; align-items: center; padding: 16px 16px; border-bottom: 1px solid #eee;">
              <div style="min-width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, ${NAVY}, ${NAVY_LIGHT}); display: flex; align-items: center; justify-content: center; font-size: 20px; margin-right: 18px;">${section.icon}</div>
              <span style="flex: 1; font-size: 15px; font-weight: 500; color: ${NAVY};">${section.title}</span>
              ${section.adminOnly ? `<span style="font-size: 9px; background: ${GOLD}; color: white; padding: 3px 8px; border-radius: 4px; margin-right: 10px; font-weight: 700;">ADMIN</span>` : ""}
              <span style="font-size: 20px; color: ${GOLD}; font-weight: 800; width: 36px; text-align: right;">${section.number}</span>
            </div>
          `).join("")}
        </div>
        <div style="margin-top: 40px; padding: 20px 24px; background: linear-gradient(135deg, #f8f6f3, #faf9f7); border-radius: 12px; border-left: 4px solid ${GOLD};">
          <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.7;">
            <strong style="color: ${NAVY};">💡 Note :</strong> Ce guide a été généré pour votre profil <strong style="color: ${GOLD};">${roleLabel}</strong> et contient uniquement les ${guideContent.length} modules auxquels vous avez accès.
            ${isManager ? `Les sections marquées <span style="background: ${NAVY}; color: ${GOLD}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">👔 Managers</span> contiennent des informations spécifiques à votre rôle.` : ""}
          </p>
        </div>
      </div>
      <div style="position: absolute; bottom: 30px; right: 60px; font-size: 10px; color: #ccc; font-weight: 500;">FACAM PERFORMER — Page 2</div>
    </div>
  `;

  // Module pages
  const pages = guideContent.map((section, idx) => `
    <div style="padding: 50px 55px 60px; font-family: 'Montserrat', sans-serif; position: relative; display: flex; flex-direction: column; overflow: hidden; page-break-before: always; page-break-inside: avoid;">
      <div style="position: absolute; top: 25px; right: 35px; opacity: 0.06;">
        <img src="${LOGO_URL}" alt="" style="height: 40px; object-fit: contain;" onerror="this.style.display='none'" />
      </div>
      <div style="display: flex; align-items: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid ${GOLD}; position: relative;">
        <div style="position: absolute; bottom: -2px; left: 0; width: 80px; height: 2px; background: ${GOLD_LIGHT};"></div>
        <div style="width: 60px; height: 60px; border-radius: 16px; background: linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT}); display: flex; align-items: center; justify-content: center; font-size: 30px; margin-right: 20px; box-shadow: 0 6px 20px rgba(255,174,3,0.3);">
          ${section.icon}
        </div>
        <div style="flex: 1;">
          <p style="font-size: 10px; letter-spacing: 4px; color: ${GOLD}; margin: 0 0 4px; font-weight: 700; text-transform: uppercase;">Module ${section.number}</p>
          <h2 style="font-size: 26px; font-weight: 700; margin: 0; color: ${NAVY};">${section.title}</h2>
        </div>
        ${section.adminOnly ? `<span style="font-size: 10px; background: ${GOLD}; color: white; padding: 4px 12px; border-radius: 6px; font-weight: 700; margin-right: 10px;">ADMIN</span>` : ""}
        <div style="width: 52px; height: 52px; border-radius: 50%; border: 2px solid rgba(255,174,3,0.15); display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 22px; font-weight: 800; color: ${GOLD}; opacity: 0.4;">${section.number}</span>
        </div>
      </div>
      <div style="background: linear-gradient(135deg, #f8f6f3 0%, #faf9f7 100%); border-radius: 12px; padding: 22px 26px; margin-bottom: 28px; border-left: 4px solid ${GOLD};">
        <p style="font-size: 14px; line-height: 1.75; margin: 0; color: #444;">${section.description}</p>
      </div>
      <div style="margin-bottom: 24px; flex: 1;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px;">
          <div style="width: 24px; height: 2px; background: ${GOLD};"></div>
          <h3 style="font-size: 12px; letter-spacing: 3px; color: ${GOLD}; margin: 0; font-weight: 700; text-transform: uppercase;">Comment utiliser</h3>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${section.steps.map((step, si) => `
            <div style="display: flex; align-items: flex-start; gap: 14px; padding: 8px 12px; background: ${si % 2 === 0 ? 'rgba(26,31,46,0.02)' : 'transparent'}; border-radius: 8px;">
              <div style="min-width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, ${NAVY}, ${NAVY_LIGHT}); color: ${GOLD}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex-shrink: 0;">${si + 1}</div>
              <p style="font-size: 13px; line-height: 1.65; margin: 5px 0 0; color: #333;">${step}</p>
            </div>
          `).join("")}
        </div>
      </div>
      ${section.tips && section.tips.length > 0 ? `
        <div style="background: linear-gradient(135deg, #fffcf5, #fffbf0); border: 1px solid rgba(255,174,3,0.2); border-radius: 12px; padding: 18px 22px; margin-bottom: 18px;">
          <h4 style="font-size: 12px; font-weight: 700; color: ${GOLD}; margin: 0 0 12px; letter-spacing: 1px; text-transform: uppercase;">💡 Bon à savoir</h4>
          <div style="display: flex; flex-direction: column; gap: 6px;">
          ${section.tips.map(tip => `
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <span style="color: ${GOLD}; font-size: 16px; line-height: 1; margin-top: 1px;">›</span>
              <p style="font-size: 12px; line-height: 1.65; margin: 0; color: #555;">${tip}</p>
            </div>
          `).join("")}
          </div>
        </div>
      ` : ""}
      ${(section.managerNote && isManager) ? `
        <div style="background: linear-gradient(135deg, ${NAVY}, ${NAVY_LIGHT}); border-radius: 12px; padding: 18px 22px; color: white; position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; right: 0; width: 100px; height: 100px; background: radial-gradient(circle, rgba(255,174,3,0.1) 0%, transparent 70%);"></div>
          <h4 style="font-size: 12px; font-weight: 700; color: ${GOLD}; margin: 0 0 10px; letter-spacing: 1px; text-transform: uppercase; position: relative;">👔 Spécifique Managers</h4>
          <p style="font-size: 12px; line-height: 1.7; margin: 0; opacity: 0.9; position: relative;">${section.managerNote}</p>
        </div>
      ` : ""}
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 20px;">
        <div style="width: 40px; height: 1px; background: linear-gradient(90deg, ${GOLD}, transparent); opacity: 0.3;"></div>
        <p style="font-size: 9px; color: #bbb; font-weight: 500; letter-spacing: 2px;">FACAM PERFORMER — Page ${idx + 3}</p>
      </div>
    </div>
  `).join("");

  // Quick reference page
  const quickRef = `
    <div style="padding: 55px; font-family: 'Montserrat', sans-serif; position: relative; overflow: hidden; page-break-before: always;">
      <div style="position: absolute; top: 25px; right: 35px; opacity: 0.06;">
        <img src="${LOGO_URL}" alt="" style="height: 40px; object-fit: contain;" onerror="this.style.display='none'" />
      </div>
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 40px;">
        <div style="width: 4px; height: 50px; background: linear-gradient(to bottom, ${GOLD}, transparent); border-radius: 2px;"></div>
        <div>
          <p style="font-size: 11px; letter-spacing: 4px; color: ${GOLD}; margin: 0 0 6px; font-weight: 600; text-transform: uppercase;">Référence rapide</p>
          <h2 style="font-size: 28px; font-weight: 700; margin: 0; color: ${NAVY};">Aide-mémoire</h2>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
        <div style="background: linear-gradient(135deg, #f8f6f3, #faf9f7); border-radius: 12px; padding: 22px; border-top: 3px solid ${GOLD};">
          <h4 style="font-size: 13px; font-weight: 700; color: ${NAVY}; margin: 0 0 14px;">📋 Dates limites hebdo</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #555;">Soumission planning</span>
              <span style="font-size: 12px; font-weight: 700; color: ${GOLD}; background: rgba(255,174,3,0.1); padding: 3px 10px; border-radius: 20px;">Ven. 16h00</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #555;">Validation manager</span>
              <span style="font-size: 12px; font-weight: 700; color: ${GOLD}; background: rgba(255,174,3,0.1); padding: 3px 10px; border-radius: 20px;">Ven. 18h30</span>
            </div>
          </div>
        </div>
        <div style="background: linear-gradient(135deg, #f8f6f3, #faf9f7); border-radius: 12px; padding: 22px; border-top: 3px solid ${GOLD};">
          <h4 style="font-size: 13px; font-weight: 700; color: ${NAVY}; margin: 0 0 14px;">🎯 Cycle des objectifs</h4>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: #aaa;"></div>
              <span style="font-size: 11px; color: #555;">Brouillon</span>
              <span style="font-size: 14px; color: #ccc;">→</span>
              <div style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></div>
              <span style="font-size: 11px; color: #555;">En attente</span>
              <span style="font-size: 14px; color: #ccc;">→</span>
              <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div>
              <span style="font-size: 11px; color: #555;">Validé</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;"></div>
              <span style="font-size: 11px; color: #555;">Revue S1</span>
              <span style="font-size: 14px; color: #ccc;">→</span>
              <div style="width: 8px; height: 8px; border-radius: 50%; background: #8b5cf6;"></div>
              <span style="font-size: 11px; color: #555;">Éval. S2</span>
              <span style="font-size: 14px; color: #ccc;">→</span>
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${GOLD};"></div>
              <span style="font-size: 11px; color: #555;">Complété</span>
            </div>
          </div>
        </div>
      </div>
      <div style="background: linear-gradient(135deg, ${NAVY}, ${NAVY_LIGHT}); border-radius: 14px; padding: 28px; color: white; margin-bottom: 24px;">
        <h4 style="font-size: 13px; font-weight: 700; color: ${GOLD}; margin: 0 0 18px; letter-spacing: 1px;">🔑 BONNES PRATIQUES</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          ${[
            "Remplissez votre planning au plus tard le vendredi à 16h",
            "Saisissez vos heures quotidiennement",
            "Documentez vos réalisations régulièrement",
            "Consultez votre tableau de bord chaque jour",
            "Déposez vos livrables avant l'échéance",
            ...(isManager ? ["Validez les plannings de votre équipe avant vendredi 18h30"] : []),
          ].map(tip => `
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="color: ${GOLD}; font-size: 14px; margin-top: 1px;">✓</span>
              <p style="font-size: 12px; line-height: 1.5; margin: 0; opacity: 0.85;">${tip}</p>
            </div>
          `).join("")}
        </div>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 20px;">
        <div style="width: 40px; height: 1px; background: linear-gradient(90deg, ${GOLD}, transparent); opacity: 0.3;"></div>
        <p style="font-size: 9px; color: #bbb; font-weight: 500; letter-spacing: 2px;">FACAM PERFORMER — Page ${guideContent.length + 3}</p>
      </div>
    </div>
  `;

  // Closing page
  const closingPage = `
    <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(160deg, ${NAVY} 0%, ${NAVY_LIGHT} 40%, ${NAVY} 100%); color: white; text-align: center; position: relative; overflow: hidden; page-break-before: always;">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse at 50% 50%, rgba(255,174,3,0.08) 0%, transparent 60%);"></div>
      <div style="position: relative; z-index: 1;">
        <img src="${LOGO_URL}" alt="FACAM PERFORMER" style="height: 70px; margin: 0 auto 30px; display: block; object-fit: contain; opacity: 0.9;" onerror="this.style.display='none'" />
        <div style="width: 100px; height: 2px; background: linear-gradient(90deg, transparent, ${GOLD}, transparent); margin: 0 auto 36px; border-radius: 2px;"></div>
        <h2 style="font-size: 34px; font-weight: 700; margin: 0 0 14px; font-family: 'Montserrat', sans-serif;">Bonne utilisation !</h2>
        <p style="font-size: 15px; opacity: 0.5; margin: 0 0 50px; font-weight: 300; max-width: 420px; line-height: 1.7;">
          Pour toute question ou assistance, contactez votre administrateur 
          ou consultez le guide intégré directement dans l'application.
        </p>
        <div style="padding: 16px 32px; border: 1px solid rgba(255,174,3,0.3); border-radius: 10px; display: inline-block; background: rgba(255,174,3,0.04);">
          <p style="font-size: 13px; margin: 0; color: ${GOLD}; font-weight: 600; letter-spacing: 3px;">FACAM PERFORMER</p>
          <p style="font-size: 10px; margin: 4px 0 0; opacity: 0.4; letter-spacing: 2px;">WORKSPACE</p>
        </div>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Guide d'utilisation — FACAM PERFORMER</title>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Montserrat', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
        @media print {
          body { margin: 0; }
          @page { margin: 0; size: A4; }
        }
      </style>
    </head>
    <body>
      ${cover}
      ${toc}
      ${pages}
      ${quickRef}
      ${closingPage}
    </body>
    </html>
  `;
}

const UserGuideExport = () => {
  const { profile, isAdmin, allowedModules } = useAuth();
  const isManager = profile?.is_manager ?? false;
  const userName = profile?.full_name || "";

  const handleExport = () => {
    toast.info("Préparation du guide personnalisé...");
    const html = generateGuideHTML(isManager, isAdmin, userName, allowedModules);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Veuillez autoriser les pop-ups pour générer le PDF.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      toast.success("Guide prêt ! Utilisez « Enregistrer en PDF » dans la boîte de dialogue d'impression.");
    }, 800);
  };

  return (
    <Button
      onClick={handleExport}
      variant="outline"
      className="gap-2"
      style={{ borderColor: GOLD, color: GOLD }}
    >
      <FileDown className="w-4 h-4" />
      Exporter le guide en PDF
    </Button>
  );
};

export default UserGuideExport;
