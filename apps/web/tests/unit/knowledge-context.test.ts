import { describe, expect, it } from "vitest";
import {
  CONSIGNE_INSUFFISANTE,
  CONSIGNE_SYNTHESE,
  composerReponseAvecSuite,
  composerReponseTexte,
  composerSuite,
  enrichirQuestionRecherche,
  estDemandeDeSuite,
  premieresPhrases,
  selectionnerPreuves,
  shapeKnowledgeForModel,
} from "@/lib/realtime/knowledge-context";

/** Fixtures tirées du corpus réel (extraits verbatim de la base). */
const FICHE_DJACE = {
  title: "Localité — DJACE (JACQUEVILLE)",
  content:
    "Village de DJACE, sous-préfecture de JACQUEVILLE, département de JACQUEVILLE, " +
    "région GRANDS-PONTS. Population : 371 habitants. Électrification : OUI. " +
    "Distances aux infrastructures : site 3G le plus proche 613 m.",
  score: 0.611,
};
const FICHE_AUTRE_VILLAGE = {
  title: "Localité — VAPLEU (ZOUAN-HOUNIEN)",
  content: "Village de VAPLEU, sous-préfecture de ZOUAN-HOUNIEN. Population : 500 habitants.",
  score: 0.535,
};
const FICHE_METHODOLOGIQUE = {
  title: "Les localités dont on ne connaît pas la position exacte",
  content:
    "Or 434 localités du recensement, où vivent 316 306 personnes, n'ont pas de " +
    "coordonnées géographiques exploitables. Pour celles-là, la distance ne peut " +
    "pas être calculée. L'ANSUT a choisi de les compter comme non couvertes par précaution.",
  score: 0.62,
};
const FICHE_PASS = {
  title: "Le programme PASS : un smartphone à petit prix",
  content: "Le programme PASS permet d'acheter un smartphone à petit prix.",
  score: 0.6,
};

