import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import type { ChangeRequestSummary } from "@/hooks/useObjectiveChangeRequests";
import { getChangeRequestStatus } from "@/hooks/useObjectiveChangeRequests";

const FIELD_LABELS: Record<string, string> = {
  title: "Titre",
  description: "Description",
  category: "Catégorie",
  deadline: "Échéance",
  kpi_target: "Cible KPI",
};

interface Props {
  requests: ChangeRequestSummary[] | undefined;
}

const ObjectiveChangeRequestBadge = ({ requests }: Props) => {
  const { status, latestRequests } = getChangeRequestStatus(requests);
  if (!status) return null;

  const config = {
    pending: {
      icon: Clock,
      label: "Modification en cours",
      badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
      detail: "Votre demande est en cours d'examen par la hiérarchie",
    },
    approved: {
      icon: CheckCircle,
      label: "Modification approuvée",
      badgeClass: "bg-green-100 text-green-800 border-green-300",
      detail: "Votre demande de modification a été approuvée",
    },
    rejected: {
      icon: XCircle,
      label: "Modification refusée",
      badgeClass: "bg-red-100 text-red-800 border-red-300",
      detail: "Votre demande de modification a été refusée",
    },
  }[status];

  const Icon = config.icon;
  const comment = latestRequests[0]?.review_comment || latestRequests[0]?.manager_comment;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`text-[9px] gap-1 cursor-help ${config.badgeClass}`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs space-y-1.5 p-3">
        <p className="font-semibold">{config.detail}</p>
        {latestRequests.length > 0 && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-[10px]">Champs concernés :</p>
            {latestRequests.map((r, i) => (
              <p key={i} className="text-[10px]">
                • {FIELD_LABELS[r.field_name || ""] || r.field_name || "Suppression"}
              </p>
            ))}
          </div>
        )}
        {comment && (
          <div className="pt-1 border-t">
            <p className="text-[10px] text-muted-foreground">Commentaire :</p>
            <p className="text-[10px] italic">"{comment}"</p>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export default ObjectiveChangeRequestBadge;
