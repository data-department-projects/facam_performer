type AuthLikeError = {
  code?: string;
  message?: string;
  name?: string;
  status?: number;
} | null | undefined;

export const getPasswordUpdateErrorMessage = (error: AuthLikeError) => {
  const code = error?.code?.toLowerCase() ?? "";
  const message = error?.message?.toLowerCase() ?? "";

  if (
    code.includes("same_password") ||
    message.includes("different from the old password") ||
    message.includes("same password")
  ) {
    return "Ce mot de passe a déjà été utilisé. Veuillez choisir un mot de passe différent.";
  }

  if (
    message.includes("auth session missing") ||
    message.includes("session_not_found") ||
    message.includes("invalid") ||
    message.includes("expired") ||
    message.includes("token")
  ) {
    return "Le lien de réinitialisation est invalide ou expiré. Merci de demander un nouvel email d'accès.";
  }

  return error?.message || "Erreur lors de la modification du mot de passe";
};