describe("selectionnerPreuves", () => {
  it("écarte la fiche méthodologique d'une question citoyenne concrète", () => {
    // Bug réel : « mon village est-il connecté ? » répondu par la fiche
    // « 434 localités sans coordonnées GPS ». Hors sujet.
    const preuves = selectionnerPreuves("mon village DJACE est-il connecté ?", {
      results: [FICHE_METHODOLOGIQUE, FICHE_DJACE],
    });
    expect(preuves).toEqual([FICHE_DJACE.content]);
  });

  it("garde la fiche méthodologique quand la question porte sur la méthode", () => {
    const preuves = selectionnerPreuves(
      "comment sont comptées les localités sans coordonnées ?",
      { results: [FICHE_METHODOLOGIQUE] },
    );
    expect(preuves).toEqual([FICHE_METHODOLOGIQUE.content]);
  });

  it("écarte la fiche d'un village que la question ne nomme pas", () => {
    // Sans toponyme, le classement vectoriel renvoie des villages au hasard :
    // décrire VAPLEU à quelqu'un qui n'en a jamais parlé est pire que
    // demander le nom du village.
    const preuves = selectionnerPreuves("mon village est-il connecté ?", {
      results: [FICHE_AUTRE_VILLAGE, FICHE_DJACE],
    });
    expect(preuves).toEqual([]);
  });

  it("garde la fiche du village nommé, dans n'importe quelle casse et accentuation", () => {
    const preuves = selectionnerPreuves("est-ce que Djacé a le réseau ?", {
      results: [FICHE_DJACE, FICHE_AUTRE_VILLAGE],
    });
    expect(preuves).toEqual([FICHE_DJACE.content]);
  });

  it("laisse passer les fiches non géographiques (programmes, démarches)", () => {
    const preuves = selectionnerPreuves("c'est quoi le programme PASS ?", {
      results: [FICHE_PASS],
    });
    expect(preuves).toEqual([FICHE_PASS.content]);
  });

  it("laisse le sujet répondre : une seule fiche de lieu quand le plan existe", () => {
    // Retour de terrain : « où me former à Korhogo ? » recevait trois fiches
    // d'infrastructure et jamais le plan — réponse orientée connectivité.
    const preuves = selectionnerPreuves("où me former au numérique à Korhogo ?", {
      results: [
        { title: "Localité — KORHOGO (KORHOGO)", content: "Couverture de Korhogo.", score: 0.52 },
        { title: "Poste — Korhogo", content: "Bureau de poste de Korhogo.", score: 0.5 },
        { title: "BTS — BTS Korhogo Nord", content: "Antenne BTS de Korhogo.", score: 0.49 },
        { title: "Le programme national d'inclusion numérique", content: "L'ANSUT prévoit un programme d'inclusion numérique.", score: 0.55 },
        { title: "L'école et l'université numériques d'ici 2030", content: "La loi prévoit le numérique à l'école.", score: 0.52 },
      ],
    });
    expect(preuves).toEqual([
      "Couverture de Korhogo.",
      "L'ANSUT prévoit un programme d'inclusion numérique.",
      "La loi prévoit le numérique à l'école.",
    ]);
  });

  it("écarte le bruit vectoriel sous le plancher de score", () => {
    // Audit réel : « qui a gagné le match hier soir ? » remonte des fiches à
    // ~0,23 — aucune ne doit devenir une preuve.
    const preuves = selectionnerPreuves("qui a gagné le match hier soir ?", {
      results: [
        { title: "Synthèse couverture — région GONTOUGO", content: "Synthèse de couverture.", score: 0.233 },
      ],
    });
    expect(preuves).toEqual([]);
  });

  it("traite les fiches « Zone blanche — X » comme des fiches de lieu", () => {
    // Audit réel : « c'est quoi une zone blanche ? » remontait cinq fiches de
    // villages précis — hors sujet pour une définition.
    const preuves = selectionnerPreuves("c'est quoi une zone blanche ?", {
      results: [
        { title: "Zone blanche — WIREDOUO (BOUNKANI)", content: "Village en zone blanche.", score: 0.538 },
      ],
    });
    expect(preuves).toEqual([]);
  });

  it("rend zéro preuve quand un niveau absent du corpus (PTBA) est demandé", () => {
    // Audit du 23/08 (STRAT-PTBA-ABSENT) : aucune fiche PTBA n'existe, mais
    // des voisins vectoriels (~0,45) passaient le plancher — risque de
    // broderie au lieu d'aveu.
    const voisins = [
      { title: "Le très haut débit dans les immeubles", content: "Fiche THD immeubles.", score: 0.455 },
      { title: "Une politique nationale des infrastructures numériques", content: "Fiche politique.", score: 0.429 },
    ];
    expect(selectionnerPreuves("Que prévoit le PTBA sur ce projet ?", { results: voisins })).toEqual([]);
    // Auto-guérison : une vraie fiche PTBA passerait.
    const preuves = selectionnerPreuves("Que prévoit le PTBA sur ce projet ?", {
      results: [{ title: "PTBA 2026 de l'ANSUT — programmation annuelle", content: "Le plan de travail et budget annuel programme…", score: 0.6 }, ...voisins],
    });
    expect(preuves?.[0]).toContain("plan de travail et budget annuel");
  });

  it("rend zéro preuve pour un rapport d'audit interne (jamais public)", () => {
    // STRAT-NIVEAU-ABSENT : des rapports d'activités voisins ne doivent pas
    // être résumés comme un audit interne.
    const preuves = selectionnerPreuves("Que dit le rapport d'audit interne ?", {
      results: [
        { title: "Atelier international SUTEL à Abidjan", content: "L'ANSUT a co-organisé un atelier.", score: 0.45 },
      ],
    });
    expect(preuves).toEqual([]);
  });

  it("plafonne à trois preuves", () => {
    const preuves = selectionnerPreuves("le programme PASS", {
      results: Array.from({ length: 8 }, (_, i) => ({
        title: `Fiche PASS ${i}`,
        content: `Contenu ${i}`,
      })),
    });
    expect(preuves).toHaveLength(3);
  });
});

