import { useState, useEffect } from "react";
import ProjectsView from "@/components/ProjectsView";
import CommitteesView from "@/components/CommitteesView";
import CollaboratorProjectsView from "@/components/CollaboratorProjectsView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderKanban, Users2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  initialProjectId?: string | null;
  onNavigateToGantt?: () => void;
}

const ProjectsAndCommitteesView = ({ initialProjectId, onNavigateToGantt }: Props) => {
  const { isAdmin, profile } = useAuth();
  const [filter, setFilter] = useState<"projects" | "committees">("projects");

  useEffect(() => {
    if (initialProjectId) setFilter("projects");
  }, [initialProjectId]);

  const isSimpleCollaborator = !isAdmin && !profile?.is_manager;

  return (
    <div className="space-y-6">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as "projects" | "committees")}>
        <TabsList className="bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="projects" className="rounded-md text-xs font-medium gap-1.5">
            <FolderKanban className="w-3.5 h-3.5" />
            Projets
          </TabsTrigger>
          <TabsTrigger value="committees" className="rounded-md text-xs font-medium gap-1.5">
            <Users2 className="w-3.5 h-3.5" />
            Comités
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          {isSimpleCollaborator
            ? <CollaboratorProjectsView onNavigateToGantt={onNavigateToGantt} />
            : <ProjectsView initialExpandedId={initialProjectId} onNavigateToGantt={onNavigateToGantt} />}
        </TabsContent>
        <TabsContent value="committees" className="mt-4">
          <CommitteesView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectsAndCommitteesView;
