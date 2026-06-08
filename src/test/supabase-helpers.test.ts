import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";

// Doit être avant les imports du module sous test (hoisting)
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { handleError, withToast, withErrorToast } from "@/lib/supabase-helpers";
import { toast } from "sonner";

// Supprime les console.error intentionnels de handleError (isDev=true en test)
beforeAll(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterAll(() => vi.restoreAllMocks());

// Stub minimal d'une PostgrestError
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pgError = (msg: string): any => ({
  message: msg,
  code: "42P01",
  details: "",
  hint: "",
  name: "PostgrestError",
});

// ─────────────────────────────────────────────────────────────
// handleError
// ─────────────────────────────────────────────────────────────
describe("handleError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne false et ne déclenche aucun toast si erreur est null", () => {
    expect(handleError(null, "msg")).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("retourne false et ne déclenche aucun toast si erreur est undefined", () => {
    expect(handleError(undefined, "msg")).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("retourne true et appelle toast.error avec le message fourni", () => {
    expect(handleError(new Error("boom"), "Erreur serveur")).toBe(true);
    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith("Erreur serveur");
  });

  it("retourne true pour une PostgrestError", () => {
    expect(handleError(pgError("relation does not exist"), "Accès refusé")).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("Accès refusé");
  });
});

// ─────────────────────────────────────────────────────────────
// withToast
// ─────────────────────────────────────────────────────────────
describe("withToast", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne la data et affiche toast.success en cas de succès", async () => {
    const data = { id: "abc", name: "FACAM" };
    const result = await withToast(
      Promise.resolve({ data, error: null }),
      { success: "Enregistré", error: "Échec" }
    );
    expect(result).toEqual(data);
    expect(toast.success).toHaveBeenCalledWith("Enregistré");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("retourne null et affiche toast.error en cas d'erreur", async () => {
    const result = await withToast(
      Promise.resolve({ data: null, error: pgError("insert failed") }),
      { success: "Enregistré", error: "Impossible d'enregistrer" }
    );
    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Impossible d'enregistrer");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("retourne null si data est null et pas d'erreur (edge case)", async () => {
    const result = await withToast(
      Promise.resolve({ data: null, error: null }),
      { success: "OK", error: "Erreur" }
    );
    expect(result).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("OK");
  });
});

// ─────────────────────────────────────────────────────────────
// withErrorToast
// ─────────────────────────────────────────────────────────────
describe("withErrorToast", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne la data sans toast en cas de succès", async () => {
    const data = [{ id: "1" }, { id: "2" }];
    const result = await withErrorToast(
      Promise.resolve({ data, error: null }),
      "Erreur de chargement"
    );
    expect(result).toEqual(data);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("retourne null et affiche toast.error en cas d'erreur", async () => {
    const result = await withErrorToast(
      Promise.resolve({ data: null, error: pgError("not found") }),
      "Ressource introuvable"
    );
    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Ressource introuvable");
  });

  it("retourne null sans toast succès si data est null", async () => {
    const result = await withErrorToast(
      Promise.resolve({ data: null, error: null }),
      "Erreur"
    );
    expect(result).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
