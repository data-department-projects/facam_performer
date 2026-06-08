import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Database, Clock, HardDrive, RefreshCw, Loader2, FileArchive, Trash2, Play, Download, CalendarClock } from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/contexts/OrganizationContext";

const DAYS = [
  { value: "0", label: "Dimanche" },
  { value: "1", label: "Lundi" },
  { value: "2", label: "Mardi" },
  { value: "3", label: "Mercredi" },
  { value: "4", label: "Jeudi" },
  { value: "5", label: "Vendredi" },
  { value: "6", label: "Samedi" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, "0")}:00`,
}));

interface BackupFile {
  name: string;
  created_at: string;
  size: number;
}

const FridayDeadlineToggle = () => {
  const { organization, updateOrganization } = useOrganization();
  const { toast } = useToast();
  const enabled = organization.fridayDeadlineEnabled ?? false;

  const toggle = () => {
    const updated = { ...organization, fridayDeadlineEnabled: !enabled };
    updateOrganization(updated);
    toast({ title: !enabled ? "Clôture vendredi activée" : "Clôture vendredi désactivée" });
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          Clôture hebdomadaire
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs font-medium">Activer la clôture du vendredi</Label>
            <p className="text-[10px] text-muted-foreground">
              Bloque la soumission du Week Planner et la saisie de temps après le vendredi (16h / 17h)
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggle} />
        </div>
      </CardContent>
    </Card>
  );
};

const AdminConfiguration = () => {
  const { toast } = useToast();
  const [backupDay, setBackupDay] = useState("0");
  const [backupHour, setBackupHour] = useState("2");
  
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);

  useEffect(() => {
    loadSchedule();
    loadBackups();
  }, []);

  const loadSchedule = async () => {
    const { data } = await supabase
      .from("backup_schedule")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (data) {
      setBackupDay(String(data.day_of_week));
      setBackupHour(String(data.hour));
      setLastBackup(data.last_backup_at);
    }
  };

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const { data, error } = await supabase.storage.from("backups").list("", {
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      setBackups(
        (data || [])
          .filter((f) => f.name.endsWith(".json"))
          .map((f) => ({
            name: f.name,
            created_at: f.created_at,
            size: f.metadata?.size || 0,
          }))
      );
    } catch {
      // ignore
    } finally {
      setLoadingBackups(false);
    }
  };


  const handleSaveBackup = async () => {
    setSavingSchedule(true);
    try {
      const day = parseInt(backupDay);
      const hour = parseInt(backupHour);

      // Update cron job + schedule record via DB function
      const { error } = await supabase.rpc("update_backup_cron", {
        _day_of_week: day,
        _hour: hour,
      });

      if (error) throw error;

      toast({
        title: "Planification sauvegardée ✓",
        description: `Sauvegarde automatique chaque ${DAYS.find(d => d.value === backupDay)?.label} à ${HOURS.find(h => h.value === backupHour)?.label}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleRunBackupNow = async () => {
    setRunningBackup(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expirée. Veuillez vous reconnecter.");
      const backupResp = await fetch("/api/backup", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await backupResp.json() as { success?: boolean; file?: string; tables?: number; error?: string };
      if (!backupResp.ok) throw new Error(data?.error || `Erreur ${backupResp.status}`);
      if (data?.success) {
        toast({
          title: "Sauvegarde terminée ✓",
          description: `Fichier : ${data.file} — ${data.tables} tables exportées`,
        });
        setLastBackup(new Date().toISOString());
        loadBackups();
      } else {
        throw new Error(data?.error || "Erreur inconnue");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast({ title: "Erreur de sauvegarde", description: msg, variant: "destructive" });
    } finally {
      setRunningBackup(false);
    }
  };

  const handleDownloadBackupZip = async (fileName: string) => {
    const zipName = fileName.replace(".json", ".zip");
    type FileSystemWritableFileStream = { write: (data: Blob) => Promise<void>; close: () => Promise<void> };
    type FileSystemFileHandle = { createWritable: () => Promise<FileSystemWritableFileStream> };
    type ShowSaveFilePicker = (options: unknown) => Promise<FileSystemFileHandle>;
    const picker = (window as Window & { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
    let fileHandle: FileSystemFileHandle | null = null;

    // IMPORTANT: open save dialog immediately (while user gesture is still active)
    if (picker) {
      try {
        fileHandle = await picker({
          suggestedName: zipName,
          types: [{ description: "Archive ZIP", accept: { "application/zip": [".zip"] } }],
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") {
          toast({ title: "Téléchargement annulé" });
          return;
        }
      }
    }

    try {
      const { data, error } = await supabase.storage.from("backups").download(fileName);
      if (error || !data) throw error ?? new Error("Fichier introuvable");

      const text = await data.text();
      const parsed = JSON.parse(text);

      const wb = XLSX.utils.book_new();
      let appendedSheets = 0;
      for (const [table, rows] of Object.entries(parsed)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const ws = XLSX.utils.json_to_sheet(
          rows.map((row: Record<string, unknown>) => {
            const flat: Record<string, string> = {};
            for (const [k, v] of Object.entries(row)) {
              let str = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
              if (str.length > 32000) str = str.substring(0, 32000) + "...[tronqué]";
              flat[k] = str;
            }
            return flat;
          })
        );
        XLSX.utils.book_append_sheet(wb, ws, table.substring(0, 31));
        appendedSheets += 1;
      }

      if (appendedSheets === 0) {
        const ws = XLSX.utils.aoa_to_sheet([["Aucune donnée dans cette sauvegarde"]]);
        XLSX.utils.book_append_sheet(wb, ws, "Résumé");
      }

      const excelArray = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const zip = new JSZip();
      zip.file(fileName, text);
      zip.file(fileName.replace(".json", ".xlsx"), excelArray);
      const zipBlob = await zip.generateAsync({ type: "blob" });

      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(zipBlob);
        await writable.close();
        toast({ title: "Sauvegarde téléchargée ✓", description: zipName });
        return;
      }

      // Fallback for browsers without showSaveFilePicker
      const blobUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = zipName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      toast({ title: "Téléchargement lancé", description: "Si rien ne se passe, utilisez Chrome/Edge." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast({ title: "Erreur de téléchargement", description: msg, variant: "destructive" });
    }
  };

  const handleDeleteBackup = async (fileName: string) => {
    try {
      const { error } = await supabase.storage.from("backups").remove([fileName]);
      if (error) throw error;
      setBackups((prev) => prev.filter((b) => b.name !== fileName));
      toast({ title: "Sauvegarde supprimée ✓" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-6">

      {/* Sauvegarde hebdomadaire */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            Sauvegarde hebdomadaire automatique
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            La sauvegarde automatique est active. Choisissez le jour et l'heure d'exécution.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Jour de la sauvegarde</Label>
              <Select value={backupDay} onValueChange={setBackupDay}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Heure de la sauvegarde</Label>
              <Select value={backupHour} onValueChange={setBackupHour}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => (
                    <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleRunBackupNow}
              disabled={runningBackup}
            >
              {runningBackup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Sauvegarder maintenant
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleSaveBackup}
              disabled={savingSchedule}
            >
              {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Enregistrer la planification
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste des sauvegardes */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              Liste des sauvegardes disponibles
            </CardTitle>
            <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5" onClick={loadBackups} disabled={loadingBackups}>
              {loadingBackups ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
        {loadingBackups ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement...
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground px-4">
            <FileArchive className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Aucune sauvegarde disponible. La première sauvegarde automatique sera créée selon la planification.
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Fichier</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Date</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Taille</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.name}>
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        <FileArchive className="w-3.5 h-3.5 text-muted-foreground" />
                        {backup.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(backup.created_at).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatSize(backup.size)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2 gap-1"
                          onClick={() => handleDownloadBackupZip(backup.name)}
                        >
                          <Download className="w-3 h-3" /> Télécharger
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteBackup(backup.name)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        </CardContent>
      </Card>

      {/* Clôture vendredi */}
      <FridayDeadlineToggle />

      {/* Informations système */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Informations système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Version de l'application</p>
              <p className="font-medium">1.0.0</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Environnement</p>
              <p className="font-medium">Production</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">Dernière sauvegarde</p>
              <p className="font-medium">
                {lastBackup
                  ? new Date(lastBackup).toLocaleString("fr-FR")
                  : "Aucune sauvegarde effectuée"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminConfiguration;