describe("composerReponseTexte (chemin texte dégradé)", () => {
  // Constat d'écran du 23/08 : la bulle récitait la fiche PTBA brute, coupée
  // en plein mot (« …la connectivité numérique univ… »).
  const FICHE_PTBA_CHAPEAU = {
    title: "PTBA 2026 — le plan de travail annuel de l'ANSUT",
    content:
      "Le PTBA — plan de travail et budget annuel — est le document qui traduit la stratégie de l'ANSUT " +
      "en actions concrètes pour l'année. Le PTBA 2026, dans sa version de travail du 22 juin 2026, " +
      "organise l'année en quatre piliers : la connectivité numérique universelle (le réseau), les " +
      "services numériques et l'inclusion sociale, les usages digitaux, et un pilier interne. " +
      "Chaque action y est suivie par un indicateur précis.",
    score: 0.59,
  };

  it("compose des phrases complètes et propose d'approfondir — jamais de coupure en plein mot", () => {
    const texte = composerReponseTexte("Que prévoit le PTBA 2026 de l'ANSUT ?", {
      results: [FICHE_PTBA_CHAPEAU],
    });
    expect(texte).toContain("plan de travail et budget annuel");
    expect(texte).toMatch(/Je peux vous en dire plus si vous voulez\.$/);
    expect(texte).not.toMatch(/\wuniv…/);
    // Chaque segment se termine proprement (ponctuation), pas en plein mot.
    expect(texte).not.toMatch(/\w…\s/);
  });

  it("reste honnête quand la sélection ne retient aucune preuve", () => {
    const texte = composerReponseTexte("mon village est-il connecté ?", {
      results: [{ title: "Localité — VAPLEU (ZOUAN-HOUNIEN)", content: "Village de VAPLEU.", score: 0.52 }],
    });
    expect(texte).toContain("pas encore d'information fiable");
  });
});

describe("premieresPhrases", () => {
  it("coupe à la frontière de phrase, pas au caractère", () => {
    const texte = "Première phrase. Deuxième phrase un peu plus longue. Troisième phrase.";
    expect(premieresPhrases(texte, 2, 240)).toBe("Première phrase. Deuxième phrase un peu plus longue.");
    expect(premieresPhrases(texte, 2, 20)).toBe("Première phrase.");
  });

  it("replie à la frontière de mot si la première phrase dépasse la limite", () => {
    const longue = "Une très longue phrase sans ponctuation intermédiaire qui déborde largement la limite fixée pour la carte";
    const sortie = premieresPhrases(longue, 2, 60);
    expect(sortie.length).toBeLessThanOrEqual(61);
    expect(sortie.endsWith("…")).toBe(true);
    // Le préfixe gardé s'arrête sur un mot entier : le caractère suivant
    // dans le texte d'origine est un espace, pas le milieu d'un mot.
    const prefixe = sortie.slice(0, -1);
    expect(longue.startsWith(prefixe)).toBe(true);
    expect(longue[prefixe.length]).toBe(" ");
  });
});

describe("shapeKnowledgeForModel", () => {
  it("présente les preuves retenues avec la consigne de synthèse", () => {
    const shaped = shapeKnowledgeForModel(
      { results: [FICHE_DJACE] },
      "mon village DJACE est-il connecté ?",
    ) as { preuves: string[]; consigne: string };
    expect(shaped.preuves).toEqual([FICHE_DJACE.content]);
    expect(shaped.consigne).toContain(CONSIGNE_SYNTHESE);
    expect(shaped.consigne).toContain("ne les récite jamais");
    expect(shaped.consigne).toContain("une à trois phrases");
  });

  it("exige un chiffre quand les preuves en portent", () => {
    // Runs vocaux n°4-5 (V-CONCRET) : deux fois de suite, « ANSUT Academy »
    // cité sans un chiffre alors que deux preuves sur trois en portaient.
    const shaped = shapeKnowledgeForModel(
      { results: [FICHE_DJACE] },
      "mon village DJACE est-il connecté ?",
    ) as { consigne: string };
    // La fiche porte « 371 habitants », « 613 m » : la consigne le dit.
    expect(shaped.consigne).toContain("ta réponse en cite au moins un");
    expect(shaped.consigne).toContain("un exemple nommé ne suffit pas");
  });

  it("n'exige pas de chiffre quand les preuves n'en portent aucun", () => {
    const sansChiffre = {
      title: "Une mission de l'agence",
      content: "L'agence accompagne la transformation des services publics.",
      score: 0.62,
      source: "Corpus ANSUT",
    };
    const shaped = shapeKnowledgeForModel(
      { results: [sansChiffre] },
      "comment l'agence accompagne-t-elle les services publics ?",
    ) as { consigne: string };
    expect(shaped.consigne).toBe(CONSIGNE_SYNTHESE);
  });

  it("dit au modèle qu'il n'a rien plutôt que de lui tendre un texte voisin", () => {
    const shaped = shapeKnowledgeForModel(
      { results: [FICHE_METHODOLOGIQUE, FICHE_AUTRE_VILLAGE] },
      "mon village est-il connecté ?",
    ) as { preuves: string[]; consigne: string };
    expect(shaped.preuves).toEqual([]);
    expect(shaped.consigne).toBe(CONSIGNE_INSUFFISANTE);
    expect(shaped.consigne).toContain("demande-le");
  });

  it("laisse passer les erreurs d'outil telles quelles", () => {
    expect(shapeKnowledgeForModel({ error: "indisponible" }, "peu importe")).toEqual({
      error: "indisponible",
    });
    expect(shapeKnowledgeForModel(null, "")).toBeNull();
  });
});

