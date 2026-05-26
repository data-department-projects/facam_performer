import { useDepartments } from "@/contexts/DepartmentsContext";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ExportButton = () => {
  const { departments } = useDepartments();

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    downloadFile(JSON.stringify(departments, null, 2), "organisation.json", "application/json");
  };

  const exportCSV = () => {
    const rows = [["Département", "Service", "Période", "Nom", "Rôle", "Services attribués"]];
    departments.forEach(d => {
      const addMembers = (members: typeof d.compositionToday, period: string) => {
        if (members.length === 0) {
          rows.push([d.name, "", period, "", "", ""]);
        }
        members.forEach(m => {
          rows.push([d.name, "", period, m.name, m.role, (m.services || []).join("; ")]);
        });
      };
      addMembers(d.compositionToday, "Aujourd'hui");
      addMembers(d.compositionTomorrow, "Cible 2027");
    });
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadFile("\uFEFF" + csv, "organisation.csv", "text/csv;charset=utf-8");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportJSON}>Export JSON</DropdownMenuItem>
        <DropdownMenuItem onClick={exportCSV}>Export CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportButton;
