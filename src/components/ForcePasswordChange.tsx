import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPasswordUpdateErrorMessage } from "@/lib/authErrorMessages";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff, Check, X } from "lucide-react";
import WelcomeAnimation from "@/components/WelcomeAnimation";

const ForcePasswordChange = () => {
  const { user, setMustChangePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const allValid = hasMinLength && hasLowercase && hasUppercase && hasDigit;

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

    setLoading(true);
    if (!user) {
      toast.error("Session utilisateur introuvable. Merci de vous reconnecter.");
      setLoading(false);
      return;
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ must_change_password: false } as any)
      .eq("user_id", user.id);

    if (profileUpdateError) {
      console.error("Failed to clear must_change_password before password update:", profileUpdateError);
      toast.error("Impossible d'enregistrer le changement de mot de passe. Réessayez.");
      setLoading(false);
      return;
    }

    setMustChangePassword(false);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const { error: rollbackError } = await supabase
        .from("profiles")
        .update({ must_change_password: true } as any)
        .eq("user_id", user.id);

      if (rollbackError) {
        console.error("Failed to restore must_change_password after password update error:", rollbackError);
      }

      setMustChangePassword(true);

      toast.error(getPasswordUpdateErrorMessage(error));
      setLoading(false);
      return;
    }

    toast.success("Mot de passe modifié avec succès");
    setLoading(false);

    // Show welcome animation before granting access
    setShowWelcome(true);
  };

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    setMustChangePassword(false);
  };

  if (showWelcome) {
    return <WelcomeAnimation onComplete={handleWelcomeComplete} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-lg">Définissez votre mot de passe</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Bienvenue ! Veuillez créer votre mot de passe pour accéder à la plateforme.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                <div className="space-y-1 mt-2 text-xs">
                  {[
                    { ok: hasMinLength, label: "Au moins 8 caractères" },
                    { ok: hasLowercase, label: "Au moins une lettre minuscule" },
                    { ok: hasUppercase, label: "Au moins une lettre majuscule" },
                    { ok: hasDigit, label: "Au moins un chiffre" },
                  ].map((rule) => (
                    <div key={rule.label} className="flex items-center gap-1.5">
                      {rule.ok ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-destructive" />
                      )}
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
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Modification..." : "Valider le nouveau mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForcePasswordChange;
