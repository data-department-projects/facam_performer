import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Tests de l'utilitaire cn() — fusion de classes Tailwind CSS
// ─────────────────────────────────────────────────────────────
describe("cn — utilitaire de fusion de classes Tailwind", () => {

  it("fusionne plusieurs classes simples", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignore les valeurs false", () => {
    // eslint-disable-next-line no-constant-binary-expression
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  it("ignore undefined et null", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(cn("foo", undefined, null as any, "bar")).toBe("foo bar");
  });

  it("résout les conflits Tailwind — la dernière classe gagne", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("mt-2 mb-2", "my-4")).toBe("my-4");
    expect(cn("px-2", "px-6")).toBe("px-6");
  });

  it("prend en charge les tableaux de classes", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });

  it("prend en charge les objets conditionnels", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("gère les entrées mixtes (string, objet, tableau)", () => {
    expect(cn("base", { active: true, disabled: false }, ["extra"])).toBe(
      "base active extra"
    );
  });

  it("retourne une chaîne vide sans argument", () => {
    expect(cn()).toBe("");
  });

  it("résout les conflits sur les classes responsives Tailwind", () => {
    expect(cn("sm:text-sm", "sm:text-lg")).toBe("sm:text-lg");
    expect(cn("lg:p-2", "lg:p-8")).toBe("lg:p-8");
  });

  it("gère les classes avec modificateurs Tailwind", () => {
    expect(cn("hover:text-red-500", "hover:text-blue-500")).toBe(
      "hover:text-blue-500"
    );
    expect(cn("dark:bg-gray-800", "dark:bg-gray-900")).toBe("dark:bg-gray-900");
  });
});
