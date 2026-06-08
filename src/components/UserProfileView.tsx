import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPasswordUpdateErrorMessage } from "@/lib/authErrorMessages";
import { toast } from "sonner";
import {
  User, Mail, Building2, Briefcase, ShieldCheck,
  Eye, EyeOff, Check, X, KeyRound,
} from "lucide-react";

const UserProfileView = () => {
  const { user, profile, setMustChangePassword } = useAuth();
  const { departments } = useDepartments();

  /* ── Password form state ── */
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);

  /* ── Validation rules ── */
  const hasMinLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit     = /[0-9]/.test(password);
  const allValid     = hasMinLength && hasLowercase && hasUppercase && hasDigit;
  const passwordsMatch = password === confirm;

  const canSubmit = allValid && passwordsMatch && confirm.length > 0;

  /* ── Department name ── */
  const departmentName = useMemo(() => {
    if (!profile?.department_id) return null;
    const dept = departments.find(d => d.id === profile.department_id);
    return dept ? `${dept.icon} ${dept.name}` : null;
  }, [profile?.department_id, departments]);

  /* ── Avatar initials ── */
  const initials = (profile?.full_name || profile?.email || "?")
    .trim().split(/\s+/).map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2);

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;

    setLoading(true);

    // Clear the flag first
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("user_id", user.id);

    if (profileErr) {
      toast.error("Impossible d'enregistrer le changement. Réessayez.");
      setLoading(false);
      return;
    }

    setMustChangePassword(false);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      // Rollback the flag
      await supabase.from("profiles").update({ must_change_password: true }).eq("user_id", user.id);
      setMustChangePassword(true);
      toast.error(getPasswordUpdateErrorMessage(error));
      setLoading(false);
      return;
    }

    toast.success("Mot de passe modifié avec succès !");
    setPassword("");
    setConfirm("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Profile info ── */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Informations du compte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
              <span className="text-white font-display font-bold text-xl">{initials}</span>
            </div>

            {/* Fields */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/30">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9.5px] uppercase tracking-wider font-semibold text-muted-foreground">Nom complet</p>
                  <p className="text-[12px] font-medium text-secondary truncate">{profile?.full_name || "—"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/30">
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9.5px] uppercase tracking-wider font-semibold text-muted-foreground">Adresse e-mail</p>
                  <p className="text-[12px] font-medium text-secondary truncate">{profile?.email || user?.email || "—"}</p>
                </div>
              </div>

              {departmentName && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9.5px] uppercase tracking-wider font-semibold text-muted-foreground">Département</p>
                    <p className="text-[12px] font-medium text-secondary truncate">{departmentName}</p>
                  </div>
                </div>
              )}

              {(profile as unknown as { poste?: string })?.poste && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9.5px] uppercase tracking-wider font-semibold text-muted-foreground">Poste</p>
                    <p className="text-[12px] font-medium text-secondary truncate">
                      {(profile as unknown as { poste?: string }).poste}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Password change ── */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            Changer mon mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
              <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Mot de passe modifié avec succès</p>
                <p className="text-xs text-green-600 mt-0.5">Votre nouveau mot de passe est actif immédiatement.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-sm">
              {/* New password */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPwd(v => !v)}
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength indicators */}
                {password.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {[
                      { ok: hasMinLength, label: "Au moins 8 caractères" },
                      { ok: hasLowercase, label: "Au moins une minuscule" },
                      { ok: hasUppercase, label: "Au moins une majuscule" },
                      { ok: hasDigit,     label: "Au moins un chiffre" },
                    ].map(rule => (
                      <div key={rule.label} className="flex items-center gap-1.5 text-xs">
                        {rule.ok
                          ? <Check className="w-3.5 h-3.5 text-green-600" />
                          : <X className="w-3.5 h-3.5 text-destructive" />}
                        <span className={rule.ok ? "text-green-600" : "text-muted-foreground"}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Confirmer le mot de passe</Label>
                <Input
                  type={showPwd ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Retapez le mot de passe"
                  autoComplete="new-password"
                  className={confirm.length > 0 && !passwordsMatch ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {confirm.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="w-3 h-3" /> Les mots de passe ne correspondent pas
                  </p>
                )}
                {confirm.length > 0 && passwordsMatch && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Les mots de passe correspondent
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={!canSubmit || loading}
                className="w-full"
              >
                {loading ? "Modification en cours…" : "Enregistrer le nouveau mot de passe"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserProfileView;
