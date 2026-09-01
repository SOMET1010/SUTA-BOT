import { premieresPhrases } from "@/lib/realtime/knowledge-context";
import { sceneForVisual, type SutaEmotion, type SutaScene } from "./scene";
import { visualFromSearchResults, type SutaVisual, type VisualPoint } from "./visuals";

interface ExperienceResult {
  title: string;
  content: string;
  source: string;
  score: number;
  location?: VisualPoint;
}

export type SutaPillar = "connecter" | "equiper" | "former" | "service-public";

export interface ExperienceDecision {
  pillar: SutaPillar;
  scene: SutaScene;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function pillarFor(question: string, results: ExperienceResult[]): SutaPillar {
  const text = normalize(`${question} ${results.map((r) => `${r.title} ${r.content}`).join(" ")}`);

  if (
    hasAny(text, [
      "reseau",
      "couverture",
      "connecte",
      "connexion",
      "fibre",
      "antenne",
      "internet",
      "4g",
      "5g",
      "localite",
      "village",
    ])
  ) {
    return "connecter";
  }

  if (
    hasAny(text, [
      "equipement",
      "equiper",
      "telephone",
      "smartphone",
      "terminal",
      "ordinateur",
      "tablette",
      "subvention",
      "pass",
    ])
  ) {
    return "equiper";
  }

  if (
    hasAny(text, [
      "formation",
      "former",
      "competence",
      "apprendre",
      "initiation",
      "emploi",
      "numerique",
      "certification",
    ])
  ) {
    return "former";
  }

  return "service-public";
}

function emotionFor(pillar: SutaPillar, results: ExperienceResult[]): SutaEmotion {
  const text = normalize(results.map((r) => r.content).join(" "));
  if (hasAny(text, ["indisponible", "panne", "incident", "interruption", "non couvert", "alerte"])) {
    return "alert";
  }
  if (hasAny(text, ["disponible", "eligible", "connecte", "ouvert", "gratuit", "beneficie"])) {
    return "celebrating";
  }
  if (pillar === "service-public") return "reassuring";
  return "explaining";
}

/**
 * Constat d'écran du 23/08 : la carte affichait le contenu brut de la fiche,
 * coupé en plein mot (« univ… ») — un moteur documentaire, pas un assistant.
 * La carte illustre : deux phrases COMPLÈTES au maximum, jamais de coupure
 * en plein mot. L'essentiel reste porté par la voix ou la bulle.
 */
function firstSummary(results: ExperienceResult[]): string {
  const first = results[0]?.content?.trim();
  if (!first) return "Voici les informations fiables que j'ai trouvées pour vous.";
  return premieresPhrases(first, 2, 300);
}

function visualFor(
  pillar: SutaPillar,
  question: string,
  results: ExperienceResult[],
): SutaVisual | null {
  const map = visualFromSearchResults(results);
  if (pillar === "connecter" && map) {
    // Recette v3 du 31/08 (C09) : le bouton « localités proches » envoyait
    // une requête sans nom de lieu — après Yamoussoukro, la recherche
    // partait au hasard dans la région Béré. L'action est ancrée à la
    // localité affichée sur la carte ; sans localité connue, pas de bouton.
    const lieu = map.points[0]?.label;
    return {
      ...map,
      status: "connected",
      details: results.slice(0, 3).map((r) => r.title),
      actions: [
        { id: "network-details", label: "Voir les détails", prompt: `Donne-moi plus de détails sur ${question}` },
        ...(lieu
          ? [{ id: "nearby", label: "Autres localités proches", prompt: `Quelles localités proches de ${lieu} sont couvertes ?` }]
          : []),
      ],
    };
  }

  // Terrain du 01/09 : « Quelle est la prochaine démarche à faire ? » (le
  // bouton suggéré, envoyé SANS contexte) partait en recherche sur ces mots
  // seuls et servait le workshop PwC. Même famille que « localités proches »
  // (C09) : chaque bouton d'action porte désormais le sujet en cours — le
  // titre de la fiche de tête, que la recherche retrouve à coup sûr.
  if (pillar === "equiper") {
    const sujet = results[0]?.title || "ce dispositif";
    return {
      kind: "program",
      title: results[0]?.title || "Dispositifs pour s'équiper",
      pillar: "equiper",
      summary: firstSummary(results),
      benefits: results.slice(0, 3).map((r) => r.title),
      actions: [{ id: "eligibility", label: "Vérifier mon éligibilité", prompt: `Qui peut bénéficier de « ${sujet} » et à quelles conditions ?` }],
    };
  }

  if (pillar === "former") {
    const sujet = results[0]?.title || "les formations au numérique";
    return {
      kind: "program",
      title: results[0]?.title || "Formations numériques",
      pillar: "former",
      summary: firstSummary(results),
      benefits: results.slice(0, 3).map((r) => r.title),
      actions: [{ id: "training-nearby", label: "Trouver une formation", prompt: `Comment participer concrètement à « ${sujet} » ?` }],
    };
  }

  return {
    kind: "info-card",
    eyebrow: "SERVICE PUBLIC",
    title: results[0]?.title || "Ce qu'il faut savoir",
    summary: firstSummary(results),
    // La fiche de tête est déjà le titre de la carte : les preuves discrètes
    // sont les suivantes, pas sa répétition. « Corpus ANSUT » répété en gras
    // sous chaque preuve était un label technique sans valeur citoyenne — la
    // valeur n'est affichée que quand elle apporte quelque chose (une région).
    facts: results.slice(1, 4).map((r) => ({ label: r.title, value: r.source === "Corpus ANSUT" ? "" : r.source })),
    actions: [{ id: "next-step", label: "Que dois-je faire ?", prompt: `Concrètement, que peut faire un citoyen concernant « ${results[0]?.title ?? question} » ?` }],
  };
}

/**
 * Transforme une question citoyenne et des résultats RAG en scène contrôlée.
 * Cette couche ne crée aucun fait : elle ne fait que choisir une présentation
 * à partir des informations déjà retournées par les outils.
 */
export function experienceFromKnowledge(
  question: string,
  results: ExperienceResult[],
): ExperienceDecision {
  const pillar = pillarFor(question, results);
  const visual = visualFor(pillar, question, results);
  return {
    pillar,
    scene: sceneForVisual(visual, emotionFor(pillar, results)),
  };
}
