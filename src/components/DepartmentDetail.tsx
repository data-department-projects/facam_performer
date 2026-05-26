import { Department } from "@/data/departments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TimelineView from "./TimelineView";
import MissionCompare from "./MissionCompare";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DepartmentDetailProps {
  department: Department;
  onEdit?: () => void;
}

const DepartmentDetail = ({ department, onEdit }: DepartmentDetailProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
            {department.icon}
          </div>
          <div>
            <h2 className="font-display font-bold text-xl">{department.name}</h2>
            <p className="text-sm text-muted-foreground">{department.compositionToday.length} membres → {department.compositionTomorrow.length} cibles</p>
          </div>
        </div>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit} className="text-xs gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </Button>
        )}
      </div>

      <Tabs defaultValue="mission" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="mission" className="rounded-md text-xs font-medium">Mission & Équipe</TabsTrigger>
          <TabsTrigger value="roadmap-2026" className="rounded-md text-xs font-medium">Roadmap 2026</TabsTrigger>
          <TabsTrigger value="roadmap-2027" className="rounded-md text-xs font-medium">Roadmap 2027</TabsTrigger>
        </TabsList>
        <TabsContent value="mission" className="mt-5">
          <MissionCompare department={department} />
        </TabsContent>
        <TabsContent value="roadmap-2026" className="mt-5">
          <TimelineView milestones={department.milestones2026} year="2026" />
        </TabsContent>
        <TabsContent value="roadmap-2027" className="mt-5">
          <TimelineView milestones={department.milestones2027} year="2027" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DepartmentDetail;
