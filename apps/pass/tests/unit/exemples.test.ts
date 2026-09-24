import { describe, expect, it } from "vitest";
import { resoudreAction, type IntentionPass } from "@suta/pass";
import { EXEMPLES } from "@/lib/exemples";

/**
 * Les exemples de l'écran technique sont ce qu'un locuteur va réellement
 * essayer sur un téléphone. Un bouton qui ne route pas ne teste rien et fait
 * passer une hypothèse linguistique correcte pour fausse : ces tests
 * garantissent que chaque exemple atteint bien l'intention annoncée.
 *
 * Ils ne disent RIEN de la justesse du dioula proposé — seul un locuteur natif
 * peut en juger. Ils disent que le code fait ce que le bouton promet.
 */

const ATTENDU_DYU: ReadonlyArray<readonly [string, IntentionPass, string?]> = [
  ["Awa wele", "appeler_contact", "awa"],
  ["WhatsApp yele", "ouvrir_application", "whatsapp"],
  ["mankan bonya", "regler_volume", "monter"],
  ["mankan dɔgɔya", "regler_volume", "baisser"],
  ["foto ta", "prendre_photo"],
  ["n dɛmɛ", "assistance", "aide"],
  ["segin kokura", "assistance", "repeter"],
  ["dabila", "assistance", "arreter"],
];

describe("exemples dioula de l'écran technique", () => {
  it("la liste de l'écran est exactement celle qui est éprouvée ici", () => {
    expect([...EXEMPLES.dyu]).toEqual(ATTENDU_DYU.map(([commande]) => commande));
  });

  for (const [commande, intention, cible] of ATTENDU_DYU) {
    it(`« ${commande} » → ${intention}${cible ? ` (${cible})` : ""}`, () => {
      const resolution = resoudreAction(commande, "dyu");
      expect(resolution.statut).toBe("prete");
      expect(resolution.intention).toBe(intention);
      if (cible && resolution.statut === "prete") {
        expect(JSON.stringify(resolution.action.entree)).toContain(cible);
      }
    });
  }

  it("aucun exemple dioula n'est refusé comme hors périmètre", () => {
    for (const commande of EXEMPLES.dyu) {
      expect(resoudreAction(commande, "dyu").intention).not.toBe("hors_perimetre");
    }
  });
});

describe("exemples français", () => {
  it("« quel temps fait-il » reste refusé : le périmètre PASS ne s'élargit pas", () => {
    expect(resoudreAction("quel temps fait-il", "fr").intention).toBe("hors_perimetre");
    // et il l'est aussi en session dioula, où les motifs français s'appliquent
    expect(resoudreAction("quel temps fait-il", "dyu").intention).toBe("hors_perimetre");
  });

  it("les six autres exemples français routent tous", () => {
    for (const commande of EXEMPLES.fr.filter((e) => e !== "quel temps fait-il")) {
      expect(resoudreAction(commande, "fr").intention).not.toBe("hors_perimetre");
    }
  });
});