/** Recette DTDI du 31/08 — fixtures verbatim de la base réelle. */
const FICHE_OPERATEURS_GANGBAPLEU = {
  title: "Opérateurs mobiles — Gangbapleu (Fagnampleu)",
  content: "À Gangbapleu (sous-préfecture de Fagnampleu), la présence des opérateurs mobiles est relevée en mai 2026.",
  score: 0.307,
};
const FICHE_SECTION_RNHD = {
  title: "RNHD — section Nassian-Kafolo",
  content: "La section Nassian-Kafolo fait partie du Réseau National Haut Débit (RNHD).",
  score: 0.714,
};
const FICHE_SYNTHESE_RNHD = {
  title: "Le RNHD en mai 2026 : l'état réel de la dorsale de fibre optique",
  content: "Le Réseau National Haut Débit (RNHD) est la dorsale de fibre optique de l'État de Côte d'Ivoire. Le réseau compte 149 sections recensées.",
  score: 0.736,
};

describe("selectionnerPreuves — recette du 31/08 (F08)", () => {
  it("n'offre jamais une fiche de présence opérateurs à une question qui ne nomme pas la localité", () => {
    // F08 : « quelle est la capitale de la France ? » était « répondue » par
    // la fiche de Gangbapleu, passée à 0,307 de bruit vectoriel.
    const preuves = selectionnerPreuves("Quelle est la capitale de la France ?", {
      results: [FICHE_OPERATEURS_GANGBAPLEU],
    });
    expect(preuves).toEqual([]);
  });

  it("garde la fiche de présence opérateurs quand la localité est nommée", () => {
    const preuves = selectionnerPreuves("quels opérateurs captent à Gangbapleu ?", {
      results: [FICHE_OPERATEURS_GANGBAPLEU],
    });
    expect(preuves).toEqual([FICHE_OPERATEURS_GANGBAPLEU.content]);
  });

  it("écarte une section RNHD précise d'une question générale, garde la synthèse", () => {
    const preuves = selectionnerPreuves("où en est la fibre optique du RNHD ?", {
      results: [FICHE_SYNTHESE_RNHD, FICHE_SECTION_RNHD],
    });
    expect(preuves).toEqual([FICHE_SYNTHESE_RNHD.content]);
  });

  it("garde la fiche de section quand la question nomme le tronçon", () => {
    const preuves = selectionnerPreuves("la fibre passe-t-elle entre Nassian et Kafolo ?", {
      results: [FICHE_SECTION_RNHD],
    });
    expect(preuves).toEqual([FICHE_SECTION_RNHD.content]);
  });
});

describe("enrichirQuestionRecherche — recette du 31/08 (F06)", () => {
  it("complète une question d'équipement vague avec les mots du pilier", () => {
    // F06 : le raccourci répondait, la même question tapée librement non —
    // mesuré sur la base réelle : score de tête 0,29 → 0,65 avec l'enrichi.
    expect(enrichirQuestionRecherche("Comment puis-je m'équiper ?")).toContain("programme PASS");
  });

  it("complète une question de formation", () => {
    expect(enrichirQuestionRecherche("Où puis-je me former ?")).toContain("inclusion numérique");
  });

  it("complète une question de connexion", () => {
    expect(enrichirQuestionRecherche("Mon village est-il connecté ?")).toContain("connectivité des localités");
  });

  it("laisse intacte une question sans pilier reconnu", () => {
    expect(enrichirQuestionRecherche("Quelle est la capitale de la France ?")).toBe("Quelle est la capitale de la France ?");
  });
});

describe("composerReponseTexte — recette du 31/08 (F08)", () => {
  it("dit son périmètre quand il n'a pas compris", () => {
    const reponse = composerReponseTexte("Quelle est la capitale de la France ?", {
      results: [FICHE_OPERATEURS_GANGBAPLEU],
    });
    expect(reponse).toContain("connectivité et le numérique en Côte d'Ivoire");
    expect(reponse).toContain("pas encore d'information fiable");
  });
});

