import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppModule = Database["public"]["Enums"]["app_module"];
type AppRole = Database["public"]["Enums"]["app_role"];
type UntypedRpc = (fn: string, params: Record<string, unknown>) => Promise<{ error: Error | null }>;

interface AuthStatus {
  user_id: string;
  banned_until?: string | null;
  last_sign_in_at?: string | null;
  created_at?: string | null;
}
import { refreshProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { getDepartmentDisplayName } from "@/data/departments";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Shield, Mail, Pencil, Trash2, Upload, Download, FileSpreadsheet, Ban, CheckCircle2, Send, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AdminUserAuditLog from "@/components/AdminUserAuditLog";

const ALWAYS_AVAILABLE_MODULES = ["accueil"] as const;

const ALL_MODULES = [
  { id: "dashboard", label: "Tableau de bord" },
  { id: "orgchart", label: "Organigramme" },
  { id: "gantt", label: "Gantt Projets" },
  { id: "projectscomites", label: "Projets & Comités" },
  { id: "timeentry", label: "Week Planner" },
  { id: "hrperformance", label: "Objectifs" },
  { id: "dept_objectives", label: "Obj. Départements" },
  { id: "project_costs", label: "Coût des projets" },
  { id: "weekly_analysis", label: "Analyse hebdomadaire IA" },
  { id: "badgemanagement", label: "Gestion de temps" },
  { id: "etpadmin", label: "Suivi ETP (Admin)" },
  { id: "admin", label: "Administration" },
] as const;

const VALID_DB_MODULES = new Set<string>(ALL_MODULES.map((module) => module.id));
const sanitizePersistedModules = (modules: string[]) =>
  Array.from(new Set(modules.filter((module) => VALID_DB_MODULES.has(module))));

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  service: string | null;
  poste: string | null;
  hierarchy_user_id: string | null;
  role: string;
  modules: string[];
  is_banned: boolean;
  last_sign_in_at: string | null;
  created_at: string | null;
  can_create_projects: boolean;
  can_create_committees: boolean;
  salary: number | null;
  is_manager: boolean;
  category: string;
  badge_number: string | null;
}

