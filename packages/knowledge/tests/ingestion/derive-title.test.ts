import { describe, expect, it } from "vitest";
import { deriveTitle } from "../../src/ingestion/derive-title";

describe("deriveTitle", () => {
  it("extracts the first level-1 Markdown heading", () => {
    const text = "# Qu'est-ce que l'ANSUT ?\n\nContenu du document.";
    expect(deriveTitle(text)).toBe("Qu'est-ce que l'ANSUT ?");
  });

  it("skips leading non-heading lines (e.g. a disclaimer blockquote)", () => {
    const text = "> Contenu fictif de démonstration.\n\n# Contacter l'ANSUT (exemple)\n\nSuite.";
    expect(deriveTitle(text)).toBe("Contacter l'ANSUT (exemple)");
  });

  it("ignores level-2+ headings when no level-1 heading exists", () => {
    const text = "## Sous-titre\n\nContenu sans titre de premier niveau.";
    expect(deriveTitle(text)).toBeUndefined();
  });

  it("returns undefined when no Markdown heading is present", () => {
    expect(deriveTitle("Juste du texte brut, sans titre.")).toBeUndefined();
  });
});
