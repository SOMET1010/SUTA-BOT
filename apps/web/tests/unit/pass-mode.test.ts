import { afterEach, describe, expect, it } from "vitest";
import { gardeInstance, modePassActif, modeSuta } from "@/lib/pass/mode";
import { POST as postPass } from "@/app/api/tools/pass/route";
import { POST as postPointConnecte } from "@/app/api/tools/point-connecte/route";
import { POST as postSignalerZone } from "@/app/api/tools/signaler-zone/route";
import { POST as postSearchKnowledge } from "@/app/api/tools/search-knowledge/route";
import { POST as postCockpit } from "@/app/api/tools/cockpit/route";

/**
 * SUTA PASS, lot 1 (17/09) : l'isolation des trois instances.
 *
 * La propriété vérifiée ici n'est pas « PASS fonctionne » mais « PASS ne peut
 * PAS atteindre ce qui n'est pas à lui, et réciproquement ». Elle est testée
 * sur les routes réelles, pas seulement sur la fonction de bascule : c'est la
 * route qui refuse, et c'est donc la route qu'il faut interroger.
 */

const SUTA_MODE_INITIAL = process.env.SUTA_MODE;

afterEach(() => {
  if (SUTA_MODE_INITIAL === undefined) delete process.env.SUTA_MODE;
  else process.env.SUTA_MODE = SUTA_MODE_INITIAL;
});

function requete(corps: unknown): Request {
  return new Request("http://local/api/tools/pass", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps),
  });
}

describe("la bascule à trois voies", () => {
  it("variable absente ou vide = instance citoyenne, comme avant", () => {
    expect(modeSuta({})).toBe("citoyen");
    expect(modeSuta({ SUTA_MODE: "" })).toBe("citoyen");
    expect(modeSuta({ SUTA_MODE: "   " })).toBe("citoyen");
  });

  it("reconnaît les trois modes, casse et espaces indifférents", () => {
    expect(modeSuta({ SUTA_MODE: "pass" })).toBe("pass");
    expect(modeSuta({ SUTA_MODE: " PASS " })).toBe("pass");
    expect(modeSuta({ SUTA_MODE: "Cockpit" })).toBe("cockpit");
    expect(modeSuta({ SUTA_MODE: "citoyen" })).toBe("citoyen");
  });

  it("ÉCHOUE FERMÉ : un mode inconnu n'est pas traité comme citoyen", () => {
    expect(modeSuta({ SUTA_MODE: "pas" })).toBe("inconnu");
    expect(modeSuta({ SUTA_MODE: "cokpit" })).toBe("inconnu");
    expect(modeSuta({ SUTA_MODE: "admin" })).toBe("inconnu");
  });

  it("modePassActif ne dit vrai que pour pass", () => {
    expect(modePassActif({ SUTA_MODE: "pass" })).toBe(true);
    expect(modePassActif({})).toBe(false);
    expect(modePassActif({ SUTA_MODE: "cockpit" })).toBe(false);
    expect(modePassActif({ SUTA_MODE: "pas" })).toBe(false);
  });

  it("la garde laisse passer l'instance attendue et refuse toutes les autres", () => {
    expect(gardeInstance({ SUTA_MODE: "pass" }, "pass")).toBeNull();
    expect(gardeInstance({}, "citoyen")).toBeNull();
    expect(gardeInstance({ SUTA_MODE: "pass" }, "citoyen")?.status).toBe(404);
    expect(gardeInstance({}, "pass")?.status).toBe(404);
    expect(gardeInstance({ SUTA_MODE: "inconnu-quelconque" }, "citoyen")?.status).toBe(404);
  });
});

describe("la route PASS n'existe que sur l'instance PASS", () => {
  it("404 sur l'instance citoyenne — le défaut", async () => {
    delete process.env.SUTA_MODE;
    expect((await postPass(requete({ action: "prendre_photo", entree: {} }))).status).toBe(404);
  });

  it("404 sur l'instance Cockpit", async () => {
    process.env.SUTA_MODE = "cockpit";
    expect((await postPass(requete({ action: "prendre_photo", entree: {} }))).status).toBe(404);
  });

  it("404 sur un mode inconnu", async () => {
    process.env.SUTA_MODE = "pas";
    expect((await postPass(requete({ action: "prendre_photo", entree: {} }))).status).toBe(404);
  });

  it("valide l'action sur l'instance PASS", async () => {
    process.env.SUTA_MODE = "pass";
    const reponse = await postPass(requete({ action: "appeler_contact", entree: { nom: "Awa" } }));
    expect(reponse.status).toBe(200);
    await expect(reponse.json()).resolves.toEqual({
      ok: true,
      action: { nom: "appeler_contact", entree: { nom: "Awa" } },
    });
  });

  it("refuse une action inconnue avec 400, pas 200", async () => {
    process.env.SUTA_MODE = "pass";
    expect((await postPass(requete({ action: "search_knowledge", entree: {} }))).status).toBe(400);
  });

  it("refuse une entrée malformée avec 400", async () => {
    process.env.SUTA_MODE = "pass";
    expect((await postPass(requete({ action: "regler_volume", entree: { sens: "definir" } }))).status).toBe(400);
  });

  it("n'exécute rien : elle rend l'action, jamais un résultat d'exécution", async () => {
    process.env.SUTA_MODE = "pass";
    const donnees = (await (await postPass(requete({ action: "prendre_photo", entree: {} }))).json()) as Record<string, unknown>;
    expect(Object.keys(donnees).sort()).toEqual(["action", "ok"]);
  });
});

describe("isolation réciproque : PASS n'atteint pas les outils des autres", () => {
  const citoyennes: [string, (r: Request) => Promise<Response>][] = [
    ["point-connecte", postPointConnecte],
    ["signaler-zone", postSignalerZone],
    ["search-knowledge", postSearchKnowledge],
  ];

  it.each(citoyennes)("l'outil citoyen %s répond 404 en mode PASS", async (_nom, handler) => {
    process.env.SUTA_MODE = "pass";
    expect((await handler(requete({ localite: "Korhogo", question: "test" }))).status).toBe(404);
  });

  it.each(citoyennes)("l'outil citoyen %s répond 404 en mode Cockpit", async (_nom, handler) => {
    process.env.SUTA_MODE = "cockpit";
    expect((await handler(requete({ localite: "Korhogo", question: "test" }))).status).toBe(404);
  });

  it("l'outil Cockpit répond 404 en mode PASS", async () => {
    process.env.SUTA_MODE = "pass";
    expect((await postCockpit(requete({ acces: "indicateur" }))).status).toBe(404);
  });

  it("les outils citoyens restent atteignables sur l'instance citoyenne", async () => {
    delete process.env.SUTA_MODE;
    // 404 signifierait que la garde a mordu sur l'instance citoyenne : c'est
    // exactement la régression que ce test surveille. Tout autre code (400 sur
    // une entrée incomplète, 503 sans Supabase) prouve que la route s'exécute.
    for (const [, handler] of citoyennes) {
      const reponse = await handler(requete({}));
      expect(reponse.status).not.toBe(404);
    }
  });
});
