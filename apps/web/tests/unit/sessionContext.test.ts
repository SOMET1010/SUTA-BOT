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

  // Contre-audit du 01/09 : « Mon village est connecté ? » mémorisait la
  // localité « connecté », jamais invalidée ensuite — chaque recherche de la
  // session partait avec « Localité déjà donnée : connecté ».
  it("ne prend jamais un état (« connecté », « couvert »…) pour une localité", () => {
    const debut = { ...EMPTY_SUTA_CONTEXT, lastTopics: [] };
    expect(updateSessionContext(debut, "Mon village est connecté ?").locality).toBeUndefined();
    expect(updateSessionContext(debut, "mon village est il connecté").locality).toBeUndefined();
    expect(updateSessionContext(debut, "est-ce que mon village est connecté à la fibre").locality).toBeUndefined();
    expect(updateSessionContext(debut, "ma localité est couverte ?").locality).toBeUndefined();
    expect(updateSessionContext(debut, "je suis bien couvert chez moi ?").locality).toBeUndefined();
  });

  it("capture toujours les vrais noms, y compris composés", () => {
    const debut = { ...EMPTY_SUTA_CONTEXT, lastTopics: [] };
    expect(updateSessionContext(debut, "J'habite à Grand-Bassam.").locality).toBe("Grand-Bassam");
    expect(updateSessionContext(debut, "mon village s'appelle Tieme").locality).toBe("Tieme");
  });

  it("une phrase entière après « je suis » n'est pas un nom de localité", () => {
    const ctx = updateSessionContext(
      { ...EMPTY_SUTA_CONTEXT, lastTopics: [] },
      "je suis venu voir le stand avec mes enfants ce matin",
    );
    expect(ctx.locality).toBeUndefined();
  });

  it("reste vide tant que rien n'est appris (rien n'est réinjecté)", () => {
    expect(contextForModel({ ...EMPTY_SUTA_CONTEXT, lastTopics: [] })).toBe("");
  });
});
