import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Receipt, Tag, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ExpenseType {
  id: string;
  name: string;
  project_id: string;
  created_by: string;
}

interface Expense {
  id: string;
  project_id: string;
  expense_type_id: string | null;
  description: string;
  amount: number;
  expense_date: string;
  created_by: string;
  created_at: string;
  payment_method?: string | null;
  comment?: string | null;
}

interface ProjectExpensesProps {
  projectId: string;
}

const ProjectExpenses = ({ projectId }: ProjectExpensesProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [showNewType, setShowNewType] = useState(false);

  // New expense form
  const [newExpense, setNewExpense] = useState({
    typeId: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "",
    comment: "",
  });

  const fetchData = async () => {
    if (!user) return;
    const [typesRes, expensesRes] = await Promise.all([
      supabase.from("project_expense_types").select("*").eq("project_id", projectId),
      supabase.from("project_expenses").select("*").eq("project_id", projectId).order("expense_date", { ascending: false }),
    ]);
    if (typesRes.data) setExpenseTypes(typesRes.data);
    if (expensesRes.data) setExpenses(expensesRes.data);
  };

  useEffect(() => { fetchData(); }, [projectId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const addType = async () => {
    if (!newTypeName.trim() || !user) return;
    const { error } = await supabase.from("project_expense_types").insert({
      project_id: projectId,
      name: newTypeName.trim(),
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Typologie ajoutée" });
      setNewTypeName("");
      setShowNewType(false);
      fetchData();
    }
  };

  const deleteType = async (id: string) => {
    if (!confirm("Supprimer cette typologie ?")) return;
    await supabase.from("project_expense_types").delete().eq("id", id);
    fetchData();
  };

  const addExpense = async () => {
    if (!user || !newExpense.amount || !newExpense.description.trim()) {
      toast({ title: "Erreur", description: "Remplissez la description et le montant.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("project_expenses").insert({
      project_id: projectId,
      expense_type_id: newExpense.typeId || null,
      description: newExpense.description.trim(),
      amount: parseFloat(newExpense.amount),
      expense_date: newExpense.date,
      created_by: user.id,
      payment_method: newExpense.paymentMethod || null,
      comment: newExpense.comment.trim() || null,
    });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dépense ajoutée ✓" });
      setNewExpense({ typeId: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], paymentMethod: "", comment: "" });
      fetchData();
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Supprimer cette dépense ?")) return;
    await supabase.from("project_expenses").delete().eq("id", id);
    fetchData();
  };

  const getTypeName = (id: string | null) => expenseTypes.find(t => t.id === id)?.name || "—";

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dépenses du projet</h4>
        {totalAmount > 0 && (
          <Badge variant="secondary" className="text-[10px] ml-auto">
            Total : {totalAmount.toLocaleString("fr-FR")} Fr CFA
          </Badge>
        )}
      </div>

      {/* Expense types management */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Typologies de dépenses</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowNewType(true)}>
            <Plus className="w-3 h-3" /> Nouvelle
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {expenseTypes.map(t => (
            <Badge key={t.id} variant="outline" className="text-[10px] gap-1 pr-1">
              {t.name}
              <button onClick={() => deleteType(t.id)} className="ml-0.5 hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
          {expenseTypes.length === 0 && !showNewType && (
            <span className="text-[10px] text-muted-foreground italic">Aucune typologie — créez-en une ci-dessus</span>
          )}
        </div>

        {showNewType && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px]">Nom de la typologie</Label>
              <Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="Ex: Transport, Fournitures..." className="text-xs h-7" onKeyDown={e => e.key === "Enter" && addType()} />
            </div>
            <Button size="sm" className="h-7 text-[10px]" onClick={addType}>Ajouter</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setShowNewType(false); setNewTypeName(""); }}>Annuler</Button>
          </div>
        )}
      </div>

      {/* Add new expense */}
      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nouvelle dépense</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Typologie</Label>
            <Select value={newExpense.typeId} onValueChange={v => setNewExpense(p => ({ ...p, typeId: v }))}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {expenseTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Description *</Label>
            <Input value={newExpense.description} onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))} placeholder="Détail de la dépense" className="text-xs h-7" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Montant (Fr CFA) *</Label>
            <Input type="number" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} placeholder="0" className="text-xs h-7" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Date</Label>
            <Input type="date" value={newExpense.date} onChange={e => setNewExpense(p => ({ ...p, date: e.target.value }))} className="text-xs h-7" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Moyen de paiement</Label>
            <Select value={newExpense.paymentMethod} onValueChange={v => setNewExpense(p => ({ ...p, paymentMethod: v }))}>
              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {["Virement", "Espèces", "Chèque", "Mobile Money", "Carte bancaire", "Autre"].map(m => (
                  <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Commentaire</Label>
            <Input value={newExpense.comment} onChange={e => setNewExpense(p => ({ ...p, comment: e.target.value }))} placeholder="Remarque optionnelle..." className="text-xs h-7" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="h-7 text-[10px] gap-1" onClick={addExpense}>
            <Plus className="w-3 h-3" /> Ajouter la dépense
          </Button>
        </div>
      </div>

      {/* Expenses list */}
      {expenses.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Historique des dépenses</span>
          {expenses.map(e => (
            <div key={e.id} className="bg-card rounded-md px-3 py-2.5 border border-border space-y-1">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground shrink-0">{format(new Date(e.expense_date + "T00:00:00"), "dd/MM/yyyy", { locale: fr })}</span>
                {e.expense_type_id && <Badge variant="outline" className="text-[9px]">{getTypeName(e.expense_type_id)}</Badge>}
                {e.payment_method && <Badge variant="secondary" className="text-[9px]">{e.payment_method}</Badge>}
                <span className="flex-1 truncate font-medium">{e.description}</span>
                <span className="font-bold shrink-0">{Number(e.amount).toLocaleString("fr-FR")} Fr CFA</span>
                <button onClick={() => deleteExpense(e.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {e.comment && (
                <p className="text-[10px] text-muted-foreground pl-0.5 italic">{e.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectExpenses;
