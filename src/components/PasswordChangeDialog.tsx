import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPasswordUpdateErrorMessage } from "@/lib/authErrorMessages";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff, Check, X, KeyRound } from "lucide-react";

interface PasswordChangeDialogProps {
  trigger?: React.ReactNode;
}

const PasswordChangeDialog = ({ trigger }: PasswordChangeDialogProps) => {
  const { user, setMustChangePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const allValid = hasMinLength && hasLowercase && hasUppercase && hasDigit;

  const resetForm = () => {
    setPassword("");
    setConfirm("");
    setShowPwd(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) {
      toast.error("Le mot de passe ne respecte pas tous les critères requis");
      return;
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (!user) {
      toast.error("Session utilisateur introuvable. Merci de vous reconnecter.");
      return;
    }

    setLoading(true);

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", user.id);

    if (profileUpdateError) {
      toast.error("Impossible d'enregistrer le changement. Réessayez.");
      setLoading(false);
      return;
    }

    setMustChangePassword(false);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      await supabase.from("profiles").update({ must_change_password: true }).eq("user_id", user.id);
      setMustChangePassword(true);
      toast.error(getPasswordUpdateErrorMessage(error));
      setLoading(false);
      return;
    }

    toast.success("Mot de passe modifié avec succès !");
    setLoading(false);
    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <KeyRound className="w-3.5 h-3.5" />
            Changer mon mot de passe
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="font-display text-base">Changer mon mot de passe</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                className="pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPwd(!showPwd)}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            {password.length > 0 && (
              <div className="space-y-1 mt-2">
                {[
                  { ok: hasMinLength,  label: "Au moins 8 caractères" },
                  { ok: hasLowercase,  label: "Au moins une lettre minuscule" },
                  { ok: hasUppercase,  label: "Au moins une lettre majuscule" },
                  { ok: hasDigit,      label: "Au moins un chiffre" },
                ].map((rule) => (
                  <div key={rule.label} className="flex items-center gap-1.5 text-xs">
                    {rule.ok
                      ? <Check className="w-3.5 h-3.5 text-green-600" />
                      : <X className="w-3.5 h-3.5 text-destructive" />}
                    <span className={rule.ok ? "text-green-600" : "text-destructive"}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Confirmer le mot de passe</Label>
            <Input
              type={showPwd ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Retapez le mot de passe"
              required
            />
            {confirm.length > 0 && password !== confirm && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <X className="w-3 h-3" /> Les mots de passe ne correspondent pas
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { setOpen(false); resetForm(); }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !allValid || password !== confirm}
            >
              {loading ? "Modification..." : "Valider"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordChangeDialog;