const AdminCollaborators = () => {
  const { toast } = useToast();
  const { departments } = useDepartments();
  const { organization } = useOrganization();
  const { isAdmin, user: authUser, refreshPermissions } = useAuth();
  const isFullAdmin = isAdmin;

  const logAudit = async (action: string, target_user_id: string | null, details: Record<string, unknown> = {}) => {
    if (!authUser) return;
    const rpc = supabase.rpc as unknown as UntypedRpc;
    await rpc("insert_user_audit_log", {
      _action: action,
      _actor_id: authUser.id,
      _target_user_id: target_user_id,
      _details: details,
    });
  };

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterManager, setFilterManager] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);


  const [sendingInvite, setSendingInvite] = useState<UserRow | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formService, setFormService] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "admin_rapproche" | "collaborator">("collaborator");
  const [formModules, setFormModules] = useState<string[]>([]);
  const [formPoste, setFormPoste] = useState("");
  const [formHierarchy, setFormHierarchy] = useState("");
  const [formCanCreateProjects, setFormCanCreateProjects] = useState(false);
  const [formCanCreateCommittees, setFormCanCreateCommittees] = useState(false);
  const [formSalary, setFormSalary] = useState("");
  const [formIsManager, setFormIsManager] = useState(false);
  const [formCategory, setFormCategory] = useState<"cadre" | "ouvrier">("cadre");
  const [formBadgeNumber, setFormBadgeNumber] = useState("");

  const invokeEdge = async (bodyData: Record<string, unknown>, retried = false): Promise<{ data: unknown; error: Error | null }> => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data: refreshData } = await supabase.auth.refreshSession();
      session = refreshData.session;
    }
    const token = session?.access_token;
    if (!token) {
      return { data: null, error: new Error("Session expirée. Veuillez vous reconnecter.") };
    }
    const resp = await fetch("/api/admin-users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "x-user-token": token,
      },
      body: JSON.stringify(bodyData),
    });
    const data = await resp.json();
    if (resp.status === 401 && !retried) {
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData.session) {
        return invokeEdge(bodyData, true);
      }
    }
    if (!resp.ok) return { data: null, error: new Error((data as { error?: string }).error || `Error ${resp.status}`) };
    return { data, error: null };
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    const { data: permissions } = await supabase.from("user_module_permissions").select("*");
    const { data: createPerms } = await supabase.from("user_create_permissions").select("*");

    let authStatuses: AuthStatus[] = [];
    const statusRes = await invokeEdge({ action: "list_users_status" });
    if (statusRes.data?.statuses) authStatuses = statusRes.data.statuses as AuthStatus[];

    const userList: UserRow[] = (profiles ?? []).map((p) => {
      const authInfo = authStatuses.find((s) => s.user_id === p.user_id);
      const bannedUntil = authInfo?.banned_until;
      const isBanned = bannedUntil ? new Date(bannedUntil) > new Date() : false;
      const cp = (createPerms ?? []).find((c) => c.user_id === p.user_id);
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        department_id: p.department_id,
        service: p.service,
        poste: p.poste,
        hierarchy_user_id: p.hierarchy_user_id,
        role: roles?.find((r) => r.user_id === p.user_id)?.role ?? "collaborator",
        modules: permissions?.filter((m) => m.user_id === p.user_id).map((m) => m.module) ?? [],
        is_banned: isBanned,
        last_sign_in_at: authInfo?.last_sign_in_at || null,
        created_at: authInfo?.created_at || null,
        can_create_projects: cp?.can_create_projects ?? false,
        can_create_committees: cp?.can_create_committees ?? false,
        salary: p.salary ?? null,
        is_manager: p.is_manager ?? false,
        category: p.category ?? "cadre",
        badge_number: p.badge_number ?? null,
      };
    });
    setUsers(userList);
    setLoading(false);
    refreshProfiles();
  };

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setFormName(""); setFormEmail("");
    setFormDept(""); setFormService(""); setFormPoste(""); setFormHierarchy("");
    setFormRole("collaborator"); setFormModules([]);
    setFormCanCreateProjects(false); setFormCanCreateCommittees(false);
    setFormSalary(""); setFormIsManager(false); setFormCategory("cadre");
    setFormBadgeNumber("");
  };

  const handleCreate = async () => {
    if (!formEmail || !formName) {
      toast({ title: "Erreur", description: "Nom et email requis.", variant: "destructive" });
      return;
    }

    const roleToUse = isFullAdmin ? formRole : "collaborator";

    const { data, error } = await invokeEdge({
      users: [{
        email: formEmail,
        full_name: formName,
        department_id: formDept || null,
        service: formService || null,
        role: roleToUse,
      }],
    });

    if (error || !data?.results?.[0]?.success) {
      toast({ title: "Erreur", description: data?.results?.[0]?.error || error?.message || "Échec de la création", variant: "destructive" });
      return;
    }

    const createdUserId = data?.results?.[0]?.user_id;

    if (isFullAdmin) {
      const persistedModules = sanitizePersistedModules(formModules);
      if (createdUserId && roleToUse !== "admin" && persistedModules.length > 0) {
        await supabase.from("user_module_permissions").insert(
          persistedModules.map(m => ({ user_id: createdUserId, module: m as AppModule }))
        );
      }

      if (createdUserId && (formCanCreateProjects || formCanCreateCommittees)) {
        await supabase.from("user_create_permissions").upsert({
          user_id: createdUserId,
          can_create_projects: formCanCreateProjects,
          can_create_committees: formCanCreateCommittees,
        });
      }

      if (createdUserId) {
        const dgUser = users.find(u => u.full_name === organization.leader);
        const hierarchyId = formIsManager && dgUser ? dgUser.user_id : (formHierarchy && formHierarchy !== "none" ? formHierarchy : null);
        await supabase.from("profiles").update({ is_manager: formIsManager, hierarchy_user_id: hierarchyId, category: formCategory, badge_number: formBadgeNumber || null }).eq("user_id", createdUserId);
      }
    }

    if (!isFullAdmin && createdUserId) {
      await supabase.from("profiles").update({ poste: formPoste || null, category: formCategory, badge_number: formBadgeNumber || null }).eq("user_id", createdUserId);
    }

    toast({ title: "Collaborateur créé ✓", description: `Un email d'invitation a été envoyé à ${formEmail}` });
    if (createdUserId) {
      await logAudit("user_created", createdUserId, { full_name: formName, email: formEmail, role: isFullAdmin ? formRole : "collaborator", department_id: formDept || null });
    }
    resetForm();
    setCreating(false);
    fetchUsers();
  };

  const handleSendInvite = async () => {
    if (!sendingInvite) return;
    const { data, error } = await invokeEdge({ action: "resend_invite", user_id: sendingInvite.user_id });
    if (error || !data?.success) {
      toast({ title: "Erreur", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Email d'accès envoyé ✓",
      description: `Un email pour définir le mot de passe a été renvoyé à ${sendingInvite.email}`,
    });
    await logAudit("invite_sent", sendingInvite.user_id, { email: sendingInvite.email, full_name: sendingInvite.full_name });
    setSendingInvite(null);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    const errors: string[] = [];

    if (isFullAdmin) {
      const dgUser = users.find(u => u.full_name === organization.leader);
      const hierarchyId = formIsManager && dgUser ? dgUser.user_id : (formHierarchy && formHierarchy !== "none" ? formHierarchy : null);
      const dbModules = sanitizePersistedModules(formModules);

      // 1. Update profile
      const { error: profErr } = await supabase.from("profiles").update({
        full_name: formName,
        department_id: formDept || null,
        service: formService || null,
        poste: formPoste || null,
        hierarchy_user_id: hierarchyId,
        salary: formSalary ? parseFloat(formSalary) : null,
        is_manager: formIsManager,
        category: formCategory,
        badge_number: formBadgeNumber || null,
      }).eq("user_id", editing.user_id);
      if (profErr) errors.push(`Profil: ${profErr.message}`);

      // 2. Update role (delete then insert sequentially)
      const { error: roleDelErr } = await supabase.from("user_roles").delete().eq("user_id", editing.user_id);
      if (roleDelErr) {
        errors.push(`Rôle (suppression): ${roleDelErr.message}`);
      } else {
        const { error: roleInsErr } = await supabase.from("user_roles").insert({ user_id: editing.user_id, role: formRole });
        if (roleInsErr) errors.push(`Rôle (ajout): ${roleInsErr.message}`);
      }

      // 3. Update modules (delete then insert sequentially — wait for delete to complete)
      const { error: modDelErr } = await supabase.from("user_module_permissions").delete().eq("user_id", editing.user_id);
      if (modDelErr) {
        errors.push(`Modules (suppression): ${modDelErr.message}`);
      } else if (formRole !== "admin" && dbModules.length > 0) {
        const { error: modInsErr } = await supabase.from("user_module_permissions").insert(
          dbModules.map(m => ({ user_id: editing.user_id, module: m as AppModule }))
        );
        if (modInsErr) errors.push(`Modules (ajout): ${modInsErr.message}`);
      }

      // 4. Update create permissions
      const { error: createPermErr } = await supabase.from("user_create_permissions").upsert({
        user_id: editing.user_id,
        can_create_projects: formCanCreateProjects,
        can_create_committees: formCanCreateCommittees,
      }, { onConflict: "user_id" });
      if (createPermErr) errors.push(`Permissions création: ${createPermErr.message}`);
    } else {
      const { error: salErr } = await supabase.from("profiles").update({
        salary: formSalary ? parseFloat(formSalary) : null,
      }).eq("user_id", editing.user_id);
      if (salErr) errors.push(`Salaire: ${salErr.message}`);
    }

    if (errors.length > 0) {
      console.error("Edit save errors:", errors);
      toast({ title: "Erreurs lors de la sauvegarde", description: errors.join(" | "), variant: "destructive" });
      return;
    }

    await logAudit("user_edited", editing.user_id, { full_name: formName, role: formRole, department_id: formDept || null, modules: sanitizePersistedModules(formModules), always_available_modules: [...ALWAYS_AVAILABLE_MODULES] });
    await fetchUsers();
    // Refresh current user's permissions if editing self
    if (authUser?.id === editing.user_id) {
      await refreshPermissions();
    }
    toast({ title: "Mis à jour ✓", description: "Modifications enregistrées et en vigueur immédiatement." });
    setEditing(null);
    resetForm();
  };

  const openEdit = (u: UserRow) => {
    setFormName(u.full_name);
    setFormEmail(u.email);
    setFormDept(u.department_id ?? "");
    setFormService(u.service ?? "");
    setFormPoste(u.poste ?? "");
    setFormHierarchy(u.hierarchy_user_id ?? "");
    setFormRole(u.role as "admin" | "admin_rapproche" | "collaborator");
    setFormModules(sanitizePersistedModules(u.modules));
    setFormCanCreateProjects(u.can_create_projects);
    setFormCanCreateCommittees(u.can_create_committees);
    setFormSalary(u.salary != null ? String(u.salary) : "");
    setFormIsManager(u.is_manager);
    setFormCategory((u.category as "cadre" | "ouvrier") || "cadre");
    setFormBadgeNumber(u.badge_number || "");
    setEditing(u);
  };

  const toggleModule = (mod: string) => {
    setFormModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
  };




  const handleToggleBan = async (u: UserRow) => {
    const { data, error } = await invokeEdge({ action: "toggle_ban", user_id: u.user_id, ban: !u.is_banned });
    if (error || !data?.success) {
      toast({ title: "Erreur", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: u.is_banned ? "Compte réactivé ✓" : "Compte désactivé ✓" });
      await logAudit(u.is_banned ? "user_unbanned" : "user_banned", u.user_id, { email: u.email, full_name: u.full_name });
    }
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    const { data, error } = await invokeEdge({ action: "delete_user", user_id: userId });
    if (error || !data?.success) {
      toast({ title: "Erreur", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Collaborateur supprimé ✓" });
      const deletedUser = users.find(u => u.user_id === userId);
      await logAudit("user_deleted", userId, { email: deletedUser?.email, full_name: deletedUser?.full_name });
    }
    setDeleting(null);
    fetchUsers();
  };

  const getDeptName = (id: string | null) => {
    if (!id) return "—";
    const d = departments.find(d => d.id === id);
    return d ? `${d.icon} ${getDepartmentDisplayName(d)}` : id;
  };

  // ── Excel: Template ──
  const COLLAB_HEADERS = ["nom", "email", "departement", "poste", "profil", "n_badge", "manager", "responsable_hierarchique", "role", "modules", "creer_projets", "creer_comites"];

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const examples = [
      { nom: "Jean Dupont", email: "jean@exemple.com", departement: "Direction Technique", poste: "Chef de projet", profil: "cadre", n_badge: "B001", manager: "oui", responsable_hierarchique: "", role: "collaborator", modules: "dashboard;orgchart;projectscomites;timeentry;gantt", creer_projets: "oui", creer_comites: "non" },
      { nom: "Marie Martin", email: "marie@exemple.com", departement: "Direction RH", poste: "Analyste RH", profil: "ouvrier", n_badge: "B002", manager: "non", responsable_hierarchique: "jean@exemple.com", role: "admin", modules: "dashboard;admin;hrperformance;dept_objectives", creer_projets: "", creer_comites: "" },
    ];
    const ws = XLSX.utils.json_to_sheet(examples, { header: COLLAB_HEADERS });
    ws["!cols"] = COLLAB_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 20) }));
    XLSX.utils.book_append_sheet(wb, ws, "Collaborateurs");

    const deptRows = departments.map(d => ({ departement_id: d.id, departement_nom: d.name }));
    if (deptRows.length === 0) {
      deptRows.push({ departement_id: "(aucun)", departement_nom: "" });
    }
    const wsDept = XLSX.utils.json_to_sheet(deptRows);
    wsDept["!cols"] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsDept, "Départements (référence)");

    XLSX.writeFile(wb, "modele_collaborateurs.xlsx");
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const data = users.map(u => {
      const dept = departments.find(d => d.id === u.department_id);
      return {
        nom: u.full_name,
        email: u.email,
        departement: dept ? dept.name : "",
        poste: u.poste || "",
        profil: (u.category || "cadre") === "cadre" ? "cadre" : "ouvrier",
        n_badge: u.badge_number || "",
        manager: u.is_manager ? "oui" : "non",
        responsable_hierarchique: u.hierarchy_user_id ? (users.find(x => x.user_id === u.hierarchy_user_id)?.email || u.hierarchy_user_id) : "",
        role: u.role,
        modules: u.modules.join(";"),
        creer_projets: u.can_create_projects ? "oui" : "non",
        creer_comites: u.can_create_committees ? "oui" : "non",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: COLLAB_HEADERS });
    ws["!cols"] = COLLAB_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 20) }));
    XLSX.utils.book_append_sheet(wb, ws, "Collaborateurs");
    XLSX.writeFile(wb, "export_collaborateurs.xlsx");
    toast({ title: "Export réussi ✓" });
  };

  // ── Excel: Import ──
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileData = await file.arrayBuffer();
    const wb = XLSX.read(fileData);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    if (rows.length === 0) {
      toast({ title: "Fichier vide", variant: "destructive" });
      if (importFileRef.current) importFileRef.current.value = "";
      return;
    }

    const usersToCreate = [];
    const usersToUpdate = [];
    for (const r of rows) {
      const name = String(r["nom"] || "").trim();
      const email = String(r["email"] || "").trim();
      const deptName = String(r["departement"] || r["departement_id"] || "").trim();
      const poste = String(r["poste"] || "").trim();
      const profil = String(r["profil"] || "cadre").trim().toLowerCase();
      const badgeNumber = String(r["n_badge"] || "").trim();
      const isManager = String(r["manager"] || "non").trim().toLowerCase() === "oui";
      const hierarchyRef = String(r["responsable_hierarchique"] || "").trim();
      const role = String(r["role"] || "collaborator").trim().toLowerCase();
      const modules = sanitizePersistedModules(String(r["modules"] || "").trim().split(";").map(m => m.trim()).filter(Boolean));
      const canCreateProjects = String(r["creer_projets"] || "").trim().toLowerCase() === "oui";
      const canCreateCommittees = String(r["creer_comites"] || "").trim().toLowerCase() === "oui";

      const dept = departments.find(d => d.name.toLowerCase() === deptName.toLowerCase());
      const deptId = dept ? dept.id : (deptName || null);

      if (!email || !name) continue;

      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        usersToUpdate.push({ ...existingUser, full_name: name, department_id: deptId, service: null, poste: poste || null, category: profil === "ouvrier" ? "ouvrier" : "cadre", badge_number: badgeNumber || null, is_manager: isManager, hierarchy_ref: hierarchyRef, role, modules, can_create_projects: canCreateProjects, can_create_committees: canCreateCommittees });
      } else {
        usersToCreate.push({ email, full_name: name, department_id: deptId, service: null, poste: poste || null, category: profil === "ouvrier" ? "ouvrier" : "cadre", badge_number: badgeNumber || null, is_manager: isManager, hierarchy_ref: hierarchyRef, role, modules, can_create_projects: canCreateProjects, can_create_committees: canCreateCommittees });
      }
    }

    if (usersToCreate.length === 0 && usersToUpdate.length === 0) {
      toast({ title: "Aucun collaborateur valide", variant: "destructive" });
      if (importFileRef.current) importFileRef.current.value = "";
      return;
    }

    let createdCount = 0;
    let updatedCount = 0;

    if (usersToCreate.length > 0) {
      const { data: importResult } = await invokeEdge({ users: usersToCreate });
      const results = (importResult as { results?: Array<{ success: boolean; user_id?: string; error?: string }> })?.results ?? [];
      for (let i = 0; i < results.length; i++) {
        if (results[i]?.success && results[i]?.user_id) {
          createdCount++;
          const u = usersToCreate[i];
          const allUsers = [...users];
          const hierarchyUserId = u.hierarchy_ref ? (allUsers.find(x => x.email.toLowerCase() === u.hierarchy_ref!.toLowerCase())?.user_id || null) : null;
          await supabase.from("profiles").update({ poste: u.poste, category: u.category, badge_number: u.badge_number, is_manager: u.is_manager, hierarchy_user_id: hierarchyUserId }).eq("user_id", results[i].user_id);
          await supabase.from("user_create_permissions").upsert({ user_id: results[i].user_id, can_create_projects: u.can_create_projects, can_create_committees: u.can_create_committees });
        }
      }
    }

    for (const u of usersToUpdate) {
      const hierarchyUserId = u.hierarchy_ref ? (users.find(x => x.email.toLowerCase() === u.hierarchy_ref.toLowerCase())?.user_id || null) : null;
      await supabase.from("profiles").update({ full_name: u.full_name, department_id: u.department_id, service: u.service, poste: u.poste, category: u.category, badge_number: u.badge_number, is_manager: u.is_manager, hierarchy_user_id: hierarchyUserId }).eq("user_id", u.user_id);
      await supabase.from("user_roles").delete().eq("user_id", u.user_id);
      await supabase.from("user_roles").insert({ user_id: u.user_id, role: u.role as AppRole });
      await supabase.from("user_module_permissions").delete().eq("user_id", u.user_id);
      const filteredModules = sanitizePersistedModules(u.modules);
      if (u.role !== "admin" && filteredModules.length > 0) {
        await supabase.from("user_module_permissions").insert(filteredModules.map(m => ({ user_id: u.user_id, module: m as AppModule })));
      }
      await supabase.from("user_create_permissions").upsert({ user_id: u.user_id, can_create_projects: u.can_create_projects, can_create_committees: u.can_create_committees });
      updatedCount++;
    }

    const parts = [];
    if (createdCount > 0) parts.push(`${createdCount} créé(s)`);
    if (updatedCount > 0) parts.push(`${updatedCount} mis à jour`);
    toast({ title: "Import réussi ✓", description: parts.join(", ") });
    if (importFileRef.current) importFileRef.current.value = "";
    fetchUsers();
  };

  const formContent = (isEdit: boolean) => {
    if (!isFullAdmin) {
      return (
        <div className="space-y-3">
          {!isEdit ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px]">Nom complet</Label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Email</Label>
                  <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px]">Département</Label>
                  <Select value={formDept} onValueChange={setFormDept}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.icon} {d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Poste</Label>
                  <Input value={formPoste} onChange={e => setFormPoste(e.target.value)} className="h-8 text-sm" placeholder="Ex: Chef de projet, Analyste..." />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Salaire mensuel (Fr CFA)</Label>
                <Input type="number" value={formSalary} onChange={e => setFormSalary(e.target.value)} className="h-8 text-sm" placeholder="Ex: 500000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px]">Catégorie</Label>
                  <Select value={formCategory} onValueChange={v => setFormCategory(v as "cadre" | "ouvrier")}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cadre">Cadre</SelectItem>
                      <SelectItem value="ouvrier">Ouvrier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">N° de Badge</Label>
                  <Input value={formBadgeNumber} onChange={e => setFormBadgeNumber(e.target.value)} className="h-8 text-sm" placeholder="Ex: B001" />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Collaborateur</Label>
                <Input value={formName} disabled className="h-8 text-sm bg-muted" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Salaire mensuel (Fr CFA)</Label>
                <Input type="number" value={formSalary} onChange={e => setFormSalary(e.target.value)} className="h-8 text-sm" placeholder="Ex: 500000" />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px]">Nom complet</Label>
          <Input value={formName} onChange={e => setFormName(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Email</Label>
          <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} disabled={isEdit} className="h-8 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px]">Département</Label>
          <Select value={formDept} onValueChange={setFormDept}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Aucune" /></SelectTrigger>
            <SelectContent>
              {departments.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.icon} {d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px]">Poste</Label>
          <Input value={formPoste} onChange={e => setFormPoste(e.target.value)} className="h-8 text-sm" placeholder="Ex: Chef de projet, Analyste..." />
        </div>
        {formIsManager ? (
          <div className="space-y-1">
            <Label className="text-[10px]">Supérieur hiérarchique</Label>
            <Input value={organization.leader || "Directeur Général"} disabled className="h-8 text-sm bg-muted" />
            <p className="text-[9px] text-muted-foreground">Les managers sont rattachés au Directeur Général</p>
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-[10px]">Manager (supérieur hiérarchique)</Label>
            <Select value={formHierarchy} onValueChange={setFormHierarchy}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {users.filter(u => u.user_id !== editing?.user_id && u.is_manager).map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Rôle</Label>
        <Select value={formRole} onValueChange={v => setFormRole(v as AppRole)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrateur (accès complet)</SelectItem>
            <SelectItem value="admin_rapproche">Admin Rapproché (accès sélectif)</SelectItem>
            <SelectItem value="collaborator">Collaborateur (accès limité)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {formRole !== "admin" && (
        <div className="space-y-1.5">
          <Label className="text-[10px]">Modules autorisés</Label>
          <div className="flex flex-wrap gap-2">
            {ALL_MODULES.map(mod => (
              <label key={mod.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={formModules.includes(mod.id)}
                  onCheckedChange={() => toggleModule(mod.id)}
                />
                {mod.label}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Guide d'utilisation toujours disponible pour tous les collaborateurs.
          </p>
        </div>
      )}
      {formRole !== "admin" && formRole !== "admin_rapproche" && (
        <div className="space-y-1.5">
          <Label className="text-[10px]">Droits de création</Label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox checked={formCanCreateProjects} onCheckedChange={(c) => setFormCanCreateProjects(!!c)} />
              Créer des projets
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox checked={formCanCreateCommittees} onCheckedChange={(c) => setFormCanCreateCommittees(!!c)} />
              Créer des comités
            </label>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="space-y-1 flex-1">
          <Label className="text-[10px]">Salaire mensuel (Fr CFA)</Label>
          <Input type="number" value={formSalary} onChange={e => setFormSalary(e.target.value)} className="h-8 text-sm" placeholder="Ex: 500000" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Catégorie</Label>
          <Select value={formCategory} onValueChange={v => setFormCategory(v as "cadre" | "ouvrier")}>
            <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cadre">Cadre</SelectItem>
              <SelectItem value="ouvrier">Ouvrier</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">N° Badge</Label>
          <Input value={formBadgeNumber} onChange={e => setFormBadgeNumber(e.target.value)} className="h-8 text-sm w-[100px]" placeholder="B001" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Manager</Label>
          <div className="flex items-center gap-2 h-8">
            <Checkbox checked={formIsManager} onCheckedChange={(c) => setFormIsManager(!!c)} />
            <span className="text-xs text-muted-foreground">Ce collaborateur est un manager</span>
          </div>
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-xl">Gestion des collaborateurs</h2>
            <p className="text-sm text-muted-foreground">Créer, modifier et gérer les accès</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFullAdmin && (
            <>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={downloadTemplate}>
                <FileSpreadsheet className="w-3.5 h-3.5" /> Modèle
              </Button>
              <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => importFileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> Importer
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" /> Exporter
              </Button>
            </>
          )}
          <Button size="sm" className="text-xs gap-1.5" onClick={() => { resetForm(); setCreating(true); }}>
            <UserPlus className="w-3.5 h-3.5" /> Nouveau collaborateur
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <Select value={filterManager} onValueChange={setFilterManager}>
          <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les collaborateurs</SelectItem>
            <SelectItem value="managers_only">Managers uniquement</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
          <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les départements</SelectItem>
            {departments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous profils</SelectItem>
            <SelectItem value="cadre">Cadre</SelectItem>
            <SelectItem value="ouvrier">Ouvrier</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher un collaborateur..."
            className="h-8 text-xs pl-8"
          />
        </div>
      </div>
      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <Table className={isFullAdmin ? "min-w-[1100px]" : "min-w-[400px]"}>
             <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Nom</TableHead>
                {isFullAdmin && <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Email</TableHead>}
                {isFullAdmin && <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Département</TableHead>}
                {isFullAdmin && <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Poste</TableHead>}
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">Profil</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase">N° Badge</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase text-right sticky right-0 bg-card z-10">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={isFullAdmin ? 6 : 3} className="text-center text-sm text-muted-foreground py-8">Chargement...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={isFullAdmin ? 6 : 3} className="text-center text-sm text-muted-foreground py-8">Aucun collaborateur</TableCell></TableRow>
              ) : users.filter(u => {
                if (filterManager === "managers_only" && !u.is_manager) return false;
                if (filterDepartment !== "all" && u.department_id !== filterDepartment) return false;
                if (filterCategory !== "all" && (u.category || "cadre") !== filterCategory) return false;
                if (searchTerm) {
                  const s = searchTerm.toLowerCase();
                  if (!u.full_name?.toLowerCase().includes(s) && !u.email?.toLowerCase().includes(s)) return false;
                }
                return true;
              }).map(u => {
                return (
                <TableRow key={u.user_id} className={u.is_banned ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${u.is_banned ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                        {u.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{u.full_name || "—"}</span>
                        {u.is_banned && <span className="text-[9px] text-destructive font-medium">Compte désactivé</span>}
                      </div>
                    </div>
                  </TableCell>
                  {isFullAdmin && <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>}
                  {isFullAdmin && (
                  <TableCell className="text-xs">
                    <Select value={u.department_id || "none"} onValueChange={async (v) => {
                      const val = v === "none" ? null : v;
                      await supabase.from("profiles").update({ department_id: val }).eq("user_id", u.user_id);
                      fetchUsers();
                    }}>
                      <SelectTrigger className="h-7 text-[10px] w-[140px]"><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.icon} {d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  )}
                  {isFullAdmin && (
                  <TableCell className="text-xs">
                    <Input
                      value={u.poste || ""}
                      placeholder="Poste..."
                      className="h-7 text-[10px] w-[120px]"
                      onBlur={async (e) => {
                        const val = e.target.value.trim() || null;
                        if (val !== u.poste) {
                          await supabase.from("profiles").update({ poste: val }).eq("user_id", u.user_id);
                          fetchUsers();
                        }
                      }}
                      onChange={(e) => {
                        setUsers(prev => prev.map(x => x.user_id === u.user_id ? { ...x, poste: e.target.value } : x));
                      }}
                    />
                  </TableCell>
                  )}
                  <TableCell className="text-xs">
                    <Select value={u.category || "cadre"} onValueChange={async (v) => {
                      await supabase.from("profiles").update({ category: v }).eq("user_id", u.user_id);
                      fetchUsers();
                    }}>
                      <SelectTrigger className="h-7 text-[10px] w-[100px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cadre">Cadre</SelectItem>
                        <SelectItem value="ouvrier">Ouvrier</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Input
                      value={u.badge_number || ""}
                      placeholder="N° Badge"
                      className="h-7 text-[10px] w-[90px]"
                      onBlur={async (e) => {
                        const val = e.target.value.trim() || null;
                        if (val !== u.badge_number) {
                          await supabase.from("profiles").update({ badge_number: val }).eq("user_id", u.user_id);
                          fetchUsers();
                        }
                      }}
                      onChange={(e) => {
                        setUsers(prev => prev.map(x => x.user_id === u.user_id ? { ...x, badge_number: e.target.value } : x));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right sticky right-0 bg-card z-10">
                    <div className="flex justify-end gap-1">
                      {isFullAdmin && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSendingInvite(u)} title="Renvoyer l'invitation">
                            <Send className="w-3 h-3 text-primary" />
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => openEdit(u)} title="Modifier">
                             <Pencil className="w-3 h-3" /> Modifier
                          </Button>


                          <Button
                            variant={u.is_banned ? "outline" : "ghost"}
                            size="sm"
                            className={`h-7 px-2 gap-1 text-xs ${u.is_banned ? "border-green-500/50 text-green-600 hover:bg-green-50" : "text-orange-500 hover:bg-orange-50"}`}
                            onClick={() => handleToggleBan(u)}
                            title={u.is_banned ? "Réactiver le compte" : "Désactiver le compte"}
                          >
                            {u.is_banned ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                            {u.is_banned ? "Activer" : "Désactiver"}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleting(u.user_id)} title="Supprimer">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      {!isFullAdmin && (
                        <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => openEdit(u)} title="Modifier salaire">
                           <Pencil className="w-3 h-3" /> Salaire
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="w-4 h-4" /> Nouveau collaborateur
            </DialogTitle>
          </DialogHeader>
          {formContent(false)}
          <p className="text-xs text-muted-foreground italic">
            Un email d'invitation sera envoyé automatiquement. Le collaborateur devra cliquer sur le lien pour définir son mot de passe.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setCreating(false)}>Annuler</Button>
            <Button size="sm" className="text-xs gap-1" onClick={handleCreate}>
              <Mail className="w-3 h-3" /> Créer et envoyer l'invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Pencil className="w-4 h-4" /> Modifier {editing?.full_name}
            </DialogTitle>
          </DialogHeader>
          {formContent(true)}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditing(null)}>Annuler</Button>
            <Button size="sm" className="text-xs" onClick={handleEditSave}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>




      {/* Delete dialog */}
      <AlertDialog open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce collaborateur ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible. Le compte utilisateur et toutes ses données seront définitivement supprimés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleting) handleDeleteUser(deleting); }}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send invite dialog */}
      <Dialog open={!!sendingInvite} onOpenChange={o => { if (!o) setSendingInvite(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Send className="w-4 h-4" /> Renvoyer l'invitation
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Un email d'invitation sera renvoyé à <strong>{sendingInvite?.full_name}</strong> ({sendingInvite?.email}).
          </p>
          <p className="text-xs text-muted-foreground italic">
            Le collaborateur recevra un lien pour définir son mot de passe.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setSendingInvite(null)}>Annuler</Button>
            <Button size="sm" className="text-xs gap-1" onClick={handleSendInvite}>
              <Send className="w-3 h-3" /> Envoyer l'invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Log */}
      {isFullAdmin && <AdminUserAuditLog />}
    </div>
  );
};

export default AdminCollaborators;
