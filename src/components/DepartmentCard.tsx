import { Department } from "@/data/departments";
import { Users, ArrowRight } from "lucide-react";

interface DepartmentCardProps {
  department: Department;
  isSelected: boolean;
  onClick: () => void;
}

const DepartmentCard = ({ department, isSelected, onClick }: DepartmentCardProps) => {
  const inProgressCount = [...department.milestones2026, ...department.milestones2027].filter(m => m.status === "in-progress").length;
  const doneCount = [...department.milestones2026, ...department.milestones2027].filter(m => m.status === "done").length;
  const totalCount = department.milestones2026.length + department.milestones2027.length;

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left p-5 rounded-xl transition-all duration-300 border ${
        isSelected
          ? "bg-primary text-primary-foreground border-primary shadow-elevated"
          : "bg-card text-card-foreground border-border shadow-card hover:shadow-elevated hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{department.icon}</span>
        <ArrowRight className={`w-4 h-4 transition-transform ${isSelected ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"}`} />
      </div>
      <h3 className="font-display font-semibold text-base mb-2">{department.name}</h3>
      <div className="flex items-center gap-3 text-xs">
        <span className={`flex items-center gap-1 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
          <Users className="w-3 h-3" />
          {department.compositionToday.length} membres
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
          isSelected ? "bg-primary-foreground/20" : "bg-secondary text-secondary-foreground"
        }`}>
          {doneCount}/{totalCount} étapes
        </span>
      </div>
    </button>
  );
};

export default DepartmentCard;
