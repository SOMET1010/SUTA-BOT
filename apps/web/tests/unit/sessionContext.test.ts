import { describe, expect, it } from "vitest";
import { EMPTY_SUTA_CONTEXT, contextForModel, updateSessionContext, type SutaSessionContext } from "@/lib/suta/sessionContext";

/**
 * Scénario conversationnel de référence (5 tours) : c'est la partie
 * déterministe de la mémoire de session — ce que SUTA « sait » de la personne
 * au fil des tours, et ce qui serait réinjecté au modèle après une
 * reconnexion. La qualité des réponses parlées se vérifie sur la session
 * vocale réelle ; ceci garantit que la mémoire, elle, ne perd rien.
 */
describe("sessionContext — scénario Korhogo (5 tours)", () => {
  it("accumule localité, personne, équipement et sujets sans les perdre", () => {
    let ctx: SutaSessionContext = { ...EMPTY_SUTA_CONTEXT, lastTopics: [] };

    ctx = updateSessionContext(ctx, "Je suis à Korhogo.");
    expect(ctx.locality).toBe("Korhogo");

    ctx = updateSessionContext(ctx, "C'est pour ma mère.");
    expect(ctx.person).toBe("sa mère");
    expect(ctx.locality).toBe("Korhogo");

    ctx = updateSessionContext(ctx, "Elle a déjà un smartphone.");
    expect(ctx.device).toBe("smartphone");

    ctx = updateSessionContext(ctx, "Elle peut se former ?");
    expect(ctx.lastTopics).toContain("former");

    // Tour 5 — interruption puis reprise : l'interruption ne passe pas par la
    // mémoire, mais la reprise réinjecte ce contexte. Il doit tout porter.
    const injected = contextForModel(ctx);
    expect(injected).toContain("Korhogo");
    expect(injected).toContain("sa mère");
    expect(injected).toContain("smartphone");
    expect(injected).toContain("former");
  });

  it("ne prend pas un mot capitalisé après « a » pour une localité", () => {
    const ctx = updateSessionContext({ ...EMPTY_SUTA_CONTEXT, lastTopics: [] }, "On a WhatsApp au village.");
    expect(ctx.locality).toBeUndefined();
  });

  it("reste vide tant que rien n'est appris (rien n'est réinjecté)", () => {
    expect(contextForModel({ ...EMPTY_SUTA_CONTEXT, lastTopics: [] })).toBe("");
  });
});