describe("« dis-moi plus » — terrain du 31/08 (perte de fil sur le chemin texte)", () => {
  // Cas réel : « c'est quoi le service universel ? » très bien répondu, puis
  // « dis moi plus » récitait la fiche « Opérateurs mobiles — Meo (Meo) » —
  // la continuation partait en recherche vectorielle sur ces trois mots.
  const FICHE_SERVICE_UNIVERSEL = {
    title: "Ce que veut dire service universel",
    content:
      "Le service universel est le principe selon lequel tout citoyen doit pouvoir accéder aux services " +
      "essentiels de télécommunications, quel que soit l'endroit où il vit, sa situation sociale ou son " +
      "niveau de revenu. Cette définition vient de l'Union internationale des télécommunications et des " +
      "orientations de l'OCDE. En Côte d'Ivoire, c'est l'ANSUT qui est chargée de le mettre en œuvre. " +
      "Elle finance des programmes de couverture des zones rurales et d'inclusion numérique. " +
      "Le fonds du service universel est alimenté par les contributions des opérateurs.",
    score: 0.7,
  };

  it.each([
    "dis-moi plus",
    "dis moi plus",
    "OK DIS PLUS",
    "dis-m'en plus",
    "je veux en savoir plus",
    "oui",
    "continuez",
    "la suite",
  ])("reconnaît la continuation « %s »", (texte) => {
    expect(estDemandeDeSuite(texte)).toBe(true);
  });

  it.each([
    "c'est quoi le service universel ?",
    "il n'y a plus de réseau dans mon village",
    "mon village est-il connecté ?",
    "oui mais à Korhogo ?",
  ])("ne confond pas « %s » avec une continuation", (texte) => {
    expect(estDemandeDeSuite(texte)).toBe(false);
  });

  it("sert d'abord l'essentiel, puis la suite de la MÊME réponse, puis avoue la fin", () => {
    const premiere = composerReponseAvecSuite("c'est quoi le service universel ?", {
      results: [FICHE_SERVICE_UNIVERSEL],
    });
    expect(premiere.comprise).toBe(true);
    expect(premiere.texte).toContain("Le service universel est le principe");
    expect(premiere.texte).toContain("Je peux vous en dire plus si vous voulez.");
    expect(premiere.suite.length).toBeGreaterThan(0);

    const deuxieme = composerSuite(premiere.suite);
    expect(deuxieme.texte).toContain("ANSUT");
    // La suite reste sur le sujet : jamais un village au hasard.
    expect(deuxieme.texte).not.toContain("Meo");

    // On épuise la matière : le dernier service avoue la fin sans relancer.
    let etat = deuxieme;
    for (let i = 0; i < 10 && etat.suite.length > 0; i += 1) etat = composerSuite(etat.suite);
    const fin = composerSuite(etat.suite);
    expect(fin.texte).toContain("l'essentiel de ce que j'ai sur ce sujet");
    expect(fin.suite).toEqual([]);
  });

  it("rend comprise=false et une suite vide quand rien n'a été retenu", () => {
    const reponse = composerReponseAvecSuite("Quelle est la capitale de la France ?", {
      results: [FICHE_OPERATEURS_GANGBAPLEU],
    });
    expect(reponse.comprise).toBe(false);
    expect(reponse.suite).toEqual([]);
  });
});

describe("enrichirQuestionRecherche — recette v3 du 31/08 (C05/C06/C07)", () => {
  it("réécrit « eGOUV » en « e-gouv » et glose le programme", () => {
    // Mesuré sur la base réelle : « eGOUV » d'un seul tenant tombe dans le
    // cluster des villages en « GOU- » ; « e-gouv » remonte les fiches eGOUV.
    const enrichie = enrichirQuestionRecherche("À quoi sert eGOUV ?");
    expect(enrichie).toContain("e-gouv");
    expect(enrichie).toContain("gouvernance électronique");
    expect(enrichie).not.toMatch(/\begouv\b/i);
  });

  it("glose le RNHD avec la dorsale nationale", () => {
    expect(enrichirQuestionRecherche("Combien de sections compte le RNHD ?")).toContain("Réseau National Haut Débit");
  });

  it("glose la présence des opérateurs mobiles", () => {
    expect(enrichirQuestionRecherche("Quels opérateurs sont présents dans mon village ?")).toContain("localité par localité");
  });
});
