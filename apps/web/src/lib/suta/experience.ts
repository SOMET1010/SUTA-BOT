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

function firstSummary(results: ExperienceResult[]): string {
  const first = results[0]?.content?.trim();
  if (!first) return "Voici les informations fiables que j'ai trouvees pour vous.";
  return first.length > 260 ? `${first.slice(0, 257).trim()}...` : first;
}

function visualFor(
  pillar: SutaPillar,
  question: string,
  results: ExperienceResult[],
): SutaVisual | null {
  const map = visualFromSearchResults(results);
  if (pillar === "connecter" && map) {
    return {
      ...map,
      status: "connected",
      details: results.slice(0, 3).map((r) => r.title),
      actions: [
        { id: "network-details", label: "Voir les details", prompt: `Donne-moi plus de details sur ${question}` },
        { id: "nearby", label: "Autres localites proches", prompt: "Quelles localites proches sont couvertes ?" },
      ],
    };
  }

  if (pillar === "equiper") {
    return {
      kind: "program",
      title: results[0]?.title || "Dispositifs pour s'equiper",
      pillar: "equiper",
      summary: firstSummary(results),
      benefits: results.slice(0, 3).map((r) => r.title),
      actions: [{ id: "eligibility", label: "Verifier mon eligibilite", prompt: "Suis-je eligible a ce dispositif ?" }],
    };
  }

  if (pillar === "former") {
    return {
      kind: "program",
      title: results[0]?.title || "Formations numeriques",
      pillar: "former",
      summary: firstSummary(results),
      benefits: results.slice(0, 3).map((r) => r.title),
      actions: [{ id: "training-nearby", label: "Trouver une formation", prompt: "Quelle formation est disponible pres de moi ?" }],
    };
  }

  return {
    kind: "info-card",
    eyebrow: "SERVICE PUBLIC",
    title: results[0]?.title || "Ce qu'il faut savoir",
    summary: firstSummary(results),
    facts: results.slice(0, 3).map((r) => ({ label: r.title, value: r.source })),
    actions: [{ id: "next-step", label: "Que dois-je faire ?", prompt: "Quelle est la prochaine demarche a faire ?" }],
  };
}

/**
 * Transforme une question citoyenne et des resultats RAG en scene controlee.
 * Cette couche ne cree aucun fait : elle ne fait que choisir une presentation
 * a partir des informations deja retournees par les outils.
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
