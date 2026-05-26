import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPasswordUpdateErrorMessage } from "@/lib/authErrorMessages";
import { toast } from "sonner";
import { KeyRound, ArrowLeft, Mail, ShieldCheck, Eye, EyeOff, CheckCircle, Check, X } from "lucide-react";

const ResetPasswordPage = () => {
  const { isRecovery, setIsRecovery, setMustChangePassword } = useAuth();

  const hasRecoveryParams = () => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);

    return (
      hashParams.get("type") === "recovery" ||
      searchParams.get("type") === "recovery" ||
      Boolean(hashParams.get("access_token")) ||
      Boolean(searchParams.get("access_token")) ||
      Boolean(searchParams.get("refresh_token")) ||
      Boolean(searchParams.get("token")) ||
      Boolean(searchParams.get("token_hash")) ||
      Boolean(searchParams.get("code"))
    );
  };

  const [step, setStep] = useState<"email" | "sent" | "newpassword">(
    isRecovery || hasRecoveryParams() ? "newpassword" : "email"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isRecovery || hasRecoveryParams()) {
      setStep("newpassword");
      setIsRecovery(true);
    }
  }, [isRecovery, setIsRecovery]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password?type=recovery`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setStep("sent");
    }
    setLoading(false);
  };

  const hasMinLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const allValid = hasMinLength && hasLowercase && hasUppercase && hasDigit;

  const handleChangePassword = async (e: React.FormEvent) => {
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

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      toast.error("Le lien de réinitialisation est invalide ou expiré. Merci de demander un nouvel email d'accès.");
      setIsRecovery(false);
      setStep("email");
      window.history.replaceState({}, "", "/reset-password");
      setLoading(false);
      return;
    }

    const updatedUserId = sessionData.session.user.id;

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ must_change_password: false } as any)
      .eq("user_id", updatedUserId);

    if (profileUpdateError) {
      console.error("Failed to clear must_change_password before password reset:", profileUpdateError);
      toast.error("Impossible d'enregistrer le nouveau mot de passe. Réessayez.");
      setLoading(false);
      return;
    }

    setMustChangePassword(false);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const { error: rollbackError } = await supabase
        .from("profiles")
        .update({ must_change_password: true } as any)
        .eq("user_id", updatedUserId);

      if (rollbackError) {
        console.error("Failed to restore must_change_password after password reset error:", rollbackError);
      }

      setMustChangePassword(true);

      toast.error(getPasswordUpdateErrorMessage(error));
      setLoading(false);
      return;
    } else {
      setMustChangePassword(false);
      toast.success("Mot de passe modifié avec succès. Vous pouvez vous connecter.");
      setIsRecovery(false);
      await supabase.auth.signOut();
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            {step === "newpassword" ? (
              <ShieldCheck className="w-6 h-6 text-primary" />
            ) : step === "sent" ? (
              <CheckCircle className="w-6 h-6 text-primary" />
            ) : (
              <KeyRound className="w-6 h-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-lg">
            {step === "email" && "Mot de passe oublié"}
            {step === "sent" && "Email envoyé"}
            {step === "newpassword" && "Nouveau mot de passe"}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "email" && "Saisissez votre adresse email pour recevoir un lien de réinitialisation."}
            {step === "sent" && "Un email contenant un lien de réinitialisation a été envoyé. Cliquez sur le lien dans l'email pour créer votre nouveau mot de passe."}
            {step === "newpassword" && "Choisissez votre nouveau mot de passe (minimum 8 caractères)."}
          </p>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleSendLink} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Adresse email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Envoi en cours..." : "Envoyer le lien de réinitialisation"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-xs gap-1" onClick={() => window.location.href = "/"}>
                <ArrowLeft className="w-3 h-3" /> Retour à la connexion
              </Button>
            </form>
          )}

          {step === "sent" && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Mail className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Vérifiez votre boîte mail <strong className="text-foreground">({email})</strong> et cliquez sur le lien pour réinitialiser votre mot de passe.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Pensez à vérifier vos spams si vous ne trouvez pas l'email.
                </p>
              </div>
              <Button variant="ghost" className="w-full text-xs" onClick={() => setStep("email")}>
                Renvoyer l'email
              </Button>
              <Button type="button" variant="ghost" className="w-full text-xs gap-1" onClick={() => window.location.href = "/"}>
                <ArrowLeft className="w-3 h-3" /> Retour à la connexion
              </Button>
            </div>
          )}

          {step === "newpassword" && (
            <form onSubmit={handleChangePassword} className="space-y-4">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
