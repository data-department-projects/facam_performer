import { describe, it, expect } from "vitest";
import { getPasswordUpdateErrorMessage } from "@/lib/authErrorMessages";

const SAME_PWD_MSG = "Ce mot de passe a déjà été utilisé. Veuillez choisir un mot de passe différent.";
const INVALID_LINK_MSG = "Le lien de réinitialisation est invalide ou expiré. Merci de demander un nouvel email d'accès.";
const GENERIC_MSG = "Erreur lors de la modification du mot de passe";

describe("getPasswordUpdateErrorMessage", () => {

  // ── Même mot de passe ──────────────────────────────────────
  it("détecte code same_password (insensible à la casse)", () => {
    expect(getPasswordUpdateErrorMessage({ code: "SAME_PASSWORD", message: "" })).toBe(SAME_PWD_MSG);
    expect(getPasswordUpdateErrorMessage({ code: "same_password", message: "" })).toBe(SAME_PWD_MSG);
  });

  it("détecte message contenant 'different from the old password'", () => {
    expect(getPasswordUpdateErrorMessage({
      message: "New password must be different from the old password",
    })).toBe(SAME_PWD_MSG);
  });

  it("détecte message contenant 'same password'", () => {
    expect(getPasswordUpdateErrorMessage({ message: "You already used the same password" })).toBe(SAME_PWD_MSG);
  });

  // ── Session invalide / token expiré ───────────────────────
  it("détecte 'auth session missing'", () => {
    expect(getPasswordUpdateErrorMessage({ message: "auth session missing" })).toBe(INVALID_LINK_MSG);
  });

  it("détecte 'session_not_found'", () => {
    expect(getPasswordUpdateErrorMessage({ message: "session_not_found" })).toBe(INVALID_LINK_MSG);
  });

  it("détecte message contenant 'invalid'", () => {
    expect(getPasswordUpdateErrorMessage({ message: "Token is invalid or has been revoked" })).toBe(INVALID_LINK_MSG);
  });

  it("détecte message contenant 'expired'", () => {
    expect(getPasswordUpdateErrorMessage({ message: "Link expired" })).toBe(INVALID_LINK_MSG);
  });

  it("détecte message contenant 'token'", () => {
    expect(getPasswordUpdateErrorMessage({ message: "Bad token provided" })).toBe(INVALID_LINK_MSG);
  });

  // ── Erreur générique (message brut de Supabase) ───────────
  it("retourne le message brut pour une erreur inconnue", () => {
    expect(getPasswordUpdateErrorMessage({ message: "Unexpected database error" })).toBe("Unexpected database error");
  });

  it("retourne le message générique si message absent", () => {
    expect(getPasswordUpdateErrorMessage({})).toBe(GENERIC_MSG);
  });

  it("retourne le message générique pour null", () => {
    expect(getPasswordUpdateErrorMessage(null)).toBe(GENERIC_MSG);
  });

  it("retourne le message générique pour undefined", () => {
    expect(getPasswordUpdateErrorMessage(undefined)).toBe(GENERIC_MSG);
  });

  it("retourne le message générique si message est une chaîne vide", () => {
    expect(getPasswordUpdateErrorMessage({ message: "" })).toBe(GENERIC_MSG);
  });
});
